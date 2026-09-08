import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Document } from "../lib/schemas";
import type { NativeFileDropEvent } from "../lib/api/file-drop";
import { droppedSessionName, usePdfDropSession } from "./usePdfDropSession";
import { useOpenPdf } from "./useOpenPdf";
import { useDocumentStore } from "../stores/document-store";
import { mockInvoke } from "../../tests/setup";

vi.mock("../lib/api/file-drop", () => ({
  onNativeFileDrop: vi.fn(),
}));

vi.mock("../services/pdf-service", () => ({
  pdfService: { loadDocument: vi.fn(), loadDocumentBound: vi.fn() },
  isScopeDenial: (e: unknown) =>
    /not allowed on the configured scope|forbidden path: .*not allowed on the scope/i.test(
      e instanceof Error ? e.message : String(e),
    ),
}));

const { pdfService } = await import("../services/pdf-service");
const loadDocument = vi.mocked(pdfService.loadDocument);
const loadDocumentBound = vi.mocked(pdfService.loadDocumentBound);

const { onNativeFileDrop } = await import("../lib/api/file-drop");
const subscribe = vi.mocked(onNativeFileDrop);

const document: Document = {
  id: "a".repeat(64),
  filePath: "/books/Data Engineering.pdf",
  title: "Data Engineering",
  pageCount: 42,
  currentPage: 7,
  scrollPosition: 0,
  lastTtsChunkId: null,
  lastOpenedAt: null,
  fileHash: "a".repeat(64),
  createdAt: "2026-08-25T10:00:00Z",
};

const session = {
  id: "session-1",
  name: "Data Engineering",
  documents: [],
  createdAt: "2026-08-25T10:00:00Z",
  updatedAt: "2026-08-25T10:00:00Z",
  lastAccessedAt: "2026-08-25T10:00:00Z",
};

let emit: (event: NativeFileDropEvent) => void;
let unlisten: ReturnType<typeof vi.fn>;

beforeEach(() => {
  unlisten = vi.fn();
  subscribe.mockReset();
  subscribe.mockImplementation(async (handler) => {
    emit = handler;
    return unlisten;
  });
  useDocumentStore.getState().reset();
  loadDocument.mockReset();
  mockInvoke.mockReset();
  mockInvoke.mockResolvedValue(null);
});

function dependencies() {
  return {
    openDroppedPdf: vi.fn().mockResolvedValue(document),
    createSession: vi.fn().mockResolvedValue(session),
    restoreSession: vi.fn().mockResolvedValue({
      success: true,
      session,
      missingDocuments: [],
    }),
    deleteSession: vi.fn().mockResolvedValue(undefined),
    onSessionCreated: vi.fn(),
    onError: vi.fn(),
  };
}

describe("usePdfDropSession", () => {
  it("bounds generated session names by the backend's UTF-8 byte ceiling", () => {
    const name = droppedSessionName({
      ...document,
      title: "📚".repeat(30),
    });

    expect(new TextEncoder().encode(name).byteLength).toBeLessThanOrEqual(100);
    expect(name).not.toContain("�");
  });

  it("announces hover, imports one PDF, then creates and activates its session", async () => {
    const deps = dependencies();
    const { result } = renderHook(() => usePdfDropSession(deps));
    await waitFor(() => expect(subscribe).toHaveBeenCalledTimes(1));

    act(() => emit({ type: "enter", paths: ["/books/Data Engineering.pdf"] }));
    expect(result.current.isDragActive).toBe(true);

    await act(async () => {
      emit({ type: "drop", paths: ["/books/Data Engineering.pdf"] });
    });
    await waitFor(() => expect(deps.onSessionCreated).toHaveBeenCalled());

    expect(deps.openDroppedPdf).toHaveBeenCalledWith(
      "/books/Data Engineering.pdf",
      // The drop transaction holds the open lease itself and defers the
      // visible-reader commit until activation (issue #185 B1 repair).
      { leaseHeldByCaller: true, deferCommit: true },
    );
    expect(deps.createSession).toHaveBeenCalledWith("Data Engineering", [
      document.id,
    ]);
    expect(deps.restoreSession).toHaveBeenCalledWith("session-1");
    expect(deps.onSessionCreated).toHaveBeenCalledWith(document, session);
    expect(result.current.isDragActive).toBe(false);
    expect(result.current.isImporting).toBe(false);
    expect(result.current.status).toEqual({
      kind: "success",
      message: "Session “Data Engineering” created",
    });
    expect(deps.onError).not.toHaveBeenCalled();
  });

  it("rejects non-PDF and multi-file drops before any mutation", async () => {
    const deps = dependencies();
    renderHook(() => usePdfDropSession(deps));
    await waitFor(() => expect(subscribe).toHaveBeenCalledTimes(1));

    act(() => emit({ type: "drop", paths: ["/books/notes.txt"] }));
    act(() =>
      emit({
        type: "drop",
        paths: ["/books/one.pdf", "/books/two.pdf"],
      }),
    );

    expect(deps.onError).toHaveBeenNthCalledWith(
      1,
      "DROP_INVALID: Drop exactly one PDF to create a reading session.",
    );
    expect(deps.onError).toHaveBeenNthCalledWith(
      2,
      "DROP_INVALID: Drop exactly one PDF to create a reading session.",
    );
    expect(deps.openDroppedPdf).not.toHaveBeenCalled();
    expect(deps.createSession).not.toHaveBeenCalled();
  });

  it("processes at most one native drop while an import is in flight", async () => {
    let resolveImport: (value: Document) => void = () => {};
    const deps = dependencies();
    deps.openDroppedPdf.mockReturnValue(
      new Promise<Document>((resolve) => {
        resolveImport = resolve;
      }),
    );
    renderHook(() => usePdfDropSession(deps));
    await waitFor(() => expect(subscribe).toHaveBeenCalledTimes(1));

    act(() => emit({ type: "drop", paths: ["/books/one.pdf"] }));
    act(() => emit({ type: "drop", paths: ["/books/two.pdf"] }));
    expect(deps.openDroppedPdf).toHaveBeenCalledTimes(1);
    expect(deps.onError).toHaveBeenCalledWith(
      "DROP_BUSY: Wait for the current PDF session to finish.",
    );

    await act(async () => resolveImport(document));
    await waitFor(() => expect(deps.createSession).toHaveBeenCalledTimes(1));
  });

  it("removes a newly-created session when activation fails", async () => {
    const deps = dependencies();
    deps.restoreSession.mockRejectedValue(new Error("restore failed"));
    renderHook(() => usePdfDropSession(deps));
    await waitFor(() => expect(subscribe).toHaveBeenCalledTimes(1));

    act(() => emit({ type: "drop", paths: ["/books/one.pdf"] }));
    await waitFor(() =>
      expect(deps.deleteSession).toHaveBeenCalledWith("session-1"),
    );

    expect(deps.onSessionCreated).not.toHaveBeenCalled();
    expect(deps.onError).toHaveBeenCalledWith("DROP_FAILED: restore failed");
  });

  it("consumes the restore authority's success=false rejection (issue #185)", async () => {
    // The store is the single success=false decision point; the drop flow
    // only consumes its rejection: roll the session back, surface the code,
    // never activate.
    const deps = dependencies();
    deps.restoreSession.mockRejectedValue(
      new Error(
        "SESSION_RESTORE_FAILED: The reading session could not be restored — the reader stayed on the current document. Try again.",
      ),
    );
    renderHook(() => usePdfDropSession(deps));
    await waitFor(() => expect(subscribe).toHaveBeenCalledTimes(1));

    await act(async () => {
      emit({ type: "drop", paths: ["/books/one.pdf"] });
    });
    await waitFor(() =>
      expect(deps.deleteSession).toHaveBeenCalledWith("session-1"),
    );

    expect(deps.onSessionCreated).not.toHaveBeenCalled();
    expect(deps.onError).toHaveBeenCalledWith(
      expect.stringContaining("DROP_FAILED: SESSION_RESTORE_FAILED"),
    );
  });

  it("holds one open lease from import start through session activation (issue #185)", async () => {
    // Falsifier for the old release/re-acquire boundary: the first code that
    // used to run AFTER `openDroppedPdf` released the shared open mutex was
    // `createSession`. The lease must already be held there — and a competing
    // public open attempted in that window must be refused, not interleaved.
    const deps = dependencies();
    let leaseHeldAtOldBoundary: boolean | null = null;
    let resolveCreate: (value: typeof session) => void = () => {};
    deps.createSession.mockImplementation(() => {
      leaseHeldAtOldBoundary = useDocumentStore.getState().isLoading;
      return new Promise<typeof session>((resolve) => {
        resolveCreate = resolve;
      });
    });

    const { result } = renderHook(() => ({
      drop: usePdfDropSession(deps),
      open: useOpenPdf(),
    }));
    await waitFor(() => expect(subscribe).toHaveBeenCalledTimes(1));

    await act(async () => {
      emit({ type: "drop", paths: ["/books/Data Engineering.pdf"] });
    });
    await waitFor(() => expect(deps.createSession).toHaveBeenCalled());
    expect(leaseHeldAtOldBoundary).toBe(true);

    // A rapid second public action in the transaction window must be refused
    // with the shared-store busy error — never loaded over the in-flight
    // transaction's document.
    let resumed: boolean | undefined;
    await act(async () => {
      resumed = await result.current.open.resumeDocument(document);
    });
    expect(resumed).toBe(false);
    expect(loadDocument).not.toHaveBeenCalled();
    expect(useDocumentStore.getState().error).toContain("OPEN_BUSY");

    // The transaction itself completes once its own steps resolve.
    await act(async () => resolveCreate(session));
    await waitFor(() => expect(deps.onSessionCreated).toHaveBeenCalled());
    expect(useDocumentStore.getState().isLoading).toBe(false);
    // The refused resume reported through the document store, not the drop
    // flow's error channel; the transaction itself succeeded.
    expect(deps.onError).not.toHaveBeenCalled();
  });

  it("unsubscribes on unmount, including a subscription that resolves late", async () => {
    let resolveSubscription: (value: () => void) => void = () => {};
    subscribe.mockReturnValue(
      new Promise((resolve) => {
        resolveSubscription = resolve;
      }),
    );
    const { unmount } = renderHook(() => usePdfDropSession(dependencies()));

    unmount();
    await act(async () => resolveSubscription(unlisten));
    expect(unlisten).toHaveBeenCalledTimes(1);
  });
});

describe("failed drop preserves the prior document (issue #185 B1 repair)", () => {
  const rowA = document; // already reading this book (module fixture, id a-repeated-64)
  const rowB = {
    ...document,
    id: "hash-of-b",
    title: "Dropped Book",
    currentPage: 1,
  };
  function preparePriorDocument() {
    // Document A is open in the reader at a nondefault page with progress.
    const proxyA = { numPages: 120 };
    act(() => {
      useDocumentStore.setState({
        pdfDocument: proxyA,
        currentDocument: rowA,
        currentPage: 42,
        scrollPosition: 0.5,
        totalPages: 120,
      });
    });
    return proxyA;
  }

  function importMocks() {
    // B is a brand-new import: unknown path, fresh row, hash-bound twice.
    // The library mock is stateful so a re-drop resolves the persisted row
    // (retry availability through the public path).
    let persistedRow: Document | null = null;
    loadDocumentBound.mockImplementation((path: string, options?) =>
      Promise.resolve({
        pdf: { numPages: 30 },
        sha256: "hash-of-b",
        // Second (retry) drop binds to the now-known row id.
        ...(options && "expectedSha256" in options ? {} : {}),
      } as never),
    );
    loadDocument.mockResolvedValue({ numPages: 30 } as never);
    mockInvoke.mockImplementation((command: string) => {
      if (command === "library_get_document_by_path") {
        return Promise.resolve(persistedRow);
      }
      if (command === "library_add_document") {
        persistedRow = rowB;
        return Promise.resolve(rowB);
      }
      if (command === "library_open_document") {
        return Promise.resolve(persistedRow ?? rowB);
      }
      return Promise.resolve(null);
    });
  }

  it("restore failure keeps exact A pdf/document/page/progress; session deleted, row kept", async () => {
    const proxyA = preparePriorDocument();
    importMocks();

    let restoreReject: (error: Error) => void = () => {};
    const deps = {
      // The REAL open path must run — a pure-return mock is what hid B1.
      openDroppedPdf: undefined as unknown as ReturnType<typeof vi.fn>,
      createSession: vi.fn().mockResolvedValue(session),
      restoreSession: vi.fn(
        () =>
          new Promise((_resolve, reject) => {
            restoreReject = reject;
          }),
      ),
      deleteSession: vi.fn().mockResolvedValue(undefined),
      onSessionCreated: vi.fn(),
      onError: vi.fn(),
    };

    const openRef: { current: ReturnType<typeof useOpenPdf> | null } = {
      current: null,
    };
    renderHook(() => {
      const open = useOpenPdf();
      openRef.current = open;
      return usePdfDropSession({
        ...(deps as unknown as Parameters<typeof usePdfDropSession>[0]),
        openDroppedPdf: (filePath: string, options?) =>
          openRef.current!.openDroppedPdf(filePath, options),
      });
    });
    await waitFor(() => expect(subscribe).toHaveBeenCalledTimes(1));

    await act(async () => {
      emit({ type: "drop", paths: ["/books/Dropped Book.pdf"] });
    });
    await waitFor(() =>
      expect(deps.createSession).toHaveBeenCalledWith("Dropped Book", [
        "hash-of-b",
      ]),
    );
    await act(async () => {
      restoreReject(
        new Error(
          "SESSION_RESTORE_FAILED: The reading session could not be restored — the reader stayed on the current document. Try again.",
        ),
      );
    });
    await waitFor(() =>
      expect(deps.deleteSession).toHaveBeenCalledWith("session-1"),
    );

    // The exact prior reader authorities survive the failed transaction —
    // same proxy instance, same row object, same page and progress.
    const state = useDocumentStore.getState();
    expect(state.pdfDocument).toBe(proxyA);
    expect(state.currentDocument).toBe(rowA);
    expect(state.currentPage).toBe(42);
    expect(state.scrollPosition).toBe(0.5);

    // Rollback contract: session deleted, callback absent, error visible.
    expect(deps.onSessionCreated).not.toHaveBeenCalled();
    expect(deps.onError).toHaveBeenCalledWith(
      expect.stringContaining("DROP_FAILED: SESSION_RESTORE_FAILED"),
    );

    // The import itself succeeded independently: B stays in the library
    // (intentional — row cleanup is out of scope for this repair; a re-drop
    // reuses the row to retry activation).
    expect(mockInvoke).toHaveBeenCalledWith(
      "library_add_document",
      expect.objectContaining({
        filePath: "/books/Dropped Book.pdf",
        expectedSha256: "hash-of-b",
      }),
    );
    expect(
      mockInvoke.mock.calls.some(([command]) =>
        String(command).includes("library_remove"),
      ),
    ).toBe(false);

    // Retry availability through the public path: a re-drop now resolves the
    // persisted known row (hash-bound) WITHOUT re-adding it, still without
    // disturbing A.
    const addCallsBeforeRetry = mockInvoke.mock.calls.filter(
      ([command]) => command === "library_add_document",
    ).length;
    let retried: Awaited<
      ReturnType<
        NonNullable<Parameters<typeof usePdfDropSession>[0]["openDroppedPdf"]>
      >
    > = null;
    await act(async () => {
      retried = await openRef.current!.openDroppedPdf(
        "/books/Dropped Book.pdf",
        { leaseHeldByCaller: true, deferCommit: true },
      );
    });
    expect(retried && "document" in retried ? retried.document.id : null).toBe(
      "hash-of-b",
    );
    expect(loadDocumentBound).toHaveBeenLastCalledWith(
      "/books/Dropped Book.pdf",
      {
        expectedSha256: "hash-of-b",
      },
    );
    const addCallsAfterRetry = mockInvoke.mock.calls.filter(
      ([command]) => command === "library_add_document",
    ).length;
    expect(addCallsAfterRetry).toBe(addCallsBeforeRetry); // reuse, not re-add
    expect(useDocumentStore.getState().currentDocument).toBe(rowA);
  });

  it("commits the dropped document only after activation succeeds", async () => {
    const prepareSpy = preparePriorDocument();
    importMocks();

    const deps = {
      createSession: vi.fn().mockResolvedValue(session),
      restoreSession: vi.fn().mockResolvedValue({
        success: true,
        session,
        missingDocuments: [],
      }),
      deleteSession: vi.fn().mockResolvedValue(undefined),
      onSessionCreated: vi.fn(),
      onError: vi.fn(),
    };
    const openRef: { current: ReturnType<typeof useOpenPdf> | null } = {
      current: null,
    };
    renderHook(() => {
      const open = useOpenPdf();
      openRef.current = open;
      return {
        drop: usePdfDropSession({
          ...(deps as unknown as Parameters<typeof usePdfDropSession>[0]),
          openDroppedPdf: (filePath: string, options?) => {
            expect(options).toEqual({
              leaseHeldByCaller: true,
              deferCommit: true,
            });
            return openRef.current!.openDroppedPdf(filePath, options);
          },
        }),
        open,
      };
    });
    await waitFor(() => expect(subscribe).toHaveBeenCalledTimes(1));

    await act(async () => {
      emit({ type: "drop", paths: ["/books/Dropped Book.pdf"] });
    });
    await waitFor(() => expect(deps.onSessionCreated).toHaveBeenCalled());

    // Only after activation does the reader show B.
    const state = useDocumentStore.getState();
    expect(state.currentDocument?.id).toBe("hash-of-b");
    expect(state.pdfDocument).not.toBe(prepareSpy);
    expect(state.totalPages).toBe(30);
    expect(deps.onSessionCreated).toHaveBeenCalledWith(rowB, session);
    expect(deps.onError).not.toHaveBeenCalled();
  });
  it("createSession rejection also preserves A exactly (no session to delete)", async () => {
    const proxyA = preparePriorDocument();
    importMocks();

    const deps = {
      createSession: vi
        .fn()
        .mockRejectedValue(
          new Error("SESSION_CREATE_FAILED: The session could not be created."),
        ),
      restoreSession: vi.fn(),
      deleteSession: vi.fn().mockResolvedValue(undefined),
      onSessionCreated: vi.fn(),
      onError: vi.fn(),
    };
    const openRef: { current: ReturnType<typeof useOpenPdf> | null } = {
      current: null,
    };
    renderHook(() => {
      const open = useOpenPdf();
      openRef.current = open;
      return {
        drop: usePdfDropSession({
          ...(deps as unknown as Parameters<typeof usePdfDropSession>[0]),
          openDroppedPdf: (filePath: string, options?) =>
            openRef.current!.openDroppedPdf(filePath, options),
        }),
        open,
      };
    });
    await waitFor(() => expect(subscribe).toHaveBeenCalledTimes(1));

    await act(async () => {
      emit({ type: "drop", paths: ["/books/Dropped Book.pdf"] });
    });
    await waitFor(() =>
      expect(deps.onError).toHaveBeenCalledWith(
        expect.stringContaining("DROP_FAILED: SESSION_CREATE_FAILED"),
      ),
    );

    // No session was created, so there is nothing to roll back...
    expect(deps.deleteSession).not.toHaveBeenCalled();
    expect(deps.restoreSession).not.toHaveBeenCalled();
    // ...the reader still holds A exactly...
    const state = useDocumentStore.getState();
    expect(state.pdfDocument).toBe(proxyA);
    expect(state.currentDocument).toBe(rowA);
    expect(state.currentPage).toBe(42);
    expect(state.scrollPosition).toBe(0.5);
    // ...no success callback fired, and the valid import row remains.
    expect(deps.onSessionCreated).not.toHaveBeenCalled();
    expect(mockInvoke).toHaveBeenCalledWith(
      "library_add_document",
      expect.objectContaining({ expectedSha256: "hash-of-b" }),
    );
  });
});
