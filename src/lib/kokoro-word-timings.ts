/**
 * Kokoro token timestamps → Lectrice `WordTiming[]`
 *
 * Spike 055 evidence. Kokoro's Python pipeline hands back per-token
 * `start_ts`/`end_ts` alongside the audio, which is a different shape from
 * ElevenLabs' per-CHARACTER alignment (grouped into words by `chars_to_words`
 * in `src-tauri/src/ai_tts/elevenlabs.rs`). This module answers whether that
 * shape can feed the karaoke highlight path unchanged.
 *
 * Two properties of the real captures drive the algorithm, and neither is
 * guessable from Kokoro's docs:
 *
 *  1. **Timestamps are chunk-relative, not absolute.** `KPipeline` splits on
 *     `\n+` by default and restarts the clock at 0 for every chunk. Chunk N's
 *     marks must be offset by the summed audio duration of chunks 0..N-1, or
 *     every word after the first line highlights at the wrong moment.
 *  2. **The split separator is not in any token.** The last token of a chunk
 *     carries `whitespace: ""`, so concatenating `text + whitespace` across
 *     chunks yields `"…gammadelta…"` — it does NOT reconstruct the source.
 *     Character offsets therefore have to be re-anchored per chunk against the
 *     original text, which is also what keeps them usable for selection.
 *
 * Offsets are JS string indices, i.e. UTF-16 code units — the same unit
 * `chars_to_words` is careful to emit, so a highlight computed here indexes
 * the page text identically to one from the ElevenLabs path.
 */

import type { WordTiming } from './api/ai-tts';

/** One Kokoro token as `KPipeline` yields it. */
export interface KokoroToken {
  text: string;
  whitespace: string;
  /** Seconds from the start of THIS chunk's audio. Null when Kokoro has no mark. */
  start_ts: number | null;
  end_ts: number | null;
  phonemes: string | null;
}

/** One `KPipeline` result — the unit the clock restarts on. */
export interface KokoroChunk {
  index: number;
  /** The source substring this chunk spoke. */
  graphemes: string | null;
  audio_samples: number;
  tokens: KokoroToken[];
}

/** A captured Kokoro synthesis, as written by `specs/055-kokoro-offline-voice/capture-kokoro.py`. */
export interface KokoroCapture {
  sample_rate: number;
  text: string;
  chunks: KokoroChunk[];
}

export interface KokoroConversion {
  wordTimings: WordTiming[];
  /** Total audio seconds across every chunk — what the highlight loop treats as the end. */
  totalDuration: number;
  /** Tokens Kokoro gave no mark for; they advance the character cursor but get no highlight. */
  skippedTokens: number;
}

/**
 * Convert a captured Kokoro synthesis into the timing marks the highlight
 * store consumes.
 *
 * Throws when a chunk's `graphemes` cannot be located in the source text:
 * that means the offsets would be silently wrong for every word after it, and
 * a highlight pointing at the wrong characters is worse than a failed request.
 */
export function kokoroToWordTimings(capture: KokoroCapture): KokoroConversion {
  const wordTimings: WordTiming[] = [];
  let searchFrom = 0;
  let timeOffset = 0;
  let skippedTokens = 0;

  for (const chunk of capture.chunks) {
    const spoken =
      chunk.graphemes ?? chunk.tokens.map((t) => t.text + t.whitespace).join('');
    const chunkStart = capture.text.indexOf(spoken, searchFrom);
    if (chunkStart < 0) {
      throw new Error(
        `kokoro chunk ${chunk.index} spoke ${JSON.stringify(spoken)}, which does not occur in the source text at or after offset ${searchFrom}`
      );
    }

    let local = 0;
    for (const token of chunk.tokens) {
      const charStart = chunkStart + local;
      local += token.text.length + token.whitespace.length;

      if (token.start_ts === null || token.end_ts === null) {
        skippedTokens += 1;
        continue;
      }

      wordTimings.push({
        word: token.text,
        startTime: timeOffset + token.start_ts,
        endTime: timeOffset + token.end_ts,
        charStart,
        charEnd: charStart + token.text.length,
      });
    }

    searchFrom = chunkStart + spoken.length;
    timeOffset += chunk.audio_samples / capture.sample_rate;
  }

  return { wordTimings, totalDuration: timeOffset, skippedTokens };
}

/**
 * The error a timestamp-less runtime would incur.
 *
 * `kokoro-js` (the ONNX/WASM port) returns audio per chunk and no per-token
 * marks, so the only thing it can do is spread each chunk's duration across
 * its words. This measures how far that guess lands from Kokoro's real marks,
 * in seconds, so the cost of the JS path is a number rather than an adjective.
 *
 * The proportional model is the generous one — length-weighted rather than
 * equal-width — so the figure it reports is a floor on the JS path's error,
 * not a worst case.
 */
export function uniformApproximationError(capture: KokoroCapture): number {
  let worst = 0;

  for (const chunk of capture.chunks) {
    const marked = chunk.tokens.filter(
      (t) => t.start_ts !== null && t.end_ts !== null
    );
    if (marked.length === 0) continue;

    const chunkDuration = chunk.audio_samples / capture.sample_rate;
    const totalChars = marked.reduce(
      (n, t) => n + t.text.length + t.whitespace.length,
      0
    );
    if (totalChars === 0) continue;

    let consumed = 0;
    for (const token of marked) {
      const guess = (consumed / totalChars) * chunkDuration;
      worst = Math.max(worst, Math.abs(guess - (token.start_ts as number)));
      consumed += token.text.length + token.whitespace.length;
    }
  }

  return worst;
}
