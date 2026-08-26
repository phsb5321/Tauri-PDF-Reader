import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ReadingSession,
  SessionRestoreResponse,
} from "../domain/sessions/session";
import {
  onNativeFileDrop,
  type NativeFileDropEvent,
} from "../lib/api/file-drop";
import type { Document } from "../lib/schemas";

const SESSION_NAME_MAX_BYTES = 100;

export interface PdfDropStatus {
  kind: "success";
  message: string;
}

interface UsePdfDropSessionOptions {
  openDroppedPdf: (filePath: string) => Promise<Document | null>;
  createSession: (
    name: string,
    documentIds: string[],
  ) => Promise<ReadingSession>;
  restoreSession: (sessionId: string) => Promise<SessionRestoreResponse>;
  deleteSession: (sessionId: string) => Promise<void>;
  onSessionCreated: (document: Document, session: ReadingSession) => void;
  onError: (message: string) => void;
}

function basenameWithoutPdf(filePath: string): string {
  const filename = filePath.split(/[\\/]/).pop() ?? "";
  return filename.replace(/\.pdf$/i, "").trim();
}

/** Rust validates session names by UTF-8 byte length, not UTF-16 code units. */
export function droppedSessionName(document: Document): string {
  const candidate =
    document.title?.trim() ||
    basenameWithoutPdf(document.filePath) ||
    "Reading session";
  const encoder = new TextEncoder();
  let result = "";
  for (const character of candidate) {
    if (
      encoder.encode(result + character).byteLength > SESSION_NAME_MAX_BYTES
    ) {
      break;
    }
    result += character;
  }
  return result || "Reading session";
}

export function usePdfDropSession({
  openDroppedPdf,
  createSession,
  restoreSession,
  deleteSession,
  onSessionCreated,
  onError,
}: UsePdfDropSessionOptions) {
  const [isDragActive, setIsDragActive] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [status, setStatus] = useState<PdfDropStatus | null>(null);
  const inFlightRef = useRef(false);

  const handleDrop = useCallback(
    async (paths: string[]) => {
      setIsDragActive(false);
      if (inFlightRef.current) {
        onError("DROP_BUSY: Wait for the current PDF session to finish.");
        return;
      }

      if (paths.length !== 1 || !/\.pdf$/i.test(paths[0] ?? "")) {
        onError(
          "DROP_INVALID: Drop exactly one PDF to create a reading session.",
        );
        return;
      }

      inFlightRef.current = true;
      setIsImporting(true);
      setStatus(null);
      let createdSession: ReadingSession | null = null;
      try {
        const document = await openDroppedPdf(paths[0]);
        if (!document) return;

        const name = droppedSessionName(document);
        const session = await createSession(name, [document.id]);
        createdSession = session;
        await restoreSession(session.id);
        onSessionCreated(document, session);
        setStatus({ kind: "success", message: `Session “${name}” created` });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        let rollback = "";
        if (createdSession) {
          try {
            await deleteSession(createdSession.id);
          } catch (cleanupError: unknown) {
            const cleanupMessage =
              cleanupError instanceof Error
                ? cleanupError.message
                : String(cleanupError);
            rollback = ` Session cleanup also failed: ${cleanupMessage}`;
          }
        }
        onError(`DROP_FAILED: ${message}${rollback}`);
      } finally {
        inFlightRef.current = false;
        setIsImporting(false);
      }
    },
    [
      createSession,
      deleteSession,
      onError,
      onSessionCreated,
      openDroppedPdf,
      restoreSession,
    ],
  );

  const handleNativeEvent = useCallback(
    (event: NativeFileDropEvent) => {
      switch (event.type) {
        case "enter":
          setIsDragActive(true);
          break;
        case "leave":
          setIsDragActive(false);
          break;
        case "drop":
          void handleDrop(event.paths);
          break;
        case "over":
          break;
      }
    },
    [handleDrop],
  );

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;

    void onNativeFileDrop(handleNativeEvent)
      .then((stop) => {
        if (disposed) stop();
        else unlisten = stop;
      })
      .catch((error: unknown) => {
        // Browser-only development has no native webview. Opening by dialog
        // remains available, so absence of this enhancement is diagnostic,
        // not a full-screen user error.
        console.warn("Native PDF drop listener unavailable:", error);
      });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [handleNativeEvent]);

  return {
    isDragActive,
    isImporting,
    status,
    dismissStatus: () => setStatus(null),
  };
}
