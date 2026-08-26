/**
 * Unit tests for the TTS word-highlight (karaoke) store.
 *
 * Covers the state machine that drives word-by-word highlighting:
 * start/stop/pause/resume transitions, their guards, currentWord updates,
 * and the derived selectors. Previously 0% covered.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  useTtsHighlightStore,
  selectCurrentWord,
  selectIsHighlighting,
} from "../../stores/tts-highlight-store";
import type { WordTiming } from "../../lib/api/ai-tts";

const wt = (word: string, startTime: number, endTime: number): WordTiming => ({
  word,
  startTime,
  endTime,
  charStart: 0,
  charEnd: word.length,
});

describe("tts-highlight-store", () => {
  beforeEach(() => {
    useTtsHighlightStore.getState().reset();
  });

  afterEach(() => {
    // Restore any performance.now stub even if a test failed before cleanup,
    // so mocks never leak into later tests.
    vi.restoreAllMocks();
  });

  it("startHighlighting activates with timings, text, page, and word index 0", () => {
    const timings = [wt("Hello", 0, 0.5), wt("world", 0.5, 1)];
    useTtsHighlightStore
      .getState()
      .startHighlighting("Hello world", timings, 1.0, 3);

    const s = useTtsHighlightStore.getState();
    expect(s.isActive).toBe(true);
    expect(s.isPaused).toBe(false);
    expect(s.wordTimings).toEqual(timings);
    expect(s.totalDuration).toBe(1.0);
    expect(s.currentText).toBe("Hello world");
    expect(s.pageNumber).toBe(3);
    expect(s.currentWordIndex).toBe(0);
    expect(s.playbackStartTime).not.toBeNull();
    expect(s.pausedAtTime).toBeNull();
  });

  it("stopHighlighting clears active + playback fields", () => {
    const st = useTtsHighlightStore.getState();
    st.startHighlighting("a b", [wt("a", 0, 0.5), wt("b", 0.5, 1)], 1, 1);
    st.stopHighlighting();

    const s = useTtsHighlightStore.getState();
    expect(s.isActive).toBe(false);
    expect(s.isPaused).toBe(false);
    expect(s.currentWordIndex).toBe(-1);
    expect(s.playbackStartTime).toBeNull();
    expect(s.pausedAtTime).toBeNull();
    expect(s.wordTimings).toEqual([]);
    expect(s.currentText).toBeNull();
    expect(s.pageNumber).toBeNull();
  });

  it("pauseHighlighting records elapsed time when active", () => {
    const st = useTtsHighlightStore.getState();
    st.startHighlighting("a", [wt("a", 0, 1)], 1, 1);
    st.pauseHighlighting();

    const s = useTtsHighlightStore.getState();
    expect(s.isPaused).toBe(true);
    expect(s.pausedAtTime).not.toBeNull();
    expect(s.pausedAtTime as number).toBeGreaterThanOrEqual(0);
  });

  it("pauseHighlighting is a no-op when not active", () => {
    useTtsHighlightStore.getState().pauseHighlighting();
    const s = useTtsHighlightStore.getState();
    expect(s.isPaused).toBe(false);
    expect(s.pausedAtTime).toBeNull();
  });

  it("pauseHighlighting does not overwrite pausedAtTime when already paused", () => {
    const st = useTtsHighlightStore.getState();
    st.startHighlighting("a", [wt("a", 0, 1)], 1, 1);
    st.pauseHighlighting();
    const first = useTtsHighlightStore.getState().pausedAtTime;
    st.pauseHighlighting();
    expect(useTtsHighlightStore.getState().pausedAtTime).toBe(first);
  });

  it("pauseHighlighting is a no-op when active but playbackStartTime is null", () => {
    useTtsHighlightStore.setState({
      isActive: true,
      playbackStartTime: null,
      pausedAtTime: null,
    });
    useTtsHighlightStore.getState().pauseHighlighting();
    expect(useTtsHighlightStore.getState().isPaused).toBe(false);
    expect(useTtsHighlightStore.getState().pausedAtTime).toBeNull();
  });

  it("resumeHighlighting re-anchors playbackStartTime to now - pausedAtTime", () => {
    // Stub performance.now() so the re-anchor formula is asserted exactly:
    // a regression to `playbackStartTime = performance.now()` would fail here.
    const nowSpy = vi.spyOn(performance, "now");
    const st = useTtsHighlightStore.getState();

    nowSpy.mockReturnValue(1000); // start -> playbackStartTime = 1000
    st.startHighlighting("a", [wt("a", 0, 1)], 1, 1);
    expect(useTtsHighlightStore.getState().playbackStartTime).toBe(1000);

    nowSpy.mockReturnValue(1500); // pause -> pausedAtTime = 1500 - 1000 = 500
    st.pauseHighlighting();
    expect(useTtsHighlightStore.getState().pausedAtTime).toBe(500);

    nowSpy.mockReturnValue(2000); // resume -> playbackStartTime = 2000 - 500 = 1500
    st.resumeHighlighting();
    const s = useTtsHighlightStore.getState();
    expect(s.playbackStartTime).toBe(1500);
    expect(s.pausedAtTime).toBeNull();
    expect(s.isPaused).toBe(false);

    nowSpy.mockRestore();
  });

  it("resumeHighlighting is a no-op when not paused", () => {
    const st = useTtsHighlightStore.getState();
    st.startHighlighting("a", [wt("a", 0, 1)], 1, 1);
    const before = useTtsHighlightStore.getState().playbackStartTime;
    st.resumeHighlighting();
    expect(useTtsHighlightStore.getState().playbackStartTime).toBe(before);
    expect(useTtsHighlightStore.getState().isPaused).toBe(false);
  });

  it("updateCurrentWord emits only when the index changes", () => {
    const st = useTtsHighlightStore.getState();
    st.startHighlighting("a b", [wt("a", 0, 0.5), wt("b", 0.5, 1)], 1, 1); // index 0
    let emissions = 0;
    const unsub = useTtsHighlightStore.subscribe(() => {
      emissions += 1;
    });
    st.updateCurrentWord(0); // unchanged -> guarded, no set()
    expect(emissions).toBe(0);
    expect(useTtsHighlightStore.getState().currentWordIndex).toBe(0);
    st.updateCurrentWord(1); // changed -> set()
    expect(emissions).toBe(1);
    expect(useTtsHighlightStore.getState().currentWordIndex).toBe(1);
    unsub();
  });

  it("setPlaybackStartTime overrides the start time", () => {
    useTtsHighlightStore.getState().setPlaybackStartTime(1234);
    expect(useTtsHighlightStore.getState().playbackStartTime).toBe(1234);
  });

  it("reset returns to the initial state", () => {
    const st = useTtsHighlightStore.getState();
    st.startHighlighting("a", [wt("a", 0, 1)], 1, 5);
    st.reset();

    const s = useTtsHighlightStore.getState();
    expect(s.isActive).toBe(false);
    expect(s.wordTimings).toEqual([]);
    expect(s.totalDuration).toBe(0);
    expect(s.currentWordIndex).toBe(-1);
    expect(s.currentText).toBeNull();
    expect(s.pageNumber).toBeNull();
  });

  describe("selectors", () => {
    it("selectCurrentWord returns the active word", () => {
      const timings = [wt("Hello", 0, 0.5), wt("world", 0.5, 1)];
      useTtsHighlightStore
        .getState()
        .startHighlighting("Hello world", timings, 1, 1);
      useTtsHighlightStore.getState().updateCurrentWord(1);
      expect(selectCurrentWord(useTtsHighlightStore.getState())?.word).toBe(
        "world",
      );
    });

    it("selectCurrentWord returns null when the index is out of range", () => {
      useTtsHighlightStore
        .getState()
        .startHighlighting("a", [wt("a", 0, 1)], 1, 1);
      useTtsHighlightStore.getState().updateCurrentWord(5);
      expect(selectCurrentWord(useTtsHighlightStore.getState())).toBeNull();
    });

    it("selectCurrentWord returns null when stopped (index -1)", () => {
      expect(selectCurrentWord(useTtsHighlightStore.getState())).toBeNull();
    });

    it("selectIsHighlighting is true only while active and not paused", () => {
      const st = useTtsHighlightStore.getState();
      expect(selectIsHighlighting(useTtsHighlightStore.getState())).toBe(false);
      st.startHighlighting("a", [wt("a", 0, 1)], 1, 1);
      expect(selectIsHighlighting(useTtsHighlightStore.getState())).toBe(true);
      st.pauseHighlighting();
      expect(selectIsHighlighting(useTtsHighlightStore.getState())).toBe(false);
    });
  });
});
