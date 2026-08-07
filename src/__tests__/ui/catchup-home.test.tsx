/**
 * The catch-up home (spec 5.1/5.2): one book gets the answer, not a shelf of
 * equal-weight cards. The most-recently-opened in-flight book becomes a
 * typographic resume line naming its relative last-read time; everything
 * else in flight drops to a compact "Also in progress" list; the grid below
 * gets its own heading.
 *
 * Asserted through the real shell (`ReaderView`) — `LibraryView` and its
 * Continue-reading shelf were complete and unreachable for weeks before
 * (#74/#81), and a unit test on a leaf component cannot see that its parent
 * never renders it. Only heavy leaves (`PdfViewer`, `Toolbar`,
 * `AiPlaybackBar`) and the Tauri IPC boundary are stubbed.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { mockInvoke } from "../../../tests/setup";
import { ReaderView } from "../../components/reader/ReaderView";
import { useDocumentStore } from "../../stores/document-store";
import { useLibraryStore } from "../../stores/library-store";
import { useCollectionsStore } from "../../stores/collections-store";
import type { Document } from "../../lib/schemas";

vi.mock("../../services/pdf-service", () => ({
  pdfService: { loadDocument: vi.fn(), getPage: vi.fn() },
}));
vi.mock("../../components/PdfViewer", () => ({
  PdfViewer: () => <div data-testid="pdf-viewer" />,
}));
vi.mock("../../components/Toolbar", () => ({
  Toolbar: () => <div data-testid="toolbar" />,
}));
vi.mock("../../components/playback-bar/AiPlaybackBar", () => ({
  AiPlaybackBar: () => <div data-testid="playback-bar" />,
}));

const { pdfService } = await import("../../services/pdf-service");
const loadDocument = vi.mocked(pdfService.loadDocument);

// Real titles from Pedro's library (~/Documents/Books), per the UX spec §6.
// lastOpenedAt is computed relative to NOW (calendar days back) so the
// "last read N days ago" assertions hold on any run date without fake timers
// (vi.useFakeTimers breaks @testing-library's waitFor under vitest).
const daysAgo = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
};

const DDD: Document = {
  id: "doc-ddd",
  filePath: "/books/domain-driven-design.pdf",
  title: "Domain-Driven Design",
  pageCount: 529,
  currentPage: 214,
  scrollPosition: 0,
  lastTtsChunkId: null,
  lastOpenedAt: daysAgo(14), // "last read 14 days ago"
  fileHash: null,
  createdAt: "2026-07-01T00:00:00Z",
} as Document;

const LOGIC: Document = {
  id: "doc-logic",
  filePath: "/books/logic-and-structure.pdf",
  title: "Logic and Structure",
  pageCount: 340,
  currentPage: 88,
  scrollPosition: 0,
  lastTtsChunkId: null,
  lastOpenedAt: daysAgo(18),
  fileHash: null,
  createdAt: "2026-06-01T00:00:00Z",
} as Document;

const MAPPING: Document = {
  id: "doc-mapping",
  filePath: "/books/mapping-experiences.pdf",
  title: "Mapping Experiences",
  pageCount: 240,
  currentPage: 12,
  scrollPosition: 0,
  lastTtsChunkId: null,
  lastOpenedAt: daysAgo(20),
  fileHash: null,
  createdAt: "2026-06-01T00:00:00Z",
} as Document;

function mockLibrary(documents: Document[]) {
  mockInvoke.mockImplementation((command: string) => {
    switch (command) {
      case "library_list_documents":
        return Promise.resolve(documents);
      case "collections_list":
      case "collections_list_memberships":
        return Promise.resolve([]);
      case "library_heal_document":
      case "library_open_document":
        return Promise.resolve(documents[0]);
      default:
        return Promise.resolve(null);
    }
  });
}

beforeEach(() => {
  useDocumentStore.getState().reset();
  useLibraryStore.getState().reset();
  useCollectionsStore.getState().reset();
  loadDocument.mockReset();
  loadDocument.mockResolvedValue({
    numPages: 529,
  } as unknown as PDFDocumentProxy);
  mockLibrary([DDD]);
});

describe("the catch-up home", () => {
  it("names the resume line with page, percent, and relative last-read time", async () => {
    render(<ReaderView />);

    const shelf = await screen.findByRole("region", {
      name: "Continue reading",
    });
    // "Page 214 of 529" must stand as its own text node — other reading-home
    // tests (reading-home.test.tsx) find it as an exact standalone string.
    expect(
      within(shelf).getByText("Page 214 of 529"),
    ).toBeInTheDocument();
    // 214/529 = 40.45% -> 40
    expect(within(shelf).getByText("40%")).toBeInTheDocument();
    // lastOpenedAt is 14 calendar days before the fixed clock.
    expect(
      within(shelf).getByText("last read 14 days ago"),
    ).toBeInTheDocument();
  });

  it("shows no 'also in progress' list when only one book is in flight", async () => {
    render(<ReaderView />);

    await screen.findByRole("region", { name: "Continue reading" });
    expect(
      screen.queryByRole("heading", { name: "Also in progress" }),
    ).not.toBeInTheDocument();
  });

  it("lists the rest of the in-flight books under 'Also in progress'", async () => {
    mockLibrary([DDD, LOGIC, MAPPING]);
    render(<ReaderView />);

    const shelf = await screen.findByRole("region", {
      name: "Continue reading",
    });
    expect(
      within(shelf).getByRole("heading", { name: "Also in progress" }),
    ).toBeInTheDocument();
    expect(
      within(shelf).getByRole("button", {
        name: /^Logic and Structure Page 88 of 340/,
      }),
    ).toBeInTheDocument();
    expect(
      within(shelf).getByRole("button", {
        name: /^Mapping Experiences Page 12 of 240/,
      }),
    ).toBeInTheDocument();
    // Domain-Driven Design is the resume line's primary book, not a second
    // "also in progress" row.
    expect(
      within(shelf).queryByRole("button", {
        name: /^Domain-Driven Design$/,
      }),
    ).not.toBeInTheDocument();
  });

  it("reads headings in sequential order: h1 -> h2 -> h3 -> h2", async () => {
    mockLibrary([DDD, LOGIC]);
    render(<ReaderView />);

    await screen.findByRole("region", { name: "Continue reading" });
    const headings = screen
      .getAllByRole("heading")
      .map((h) => Number(h.tagName[1]));
    // h1 (Library) then h2 (Continue reading) then h3 (Also in progress)
    // then h2 (Your library) — no skip anywhere in that run.
    const start = headings.indexOf(1);
    expect(headings.slice(start, start + 4)).toEqual([1, 2, 3, 2]);
  });

  it("gives the grid its own 'Your library' heading", async () => {
    render(<ReaderView />);

    expect(
      await screen.findByRole("heading", { name: "Your library" }),
    ).toBeInTheDocument();
  });
});
