/**
 * Karaoke Sync — integration harness
 *
 * Proves the headless-automatable half of the critical loop's "read-aloud with
 * the karaoke highlight SYNCED" acceptance bar: that the highlight-store's
 * `currentWordIndex` advances in step with the TTS timing marks — the active
 * word transitions on the first animation frame at/after each mark's boundary —
 * and that the 026 completion guard holds (no premature finish when duration is
 * unknown).
 *
 * Hardened after an adversarial review (Codex, WEAK→):
 *  - Drives the REAL production start path (`speakWithHighlight` + the mocked
 *    `aiTtsSpeakWithTimestamps` response + the `ai-tts:playback-starting` event),
 *    NOT just `startHighlighting`, so a regression that anchors timing to the
 *    response instead of the audio-start event is catchable.
 *  - Steps the clock to realistic frame times PAST each boundary (a real rAF
 *    samples `performance.now()` inside the frame; it cannot fire exactly on a
 *    boundary), so this proves loop/frame sync, not just the pure selector.
 *  - Resume is asserted exactly (stays at N until the resumed elapsed crosses
 *    the next boundary) and checks `isPaused`, not only `isActive`.
 *  - Includes a leading-silence case (first mark starts > 0).
 *
 * The visual/audible "does it feel right" stays the one 60-second human check;
 * the index/timing correctness is asserted here, deterministically.
 */

import { renderHook, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WordTiming } from "../../lib/api/ai-tts";
import { useTtsWordHighlight } from "../../hooks/useTtsWordHighlight";
import { useTtsHighlightStore } from "../../stores/tts-highlight-store";
import { useAiTtsStore } from "../../stores/ai-tts-store";

// Shared mock state (hoisted so the vi.mock factories can reach it).
const h = vi.hoisted(() => ({
  /** The `ai-tts:playback-starting` callback the hook registers on mount. */
  playbackStartingCb: null as ((e: { duration: number }) => void) | null,
  /** The `ai-tts:finished` callback the hook registers on mount. */
  finishedCb: null as (() => void) | null,
  /** What `aiTtsSpeakWithTimestamps` resolves to for the next speak call. */
  speakResult: {
    success: true,
    wordTimings: [] as WordTiming[],
    totalDuration: 0,
  },
}));

vi.mock("../../lib/api/ai-tts", () => ({
  onAiTtsPlaybackStarting: vi.fn((cb: (e: { duration: number }) => void) => {
    h.playbackStartingCb = cb;
    return Promise.resolve(() => {});
  }),
  onAiTtsFinished: vi.fn((cb: () => void) => {
    h.finishedCb = cb;
    return Promise.resolve(() => {});
  }),
}));
vi.mock("../../lib/tauri-invoke", () => ({
  aiTtsSpeakWithTimestamps: vi.fn(() => Promise.resolve(h.speakResult)),
  aiTtsStop: vi.fn(() => Promise.resolve({ success: true })),
  aiTtsPause: vi.fn(() => Promise.resolve({ success: true })),
  aiTtsResume: vi.fn(() => Promise.resolve({ success: true })),
}));

// Three one-second marks: alpha [0,1) beta [1,2) gamma [2,3), total 3s.
function marks(): WordTiming[] {
  return [
    { word: "alpha", startTime: 0, endTime: 1, charStart: 0, charEnd: 5 },
    { word: "beta", startTime: 1, endTime: 2, charStart: 6, charEnd: 10 },
    { word: "gamma", startTime: 2, endTime: 3, charStart: 11, charEnd: 16 },
  ];
}

const store = () => useTtsHighlightStore.getState();
const idx = () => store().currentWordIndex;

// Controlled clock + frame queue.
let nowMs = 0;
let frames: Array<{ id: number; cb: FrameRequestCallback }> = [];
let nextId = 0;

/** Set the clock to `atMs` and run exactly the frames queued so far (one tick). */
function tick(atMs: number): void {
  nowMs = atMs;
  const due = frames;
  frames = [];
  act(() => {
    for (const f of due) f.cb(atMs);
  });
}

/**
 * Run the real production start path: register intent, fire the audio-start
 * event at `eventClockMs`, then let the (mocked) timestamps response resolve at
 * `responseClockMs`. Returns once highlighting is active. Anchoring must follow
 * the EVENT time, not the response time.
 */
async function startViaProductionPath(
  speak: (text: string, page: number) => Promise<boolean>,
  text: string,
  wordTimings: WordTiming[],
  totalDuration: number,
  eventClockMs: number,
  responseClockMs: number,
): Promise<void> {
  h.speakResult = { success: true, wordTimings, totalDuration };
  // The backend emits playback-starting right before audio begins.
  nowMs = eventClockMs;
  act(() => h.playbackStartingCb?.({ duration: totalDuration }));
  // The timestamps response arrives slightly later.
  nowMs = responseClockMs;
  await act(async () => {
    await speak(text, 1);
  });
}

beforeEach(() => {
  nowMs = 0;
  frames = [];
  nextId = 0;
  h.playbackStartingCb = null;
  h.finishedCb = null;
  h.speakResult = { success: true, wordTimings: [], totalDuration: 0 };
  vi.spyOn(performance, "now").mockImplementation(() => nowMs);
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    const id = ++nextId;
    frames.push({ id, cb });
    return id;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => {
    frames = frames.filter((f) => f.id !== id);
  });
  useTtsHighlightStore.getState().reset();
  useAiTtsStore.setState({
    initialized: true,
    playbackState: "idle",
    error: null,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("karaoke sync — highlight index advances with the timing marks", () => {
  it("anchors to the audio-start event and advances word-by-word at realistic frames, then completes", async () => {
    const onWordChange = vi.fn();
    const onComplete = vi.fn();
    const { result } = renderHook(() =>
      useTtsWordHighlight({ onWordChange, onComplete }),
    );

    // Event at clock 0; response 200ms later. If timing anchored to the response
    // (clock 200) the boundaries below would be off by 200ms and the assertions
    // would fail — so this proves event-time anchoring.
    await startViaProductionPath(
      result.current.speakWithHighlight,
      "alpha beta gamma",
      marks(),
      3,
      0,
      200,
    );
    expect(idx()).toBe(0);
    expect(store().isActive).toBe(true);

    // Frame mid-alpha → still 0.
    tick(500);
    expect(idx()).toBe(0);

    // First frame PAST beta's start (1.0s) → 1. A real rAF lands just after the
    // boundary, not on it.
    tick(1050);
    expect(idx()).toBe(1);
    expect(onWordChange).toHaveBeenLastCalledWith(1, "beta");

    // First frame past gamma's start (2.0s) → 2.
    tick(2030);
    expect(idx()).toBe(2);
    expect(onWordChange).toHaveBeenLastCalledWith(2, "gamma");

    // Frame at/after totalDuration → completion fires, highlighting stops.
    tick(3010);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(store().isActive).toBe(false);
    expect(idx()).toBe(-1);
  });

  it("holds the active word while paused and only advances once resumed elapsed crosses the next boundary", async () => {
    const { result } = renderHook(() => useTtsWordHighlight({}));
    await startViaProductionPath(
      result.current.speakWithHighlight,
      "alpha beta gamma",
      marks(),
      3,
      0,
      0,
    );

    tick(1050); // → beta (1)
    expect(idx()).toBe(1);

    // Pause at clock 1050 ⇒ pausedAtTime ≈ 1.05s elapsed.
    act(() => store().pauseHighlighting());
    expect(store().isPaused).toBe(true);

    // Clock advances deep into gamma's window, but paused ⇒ index frozen at 1.
    tick(2500);
    expect(idx()).toBe(1);

    // Resume at clock 2500: playbackStartTime re-anchors to (now - pausedAtTime)
    // = 2500 - 1050 = 1450, so effective elapsed at a later frame is
    // (clock - 1450)/1000 — i.e. playback continues from where it paused (~1.05s),
    // it does NOT fast-forward through the silent gap.
    act(() => store().resumeHighlighting());
    expect(store().isPaused).toBe(false);

    // clock 2600 → effective elapsed 1.15s → still beta (1): resume did not jump.
    tick(2600);
    expect(idx()).toBe(1);

    // clock 3500 → effective elapsed 2.05s → gamma (2): advances again after resume.
    tick(3500);
    expect(idx()).toBe(2);
  });

  it("does NOT complete prematurely when the duration is unknown (026 guard)", async () => {
    const onComplete = vi.fn();
    const { result } = renderHook(() => useTtsWordHighlight({ onComplete }));

    // totalDuration 0 = the missing-alignment case.
    await startViaProductionPath(
      result.current.speakWithHighlight,
      "alpha beta gamma",
      marks(),
      0,
      0,
      0,
    );

    tick(500);
    tick(1050);
    tick(5000); // well past the marks
    expect(onComplete).not.toHaveBeenCalled();
    expect(store().isActive).toBe(true);
    expect(idx()).toBe(2); // index still tracks marks, held at the last word
  });

  it("completes off the ai-tts:finished event even when the duration is unknown", async () => {
    const onComplete = vi.fn();
    const { result } = renderHook(() => useTtsWordHighlight({ onComplete }));

    // totalDuration 0 = missing alignment: the rAF timer NEVER completes (the 026
    // guard, asserted above), so a passing assertion here can ONLY come from the
    // real audio-finished event — proving completion (and any auto-page advance)
    // is driven off the event, and that a no-alignment page no longer hangs.
    await startViaProductionPath(
      result.current.speakWithHighlight,
      "alpha beta gamma",
      marks(),
      0,
      0,
      0,
    );

    // Frames well past the marks: timer stays silent under the 026 guard.
    tick(500);
    tick(5000);
    expect(onComplete).not.toHaveBeenCalled();
    expect(store().isActive).toBe(true);

    // Backend signals the rodio sink drained → completion fires off the event.
    act(() => h.finishedCb?.());
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(store().isActive).toBe(false);
    expect(idx()).toBe(-1);

    // The event is idempotent vs the timer: a second fire does not re-complete.
    act(() => h.finishedCb?.());
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("documents leading-silence behavior: holds index 0 until the first mark starts", async () => {
    const onWordChange = vi.fn();
    const { result } = renderHook(() => useTtsWordHighlight({ onWordChange }));

    // First word does not start until 0.5s (leading silence).
    const silent: WordTiming[] = [
      { word: "alpha", startTime: 0.5, endTime: 1.5, charStart: 0, charEnd: 5 },
      { word: "beta", startTime: 1.5, endTime: 2.5, charStart: 6, charEnd: 10 },
    ];
    await startViaProductionPath(
      result.current.speakWithHighlight,
      "alpha beta",
      silent,
      2.5,
      0,
      0,
    );

    // During leading silence the pure selector returns -1, but startHighlighting
    // initializes index 0 and the loop only updates on `>= 0`, so the store holds
    // 0 (first word shown slightly early). Pin this behavior so a future change is
    // a deliberate decision, not a silent regression.
    tick(200);
    expect(idx()).toBe(0);
    expect(onWordChange).not.toHaveBeenCalled();

    // Once past alpha's real start the loop confirms index 0 explicitly.
    tick(600);
    expect(idx()).toBe(0);

    // And advances to beta past 1.5s.
    tick(1550);
    expect(idx()).toBe(1);
    expect(onWordChange).toHaveBeenLastCalledWith(1, "beta");
  });
});
