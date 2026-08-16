/**
 * Slice 146 — the three destructive/renaming controls must confirm INSIDE
 * the app before acting. The packaged WebKitGTK app shims the native
 * confirm/prompt into PROMISES (always truthy), so `if (window.confirm(...))`
 * deletes without the user ever answering — jsdom's synchronous confirm
 * cannot catch this, which is exactly why these tests assert the in-app
 * flow and why the production files must not reference the natives at all.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { DocumentCard } from "../../components/library/DocumentCard";
import type { Document } from "../../lib/schemas";

const DOC: Document = {
  id: "a1b2c3d4e5f60718293a4b5c6d7e8f9012345678abcd1234ef567890abcdef12",
  filePath: "/books/paper-1.pdf",
  title: "Paper One",
  pageCount: 20,
  currentPage: 4,
  scrollPosition: 0,
  lastTtsChunkId: null,
  lastOpenedAt: "2026-08-16T10:00:00Z",
  fileHash: null,
  createdAt: "2026-08-01T00:00:00Z",
} as Document;

function renderCard(onDelete: () => void) {
  const props = {
    document: DOC,
    isSelected: false,
    viewMode: "grid" as const,
    onClick: vi.fn(),
    onDoubleClick: vi.fn(),
    onDelete,
    shelves: undefined,
    shelfIds: undefined,
    onToggleShelf: undefined,
  };
  return render(<DocumentCard {...props} />);
}

beforeEach(() => {
  vi.useRealTimers();
});

describe("confirm dialogs (146)", () => {
  it("production library components never reference the native confirm/prompt", () => {
    const HERE = dirname(fileURLToPath(import.meta.url));
    const SRC = join(HERE, "../..");
    const files = [
      "components/library/DocumentCard.tsx",
      "components/library/LibraryView.tsx",
      "components/library/ShelfSidebar.tsx",
    ];
    const markers = [/window\.confirm/, /window\.prompt/];
    for (const file of files) {
      const text = readFileSync(join(SRC, file), "utf8");
      for (const marker of markers) {
        expect(text, `${file} must not use ${marker}`).not.toMatch(marker);
      }
    }
  });

  it("card delete does NOT fire on the first click — only the second", () => {
    const onDelete = vi.fn();
    renderCard(onDelete);

    fireEvent.click(screen.getByRole("button", { name: "Remove from library" }));
    expect(onDelete).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Click again to confirm remove" }),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Click again to confirm remove" }),
    );
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("card delete confirmation auto-dismisses", () => {
    vi.useFakeTimers();
    const onDelete = vi.fn();
    renderCard(onDelete);

    fireEvent.click(screen.getByRole("button", { name: "Remove from library" }));
    expect(onDelete).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    // Reset: the control reads as a plain delete again.
    expect(
      screen.getByRole("button", { name: "Remove from library" }),
    ).toBeInTheDocument();
  });
});
