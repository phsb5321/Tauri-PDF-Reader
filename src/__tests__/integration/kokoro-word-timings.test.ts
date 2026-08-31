/**
 * Spike 055 — is Kokoro's offline voice adoptable for Lectrice's karaoke highlight?
 *
 * The question is not "does Kokoro sound good" (ears, unfalsifiable here) but
 * "do its timestamps satisfy the contract the highlight path already depends
 * on". That contract is `WordTiming[]` → `findWordIndexAtTime` →
 * `currentWordIndex`, and it is asserted below against REAL captured output,
 * not a hand-written sample:
 *
 *   src/__tests__/fixtures/kokoro-af-heart-single-chunk.json
 *   src/__tests__/fixtures/kokoro-af-heart-multi-chunk.json
 *
 * Both were produced once by `specs/055-kokoro-offline-voice/capture-kokoro.py`
 * (kokoro 0.9.4, hexgrad/Kokoro-82M, voice af_heart, 24 kHz) and committed.
 * Nothing here calls a model, downloads a weight, or plays audio — the suite
 * stays offline and deterministic.
 *
 * The last test drives the REAL production loop (`useTtsWordHighlight` +
 * `ai-tts:playback-starting` + a mocked timestamps response) on a controlled
 * clock, mirroring `karaoke-sync.test.ts`, so "the highlight index derives
 * from start_time" is proved through the shipping code path rather than by
 * re-implementing selection in the test.
 */

import { renderHook, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WordTiming } from "../../lib/api/ai-tts";
import {
  kokoroToWordTimings,
  uniformApproximationError,
  type KokoroCapture,
} from "../../lib/kokoro-word-timings";
import { useTtsWordHighlight } from "../../hooks/useTtsWordHighlight";
import { useTtsHighlightStore } from "../../stores/tts-highlight-store";
import { useAiTtsStore } from "../../stores/ai-tts-store";
import singleChunk from "../fixtures/kokoro-af-heart-single-chunk.json";
import multiChunk from "../fixtures/kokoro-af-heart-multi-chunk.json";

const SINGLE = singleChunk as unknown as KokoroCapture;
const MULTI = multiChunk as unknown as KokoroCapture;

const h = vi.hoisted(() => ({
  playbackStartingCb: null as ((e: { duration: number }) => void) | null,
  finishedCb: null as (() => void) | null,
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
  onAiTtsStopped: vi.fn(() => Promise.resolve(() => {})),
}));
vi.mock("../../lib/tauri-invoke", () => ({
  aiTtsSpeakWithTimestamps: vi.fn(() => Promise.resolve(h.speakResult)),
  aiTtsStop: vi.fn(() => Promise.resolve({ success: true })),
  aiTtsPause: vi.fn(() => Promise.resolve({ success: true })),
  aiTtsResume: vi.fn(() => Promise.resolve({ success: true })),
}));

describe("kokoro capture fixtures are the real thing", () => {
  it("carry per-token marks for every word, in both captures", () => {
    for (const capture of [SINGLE, MULTI]) {
      expect(capture.sample_rate).toBe(24000);
      expect(capture.chunks.length).toBeGreaterThan(0);
      const tokens = capture.chunks.flatMap((c) => c.tokens);
      expect(tokens.length).toBeGreaterThan(0);
      for (const token of tokens) {
        expect(typeof token.start_ts).toBe("number");
        expect(typeof token.end_ts).toBe("number");
      }
    }
    // The multi-chunk capture must actually be multi-chunk or it proves nothing
    // about the chunk-offset hazard this spike exists to check.
    expect(MULTI.chunks.length).toBeGreaterThanOrEqual(2);
  });
});

describe("kokoroToWordTimings — spans are monotonic and cover the text", () => {
  for (const [name, capture] of [
    ["single chunk", SINGLE],
    ["multi chunk", MULTI],
  ] as const) {
    it(`${name}: every word advances and never overlaps the next`, () => {
      const { wordTimings, totalDuration, skippedTokens } =
        kokoroToWordTimings(capture);

      expect(wordTimings.length).toBeGreaterThan(0);
      expect(skippedTokens).toBe(0);

      for (let i = 0; i < wordTimings.length; i++) {
        const w = wordTimings[i];
        expect(w.startTime).toBeGreaterThanOrEqual(0);
        expect(w.endTime).toBeGreaterThan(w.startTime);
        expect(w.endTime).toBeLessThanOrEqual(totalDuration);
        if (i > 0) {
          expect(w.startTime).toBeGreaterThanOrEqual(
            wordTimings[i - 1].startTime,
          );
          expect(w.startTime).toBeGreaterThanOrEqual(
            wordTimings[i - 1].endTime,
          );
        }
      }
    });

    it(`${name}: char offsets slice the source text back to the spoken word`, () => {
      const { wordTimings } = kokoroToWordTimings(capture);

      for (const w of wordTimings) {
        expect(capture.text.slice(w.charStart, w.charEnd)).toBe(w.word);
      }

      // Coverage: every non-whitespace character of the source is claimed by
      // exactly one word. A converter that dropped or double-counted a token
      // would still pass the slice check above; this is what catches it.
      const claimed = new Array<number>(capture.text.length).fill(0);
      for (const w of wordTimings) {
        for (let i = w.charStart; i < w.charEnd; i++) claimed[i] += 1;
      }
      for (let i = 0; i < capture.text.length; i++) {
        const expected = /\s/.test(capture.text[i]) ? 0 : 1;
        expect(claimed[i]).toBe(expected);
      }
    });
  }

  it("offsets each chunk by the audio that precedes it, because Kokoro restarts the clock", () => {
    const { wordTimings, totalDuration } = kokoroToWordTimings(MULTI);

    const firstChunkSeconds = MULTI.chunks[0].audio_samples / MULTI.sample_rate;
    const firstOfSecondChunk = MULTI.chunks[1].tokens[0];

    // The raw mark restarts near zero…
    expect(firstOfSecondChunk.start_ts as number).toBeLessThan(
      firstChunkSeconds,
    );

    // …and the conversion must place it after all of chunk 0's audio instead.
    const converted = wordTimings.find(
      (w) => w.word === MULTI.chunks[1].tokens[0].text,
    );
    expect(converted).toBeDefined();
    expect(converted!.startTime).toBeCloseTo(
      firstChunkSeconds + (firstOfSecondChunk.start_ts as number),
      6,
    );
    expect(converted!.startTime).toBeGreaterThan(firstChunkSeconds);

    expect(totalDuration).toBeCloseTo(
      MULTI.chunks.reduce((s, c) => s + c.audio_samples, 0) / MULTI.sample_rate,
      6,
    );
  });

  it("refuses to guess when a chunk is not found in the source text", () => {
    const corrupted: KokoroCapture = {
      ...MULTI,
      chunks: [
        { ...MULTI.chunks[0], graphemes: "text that was never spoken" },
        ...MULTI.chunks.slice(1),
      ],
    };
    expect(() => kokoroToWordTimings(corrupted)).toThrow(
      /does not occur in the source text/,
    );
  });

  it("refuses to skip source text that no chunk spoke", () => {
    // Kokoro returning only the second segment would otherwise convert
    // "cleanly" — indexOf would find it, and the missing words would just be
    // absent from the timeline with nothing to notice them.
    const dropped: KokoroCapture = { ...MULTI, chunks: [MULTI.chunks[1]] };
    expect(() => kokoroToWordTimings(dropped)).toThrow(/kokoro skipped/);
  });

  it("refuses marks that fall outside their own chunk audio", () => {
    // The offsetting scheme assumes marks and audio share a timebase. Halve a
    // chunk's audio and its own last mark no longer fits inside it.
    const shortened: KokoroCapture = {
      ...MULTI,
      chunks: [
        { ...MULTI.chunks[0], audio_samples: 12000 }, // 0.5 s, but marks run to 1.55 s
        ...MULTI.chunks.slice(1),
      ],
    };
    expect(() => kokoroToWordTimings(shortened)).toThrow(
      /outside that chunk's .*s of audio/,
    );
  });
});

describe("what a timestamp-less runtime would cost", () => {
  it("measures the per-chunk approximation error rather than describing it", () => {
    const single = uniformApproximationError(SINGLE);
    const multi = uniformApproximationError(MULTI);

    // The measured numbers, pinned so a converter regression or a fixture swap
    // is visible. These are the values quoted in
    // specs/055-kokoro-offline-voice/decision.md.
    expect(single).toBeCloseTo(0.4433, 3);
    expect(multi).toBeCloseTo(0.4778, 3);

    // The error is bounded by one chunk's duration — it cannot accumulate
    // across chunks, because each chunk is re-anchored to real audio length.
    const longestChunk = Math.max(
      ...MULTI.chunks.map((c) => c.audio_samples / MULTI.sample_rate),
    );
    expect(multi).toBeLessThan(longestChunk);
  });
});

describe("the highlight index derives from the converted start times", () => {
  const store = () => useTtsHighlightStore.getState();
  const idx = () => store().currentWordIndex;

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
      speed: 1.0,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("walks the multi-chunk capture word by word through the production loop", async () => {
    const { wordTimings, totalDuration } = kokoroToWordTimings(MULTI);
    const { result } = renderHook(() => useTtsWordHighlight());

    h.speakResult = { success: true, wordTimings, totalDuration };
    nowMs = 0;
    act(() => h.playbackStartingCb?.({ duration: totalDuration }));
    nowMs = 120; // response lands after the audio-start event
    await act(async () => {
      await result.current.speakWithHighlight(MULTI.text, 1);
    });
    expect(store().isActive).toBe(true);

    // Kokoro opens with real leading silence: the first mark starts well after
    // zero, and the loop clamps to word 0 until then rather than going negative.
    expect(wordTimings[0].startTime).toBeGreaterThan(0.2);
    tick(Math.round(wordTimings[0].startTime * 1000) - 50);
    expect(idx()).toBe(0);

    // Each word becomes current on the first frame at/after its own start —
    // including the ones that only line up because of the chunk offset.
    for (let i = 0; i < wordTimings.length; i++) {
      tick(Math.round(wordTimings[i].startTime * 1000) + 20);
      expect(idx()).toBe(i);
    }

    // The last word holds through trailing silence; only the real sink-drained
    // event completes playback, never the visual timing estimate.
    const last = wordTimings[wordTimings.length - 1];
    expect(totalDuration).toBeGreaterThan(last.endTime);
    tick(Math.round(last.endTime * 1000) + 10);
    expect(idx()).toBe(wordTimings.length - 1);
    expect(store().isActive).toBe(true);

    tick(Math.round(totalDuration * 1000) + 10);
    expect(store().isActive).toBe(true);
    act(() => h.finishedCb?.());
    expect(store().isActive).toBe(false);
  });
});
