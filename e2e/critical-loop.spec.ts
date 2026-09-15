/**
 * Critical-loop mockIPC E2E — rung 4 of the verification ladder.
 *
 * Runs in CI (vitest + jsdom, no GPU). Drives the PRODUCTION TTS path — the REAL
 * `lib/api` → `@tauri-apps/api/core` `invoke` wire — with a mocked IPC boundary
 * and a controlled clock, asserting the karaoke STATE MACHINE: timing-model →
 * highlight index → playback state. Per project policy the state machine is the
 * oracle; pixels/speakers never are.
 *
 * IPC mock: this repo establishes its IPC mock globally in `tests/setup.ts` via
 * `vi.mock('@tauri-apps/api/core', { invoke: mockInvoke })` — that `mockInvoke`
 * IS the project's mockIPC seam (the official `@tauri-apps/api/mocks` `mockIPC`,
 * which patches `window.__TAURI_INTERNALS__`, is bypassed by that module mock and
 * would require unmocking it). We program `mockInvoke` per-command here.
 *
 * The real-render + native-menu + real-audio paths are the tauri-driver rung
 * (`e2e/critical-loop.e2e.mjs`, via wdio) — opt-in and legitimately blockable by
 * the WebKitGTK software-rendering session trap (vimeflow#65).
 *
 * TTS fixture rules (never live): word spans are monotonic and text-covering; the
 * highlight index is derived from `startTime` against the controlled clock.
 */

import { renderHook, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockInvoke } from "../tests/setup";
import { useTtsWordHighlight } from "../src/hooks/useTtsWordHighlight";
import { useTtsHighlightStore } from "../src/stores/tts-highlight-store";
import { useAiTtsStore } from "../src/stores/ai-tts-store";

// Monotonic, text-covering fixture timings (no live ElevenLabs call).
const FIXTURE = {
  text: "alpha beta gamma",
  totalDuration: 1.2,
  wordTimings: [
    { word: "alpha", startTime: 0, endTime: 0.4, charStart: 0, charEnd: 5 },
    { word: "beta", startTime: 0.4, endTime: 0.8, charStart: 6, charEnd: 10 },
    { word: "gamma", startTime: 0.8, endTime: 1.2, charStart: 11, charEnd: 16 },
  ],
};

// Controlled clock + frame queue (same model as the karaoke-sync unit gate).
let nowMs = 0;
let frames: Array<{ id: number; cb: FrameRequestCallback }> = [];
let nextId = 0;
function tick(atMs: number): void {
  nowMs = atMs;
  const due = frames;
  frames = [];
  act(() => {
    for (const f of due) f.cb(atMs);
  });
}

beforeEach(() => {
  nowMs = 0;
  frames = [];
  nextId = 0;
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

  // Program the IPC boundary per command. The REAL lib/api functions invoke
  // through this, so the api↔invoke wire contract is exercised, not stubbed.
  mockInvoke.mockImplementation((cmd: string) => {
    switch (cmd) {
      case "ai_tts_speak_with_timestamps":
        return Promise.resolve({
          success: true,
          wordTimings: FIXTURE.wordTimings,
          totalDuration: FIXTURE.totalDuration,
        });
      case "ai_tts_stop":
      case "ai_tts_pause":
      case "ai_tts_resume":
        return Promise.resolve({ success: true });
      default:
        return Promise.resolve(null);
    }
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("critical loop (mockIPC): speak → synced karaoke state machine", () => {
  it("drives the real TTS invoke wire and advances the highlight index in lockstep with the timing model", async () => {
    const { result } = renderHook(() => useTtsWordHighlight({}));

    // Production path: speakWithHighlight -> real aiTtsSpeakWithTimestamps ->
    // real invoke('ai_tts_speak_with_timestamps') -> mocked IPC fixture.
    await act(async () => {
      await result.current.speakWithHighlight(FIXTURE.text, 1);
    });

    // The real api wire was exercised: the production command + args invoked.
    expect(mockInvoke).toHaveBeenCalledWith(
      "ai_tts_speak_with_timestamps",
      expect.objectContaining({ text: FIXTURE.text }),
    );

    const h = () => useTtsHighlightStore.getState();
    expect(h().wordTimings).toHaveLength(3);
    expect(h().totalDuration).toBe(1.2);
    expect(h().isActive).toBe(true);
    expect(useAiTtsStore.getState().playbackState).toBe("playing");
    expect(h().currentWordIndex).toBe(0);

    // Controlled clock → the real rAF loop advances the index past each mark.
    tick(450);
    expect(h().currentWordIndex).toBe(1); // beta
    tick(850);
    expect(h().currentWordIndex).toBe(2); // gamma

    // Visual timing never cuts the native sink; completion is event-driven in
    // the packaged lane. This mockIPC rung has no native finished event, so it
    // proves the clock holds the last word until an explicit terminal action.
    tick(1210);
    expect(h().isActive).toBe(true);
    expect(useAiTtsStore.getState().playbackState).toBe("playing");
    await act(async () => result.current.stop());
    expect(h().isActive).toBe(false);
    expect(useAiTtsStore.getState().playbackState).toBe("idle");
  });

  // Note: pause/resume flip the playback FLAGS (setPlaybackState direct-assign),
  // not the validated transitionTo() state machine — so this asserts the flag
  // transitions + the real invoke wire + the timing hold/advance, not transition
  // validity.
  it("pause/resume flip the playback flags (playing→paused→playing) over the real invoke wire and gate the timing", async () => {
    const { result } = renderHook(() => useTtsWordHighlight({}));
    await act(async () => {
      await result.current.speakWithHighlight(FIXTURE.text, 1);
    });
    tick(450);
    expect(useTtsHighlightStore.getState().currentWordIndex).toBe(1);

    await act(async () => {
      await result.current.pause();
    });
    // Real wire: the pause command was invoked.
    expect(mockInvoke).toHaveBeenCalledWith("ai_tts_pause");
    expect(useTtsHighlightStore.getState().isPaused).toBe(true);
    expect(useAiTtsStore.getState().playbackState).toBe("paused");
    tick(900);
    expect(useTtsHighlightStore.getState().currentWordIndex).toBe(1); // held while paused

    await act(async () => {
      await result.current.resume();
    });
    expect(mockInvoke).toHaveBeenCalledWith("ai_tts_resume");
    expect(useTtsHighlightStore.getState().isPaused).toBe(false);
    expect(useAiTtsStore.getState().playbackState).toBe("playing");

    // After resume the timing continues from where it paused (~0.45s): it holds
    // beta before the next boundary and advances to gamma past it — the index is
    // derived from elapsed time, not jumped on resume.
    tick(1000);
    expect(useTtsHighlightStore.getState().currentWordIndex).toBe(1); // still beta
    tick(1300);
    expect(useTtsHighlightStore.getState().currentWordIndex).toBe(2); // advanced to gamma
  });
});
