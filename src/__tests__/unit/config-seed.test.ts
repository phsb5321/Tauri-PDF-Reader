/**
 * The config seed (spec 078, slice 1).
 *
 * The branch that matters is the NEGATIVE one: `configGetEffective` always
 * returns a fully-populated config — built-in defaults when no file exists — so
 * a seed that applied it unconditionally would silently reset the settings of
 * every user who has never written a config file. That is a data-loss bug, and
 * it is invisible in a test that only checks the happy path.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const configGetEffective = vi.fn();

vi.mock("../../lib/bindings", () => ({
  commands: {
    configGetEffective: () => configGetEffective(),
  },
}));

import { seedStoresFromConfigFile } from "../../lib/config-seed";
import { useSettingsStore } from "../../stores/settings-store";
import { useAiTtsStore } from "../../stores/ai-tts-store";

const DEFAULT_CONFIG = {
  schema_version: 1,
  appearance: { theme: "system" },
  highlight: {
    default_color: "#FFEB3B",
    colors: ["#FFEB3B", "#4CAF50", "#2196F3", "#F44336"],
  },
  tts: { rate: 1.0, voice: null, follow_along: true },
  telemetry: { analytics: false, errors: false },
  render: {
    quality_mode: "balanced",
    max_megapixels: 24,
    hw_acceleration: true,
    debug_overlay: false,
  },
  cache: { max_size_bytes: 5368709120, eviction_policy: "lru" },
  ai_tts: {
    provider: "elevenlabs",
    local_url: null,
    voice_id: "21m00Tcm4TlvDq8ikWAM",
    speed: 1.0,
    auto_page: true,
  },
};

describe("seedStoresFromConfigFile", () => {
  beforeEach(() => {
    configGetEffective.mockReset();
    useSettingsStore.setState({ theme: "light", ttsRate: 2.0 });
    useAiTtsStore.setState({ speed: 3.0 });
  });

  it("applies the file's values when a config file was loaded", async () => {
    configGetEffective.mockResolvedValue({
      config: {
        ...DEFAULT_CONFIG,
        appearance: { theme: "dark" },
        tts: { rate: 1.5, voice: null, follow_along: false },
        ai_tts: { voice_id: "abc123", speed: 2.5, auto_page: false },
      },
      path: "/home/p/.config/lectrice/config.toml",
      loaded: true,
      warnings: [],
      error: null,
    });

    await seedStoresFromConfigFile();

    expect(useSettingsStore.getState().theme).toBe("dark");
    expect(useSettingsStore.getState().ttsRate).toBe(1.5);
    expect(useSettingsStore.getState().ttsFollowAlong).toBe(false);
    expect(useAiTtsStore.getState().selectedVoiceId).toBe("abc123");
    expect(useAiTtsStore.getState().speed).toBe(2.5);
    expect(useAiTtsStore.getState().autoPageEnabled).toBe(false);
  });

  it("seeds local provider and destination only from a loaded native config", async () => {
    configGetEffective.mockResolvedValue({
      config: {
        ...DEFAULT_CONFIG,
        ai_tts: {
          provider: "local",
          local_url: "http://127.0.0.1:5301",
          voice_id: "F1-pt",
          speed: 1.0,
          auto_page: true,
        },
      },
      path: "/home/p/.config/lectrice/config.toml",
      loaded: true,
      warnings: [],
      error: null,
    });

    await seedStoresFromConfigFile();

    expect(useAiTtsStore.getState()).toMatchObject({
      provider: "local",
      localUrl: "http://127.0.0.1:5301",
      selectedVoiceId: "F1-pt",
    });
  });

  it("leaves stored settings ALONE when no config file exists", async () => {
    // The regression guard: defaults come back even with no file, and applying
    // them would wipe what the user already configured through the UI.
    configGetEffective.mockResolvedValue({
      config: DEFAULT_CONFIG,
      path: "/home/p/.config/lectrice/config.toml",
      loaded: false,
      warnings: [],
      error: null,
    });

    await seedStoresFromConfigFile();

    expect(useSettingsStore.getState().theme).toBe("light");
    expect(useSettingsStore.getState().ttsRate).toBe(2.0);
    expect(useAiTtsStore.getState().speed).toBe(3.0);
  });

  it("leaves stored settings alone when the file failed to parse", async () => {
    configGetEffective.mockResolvedValue({
      config: DEFAULT_CONFIG,
      path: "/home/p/.config/lectrice/config.toml",
      loaded: false,
      warnings: [],
      error: "config.toml:3:8: key `tts.rate`: invalid type",
    });
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    await seedStoresFromConfigFile();

    expect(useSettingsStore.getState().theme).toBe("light");
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining("tts.rate"),
    );
    consoleError.mockRestore();
  });

  it("surfaces unknown-key warnings without blocking the seed", async () => {
    configGetEffective.mockResolvedValue({
      config: { ...DEFAULT_CONFIG, appearance: { theme: "dark" } },
      path: "/home/p/.config/lectrice/config.toml",
      loaded: true,
      warnings: ["unknown key `tts.ratee` (ignored)"],
      error: null,
    });
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});

    await seedStoresFromConfigFile();

    expect(consoleWarn).toHaveBeenCalledWith(
      expect.stringContaining("tts.ratee"),
    );
    expect(useSettingsStore.getState().theme).toBe("dark");
    consoleWarn.mockRestore();
  });

  it("never writes undefined over a stored setting", async () => {
    // zustand setState shallow-merges, so an explicit `undefined` in the patch
    // OVERWRITES the stored value. Today Rust always serializes every field, but
    // that invariant is invisible in bindings.ts — this asserts the seed does
    // not depend on it.
    useSettingsStore.setState({ theme: "light", ttsRate: 2.0 });
    useAiTtsStore.setState({ speed: 3.0, autoPageEnabled: true });

    configGetEffective.mockResolvedValue({
      // A deliberately sparse payload: only `appearance` is present.
      config: { schema_version: 1, appearance: { theme: "dark" } },
      path: "/home/p/.config/lectrice/config.toml",
      loaded: true,
      warnings: [],
      error: null,
    });

    await seedStoresFromConfigFile();

    expect(useSettingsStore.getState().theme).toBe("dark");
    expect(useSettingsStore.getState().ttsRate).toBe(2.0);
    expect(useAiTtsStore.getState().speed).toBe(3.0);
    expect(useAiTtsStore.getState().autoPageEnabled).toBe(true);
  });

  it("applies an explicit null tts.voice, which is a real value", async () => {
    // `null` means "let the platform choose" — it must survive the
    // undefined-filter, unlike an absent section.
    useSettingsStore.setState({ ttsVoice: "some-voice" });

    configGetEffective.mockResolvedValue({
      config: {
        ...DEFAULT_CONFIG,
        tts: { rate: 1.0, voice: null, follow_along: true },
      },
      path: "/home/p/.config/lectrice/config.toml",
      loaded: true,
      warnings: [],
      error: null,
    });

    await seedStoresFromConfigFile();

    expect(useSettingsStore.getState().ttsVoice).toBeNull();
  });

  it("never throws when the command itself fails", async () => {
    // A reader that will not start because its config could not be read is a
    // worse bug than any misconfiguration.
    configGetEffective.mockRejectedValue(new Error("IPC is down"));
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    await expect(seedStoresFromConfigFile()).resolves.toBeUndefined();

    expect(useSettingsStore.getState().theme).toBe("light");
    consoleError.mockRestore();
  });
});
