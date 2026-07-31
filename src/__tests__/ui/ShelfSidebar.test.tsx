/**
 * Tests for ShelfSidebar.
 *
 * Verifies:
 * - The two built-in views (all books, unfiled) plus every shelf, with counts
 * - Selecting a shelf reports the shelf id, and the built-ins their sentinels
 * - Creating a shelf trims the name and refuses a blank one
 * - Rename and delete confirm first, and a cancelled prompt changes nothing
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ShelfSidebar } from "../../components/library/ShelfSidebar";
import { UNFILED } from "../../domain/library/shelves";
import type { Collection } from "../../lib/schemas";

const shelves: Collection[] = [
  {
    id: "shelf-philosophy",
    name: "Philosophy",
    documentCount: 2,
    createdAt: "2026-07-01T00:00:00Z",
    updatedAt: "2026-07-01T00:00:00Z",
  },
  {
    id: "shelf-reread",
    name: "Reread",
    documentCount: 0,
    createdAt: "2026-07-02T00:00:00Z",
    updatedAt: "2026-07-02T00:00:00Z",
  },
];

function renderSidebar(
  overrides: Partial<Parameters<typeof ShelfSidebar>[0]> = {},
) {
  const props = {
    shelves,
    selectedShelfId: null,
    totalCount: 7,
    unfiledCount: 5,
    onSelect: vi.fn(),
    onCreate: vi.fn(),
    onRename: vi.fn(),
    onDelete: vi.fn(),
    ...overrides,
  };

  render(<ShelfSidebar {...props} />);
  return props;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ShelfSidebar", () => {
  it("lists the built-in views and every shelf with its count", () => {
    renderSidebar();

    expect(screen.getByText("All books")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("Unfiled")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("Philosophy")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("Reread")).toBeInTheDocument();
  });

  it("marks the selected shelf as current", () => {
    renderSidebar({ selectedShelfId: "shelf-philosophy" });

    const selected = screen.getByRole("button", { current: true });

    expect(selected).toHaveTextContent("Philosophy");
  });

  it("reports the shelf id when a shelf is picked", () => {
    const { onSelect } = renderSidebar();

    fireEvent.click(screen.getByText("Philosophy"));

    expect(onSelect).toHaveBeenCalledWith("shelf-philosophy");
  });

  it("reports the sentinels for the built-in views", () => {
    const { onSelect } = renderSidebar({ selectedShelfId: "shelf-reread" });

    fireEvent.click(screen.getByText("Unfiled"));
    fireEvent.click(screen.getByText("All books"));

    expect(onSelect).toHaveBeenNthCalledWith(1, UNFILED);
    expect(onSelect).toHaveBeenNthCalledWith(2, null);
  });

  it("creates a shelf with the name trimmed, then clears the field", () => {
    const { onCreate } = renderSidebar();

    const input = screen.getByLabelText("New shelf");
    fireEvent.change(input, { target: { value: "  Poetry  " } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    expect(onCreate).toHaveBeenCalledWith("Poetry");
    expect(input).toHaveValue("");
  });

  it("cannot create a blank shelf", () => {
    const { onCreate } = renderSidebar();

    fireEvent.change(screen.getByLabelText("New shelf"), {
      target: { value: "   " },
    });

    expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();
    expect(onCreate).not.toHaveBeenCalled();
  });

  it("renames a shelf with the answer given", () => {
    vi.spyOn(window, "prompt").mockReturnValue("Ethics");
    const { onRename } = renderSidebar();

    fireEvent.click(screen.getByRole("button", { name: "Rename Philosophy" }));

    expect(onRename).toHaveBeenCalledWith("shelf-philosophy", "Ethics");
  });

  it("leaves the shelf alone when the rename prompt is cancelled", () => {
    vi.spyOn(window, "prompt").mockReturnValue(null);
    const { onRename } = renderSidebar();

    fireEvent.click(screen.getByRole("button", { name: "Rename Philosophy" }));

    expect(onRename).not.toHaveBeenCalled();
  });

  it("deletes a shelf once the warning is accepted", () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const { onDelete } = renderSidebar();

    fireEvent.click(screen.getByRole("button", { name: "Delete Reread" }));

    expect(onDelete).toHaveBeenCalledWith("shelf-reread");
  });

  it("keeps the shelf when the delete warning is declined", () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const { onDelete } = renderSidebar();

    fireEvent.click(screen.getByRole("button", { name: "Delete Reread" }));

    expect(onDelete).not.toHaveBeenCalled();
  });
});
