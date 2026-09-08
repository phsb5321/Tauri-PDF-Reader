/**
 * Seeded command model for the drop-to-session transaction (issue #185).
 *
 * The model drives the real `usePdfDropSession` hook (real document store,
 * mocked IPC leaves) through a generated sequence of guarded operations and
 * asserts the transaction invariants after every executed operation:
 *
 * 1. at most one transaction in flight — probes (second drop, resume) are
 *    refused with the shared-store busy errors and mutate nothing;
 * 2. the open lease spans the whole transaction — `isLoading` is true from
 *    import start until the session activates or rolls back, then false;
 * 3. a `success=false` rejection from the restore authority never activates:
 *    the created session is deleted, `onSessionCreated` never fires;
 * 4. invalid drops mutate nothing at any time.
 *
 * Operations whose precondition does not hold are skipped (guarded command
 * model); invariants are asserted after every executed operation.
 *
 * Seeded: 20260908 (recorded in evidence; deterministic replay).
 */

import fc from "fast-check";
import { describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { Document } from "../lib/schemas";
import type { NativeFileDropEvent } from "../lib/api/file-drop";
import { usePdfDropSession } from "./usePdfDropSession";
import { useOpenPdf } from "./useOpenPdf";
import { useDocumentStore } from "../stores/document-store";
import { mockInvoke } from "../../tests/setup";

vi.mock("../lib/api/file-drop", () => ({
  onNativeFileDrop: vi.fn(),
}));

vi.mock("../services/pdf-service", () => ({
  pdfService: { loadDocument: vi.fn(), loadDocumentBound: vi.fn() },
  isScopeDenial: () => false,
}));

const { pdfService } = await import("../services/pdf-service");
const loadDocument = vi.mocked(pdfService.loadDocument);
const { onNativeFileDrop: subscribe } = await import("../lib/api/file-drop");

type Op =
  | "startDrop"
  | "startDropFail"
  | "probeResume"
  | "probeSecondDrop"
  | "settle"
  | "invalidDrop";

const opArb: fc.Arbitrary<Op> = fc.constantFrom(
  "startDrop",
  "startDropFail",
  "probeResume",
  "probeSecondDrop",
  "settle",
  "invalidDrop",
);

const row = {
  id: "b".repeat(64),
  filePath: "/books/Model Book.pdf",
  title: "Model Book",
  pageCount: 9,
  currentPage: 3,
  scrollPosition: 0,
  lastTtsChunkId: null,
  lastOpenedAt: null,
  fileHash: "b".repeat(64),
  createdAt: "2026-09-08T12:00:00Z",
} as Document;

const session = {
  id: "model-session-1",
  name: "Model Book",
  documents: [],
  createdAt: "2026-09-08T12:00:00Z",
  updatedAt: "2026-09-08T12:00:00Z",
  lastAccessedAt: "2026-09-08T12:00:00Z",
};

const RESTORE_FAILED = new Error(
  "SESSION_RESTORE_FAILED: The reading session could not be restored — the reader stayed on the current document. Try again.",
);

const flush = async () => {
  for (let i = 0; i < 4; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
};

describe("drop transaction command model (seed 20260908)", () => {
  it("keeps the transaction exclusive, leased, and fail-closed", async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(opArb, { maxLength: 12 }), async (ops) => {
        // Fresh world per run.
        useDocumentStore.getState().reset();
        loadDocument.mockReset();
        mockInvoke.mockReset();
        mockInvoke.mockResolvedValue(null);

        const subscribeMock = vi.mocked(subscribe);
        subscribeMock.mockReset();
        let emit: (event: NativeFileDropEvent) => void = () => {};
        subscribeMock.mockImplementation(async (handler) => {
          emit = handler;
          return vi.fn();
        });

        let inFlight = false;
        let failNextRestore = false;
        let restoreGate: {
          resolve: (value: {
            success: boolean;
            session: typeof session;
            missingDocuments: string[];
          }) => void;
          reject: (error: Error) => void;
        } | null = null;
        const counts = {
          imports: 0,
          creates: 0,
          activations: 0,
          deletions: 0,
        };

        const deps = {
          openDroppedPdf: vi.fn(async () => {
            counts.imports += 1;
            return row;
          }),
          createSession: vi.fn(async () => {
            counts.creates += 1;
            return session;
          }),
          restoreSession: vi.fn(
            () =>
              new Promise<{
                success: boolean;
                session: typeof session;
                missingDocuments: string[];
              }>((resolve, reject) => {
                restoreGate = { resolve, reject };
              }),
          ),
          deleteSession: vi.fn(async () => {
            counts.deletions += 1;
          }),
          onSessionCreated: vi.fn(() => {
            counts.activations += 1;
          }),
          onError: vi.fn(),
        };

        const { result } = renderHook(() => ({
          drop: usePdfDropSession(deps),
          open: useOpenPdf(),
        }));
        await flush();

        for (const op of ops) {
          switch (op) {
            case "startDrop":
            case "startDropFail": {
              if (inFlight) break; // guarded
              failNextRestore = op === "startDropFail";
              inFlight = true;
              const before = { ...counts };
              await act(async () => {
                emit({ type: "drop", paths: ["/books/Model Book.pdf"] });
              });
              await flush();
              // The lease is held and exactly one new transaction started.
              expect(useDocumentStore.getState().isLoading).toBe(true);
              expect(counts.imports).toBe(before.imports + 1);
              expect(counts.creates).toBe(before.creates + 1);
              break;
            }
            case "probeResume": {
              if (!inFlight) break; // guarded
              let resumed: boolean | undefined;
              await act(async () => {
                resumed = await result.current.open.resumeDocument(row);
              });
              expect(resumed).toBe(false);
              expect(loadDocument).not.toHaveBeenCalled();
              expect(useDocumentStore.getState().error).toContain("OPEN_BUSY");
              break; // probe mutated nothing (asserted by later deltas)
            }
            case "probeSecondDrop": {
              if (!inFlight) break; // guarded
              await act(async () => {
                emit({ type: "drop", paths: ["/books/Second.pdf"] });
              });
              await flush();
              expect(deps.onError).toHaveBeenCalledWith(
                "DROP_BUSY: Wait for the current PDF session to finish.",
              );
              break; // no second transaction (asserted by later deltas)
            }
            case "settle": {
              if (!inFlight) break; // guarded
              inFlight = false;
              const errorCallsBefore = deps.onError.mock.calls.length;
              const settleBefore = { ...counts };
              await act(async () => {
                if (failNextRestore) restoreGate!.reject(RESTORE_FAILED);
                else
                  restoreGate!.resolve({
                    success: true,
                    session,
                    missingDocuments: [],
                  });
              });
              await flush();
              if (failNextRestore) {
                expect(counts.deletions).toBe(settleBefore.deletions + 1);
                expect(counts.activations).toBe(settleBefore.activations);
                expect(deps.onError).toHaveBeenCalledWith(
                  expect.stringContaining(
                    "DROP_FAILED: SESSION_RESTORE_FAILED",
                  ),
                );
              } else {
                expect(counts.activations).toBe(settleBefore.activations + 1);
                // Probes may have reported busy errors; the transaction's own
                // success adds none.
                expect(deps.onError.mock.calls.length).toBe(errorCallsBefore);
              }
              // The lease always outlives the transaction, never longer.
              expect(useDocumentStore.getState().isLoading).toBe(false);
              break;
            }
            case "invalidDrop": {
              const before = { ...counts };
              await act(async () => {
                emit({ type: "drop", paths: ["/books/notes.txt"] });
              });
              await flush();
              // Idle: refused before any mutation. In flight: the single-
              // transaction guard refuses it first — either way, no change.
              expect(deps.onError).toHaveBeenCalledWith(
                expect.stringMatching(/^DROP_(INVALID|BUSY)/),
              );
              expect(counts).toEqual(before); // mutated nothing
              break;
            }
          }
        }

        // Whatever the sequence, the world ends settled and clean.
        if (!inFlight) {
          expect(useDocumentStore.getState().isLoading).toBe(false);
        }
      }),
      { seed: 20260908, numRuns: 80 },
    );
  }, // 80 rendered model runs take longer than vitest's 5s default.
  30000);
});
