/**
 * PdfViewer render-gate oracle (issue #294).
 *
 * The screenshot defect: a store error set while a document was already
 * loaded replaced the whole canvas with the full-screen "Error Loading PDF"
 * panel (raw internal code and all). The gate is now: the empty/skeleton/
 * full-screen-error states render ONLY while no document is loaded. With a
 * document on screen, the canvas stays — a failed open surfaces through the
 * shell's dismissible banner — and no rendered string may carry a leading
 * internal `CODE: ` prefix.
 */

import { render, screen } from "@testing-library/react";
import { beforeEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { PdfViewer } from "../../components/PdfViewer";
import { useDocumentStore } from "../../stores/document-store";
import type { Document } from "../../lib/schemas";

// jsdom ships no matchMedia; PdfViewer listens for DPR changes through it.
beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

vi.mock("../../services/pdf-service", () => ({
  pdfService: {
    loadDocument: vi.fn(),
    loadDocumentBound: vi.fn(),
    getPage: vi.fn().mockResolvedValue({
      getViewport: () => ({ width: 600, height: 800, clone: () => ({}) }),
    }),
    hasTextLayer: vi.fn().mockResolvedValue(true),
  },
  isScopeDenial: () => false,
}));

const fakePdf = {
  numPages: 120,
  getPage: vi.fn().mockResolvedValue({
    getViewport: () => ({ width: 600, height: 800, clone: () => ({}) }),
  }),
} as unknown as PDFDocumentProxy;

const loadedDocument: Document = {
  id: "doc-loaded",
  filePath: "/books/Redes.pdf",
  title: "Redes de Computadores 6a Edicao",
  pageCount: 1153,
  currentPage: 42,
  scrollPosition: 0,
  lastTtsChunkId: null,
  lastOpenedAt: null,
  fileHash: null,
  createdAt: "2026-09-23T00:00:00Z",
};

function loadDocumentIntoReader() {
  useDocumentStore.setState({
    pdfDocument: fakePdf,
    currentDocument: loadedDocument,
    currentPage: 42,
    totalPages: 120,
  });
}

/** No rendered string may carry a leading internal code. */
function expectNoRawCodes(requireText: boolean) {
  const withText = Array.from(document.querySelectorAll("body *")).filter(
    (element) => element.textContent?.trim(),
  );
  if (requireText) expect(withText.length).toBeGreaterThan(0);
  for (const element of withText) {
    expect(element.textContent?.trim() ?? "").not.toMatch(/[A-Z][A-Z0-9_]*: /);
  }
}

beforeEach(() => {
  useDocumentStore.getState().reset();
});

describe("PdfViewer render gate (issue #294)", () => {
  it("shows the full-screen error when NO document is loaded", () => {
    useDocumentStore.setState({
      error:
        "File content changed while the book was being added — the book was not opened.",
    });
    render(<PdfViewer />);

    expect(screen.getByText("Error Loading PDF")).toBeInTheDocument();
    expect(
      screen.getByText(
        "File content changed while the book was being added — the book was not opened.",
      ),
    ).toBeInTheDocument();
    expectNoRawCodes(true);
  });

  it("keeps the canvas when a later open fails over a loaded document", () => {
    loadDocumentIntoReader();
    useDocumentStore.setState({
      error:
        "File content changed while the book was being added — the book was not opened.",
    });
    render(<PdfViewer />);

    // The full-screen error must NOT replace the loaded document's canvas.
    expect(screen.queryByText("Error Loading PDF")).not.toBeInTheDocument();
    expect(document.querySelector(".pdf-canvas")).toBeInTheDocument();
    expectNoRawCodes(false);
  });

  it("keeps the canvas while a new open is in flight (no skeleton clobber)", () => {
    loadDocumentIntoReader();
    useDocumentStore.setState({ isLoading: true });
    render(<PdfViewer />);

    expect(document.querySelector(".pdf-canvas")).toBeInTheDocument();
    expect(screen.queryByText("Error Loading PDF")).not.toBeInTheDocument();
  });

  it("shows the skeleton only while nothing is loaded", () => {
    useDocumentStore.setState({ isLoading: true });
    render(<PdfViewer />);
    expect(screen.getByLabelText("Loading PDF page")).toBeInTheDocument();
    expect(document.querySelector(".pdf-canvas")).not.toBeInTheDocument();
  });
});
