/**
 * The search zero-results empty state tells the truth.
 *
 * UX finding #1: when a query matches nothing, `LibraryView` rendered the
 * same "No recent documents" / "Open a PDF to add it to your library" state
 * as an empty library — a user searching "Zathura" was told their library was
 * empty instead of that the search missed. This test renders the real
 * `LibraryView` with the real `SearchBar` and asserts the query-aware copy.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { mockInvoke } from "../../../tests/setup";
import { LibraryView } from "../../components/library/LibraryView";
import { useLibraryStore } from "../../stores/library-store";
import { useCollectionsStore } from "../../stores/collections-store";
import type { Document } from "../../lib/schemas";

const DOC: Document = {
  id: "doc-1",
  filePath: "/books/moby-dick.pdf",
  title: "Moby-Dick",
  pageCount: 585,
  currentPage: 213,
  scrollPosition: 0,
  lastTtsChunkId: null,
  lastOpenedAt: "2026-08-05T10:00:00Z",
  fileHash: null,
  createdAt: "2026-08-01T00:00:00Z",
} as Document;

beforeEach(() => {
  useLibraryStore.getState().reset();
  useCollectionsStore.getState().reset();
  mockInvoke.mockImplementation((command: string) => {
    switch (command) {
      case "library_list_documents":
        return Promise.resolve([DOC]);
      case "collections_list":
      case "collections_list_memberships":
        return Promise.resolve([]);
      default:
        return Promise.resolve(null);
    }
  });
});

function renderLibrary() {
  return render(<LibraryView onDocumentSelect={() => {}} />);
}

describe("the library search empty state", () => {
  it("says no results (not no recent documents) when a query matches nothing", async () => {
    renderLibrary();
    // Grid with the document is showing first.
    // The card title is an h3; the Continue-reading shelf also shows the title
    // as a span, so scope by heading role.
    expect(
      await screen.findByRole("heading", { name: "Moby-Dick" }),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Search library..."), {
      target: { value: "zzzz" },
    });

    expect(
      await screen.findByText('No results for "zzzz"'),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Try a different title, or clear the search."),
    ).toBeInTheDocument();
    // The wrong copy must not appear alongside the right copy.
    expect(screen.queryByText("No recent documents")).not.toBeInTheDocument();
  });

  it("clears the search from the empty state and restores the grid", async () => {
    renderLibrary();
    await screen.findByRole("heading", { name: "Moby-Dick" });

    fireEvent.change(screen.getByPlaceholderText("Search library..."), {
      target: { value: "zzzz" },
    });
    // Two "Clear search" affordances exist while a query is set: the
    // SearchBar's icon button and this empty state's visible-text action.
    // Scope to the empty state to exercise the new action.
    const emptyState = (
      await screen.findByText('No results for "zzzz"')
    ).closest(".empty-state");
    expect(emptyState).not.toBeNull();
    fireEvent.click(
      within(emptyState as HTMLElement).getByRole("button", {
        name: "Clear search",
      }),
    );

    // Query cleared (store is the source of truth for results), grid back.
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "Moby-Dick" }),
      ).toBeInTheDocument(),
    );
    expect(useLibraryStore.getState().searchQuery).toBe("");
    // The SearchBar input keeps its own local value (uncontrolled); its own
    // icon clear button remains available as the full-clear recovery path.
    expect(
      screen.getByRole("button", { name: "Clear search" }),
    ).toBeInTheDocument();
  });

  it("keeps the original copy when there is no query", async () => {
    mockInvoke.mockImplementation((command: string) => {
      if (command === "library_list_documents") return Promise.resolve([]);
      if (
        command === "collections_list" ||
        command === "collections_list_memberships"
      )
        return Promise.resolve([]);
      return Promise.resolve(null);
    });

    renderLibrary();

    expect(await screen.findByText("No recent documents")).toBeInTheDocument();
    expect(
      screen.getByText("Open a PDF to add it to your library"),
    ).toBeInTheDocument();
  });
});
