import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HighlightsPanel } from "../../components/highlights/HighlightsPanel";
import { DocumentCard } from "../../components/library/DocumentCard";
import { HighlightOverlay } from "../../components/pdf-viewer/HighlightOverlay";
import { SessionItem } from "../../components/session-menu/SessionItem";
import type { Highlight, Document } from "../../lib/schemas";

const DOCUMENT: Document = {
  id: "document-id",
  filePath: "/books/accessibility.pdf",
  title: "Accessibility",
  pageCount: 10,
  currentPage: 2,
  scrollPosition: 0,
  lastTtsChunkId: null,
  lastOpenedAt: null,
  fileHash: null,
  createdAt: "2026-07-30T12:00:00.000Z",
};

const HIGHLIGHT: Highlight = {
  id: "00000000-0000-4000-8000-000000000001",
  documentId: DOCUMENT.id,
  pageNumber: 2,
  rects: [{ x: 1, y: 2, width: 3, height: 4 }],
  color: "#ffff00",
  textContent: "Native controls",
  note: "Prefer built-in semantics",
  createdAt: "2026-07-30T12:00:00.000Z",
  updatedAt: null,
};

function expectNoNestedButtons(container: HTMLElement) {
  expect(container.querySelector("button button")).toBeNull();
}

describe("native HTML interactions", () => {
  it.each(["grid", "list"] as const)(
    "opens a %s document card with Enter",
    (viewMode) => {
      const onClick = vi.fn();
      const onDoubleClick = vi.fn();
      const { container } = render(
        <DocumentCard
          document={DOCUMENT}
          isSelected={false}
          viewMode={viewMode}
          onClick={onClick}
          onDoubleClick={onDoubleClick}
          onDelete={vi.fn()}
        />,
      );

      const primaryAction = container.querySelector<HTMLButtonElement>(
        ".document-card-open",
      );
      if (!primaryAction) {
        throw new Error("Document card primary action was not rendered");
      }
      fireEvent.keyDown(primaryAction, { key: "Enter" });

      expect(onDoubleClick).toHaveBeenCalledOnce();
      expect(onClick).not.toHaveBeenCalled();
      expectNoNestedButtons(container);
    },
  );

  it("keeps highlight actions as sibling buttons", () => {
    const { container } = render(
      <HighlightsPanel
        highlights={[HIGHLIGHT]}
        selectedHighlightId={null}
        onHighlightClick={vi.fn()}
        onHighlightDelete={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expectNoNestedButtons(container);
  });

  it("keeps overlay actions as sibling buttons", () => {
    const { container } = render(
      <HighlightOverlay
        highlights={[HIGHLIGHT]}
        scale={1}
        viewportWidth={100}
        viewportHeight={100}
        selectedHighlightId={null}
      />,
    );

    expectNoNestedButtons(container);
  });

  it("keeps session restore and delete actions as sibling buttons", () => {
    const { container } = render(
      <SessionItem
        session={{
          id: "session-id",
          name: "Reading",
          documentCount: 1,
          lastAccessedAt: "2026-07-30T12:00:00.000Z",
          createdAt: "2026-07-30T12:00:00.000Z",
        }}
        onRestore={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expectNoNestedButtons(container);
  });
});
