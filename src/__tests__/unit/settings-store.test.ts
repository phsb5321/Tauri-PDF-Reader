/**
 * Unit tests for the settings store.
 *
 * Covers the real logic: TTS-rate clamping (accessibility speed bounds),
 * setters' state effects, reset, and loadFromDatabase (apply / fallback /
 * error). Tauri IPC is mocked so no backend is required. Previously 0% covered.
 */
import { vi, describe, it, expect, beforeEach } from "vitest";

// Mock the Tauri IPC the store calls (settings persistence). The store imports
// these from '../lib/tauri-invoke'; the test mocks the same resolved module.
vi.mock("../../lib/tauri-invoke", () => ({
  settingsGetAll: vi.fn(),
  settingsSet: vi.fn(() => Promise.resolve()),
  settingsSetBatch: vi.fn(() => Promise.resolve()),
}));

import { useSettingsStore } from "../../stores/settings-store";
import { settingsGetAll, settingsSetBatch } from "../../lib/tauri-invoke";
import { DEFAULT_TTS_RATE } from "../../lib/constants";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(settingsGetAll).mockResolvedValue({ settings: {} });
  localStorage.clear();
  useSettingsStore.getState().reset();
});

describe("settings-store", () => {
  describe("setTtsRate clamping", () => {
    it("clamps a rate below the minimum to 0.5", () => {
      useSettingsStore.getState().setTtsRate(0.1);
      expect(useSettingsStore.getState().ttsRate).toBe(0.5);
    });

    it("clamps a rate above the maximum to 3.0", () => {
      useSettingsStore.getState().setTtsRate(9);
      expect(useSettingsStore.getState().ttsRate).toBe(3.0);
    });

    it("leaves an in-range rate unchanged", () => {
      useSettingsStore.getState().setTtsRate(1.5);
      expect(useSettingsStore.getState().ttsRate).toBe(1.5);
    });
  });

  describe("setters", () => {
    it("setTheme updates the theme", () => {
      useSettingsStore.getState().setTheme("dark");
      expect(useSettingsStore.getState().theme).toBe("dark");
    });

    it("setTtsFollowAlong toggles follow-along", () => {
      useSettingsStore.getState().setTtsFollowAlong(false);
      expect(useSettingsStore.getState().ttsFollowAlong).toBe(false);
    });

    it("telemetry setters update flags", () => {
      useSettingsStore.getState().setTelemetryAnalytics(true);
      useSettingsStore.getState().setTelemetryErrors(false);
      expect(useSettingsStore.getState().telemetryAnalytics).toBe(true);
      expect(useSettingsStore.getState().telemetryErrors).toBe(false);
    });

    it("runtime TTS flags are not persisted setters but update state", () => {
      useSettingsStore.getState().setTtsAvailable(true);
      useSettingsStore.getState().setTtsInitialized(true);
      expect(useSettingsStore.getState().ttsAvailable).toBe(true);
      expect(useSettingsStore.getState().ttsInitialized).toBe(true);
    });
  });

  describe("reset", () => {
    it("restores defaults", () => {
      const s = useSettingsStore.getState();
      s.setTheme("dark");
      s.setTtsRate(2.5);
      s.reset();
      const after = useSettingsStore.getState();
      expect(after.theme).toBe("system");
      expect(after.ttsRate).toBe(DEFAULT_TTS_RATE);
      expect(after.telemetryErrors).toBe(true);
      expect(after.telemetryAnalytics).toBe(false);
    });
  });

  describe("loadFromDatabase", () => {
    it("applies stored values and marks db initialized", async () => {
      vi.mocked(settingsGetAll).mockResolvedValue({
        settings: {
          theme: "dark",
          "tts.rate": 2.0,
          "tts.followAlong": false,
          "telemetry.analytics": true,
        },
      });
      await useSettingsStore.getState().loadFromDatabase();
      const s = useSettingsStore.getState();
      expect(s.theme).toBe("dark");
      expect(s.ttsRate).toBe(2.0);
      expect(s.ttsFollowAlong).toBe(false);
      expect(s.telemetryAnalytics).toBe(true);
      expect(s.dbInitialized).toBe(true);
      expect(s.isLoading).toBe(false);
    });

    it("falls back to current values when keys are absent", async () => {
      vi.mocked(settingsGetAll).mockResolvedValue({ settings: {} });
      await useSettingsStore.getState().loadFromDatabase();
      const s = useSettingsStore.getState();
      expect(s.theme).toBe("system"); // default retained
      expect(s.ttsRate).toBe(DEFAULT_TTS_RATE);
      expect(s.dbInitialized).toBe(true);
    });

    it("records an error and still marks db initialized on failure", async () => {
      vi.mocked(settingsGetAll).mockRejectedValue(new Error("db down"));
      await useSettingsStore.getState().loadFromDatabase();
      const s = useSettingsStore.getState();
      expect(s.error).toBe("db down");
      expect(s.isLoading).toBe(false);
      expect(s.dbInitialized).toBe(true);
    });
  });

  describe("syncToDatabase", () => {
    it("writes the current settings in one batch", async () => {
      const s = useSettingsStore.getState();
      s.setTheme("dark");
      s.setTtsRate(2.0);
      vi.clearAllMocks(); // ignore the per-setter writes; assert only the batch
      await s.syncToDatabase();
      expect(vi.mocked(settingsSetBatch)).toHaveBeenCalledTimes(1);
      expect(vi.mocked(settingsSetBatch)).toHaveBeenCalledWith(
        expect.objectContaining({ theme: "dark", "tts.rate": 2.0 }),
      );
    });
  });

  describe("highlight + voice setters", () => {
    it("setHighlightDefaultColor updates state", () => {
      useSettingsStore.getState().setHighlightDefaultColor("#ff0000");
      expect(useSettingsStore.getState().highlightDefaultColor).toBe("#ff0000");
    });

    it("setHighlightColors replaces the palette", () => {
      useSettingsStore.getState().setHighlightColors(["#111111", "#222222"]);
      expect(useSettingsStore.getState().highlightColors).toEqual([
        "#111111",
        "#222222",
      ]);
    });

    it("setTtsVoice updates the voice", () => {
      useSettingsStore.getState().setTtsVoice("voice-x");
      expect(useSettingsStore.getState().ttsVoice).toBe("voice-x");
    });
  });
});
