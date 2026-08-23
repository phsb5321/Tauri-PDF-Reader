import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

vi.mock("../lib/tauri-invoke", () => ({
  aiTtsStop: vi.fn(() => Promise.resolve()),
}));

import { navigatePageBy, usePageNavigation } from "./usePageNavigation";
import { aiTtsStop } from "../lib/tauri-invoke";
import { useDocumentStore } from "../stores/document-store";
import { useAiTtsStore } from "../stores/ai-tts-store";

/** Put the document store on a known page in a document of known length. */
function atPage(page: number, totalPages = 100) {
  useDocumentStore.setState({ currentPage: page, totalPages });
}

function playbackState(state: "idle" | "playing" | "paused") {
  useAiTtsStore.setState({ playbackState: state });
}

beforeEach(() => {
  vi.mocked(aiTtsStop).mockReset();
  vi.mocked(aiTtsStop).mockResolvedValue(undefined);
  atPage(5);
  playbackState("idle");
});

describe("navigatePageBy", () => {
  it("moves by the delta in both directions", async () => {
    await navigatePageBy(1);
    expect(useDocumentStore.getState().currentPage).toBe(6);

    await navigatePageBy(-1);
    expect(useDocumentStore.getState().currentPage).toBe(5);
  });

  it("leaves playback alone when nothing is playing", async () => {
    await navigatePageBy(1);
    expect(aiTtsStop).not.toHaveBeenCalled();
  });

  it("stops playback before changing the page", async () => {
    const order: string[] = [];
    vi.mocked(aiTtsStop).mockImplementation(() => {
      order.push(`stop@${useDocumentStore.getState().currentPage}`);
      return Promise.resolve();
    });
    playbackState("playing");

    await navigatePageBy(1);

    // The page was still 5 when the stop was issued: audio for the page being
    // left never continues into the new one.
    expect(order).toEqual(["stop@5"]);
    expect(useDocumentStore.getState().currentPage).toBe(6);
  });

  it("cancels an in-flight synthesis before changing the page", async () => {
    playbackState("loading");
    await navigatePageBy(1);
    expect(aiTtsStop).toHaveBeenCalledOnce();
  });

  it("stops from paused too", async () => {
    playbackState("paused");
    await navigatePageBy(1);
    expect(aiTtsStop).toHaveBeenCalledOnce();
  });

  it("still turns the page when stopping playback fails", async () => {
    playbackState("playing");
    vi.mocked(aiTtsStop).mockRejectedValue(new Error("no player"));

    await navigatePageBy(1);

    // A dead TTS process must not strand the reader on the page.
    expect(useDocumentStore.getState().currentPage).toBe(6);
  });

  it("advances once per call when repeats arrive during the stop", async () => {
    // The regression this module exists for. A held PageDown fires keydown far
    // faster than the stop IPC returns, so the second call starts while the
    // first is still awaiting. If the page were read before the await both
    // would compute 5 + 1 and the reader would advance a single page for two
    // presses. Reading after it means the second call sees what the first
    // wrote.
    let releaseStop: () => void = () => {};
    const stopped = new Promise<void>((resolve) => {
      releaseStop = resolve;
    });
    vi.mocked(aiTtsStop).mockReturnValue(stopped);
    playbackState("playing");

    const first = navigatePageBy(1);
    const second = navigatePageBy(1);
    expect(useDocumentStore.getState().currentPage).toBe(5); // both in flight

    releaseStop();
    await Promise.all([first, second]);

    expect(useDocumentStore.getState().currentPage).toBe(7);
  });

  it("clamps at both ends of the document", async () => {
    atPage(1, 3);
    await navigatePageBy(-1);
    expect(useDocumentStore.getState().currentPage).toBe(1);

    atPage(3, 3);
    await navigatePageBy(1);
    expect(useDocumentStore.getState().currentPage).toBe(3);
  });
});

describe("usePageNavigation", () => {
  it("returns callbacks that navigate", async () => {
    const { result } = renderHook(() => usePageNavigation());

    result.current.goToNextPage();
    await vi.waitFor(() =>
      expect(useDocumentStore.getState().currentPage).toBe(6),
    );

    result.current.goToPrevPage();
    await vi.waitFor(() =>
      expect(useDocumentStore.getState().currentPage).toBe(5),
    );
  });

  it("keeps the same callback identity across renders", () => {
    // The handlers object in ReaderView is rebuilt every render. If these
    // changed identity the command dispatchers would see new handlers each
    // time, which is the churn the empty dependency arrays exist to avoid.
    const { result, rerender } = renderHook(() => usePageNavigation());
    const first = result.current;

    rerender();

    expect(result.current.goToNextPage).toBe(first.goToNextPage);
    expect(result.current.goToPrevPage).toBe(first.goToPrevPage);
  });
});
