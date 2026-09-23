/**
 * Seeded command model for the drop-to-session transaction — latest-wins
 * (issue #294, replacing the #185 fail-fast model).
 *
 * The model drives the real `usePdfDropSession` hook (real document store,
 * mocked IPC leaves) through a generated sequence of guarded operations and
 * asserts the transaction invariants after every executed operation:
 *
 * 1. at most one transaction COMMITS — probes (second drop, resume) no
 *    longer get refused with busy errors: they SUPERSEDE the in-flight
 *    transaction, which rolls its session back silently and mutates nothing
 *    visible;
 * 2. the open lease spans the whole transaction — `isLoading` is true from
 *    import start until the LIVE transaction settles, then false;
 * 3. no busy code ever reaches a user-visible string — the store error and
 *    every `onError` argument are free of `OPEN_BUSY`/`DROP_BUSY`, and no
 *    user-visible message starts with an internal `CODE: ` prefix;
 * 4. a `success=false` rejection from the restore authority never activates:
 *    the created session is deleted, `onSessionCreated` never fires;
 * 5. invalid drops mutate nothing at any time.
 *
 * Operations whose precondition does not hold are skipped (guarded command
 * model); invariants are asserted after every executed operation.
 *
 * Seeded: 20260923 (new model seed; deterministic replay).
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

type RestoreGate = {
  resolve: (value: {
    success: boolean;
    session: typeof session;
    missingDocuments: string[];
  }) => void;
  reject: (error: Error) => void;
};

const flush = async () => {
  for (let i = 0; i < 4; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
};

/** A user-visible string never carries a leading internal code. */
const noRawCode = expect.not.stringMatching(/[A-Z][A-Z0-9_]*: /);

describe("drop transaction command model (latest-wins seed 20260923)", () => {
  it("supersedes instead of refusing, commits at most once, and never leaks busy codes", async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(opArb, { maxLength: 12 }), async (ops) => {
        // Fresh world per run.
        useDocumentStore.getState().reset();
        loadDocument.mockReset();
        mockInvoke.mockReset();
        // The resume probe needs a resolvable document read and library row.
        loadDocument.mockResolvedValue({ numPages: 9 });
        mockInvoke.mockImplementation((command: string) => {
          if (command === "library_open_document") return Promise.resolve(row);
          return Promise.resolve(null);
        });

        const subscribeMock = vi.mocked(subscribe);
        subscribeMock.mockReset();
        let emit: (event: NativeFileDropEvent) => void = () => {};
        subscribeMock.mockImplementation(async (handler) => {
          emit = handler;
          return vi.fn();
        });

        let liveGate: (RestoreGate & { failNextRestore: boolean }) | null =
          null;
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
                liveGate = { resolve, reject, failNextRestore: false };
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

        const errorsBefore = () => deps.onError.mock.calls.length;

        for (const op of ops) {
          switch (op) {
            case "startDrop":
            case "startDropFail":
            case "probeSecondDrop": {
              // Latest wins: starting a second drop while one is in flight
              // SUPERSEDES it. The new transaction starts FIRST (its lease
              // bumps the generation), and only then does the superseded
              // predecessor's restore settle — it must roll its session back
              // silently instead of activating.
              const stale = liveGate;
              liveGate = null;
              const failNextRestore = op === "startDropFail";
              const before = { ...counts };
              const errors = errorsBefore();
              await act(async () => {
                emit({ type: "drop", paths: ["/books/Model Book.pdf"] });
              });
              await flush();
              // Exactly one new transaction started, holding the lease.
              expect(useDocumentStore.getState().isLoading).toBe(true);
              expect(counts.imports).toBe(before.imports + 1);
              expect(counts.creates).toBe(before.creates + 1);
              if (stale) {
                await act(async () => {
                  stale.resolve({
                    success: true,
                    session,
                    missingDocuments: [],
                  });
                });
                await flush();
                // The superseded predecessor rolled back silently.
                expect(counts.deletions).toBe(before.deletions + 1);
                expect(counts.activations).toBe(before.activations);
                expect(errorsBefore()).toBe(errors); // silent — no busy error
              }
              liveGate = { ...liveGate!, failNextRestore };
              break;
            }
            case "probeResume": {
              // A resume SUPERSEDES whatever is in flight and wins.
              let resumed: boolean | undefined;
              await act(async () => {
                resumed = await result.current.open.resumeDocument(row);
              });
              expect(resumed).toBe(true);
              expect(useDocumentStore.getState().currentDocument?.id).toBe(
                row.id,
              );
              if (liveGate) {
                const stale = liveGate;
                liveGate = null;
                const deletions = counts.deletions;
                const errors = errorsBefore();
                await act(async () => {
                  stale.resolve({
                    success: true,
                    session,
                    missingDocuments: [],
                  });
                });
                await flush();
                // The superseded drop rolled back silently, never activated.
                expect(counts.deletions).toBe(deletions + 1);
                expect(errorsBefore()).toBe(errors);
              }
              // No busy error was set anywhere; the resume owns the reader.
              expect(useDocumentStore.getState().error).toBeNull();
              expect(useDocumentStore.getState().isLoading).toBe(false);
              break;
            }
            case "settle": {
              if (!liveGate) break; // guarded: no live drop transaction
              const gate = liveGate;
              liveGate = null;
              const before = { ...counts };
              const errors = errorsBefore();
              await act(async () => {
                if (gate.failNextRestore) gate.reject(RESTORE_FAILED);
                else
                  gate.resolve({
                    success: true,
                    session,
                    missingDocuments: [],
                  });
              });
              await flush();
              if (gate.failNextRestore) {
                expect(counts.deletions).toBe(before.deletions + 1);
                expect(counts.activations).toBe(before.activations);
                expect(deps.onError).toHaveBeenCalledWith(
                  expect.stringContaining(
                    "The reading session could not be restored",
                  ),
                );
                expect(deps.onError).toHaveBeenLastCalledWith(noRawCode);
              } else {
                expect(counts.activations).toBe(before.activations + 1);
                expect(errorsBefore()).toBe(errors); // success adds none
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
              // Idle or in flight: refused before any mutation, friendly copy.
              expect(deps.onError).toHaveBeenLastCalledWith(
                "Drop exactly one PDF to create a reading session.",
              );
              expect(counts).toEqual(before); // mutated nothing
              break;
            }
          }
          // Invariant after every executed operation: no busy code has ever
          // reached a user-visible string, and no message carries a code.
          expect(useDocumentStore.getState().error ?? "").not.toMatch(
            /OPEN_BUSY|DROP_BUSY/,
          );
          for (const call of deps.onError.mock.calls) {
            expect(String(call[0])).not.toMatch(/[A-Z][A-Z0-9_]*: /);
          }
        }

        // Whatever the sequence, the world ends settled and clean.
        if (!liveGate) {
          expect(useDocumentStore.getState().isLoading).toBe(false);
        }
      }),
      { seed: 20260923, numRuns: 80 },
    );
  }, 30000); // 80 rendered model runs take longer than vitest's 5s default.
});
