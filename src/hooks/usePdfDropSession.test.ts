import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Document } from "../lib/schemas";
import type { NativeFileDropEvent } from "../lib/api/file-drop";
import { droppedSessionName, usePdfDropSession } from "./usePdfDropSession";

vi.mock("../lib/api/file-drop", () => ({
  onNativeFileDrop: vi.fn(),
}));

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
