/**
 * AI-TTS api wire-contract tests.
 *
 * Covers the thin `invoke`/`listen` wrapper functions in `lib/api/ai-tts.ts` —
 * each asserts the exact Tauri command name (and key args) it dispatches, via the
 * repo's IPC mock (`mockInvoke` in tests/setup). This is the api↔invoke wire
 * contract; it also keeps function coverage honest now that the mockIPC E2E
 * (e2e/critical-loop.spec.ts) loads this real module (previously mocked away).
 */

import { describe, it, expect, beforeEach } from "vitest";
import { listen } from "@tauri-apps/api/event";
import { mockInvoke } from "../../../tests/setup";
import * as api from "./ai-tts";

beforeEach(() => {
  mockInvoke.mockResolvedValue({ success: true });
});

describe("ai-tts api → invoke wire contract", () => {
  it("aiTtsInit → ai_tts_init", async () => {
    await api.aiTtsInit("key-123");
    expect(mockInvoke).toHaveBeenCalledWith("ai_tts_init", {
      apiKey: "key-123",
    });
  });

  it("aiTtsListVoices → ai_tts_list_voices", async () => {
    await api.aiTtsListVoices();
    expect(mockInvoke).toHaveBeenCalledWith("ai_tts_list_voices");
  });

  it("aiTtsSpeak → ai_tts_speak", async () => {
    await api.aiTtsSpeak("hello", "v1");
    expect(mockInvoke).toHaveBeenCalledWith("ai_tts_speak", {
      text: "hello",
      voiceId: "v1",
    });
  });

  it("aiTtsSpeakWithTimestamps → ai_tts_speak_with_timestamps", async () => {
    await api.aiTtsSpeakWithTimestamps("hi", "v2");
    expect(mockInvoke).toHaveBeenCalledWith("ai_tts_speak_with_timestamps", {
      text: "hi",
      voiceId: "v2",
    });
  });

  it("aiTtsStop / aiTtsPause / aiTtsResume → their commands", async () => {
    await api.aiTtsStop();
    expect(mockInvoke).toHaveBeenCalledWith("ai_tts_stop");
    await api.aiTtsPause();
    expect(mockInvoke).toHaveBeenCalledWith("ai_tts_pause");
    await api.aiTtsResume();
    expect(mockInvoke).toHaveBeenCalledWith("ai_tts_resume");
  });

  it("aiTtsSetVoice → ai_tts_set_voice", async () => {
    await api.aiTtsSetVoice("v9");
    expect(mockInvoke).toHaveBeenCalledWith("ai_tts_set_voice", {
      voiceId: "v9",
    });
  });

  it("aiTtsSetSpeed → ai_tts_set_speed", async () => {
    await api.aiTtsSetSpeed(1.5);
    expect(mockInvoke).toHaveBeenCalledWith("ai_tts_set_speed", { speed: 1.5 });
  });

  it("aiTtsGetState → ai_tts_get_state", async () => {
    await api.aiTtsGetState();
    expect(mockInvoke).toHaveBeenCalledWith("ai_tts_get_state");
  });

  it("aiTtsGetConfig → ai_tts_get_config", async () => {
    await api.aiTtsGetConfig();
    expect(mockInvoke).toHaveBeenCalledWith("ai_tts_get_config");
  });

  it("aiTtsCacheInfo / Clear / InvalidateVoice → their commands", async () => {
    await api.aiTtsCacheInfo();
    expect(mockInvoke).toHaveBeenCalledWith("ai_tts_cache_info");
    await api.aiTtsCacheClear();
    expect(mockInvoke).toHaveBeenCalledWith("ai_tts_cache_clear");
    await api.aiTtsCacheInvalidateVoice("v1");
    expect(mockInvoke).toHaveBeenCalledWith("ai_tts_cache_invalidate_voice", {
      voiceId: "v1",
    });
  });

  it("aiTtsPrebuffer → ai_tts_prebuffer", async () => {
    await api.aiTtsPrebuffer("text", "v1");
    expect(mockInvoke).toHaveBeenCalledWith(
      "ai_tts_prebuffer",
      expect.objectContaining({ text: "text" }),
    );
  });
});

describe("ai-tts event subscriptions", () => {
  it("each on* subscriber resolves to an unlisten function", async () => {
    const noop = () => {};
    for (const sub of [
      api.onAiTtsStarted,
      api.onAiTtsFinished,
      api.onAiTtsStopped,
      api.onAiTtsPaused,
      api.onAiTtsResumed,
      api.onAiTtsError,
      api.onAiTtsPlaybackStarting,
    ]) {
      const unlisten = await sub(noop);
      expect(typeof unlisten).toBe("function");
    }
  });

  it("onAiTtsFinished subscribes to the ai-tts:finished channel", async () => {
    await api.onAiTtsFinished(() => {});
    expect(listen).toHaveBeenCalledWith(
      "ai-tts:finished",
      expect.any(Function),
    );
  });
});
