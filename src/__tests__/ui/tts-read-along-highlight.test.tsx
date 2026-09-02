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
import { useSettingsStore } from "../../stores/settings-store";
import type { WordTiming } from "../../lib/api/ai-tts";

const TEXT = "Alpha beta gamma";
const rangeRectDescriptor = Object.getOwnPropertyDescriptor(
  Range.prototype,
  "getBoundingClientRect",
);

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
  page.className = "pdf-viewer";
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
    useSettingsStore.setState({ ttsFollowAlong: true });
  });

  afterEach(() => {
    useTtsHighlightStore.getState().reset();
    page.remove();
    if (rangeRectDescriptor) {
      Object.defineProperty(
        Range.prototype,
        "getBoundingClientRect",
        rangeRectDescriptor,
      );
    } else {
      delete (
        Range.prototype as Range & {
          getBoundingClientRect?: () => DOMRect;
        }
      ).getBoundingClientRect;
    }
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

  it("coalesces stale range scrolls and follows the latest out-of-band word", () => {
    const scrollTo = vi.fn();
    Object.defineProperties(page, {
      scrollTop: { configurable: true, writable: true, value: 600 },
      scrollHeight: { configurable: true, value: 2_000 },
      clientHeight: { configurable: true, value: 400 },
      scrollTo: { configurable: true, value: scrollTo },
    });
    page.getBoundingClientRect = () => ({ top: 100, bottom: 500 }) as DOMRect;
    Object.defineProperty(Range.prototype, "getBoundingClientRect", {
      configurable: true,
      value(this: Range) {
        const text = this.toString();
        const top = text === "beta" ? 120 : text === "gamma" ? 470 : 250;
        return { top, bottom: top + 20 } as DOMRect;
      },
    });

    render(<TtsWordHighlight pageNumber={1} scale={1} />);
    start();
    expect(scrollTo).not.toHaveBeenCalled();
    act(() => {
      useTtsHighlightStore.getState().updateCurrentWord(1);
    });
    act(() => {
      useTtsHighlightStore.getState().updateCurrentWord(2);
    });
    act(() => {
      vi.runOnlyPendingTimers();
    });
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenCalledWith({ top: 780, behavior: "smooth" });
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
