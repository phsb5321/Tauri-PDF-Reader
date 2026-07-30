import {
  act,
  fireEvent,
  render,
  renderHook,
  waitFor,
} from "@testing-library/react";
import type { PDFPageProxy } from "pdfjs-dist";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TextLayer, useTextSelection } from "../../components/TextLayer";
import type { Highlight } from "../../lib/schemas";
import { useDocumentStore } from "../../stores/document-store";

const pdfTextLayer = vi.hoisted(() => ({
  cancel: vi.fn(),
  render: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("pdfjs-dist", () => ({
  TextLayer: vi.fn(() => pdfTextLayer),
}));

vi.mock("../../components/pdf-viewer/TtsWordHighlight", () => ({
  TtsWordHighlight: ({ pageNumber }: { pageNumber: number }) => (
    <div data-testid="tts-word-highlight">{pageNumber}</div>
  ),
}));

const HIGHLIGHT: Highlight = {
  id: "00000000-0000-4000-8000-000000000001",
  documentId: "document-id",
  pageNumber: 1,
  rects: [{ x: 2, y: 3, width: 4, height: 5 }],
  color: "#ffff00",
  textContent: "Selected text",
  note: null,
  createdAt: "2026-07-30T12:00:00.000Z",
  updatedAt: null,
};

const viewport = { width: 100, height: 200 };
const page = {
  pageNumber: 1,
  getViewport: vi.fn(() => viewport),
  getTextContent: vi.fn().mockResolvedValue({ items: [] }),
} as unknown as PDFPageProxy;

describe("TextLayer", () => {
  beforeEach(() => {
    useDocumentStore.setState({
      highlightsForPage: new Map([[1, [HIGHLIGHT]]]),
      selectedHighlightId: null,
    });
  });

  afterEach(() => {
    useDocumentStore.getState().reset();
    vi.restoreAllMocks();
  });

  it("renders PDF text, highlights, and a normalized text selection", async () => {
    const onTextSelect = vi.fn();
    const { container, unmount } = render(
      <TextLayer page={page} scale={2} onTextSelect={onTextSelect} />,
    );
    await waitFor(() => expect(pdfTextLayer.render).toHaveBeenCalled());

    const layer = container.querySelector<HTMLElement>(".text-layer-container");
    if (!layer) throw new Error("Text layer container was not rendered");
    vi.spyOn(layer, "getBoundingClientRect").mockReturnValue({
      left: 10,
      top: 20,
      width: 100,
      height: 200,
      right: 110,
      bottom: 220,
      x: 10,
      y: 20,
      toJSON: () => ({}),
    });
    vi.spyOn(window, "getSelection").mockReturnValue({
      isCollapsed: false,
      toString: () => " Selected text ",
      getRangeAt: () => ({
        getClientRects: () =>
          [
            { left: 14, top: 26, width: 8, height: 10 },
          ] as unknown as DOMRectList,
      }),
    } as unknown as Selection);

    fireEvent.mouseDown(layer);
    fireEvent.mouseUp(layer);
    const highlight = container.querySelector(".highlight-group");
    if (!highlight) throw new Error("Highlight group was not rendered");
    fireEvent.click(highlight);

    expect(onTextSelect).toHaveBeenCalledWith({
      text: "Selected text",
      pageNumber: 1,
      rects: [{ x: 2, y: 3, width: 4, height: 5 }],
    });
    expect(useDocumentStore.getState().selectedHighlightId).toBe(HIGHLIGHT.id);
    fireEvent.keyDown(highlight, { key: "Enter" });
    expect(useDocumentStore.getState().selectedHighlightId).toBeNull();
    fireEvent.keyDown(highlight, { key: " " });
    expect(useDocumentStore.getState().selectedHighlightId).toBe(HIGHLIGHT.id);
    await waitFor(() =>
      expect(
        container.querySelector("[data-testid='tts-word-highlight']"),
      ).toBeTruthy(),
    );

    unmount();
    expect(pdfTextLayer.cancel).toHaveBeenCalled();
  });

  it("reports text-layer render failures", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const failingPage = {
      ...page,
      getTextContent: vi.fn().mockRejectedValue(new Error("Render failed")),
    } as unknown as PDFPageProxy;

    render(<TextLayer page={failingPage} scale={1} onTextSelect={vi.fn()} />);

    await waitFor(() =>
      expect(consoleError).toHaveBeenCalledWith(
        "[TextLayer] Error rendering text layer:",
        expect.any(Error),
      ),
    );
  });

  it("tracks and clears pending selections", () => {
    const removeAllRanges = vi.fn();
    vi.spyOn(window, "getSelection").mockReturnValue({
      removeAllRanges,
    } as unknown as Selection);
    const { result } = renderHook(() => useTextSelection());
    const selection = {
      text: "Text",
      pageNumber: 1,
      rects: [{ x: 1, y: 1, width: 1, height: 1 }],
    };

    act(() => result.current.handleTextSelect(selection));
    expect(result.current.pendingSelection).toEqual(selection);

    act(() => result.current.clearSelection());
    expect(result.current.pendingSelection).toBeNull();
    expect(removeAllRanges).toHaveBeenCalledOnce();
  });
});
