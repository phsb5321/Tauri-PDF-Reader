import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ReadingSession,
  SessionRestoreResponse,
} from "../domain/sessions/session";
import {
  onNativeFileDrop,
  type NativeFileDropEvent,
} from "../lib/api/file-drop";
import { beginOpenTransaction } from "../stores/document-store";
import type { Document } from "../lib/schemas";
import type { DroppedPreparation } from "./useOpenPdf";

const SESSION_NAME_MAX_BYTES = 100;

function isDroppedPreparation(
  value: Document | DroppedPreparation,
): value is DroppedPreparation {
  return "commit" in value;
}

export interface PdfDropStatus {
  kind: "success";
  message: string;
}

interface UsePdfDropSessionOptions {
  openDroppedPdf: (
    filePath: string,
    options?: { leaseHeldByCaller?: boolean; deferCommit?: boolean },
  ) => Promise<Document | DroppedPreparation | null>;
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

      // Issue #185: ONE lease held from import start through session
      // activation. Releasing it between the import and the session steps
      // let a rapid second public action interleave and reopen the wrong
      // document under this transaction's session.
      const releaseLease = beginOpenTransaction();
      if (!releaseLease) {
        onError("OPEN_BUSY: Wait for the current PDF to finish opening.");
        return;
      }

      inFlightRef.current = true;
      setIsImporting(true);
      setStatus(null);
      let createdSession: ReadingSession | null = null;
      try {
        // B1 repair: the import is PREPARED (parsed, hash-bound, row
        // persisted) but visible reader state is NOT touched yet. Only after
        // the session activates does the prepared import become visible —
        // so a failed transaction leaves the prior document exactly as it
        // was. The valid B row intentionally remains in the library either
        // way; a re-drop reuses it to retry activation.
        const prepared = await openDroppedPdf(paths[0], {
          leaseHeldByCaller: true,
          deferCommit: true,
        });
        if (!prepared) return;
        const droppedDocument = isDroppedPreparation(prepared)
          ? prepared.document
          : prepared;

        const name = droppedSessionName(droppedDocument);
        const session = await createSession(name, [droppedDocument.id]);
        createdSession = session;
        // The store is the single restore-success authority: it rejects when
        // the backend resolves `success=false`, so a failed restore takes the
        // same rollback path as any other activation failure (#185).
        await restoreSession(session.id);
        if (isDroppedPreparation(prepared)) prepared.commit();
        onSessionCreated(droppedDocument, session);
        setStatus({
          kind: "success",
          message: `Session “${name}” created`,
        });
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
        releaseLease();
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
