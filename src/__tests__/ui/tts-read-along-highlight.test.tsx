/**
 * Read-along paint contract.
 *
 * Two defects motivated this: the setup effect rewired its MutationObserver on
 * every word and left its deferred callback untracked, so a repaint scheduled
 * for word A could land after the cursor had already moved to B and repaint the
 * stale word; and only one tier was painted, leaving the reader with a lone
 * jumping chip and no sense of the sentence being spoken.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, act } from "@testing-library/react";
import { TtsWordHighlight } from "../../components/pdf-viewer/TtsWordHighlight";
import { useTtsHighlightStore } from "../../stores/tts-highlight-store";
import type { WordTiming } from "../../lib/api/ai-tts";

const TEXT = "Alpha beta gamma";

const TIMINGS: WordTiming[] = [
  { word: "Alpha", charStart: 0, charEnd: 5, startTime: 0, endTime: 1 },
  { word: "beta", charStart: 6, charEnd: 10, startTime: 1, endTime: 2 },
  { word: "gamma", charStart: 11, charEnd: 16, startTime: 2, endTime: 3 },
];

// The component reads CSS.highlights support once, at module load, so the
// registry has to exist before the import is evaluated.
const { registry } = vi.hoisted(() => {
  class FakeHighlight {
    priority = 0;
    readonly ranges: Range[];
    constructor(...ranges: Range[]) {
      this.ranges = ranges;
    }
  }
  const registry = new Map<string, InstanceType<typeof FakeHighlight>>();
  Object.defineProperty(globalThis, "Highlight", {
    configurable: true,
    writable: true,
    value: FakeHighlight,
  });
  Object.defineProperty(globalThis.CSS, "highlights", {
    configurable: true,
    value: registry,
  });
  return { registry };
});

/** What the reader would actually see painted under `name`. */
function painted(name: string): string[] {
  const entry = registry.get(name);
  return entry ? entry.ranges.map((range) => range.toString()) : [];
}

function mountTextLayer(): HTMLElement {
  const page = document.createElement("div");
  page.setAttribute("data-page-number", "1");
  const layer = document.createElement("div");
  layer.className = "textLayer";
  const span = document.createElement("span");
  span.dataset.ttsStart = "0";
  span.dataset.ttsText = TEXT;
  span.textContent = TEXT;
  layer.appendChild(span);
  page.appendChild(layer);
  document.body.appendChild(page);
  return page;
}

describe("read-along highlight", () => {
  let page: HTMLElement;

  beforeEach(() => {
    vi.useFakeTimers();
    registry.clear();
    page = mountTextLayer();
    useTtsHighlightStore.getState().reset();
  });

  afterEach(() => {
    useTtsHighlightStore.getState().reset();
    page.remove();
    vi.useRealTimers();
  });

  function start() {
    act(() => {
      useTtsHighlightStore
        .getState()
        .startHighlighting(TEXT, TIMINGS, 3, 1, false);
    });
  }

  it("paints the spoken run as a band under the current word mark", () => {
    render(<TtsWordHighlight pageNumber={1} scale={1} />);
    start();

    expect(painted("tts-active-sentence")).toEqual([TEXT]);
    expect(painted("tts-current-word")).toEqual(["Alpha"]);
    // The band must sit under the word, never over it.
    expect(registry.get("tts-active-sentence")!.priority).toBeLessThan(
      registry.get("tts-current-word")!.priority,
    );
  });

  it("keeps exactly one word range painted as the cursor advances", () => {
    render(<TtsWordHighlight pageNumber={1} scale={1} />);
    start();

    act(() => {
      useTtsHighlightStore.getState().updateCurrentWord(1);
    });

    expect(painted("tts-current-word")).toEqual(["beta"]);
    expect(registry.get("tts-current-word")!.ranges).toHaveLength(1);
  });

  it("drops a delayed repaint scheduled before the cursor moved on", async () => {
    render(<TtsWordHighlight pageNumber={1} scale={1} />);
    start();
    expect(painted("tts-current-word")).toEqual(["Alpha"]);

    // A text-layer rebuild schedules a deferred re-setup while "Alpha" is
    // still current. Awaiting the microtask queue is what makes the observer
    // actually deliver here, instead of after the cursor has moved on — the
    // ordering that produced the stale repaint.
    await act(async () => {
      page
        .querySelector(".textLayer")!
        .appendChild(document.createElement("span"));
      await Promise.resolve();
    });

    // The cursor advances to "gamma" before that deferred callback runs...
    await act(async () => {
      useTtsHighlightStore.getState().updateCurrentWord(2);
    });
    expect(painted("tts-current-word")).toEqual(["gamma"]);

    // ...and when the stale callback finally fires it must not resurrect
    // "Alpha".
    await act(async () => {
      vi.advanceTimersByTime(200);
      await Promise.resolve();
    });

    expect(painted("tts-current-word")).toEqual(["gamma"]);
  });

  it("clears both tiers when narration stops", () => {
    render(<TtsWordHighlight pageNumber={1} scale={1} />);
    start();

    act(() => {
      useTtsHighlightStore.getState().stopHighlighting();
    });

    expect(registry.has("tts-current-word")).toBe(false);
    expect(registry.has("tts-active-sentence")).toBe(false);
  });
});
