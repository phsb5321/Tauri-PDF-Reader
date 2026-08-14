/**
 * Cover pipeline contract (slice 121) — the mechanized gates from the design
 * packet §5, plus the adjudications the dispatch demanded:
 *
 *  1. Fallback is deterministic (same id → same seed class across renders).
 *  2. Accessible name: the cover is always role="img" named by the title.
 *  3. No network: the cover pipeline modules carry no fetch/XHR markers.
 *  4. Warm in-session cache: a second mount of the same id resolves from the
 *     in-memory cache — extraction runs exactly once.
 *  5. No layout shift: the loading placeholder (the deterministic fallback)
 *     and the loaded raster share ONE wrapper element — the wrapper never
 *     remounts when the raster arrives.
 *  6. Lazy + bounded: no repository traffic while the card is off-screen;
 *     generation starts only on intersection.
 *  7. Failed generation writes NOTHING: a corrupt source leaves the fallback
 *     and never calls store.
 *  8. Size bound: a source above the cap is never handed to the renderer.
 *  9. Blob URL lifecycle: one object URL per document across mounts;
 *     eviction revokes the URL.
 *
 * jsdom cannot run pdf.js's real rasterizer, so pixel-distinctness lives in
 * the packaged cover journey (e2e/cover-journey.e2e.mjs); everything above is
 * assertable here and is what this file pins.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, waitFor, act } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { DocumentCover } from "../../components/library/DocumentCover";
import { MAX_COVER_SOURCE_BYTES } from "../../hooks/useCover";
import { DocumentCard } from "../../components/library/DocumentCard";
import type { Document } from "../../lib/schemas";
import type { ViewMode } from "../../stores/library-store";

const { mockRepoGet, mockRepoStore, mockRepoSize } = vi.hoisted(() => ({
  mockRepoGet: vi.fn(),
  mockRepoStore: vi.fn(),
  mockRepoSize: vi.fn(),
}));

vi.mock("../../adapters/tauri/cover-repository.adapter", () => ({
  TauriCoverRepositoryAdapter: vi.fn().mockImplementation(() => ({
    get: mockRepoGet,
    store: mockRepoStore,
    sourceSize: mockRepoSize,
  })),
  tauriCoverRepository: {
    get: mockRepoGet,
    store: mockRepoStore,
    sourceSize: mockRepoSize,
  },
}));

// The generation path under test: pdfService is mocked; the repository is
// mocked; only the hook's state machine + DOM contract are real.
const loadDocumentForCover = vi.fn();
vi.mock("../../services/pdf-service", () => ({
  pdfService: {
    loadDocumentForCover: (...args: unknown[]) =>
      loadDocumentForCover(...args),
    getPage: vi.fn(),
    renderPage: vi.fn(),
  },
}));

/** Controllable IntersectionObserver — jsdom has none. */
type ObserverCb = (entries: { isIntersecting: boolean }[]) => void;
let observerCallbacks: ObserverCb[] = [];
const observe = vi.fn();
const unobserve = vi.fn();
const disconnect = vi.fn();
class FakeIntersectionObserver {
  constructor(cb: ObserverCb) {
    observerCallbacks.push(cb);
  }
  observe = observe;
  unobserve = unobserve;
  disconnect = disconnect;
}
vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);

function intersect(): void {
  for (const cb of observerCallbacks) {
    cb([{ isIntersecting: true }]);
  }
}

function makeDoc(prefix: string, title = "Paper One"): Document {
  return {
    id: prefix.padEnd(64, "a"),
    filePath: `/books/${prefix}.pdf`,
    title,
    pageCount: 20,
    currentPage: 4,
    scrollPosition: 0,
    lastTtsChunkId: null,
    lastOpenedAt: "2026-08-13T10:00:00Z",
    fileHash: null,
    createdAt: "2026-08-01T00:00:00Z",
  } as Document;
}

const DOC = makeDoc("a1b2c3d4e5f60718293a4b5c6d7e8f9012345678abcd1234ef567890abcde", "Paper One");

const DOC_SAME_TITLE_DIFF_ID: Document = {
  ...DOC,
  id: "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
  title: "Paper Two",
} as Document;

function stubCanvasToBlob(): void {
  HTMLCanvasElement.prototype.toBlob = function (cb: BlobCallback) {
    cb(new Blob(["cover-png"], { type: "image/png" }));
  };
}

beforeEach(() => {
  observerCallbacks = [];
  observe.mockClear();
  unobserve.mockClear();
  disconnect.mockClear();
  mockRepoGet.mockReset();
  mockRepoStore.mockReset();
  mockRepoSize.mockReset();
  loadDocumentForCover.mockReset();
  // jsdom implements neither Blob URL factory — stub both for the lifecycle
  // assertions (createObjectURL called once per doc; revoke on eviction).
  let urlCounter = 0;
  URL.createObjectURL = vi.fn(() => `blob:mock-${++urlCounter}`);
  URL.revokeObjectURL = vi.fn();
});

describe("cover pipeline contract (121)", () => {
  it("renders the deterministic fallback with the accessible name before any generation", () => {
    const doc = makeDoc("11a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1");
    const { getByRole } = render(
      <DocumentCover
        documentId={doc.id}
        title={doc.title}
        filePath={doc.filePath}
      />,
    );
    // role="img" named by the title — always, even before the raster.
    const cover = getByRole("img", { name: "Paper One" });
    // Deterministic seed: first 8 hex chars of the id.
    expect(cover.dataset.seed).toBe(String(parseInt(doc.id.slice(0, 8), 16)));
    // No repository traffic without intersection.
    expect(mockRepoGet).not.toHaveBeenCalled();
  });

  it("is deterministic: the same id renders the same fallback class on every mount", () => {
    const a = render(
      <DocumentCover
        documentId={DOC.id}
        title={DOC.title}
        filePath={DOC.filePath}
      />,
    );
    const b = render(
      <DocumentCover
        documentId={DOC.id}
        title={DOC.title}
        filePath={DOC.filePath}
      />,
    );
    const clsA = a.container.querySelector(".cover-fallback")?.className;
    const clsB = b.container.querySelector(".cover-fallback")?.className;
    expect(clsA).toBe(clsB);
    // A different id picks from the palette by its own seed.
    const c = render(
      <DocumentCover
        documentId={DOC_SAME_TITLE_DIFF_ID.id}
        title={DOC_SAME_TITLE_DIFF_ID.title}
        filePath={DOC_SAME_TITLE_DIFF_ID.filePath}
      />,
    );
    const seedC = c.container.querySelector(".document-cover")?.getAttribute("data-seed");
    const seedA = a.container.querySelector(".document-cover")?.getAttribute("data-seed");
    expect(seedC).not.toBe(seedA);
  });

  it("no network: the cover pipeline modules carry no fetch/XHR/WS markers", () => {
    const HERE = dirname(fileURLToPath(import.meta.url));
    const SRC = join(HERE, "../..");
    const modules = [
      "ports/cover-repository.port.ts",
      "adapters/tauri/cover-repository.adapter.ts",
      "hooks/useCover.ts",
      "components/library/DocumentCover.tsx",
      "components/library/DocumentCover.css",
    ];
    const markers = [/fetch\(/, /XMLHttpRequest/, /new WebSocket/, /EventSource\(/, /https?:\/\//];
    for (const mod of modules) {
      const text = readFileSync(join(SRC, mod), "utf8");
      for (const marker of markers) {
        expect(text, `${mod} must not carry ${marker}`).not.toMatch(marker);
      }
    }
  });

  it("warm cache: a second mount of the same id runs extraction exactly once", async () => {
    const doc = makeDoc("22b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2");
    stubCanvasToBlob();
    mockRepoGet.mockResolvedValue(null); // disk miss both times
    mockRepoStore.mockResolvedValue(undefined);
    mockRepoSize.mockResolvedValue(4096); // small source — preflight passes
    const page = { getViewport: () => ({ width: 612, height: 792 }) };
    loadDocumentForCover.mockResolvedValue({
      doc: { destroy: vi.fn().mockResolvedValue(undefined) },
    });
    const { pdfService } = await import("../../services/pdf-service");
    vi.mocked(pdfService.getPage).mockResolvedValue(page);
    vi.mocked(pdfService.renderPage).mockReturnValue({
      promise: Promise.resolve(),
      cancel: vi.fn(),
    });

    const a = render(
      <DocumentCover
        documentId={doc.id}
        title={doc.title}
        filePath={doc.filePath}
      />,
    );
    act(() => intersect());
    await waitFor(() => expect(mockRepoStore).toHaveBeenCalledTimes(1));

    a.unmount();
    const b = render(
      <DocumentCover
        documentId={doc.id}
        title={doc.title}
        filePath={doc.filePath}
      />,
    );
    act(() => intersect());
    await waitFor(() => expect(b.getByRole("img", { name: "Paper One" }).dataset.state).toBe("ready"));

    // The second mount was served from the in-memory cache: the extraction
    // (loadDocumentForCover) still ran exactly once.
    expect(loadDocumentForCover).toHaveBeenCalledTimes(1);
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
  });

  it("no layout shift: the placeholder and the raster share one wrapper element", async () => {
    const doc = makeDoc("33c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3");
    stubCanvasToBlob();
    mockRepoGet.mockResolvedValue(null);
    mockRepoStore.mockResolvedValue(undefined);
    mockRepoSize.mockResolvedValue(4096);
    loadDocumentForCover.mockResolvedValue({
      doc: { destroy: vi.fn().mockResolvedValue(undefined) },
    });
    const { pdfService } = await import("../../services/pdf-service");
    vi.mocked(pdfService.getPage).mockResolvedValue({
      getViewport: () => ({ width: 612, height: 792 }),
    });
    vi.mocked(pdfService.renderPage).mockReturnValue({
      promise: Promise.resolve(),
      cancel: vi.fn(),
    });

    const { container, getByRole } = render(
      <DocumentCover
        documentId={doc.id}
        title={doc.title}
        filePath={doc.filePath}
      />,
    );
    const wrapperBefore = container.querySelector(".document-cover");
    expect(wrapperBefore?.querySelector(".cover-fallback")).not.toBeNull();

    act(() => intersect());
    await waitFor(() => expect(getByRole("img", { name: "Paper One" }).dataset.state).toBe("ready"));

    const wrapperAfter = container.querySelector(".document-cover");
    expect(wrapperAfter).toBe(wrapperBefore); // same node — no remount, no shift
    expect(wrapperAfter?.querySelector("img.document-cover-img")).not.toBeNull();
  });

  it("lazy: zero repository calls while off-screen; generation starts on intersection", async () => {
    const doc = makeDoc("44d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4");
    stubCanvasToBlob();
    mockRepoGet.mockResolvedValue(null);
    mockRepoStore.mockResolvedValue(undefined);
    mockRepoSize.mockResolvedValue(4096);
    loadDocumentForCover.mockResolvedValue({
      doc: { destroy: vi.fn().mockResolvedValue(undefined) },
    });
    const { pdfService } = await import("../../services/pdf-service");
    vi.mocked(pdfService.getPage).mockResolvedValue({
      getViewport: () => ({ width: 612, height: 792 }),
    });
    vi.mocked(pdfService.renderPage).mockReturnValue({
      promise: Promise.resolve(),
      cancel: vi.fn(),
    });

    render(
      <DocumentCover
        documentId={doc.id}
        title={doc.title}
        filePath={doc.filePath}
      />,
    );
    // Not intersecting yet: no get, no extraction.
    expect(mockRepoGet).not.toHaveBeenCalled();
    expect(loadDocumentForCover).not.toHaveBeenCalled();

    act(() => intersect());
    await waitFor(() => expect(loadDocumentForCover).toHaveBeenCalledTimes(1));
    expect(mockRepoGet).toHaveBeenCalledWith(doc.id);
  });

  it("failed generation writes nothing: corrupt source keeps the fallback and never stores", async () => {
    const doc = makeDoc("55e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5");
    mockRepoGet.mockResolvedValue(null);
    loadDocumentForCover.mockRejectedValue(new Error("PDF_INVALID: corrupted"));

    const { getByRole } = render(
      <DocumentCover
        documentId={doc.id}
        title={doc.title}
        filePath={doc.filePath}
      />,
    );
    act(() => intersect());
    await waitFor(() => expect(getByRole("img", { name: "Paper One" }).dataset.state).toBe("fallback"));
    expect(mockRepoStore).not.toHaveBeenCalled();
    // The deterministic fallback is still there (never a blank box).
    expect(getByRole("img", { name: "Paper One" }).querySelector(".cover-fallback")).not.toBeNull();
  });

  it("size bound: an oversized source is rejected BEFORE any file read (NC)", async () => {
    const doc = makeDoc("66f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6");
    mockRepoGet.mockResolvedValue(null);
    mockRepoSize.mockResolvedValue(MAX_COVER_SOURCE_BYTES + 1);
    loadDocumentForCover.mockResolvedValue({ tooBig: true });

    const { getByRole } = render(
      <DocumentCover
        documentId={doc.id}
        title={doc.title}
        filePath={doc.filePath}
      />,
    );
    act(() => intersect());
    await waitFor(() => expect(getByRole("img", { name: "Paper One" }).dataset.state).toBe("fallback"));
    // The negative control: the full read + pdf.js parse never happened.
    expect(loadDocumentForCover).not.toHaveBeenCalled();
    const { pdfService } = await import("../../services/pdf-service");
    expect(pdfService.getPage).not.toHaveBeenCalled();
    expect(mockRepoStore).not.toHaveBeenCalled();
  });

  it("no-observer path balances its ref: the last unmount revokes a pending evicted URL", async () => {
    // Force the no-IntersectionObserver branch of the effect — a leaked ref
    // there would defer an evicted URL's revoke forever (Codex round 3).
    const OriginalIO = globalThis.IntersectionObserver;
    vi.stubGlobal("IntersectionObserver", undefined);
    try {
      stubCanvasToBlob();
      mockRepoGet.mockResolvedValue(null);
      mockRepoStore.mockResolvedValue(undefined);
      mockRepoSize.mockResolvedValue(4096);
      loadDocumentForCover.mockResolvedValue({
        doc: { destroy: vi.fn().mockResolvedValue(undefined) },
      });
      const { pdfService } = await import("../../services/pdf-service");
      vi.mocked(pdfService.getPage).mockResolvedValue({
        getViewport: () => ({ width: 612, height: 792 }),
      });
      vi.mocked(pdfService.renderPage).mockReturnValue({
        promise: Promise.resolve(),
        cancel: vi.fn(),
      });

      // Fill the in-memory cache past its bound (64) with unique docs — the
      // first doc's URL gets evicted while its card is still mounted, so its
      // revoke is deferred to the last unmount.
      const mounted: ReturnType<typeof render>[] = [];
      for (let i = 0; i < 65; i += 1) {
        const id = (i + 0x80).toString(16).padStart(2, "0");
        const doc = makeDoc(id.repeat(32));
        mounted.push(
          render(
            <DocumentCover
              documentId={doc.id}
              title={doc.title}
              filePath={doc.filePath}
            />,
          ),
        );
      }
      await waitFor(() => expect(mockRepoStore.mock.calls.length).toBe(65));

      // Unmount the FIRST card (its URL was evicted from the cache but it is
      // still mounted): the balanced ref must fire the deferred revoke.
      const firstUrl = URL.createObjectURL.mock.results[0].value;
      act(() => mounted[0].unmount());
      await waitFor(() =>
        expect(URL.revokeObjectURL).toHaveBeenCalledWith(firstUrl),
      );
      mounted.slice(1).forEach((m) => m.unmount());
    } finally {
      vi.stubGlobal("IntersectionObserver", OriginalIO);
    }
  });

  it("relocation resets the pipeline: a healed path reaches ready on the same id", async () => {
    // The library keeps the content-hash id while healing/relocation changes
    // the filePath; the card keys the cover by path so the pipeline (and the
    // broken state) resets and retries on the new path (Codex round 4).
    stubCanvasToBlob();
    mockRepoGet.mockResolvedValue(null);
    mockRepoStore.mockResolvedValue(undefined);
    mockRepoSize.mockResolvedValue(4096);
    loadDocumentForCover
      .mockRejectedValueOnce(new Error("PDF_INVALID: missing"))
      .mockResolvedValueOnce({
        doc: { destroy: vi.fn().mockResolvedValue(undefined) },
      });
    const { pdfService } = await import("../../services/pdf-service");
    vi.mocked(pdfService.getPage).mockResolvedValue({
      getViewport: () => ({ width: 612, height: 792 }),
    });
    vi.mocked(pdfService.renderPage).mockReturnValue({
      promise: Promise.resolve(),
      cancel: vi.fn(),
    });

    const doc = makeDoc("88b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8");
    const { rerender, getByRole } = render(
      <DocumentCover
        key="/books/old.pdf"
        documentId={doc.id}
        title={doc.title}
        filePath="/books/old.pdf"
      />,
    );
    act(() => intersect());
    await waitFor(() =>
      expect(getByRole("img", { name: "Paper One" }).dataset.state).toBe("fallback"),
    );
    // The book heals: same id, new path. The key change remounts the cover —
    // the fresh pipeline retries and reaches ready.
    rerender(
      <DocumentCover
        key="/books/new.pdf"
        documentId={doc.id}
        title={doc.title}
        filePath="/books/new.pdf"
      />,
    );
    // The remounted cover has its own observer — intersect it.
    act(() => intersect());
    await waitFor(() =>
      expect(getByRole("img", { name: "Paper One" }).dataset.state).toBe("ready"),
    );
    expect(loadDocumentForCover).toHaveBeenCalledWith(
      "/books/new.pdf",
      expect.any(Number),
    );
  });

  it("grid card: the open button keeps working with the cover inside", async () => {
    const onClick = vi.fn();
    const { getByRole } = render(
      <DocumentCard
        document={DOC}
        isSelected={false}
        viewMode={"grid" as ViewMode}
        onClick={onClick}
        onDoubleClick={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    const open = getByRole("button", { name: /Paper One/ });
    open.click();
    expect(onClick).toHaveBeenCalled();
  });

  it("list card: the cover thumb is named by the title too", () => {
    const { getByRole } = render(
      <DocumentCard
        document={DOC}
        isSelected={false}
        viewMode={"list" as ViewMode}
        onClick={vi.fn()}
        onDoubleClick={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(getByRole("img", { name: "Paper One" })).toBeInTheDocument();
  });
});
