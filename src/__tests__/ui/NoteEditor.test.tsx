import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NoteEditor } from "../../components/highlights/NoteEditor";
import type { Highlight } from "../../lib/schemas";

const HIGHLIGHT: Highlight = {
  id: "00000000-0000-4000-8000-000000000001",
  documentId: "document-id",
  pageNumber: 1,
  rects: [{ x: 1, y: 2, width: 3, height: 4 }],
  color: "#ffff00",
  textContent: "Selected text",
  note: "Existing note",
  createdAt: "2026-07-30T12:00:00.000Z",
  updatedAt: null,
};

describe("NoteEditor", () => {
  it("edits and saves a trimmed note with the keyboard shortcut", () => {
    const onSave = vi.fn();
    const onClose = vi.fn();
    render(
      <NoteEditor highlight={HIGHLIGHT} onSave={onSave} onClose={onClose} />,
    );

    const textarea = screen.getByRole("textbox", { name: "Note" });
    expect(textarea).toHaveFocus();
    fireEvent.change(textarea, { target: { value: "  Updated note  " } });
    fireEvent.keyDown(textarea, { key: "Enter", ctrlKey: true });

    expect(onSave).toHaveBeenCalledWith(HIGHLIGHT.id, "Updated note");
    expect(onClose).toHaveBeenCalledOnce();
  });

  it.each([
    [
      "Escape",
      () => fireEvent.keyDown(screen.getByRole("textbox"), { key: "Escape" }),
    ],
    ["backdrop click", () => fireEvent.click(screen.getByRole("dialog"))],
  ])("closes on %s", (_action, closeDialog) => {
    const onClose = vi.fn();
    render(
      <NoteEditor
        highlight={{ ...HIGHLIGHT, note: null }}
        onSave={vi.fn()}
        onClose={onClose}
      />,
    );

    closeDialog();

    expect(screen.getByRole("heading")).toHaveTextContent("Add Note");
    expect(onClose).toHaveBeenCalledOnce();
  });
});
