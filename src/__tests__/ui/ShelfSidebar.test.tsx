/**
 * Tests for ShelfSidebar.
 *
 * Verifies:
 * - The two built-in views (all books, unfiled) plus every shelf, with counts
 * - Selecting a shelf reports the shelf id, and the built-ins their sentinels
 * - Creating a shelf trims the name and refuses a blank one
 * - Delete is click-again-to-confirm (slice 146): the destructive action
 *   fires ONLY on the second click, and never via a native confirm (a
 *   Promise shim in the packaged WebKitGTK app makes it always truthy).
 * - Rename is an in-app dialog (the native prompt is a bare text prompt);
 *   Save with a new name renames, Cancel/blank/unchanged do not.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
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

  it("renames a shelf through the in-app dialog", () => {
    const { onRename } = renderSidebar();

    fireEvent.click(screen.getByRole("button", { name: "Rename Philosophy" }));
    const input = screen.getByLabelText("Shelf name");
    expect(input).toHaveValue("Philosophy");
    fireEvent.change(input, { target: { value: "Ethics" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(onRename).toHaveBeenCalledWith("shelf-philosophy", "Ethics");
  });

  it("leaves the shelf alone when the rename dialog is cancelled", () => {
    const { onRename } = renderSidebar();

    fireEvent.click(screen.getByRole("button", { name: "Rename Philosophy" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onRename).not.toHaveBeenCalled();
  });

  it("leaves the shelf alone on a blank or unchanged rename", () => {
    const { onRename } = renderSidebar();

    fireEvent.click(screen.getByRole("button", { name: "Rename Philosophy" }));
    fireEvent.change(screen.getByLabelText("Shelf name"), {
      target: { value: "   " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onRename).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Rename Philosophy" }));
    fireEvent.change(screen.getByLabelText("Shelf name"), {
      target: { value: "Philosophy" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onRename).not.toHaveBeenCalled();
  });

  it("does NOT delete a shelf on the first click — only the second (click-again)", () => {
    const { onDelete } = renderSidebar();

    fireEvent.click(screen.getByRole("button", { name: "Delete Reread" }));
    expect(onDelete).not.toHaveBeenCalled();
    // The control now reads as a confirmation.
    expect(
      screen.getByRole("button", { name: "Click again to confirm delete Reread" }),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Click again to confirm delete Reread" }),
    );
    expect(onDelete).toHaveBeenCalledWith("shelf-reread");
  });

  it("returns focus to the Rename trigger when the dialog closes (unmount-while-active)", () => {
    const { onRename } = renderSidebar();
    const renameBtn = screen.getByRole("button", { name: "Rename Philosophy" });
    fireEvent.click(renameBtn);
    const input = screen.getByLabelText("Shelf name");
    fireEvent.change(input, { target: { value: "Ethics" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(onRename).toHaveBeenCalledWith("shelf-philosophy", "Ethics");
    // Keyboard focus returns to the triggering control (slice 146 — the
    // trap's own snapshot is the dialog's autoFocused input).
    expect(document.activeElement).toBe(renameBtn);
  });

  it("auto-dismisses the delete confirmation after the timeout", () => {
    vi.useFakeTimers();
    try {
      const { onDelete } = renderSidebar();
      fireEvent.click(screen.getByRole("button", { name: "Delete Reread" }));
      expect(onDelete).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(3000);
      });
      // The confirmation reset: the control reads as plain "Delete" again.
      expect(
        screen.getByRole("button", { name: "Delete Reread" }),
      ).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
