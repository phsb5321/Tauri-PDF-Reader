/**
 * Tests for the shelf-filing controls on DocumentCard.
 *
 * Verifies:
 * - Shelves appear in the context menu, checked where the book is already filed
 * - Toggling reports the shelf and whether it was filed, so the caller knows
 *   which way to move it
 * - The menu stays open across a toggle — filing on several shelves is one pass
 * - The menu is reachable in list view too, not only in grid view
 * - Cards rendered without shelves show no filing controls
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DocumentCard } from "../../components/library/DocumentCard";
import type { Document } from "../../lib/schemas";

const document: Document = {
  id: "doc-1",
  filePath: "/books/critique.pdf",
  title: "Critique of Pure Reason",
  fileHash: "hash-1",
  fileSize: 1024,
  pageCount: 800,
  currentPage: 120,
  scrollPosition: 0,
  zoomLevel: 1,
  createdAt: "2026-07-01T00:00:00Z",
  updatedAt: "2026-07-02T00:00:00Z",
  lastOpenedAt: "2026-07-02T00:00:00Z",
};

const shelves = [
  { id: "shelf-philosophy", name: "Philosophy" },
  { id: "shelf-reread", name: "Reread" },
];

function renderCard(
  overrides: Partial<Parameters<typeof DocumentCard>[0]> = {},
) {
  const props = {
    document,
    isSelected: false,
    viewMode: "grid" as const,
    onClick: vi.fn(),
    onDoubleClick: vi.fn(),
    onDelete: vi.fn(),
    shelves,
    shelfIds: new Set(["shelf-philosophy"]),
    onToggleShelf: vi.fn(),
    ...overrides,
  };

  const { container } = render(<DocumentCard {...props} />);
  return { ...props, container };
}

function openMenu(container: HTMLElement) {
  const card = container.querySelector(".document-card");
  expect(card).not.toBeNull();
  fireEvent.contextMenu(card as Element);
}

describe("DocumentCard shelves", () => {
  it("checks the shelves the book is already filed on", () => {
    const { container } = renderCard();

    openMenu(container);

    expect(screen.getByRole("checkbox", { name: "Philosophy" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Reread" })).not.toBeChecked();
  });

  it("reports an unfiled shelf as not yet filed", () => {
    const { container, onToggleShelf } = renderCard();

    openMenu(container);
    fireEvent.click(screen.getByRole("checkbox", { name: "Reread" }));

    expect(onToggleShelf).toHaveBeenCalledWith("shelf-reread", false);
  });

  it("reports a filed shelf as already filed, so it can be removed", () => {
    const { container, onToggleShelf } = renderCard();

    openMenu(container);
    fireEvent.click(screen.getByRole("checkbox", { name: "Philosophy" }));

    expect(onToggleShelf).toHaveBeenCalledWith("shelf-philosophy", true);
  });

  it("keeps the menu open so several shelves can be picked in one pass", () => {
    const { container } = renderCard();

    openMenu(container);
    fireEvent.click(screen.getByRole("checkbox", { name: "Reread" }));

    expect(
      screen.getByRole("checkbox", { name: "Philosophy" }),
    ).toBeInTheDocument();
  });

  it("offers the same filing controls in list view", () => {
    const { container } = renderCard({ viewMode: "list" });

    openMenu(container);

    expect(
      screen.getByRole("checkbox", { name: "Philosophy" }),
    ).toBeInTheDocument();
  });

  it("shows no filing controls when the card is given no shelves", () => {
    const { container } = renderCard({ shelves: [] });

    openMenu(container);

    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    // The menu itself still opened — this is the absence of shelves, not the
    // absence of a menu.
    expect(screen.getByRole("button", { name: "Open" })).toBeInTheDocument();
  });
});
