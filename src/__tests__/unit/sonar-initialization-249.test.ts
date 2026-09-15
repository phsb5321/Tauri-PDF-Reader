import { beforeEach, describe, expect, it } from "vitest";
import { useAiTtsStore } from "../../stores/ai-tts-store";

beforeEach(() => useAiTtsStore.getState().reset());

describe("initialization status precedence", () => {
  it.each([
    [false, undefined, "setup", "idle"],
    [false, "", "setup", "idle"],
    [false, "failure", "error", "error"],
    [true, undefined, "connected", "idle"],
    [true, "", "connected", "idle"],
    [true, "failure", "connected", "idle"],
  ] as const)(
    "initialized=%s error=%s preserves connection=%s playback=%s",
    (initialized, error, status, playbackState) => {
      useAiTtsStore.getState().setInitialized(initialized, error);
      const state = useAiTtsStore.getState();
      expect(state).toMatchObject({
        initialized,
        initError: error ?? null,
        playbackState,
      });
      expect(state.connections[state.provider]).toMatchObject({
        status,
        error: error ?? null,
      });
    },
  );
});
