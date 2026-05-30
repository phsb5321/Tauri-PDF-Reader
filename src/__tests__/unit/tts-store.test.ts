/**
 * Unit tests for the (native) TTS store.
 *
 * Pure Zustand state machine (no IPC): rate clamping, chunk-queue navigation
 * (next/previous/current with bounds), chunk array ops, init mapping, and the
 * derived selectors. Previously 0% covered.
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  useTtsStore,
  selectIsPlaying,
  selectIsPaused,
  selectIsLoading,
  selectCanPlay,
} from "../../stores/tts-store";

const chunk = (id: string, page = 1) => ({
  id,
  text: `text-${id}`,
  pageNumber: page,
  startOffset: 0,
  endOffset: 10,
});

beforeEach(() => {
  useTtsStore.getState().reset();
});

describe("tts-store", () => {
  describe("setRate clamping", () => {
    it("clamps below the minimum to 0.5", () => {
      useTtsStore.getState().setRate(0.1);
      expect(useTtsStore.getState().rate).toBe(0.5);
    });
    it("clamps above the maximum to 3.0", () => {
      useTtsStore.getState().setRate(9);
      expect(useTtsStore.getState().rate).toBe(3.0);
    });
    it("leaves an in-range rate unchanged", () => {
      useTtsStore.getState().setRate(2);
      expect(useTtsStore.getState().rate).toBe(2);
    });
  });

  describe("initialization", () => {
    it("setInitialized maps the response into state", () => {
      useTtsStore.getState().setInitialized({
        available: true,
        backend: "speech-dispatcher",
        defaultVoice: null,
        error: null,
      });
      const s = useTtsStore.getState();
      expect(s.initialized).toBe(true);
      expect(s.available).toBe(true);
      expect(s.backend).toBe("speech-dispatcher");
      expect(s.initError).toBeNull();
    });
  });

  describe("chunk queue", () => {
    it("setChunks stores chunks and resets the cursor", () => {
      useTtsStore.setState({ currentChunkIndex: 3, currentChunkId: "x" });
      useTtsStore.getState().setChunks([chunk("a"), chunk("b")]);
      const s = useTtsStore.getState();
      expect(s.chunks).toHaveLength(2);
      expect(s.currentChunkIndex).toBe(-1);
      expect(s.currentChunkId).toBeNull();
    });

    it("addChunk appends to the queue", () => {
      useTtsStore.getState().setChunks([chunk("a")]);
      useTtsStore.getState().addChunk(chunk("b"));
      expect(
        useTtsStore.getState().chunks.map((c: { id: string }) => c.id),
      ).toEqual(["a", "b"]);
    });

    it("clearChunks empties the queue and resets the cursor", () => {
      useTtsStore.getState().setChunks([chunk("a")]);
      useTtsStore.getState().setCurrentChunk("a");
      useTtsStore.getState().clearChunks();
      const s = useTtsStore.getState();
      expect(s.chunks).toHaveLength(0);
      expect(s.currentChunkIndex).toBe(-1);
      expect(s.currentChunkId).toBeNull();
    });
  });

  describe("setCurrentChunk", () => {
    it("uses the explicit index when provided", () => {
      useTtsStore.getState().setChunks([chunk("a"), chunk("b")]);
      useTtsStore.getState().setCurrentChunk("b", 1);
      const s = useTtsStore.getState();
      expect(s.currentChunkId).toBe("b");
      expect(s.currentChunkIndex).toBe(1);
    });

    it("looks up the index by id when no index is given", () => {
      useTtsStore.getState().setChunks([chunk("a"), chunk("b"), chunk("c")]);
      useTtsStore.getState().setCurrentChunk("c");
      expect(useTtsStore.getState().currentChunkIndex).toBe(2);
    });

    it("clears the cursor when id is null", () => {
      useTtsStore.getState().setChunks([chunk("a")]);
      useTtsStore.getState().setCurrentChunk("a");
      useTtsStore.getState().setCurrentChunk(null);
      const s = useTtsStore.getState();
      expect(s.currentChunkId).toBeNull();
      expect(s.currentChunkIndex).toBe(-1);
    });

    it("keeps the id but sets index -1 for an unknown id (findIndex miss)", () => {
      useTtsStore.getState().setChunks([chunk("a")]);
      useTtsStore.getState().setCurrentChunk("ghost");
      const s = useTtsStore.getState();
      expect(s.currentChunkId).toBe("ghost");
      expect(s.currentChunkIndex).toBe(-1);
    });
  });

  describe("navigation", () => {
    beforeEach(() => {
      useTtsStore.getState().setChunks([chunk("a"), chunk("b"), chunk("c")]);
    });

    it("nextChunk advances and returns the next chunk", () => {
      const next = useTtsStore.getState().nextChunk(); // from -1 -> 0
      expect(next?.id).toBe("a");
      expect(useTtsStore.getState().currentChunkIndex).toBe(0);
    });

    it("nextChunk advances through the middle (1 -> 2)", () => {
      useTtsStore.getState().setCurrentChunk("b", 1);
      const next = useTtsStore.getState().nextChunk();
      expect(next?.id).toBe("c");
      expect(useTtsStore.getState().currentChunkIndex).toBe(2);
    });

    it("nextChunk returns null at the end without moving", () => {
      useTtsStore.getState().setCurrentChunk("c", 2); // last
      const next = useTtsStore.getState().nextChunk();
      expect(next).toBeNull();
      expect(useTtsStore.getState().currentChunkIndex).toBe(2);
    });

    it("previousChunk goes back and returns the previous chunk", () => {
      useTtsStore.getState().setCurrentChunk("b", 1);
      const prev = useTtsStore.getState().previousChunk();
      expect(prev?.id).toBe("a");
      expect(useTtsStore.getState().currentChunkIndex).toBe(0);
    });

    it("previousChunk returns null at the start without moving", () => {
      useTtsStore.getState().setCurrentChunk("a", 0);
      const prev = useTtsStore.getState().previousChunk();
      expect(prev).toBeNull();
      expect(useTtsStore.getState().currentChunkIndex).toBe(0);
    });

    it("getCurrentChunk returns the chunk at the cursor or null", () => {
      expect(useTtsStore.getState().getCurrentChunk()).toBeNull(); // index -1
      useTtsStore.getState().setCurrentChunk("b", 1);
      expect(useTtsStore.getState().getCurrentChunk()?.id).toBe("b");
    });

    it("getCurrentChunk returns null for an out-of-range cursor", () => {
      useTtsStore.setState({ currentChunkIndex: 3 }); // length is 3 -> index 3 out of range
      expect(useTtsStore.getState().getCurrentChunk()).toBeNull();
    });
  });

  describe("selectors", () => {
    it("reflect the playback state (true AND false, so they are discriminating)", () => {
      useTtsStore.getState().setPlaybackState("playing");
      let s = useTtsStore.getState();
      expect(selectIsPlaying(s)).toBe(true);
      expect(selectIsPaused(s)).toBe(false);
      expect(selectIsLoading(s)).toBe(false);

      useTtsStore.getState().setPlaybackState("paused");
      s = useTtsStore.getState();
      expect(selectIsPaused(s)).toBe(true);
      expect(selectIsPlaying(s)).toBe(false);

      useTtsStore.getState().setPlaybackState("loading");
      s = useTtsStore.getState();
      expect(selectIsLoading(s)).toBe(true);
      expect(selectIsPlaying(s)).toBe(false);

      useTtsStore.getState().setPlaybackState("idle");
      s = useTtsStore.getState();
      expect(selectIsPlaying(s)).toBe(false);
      expect(selectIsPaused(s)).toBe(false);
      expect(selectIsLoading(s)).toBe(false);
    });

    it("selectCanPlay requires initialized AND available", () => {
      expect(selectCanPlay(useTtsStore.getState())).toBe(false);
      useTtsStore.getState().setInitialized({
        available: true,
        backend: "x",
        defaultVoice: null,
        error: null,
      });
      expect(selectCanPlay(useTtsStore.getState())).toBe(true);
    });
  });

  it("reset restores initial state", () => {
    useTtsStore.getState().setChunks([chunk("a")]);
    useTtsStore.getState().setRate(2.5);
    useTtsStore.getState().setPlaybackState("playing");
    useTtsStore.getState().reset();
    const s = useTtsStore.getState();
    expect(s.chunks).toHaveLength(0);
    expect(s.rate).toBe(1.0);
    expect(s.playbackState).toBe("idle");
    expect(s.currentChunkIndex).toBe(-1);
  });
});
