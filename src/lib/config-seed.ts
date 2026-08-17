/**
 * Seed the settings stores from the user config file (spec 078, slice 1).
 *
 * The config file is the source of truth for SETTINGS, so its values must be in
 * place BEFORE the first render — otherwise the app paints with the persisted
 * localStorage theme and then snaps to the configured one.
 *
 * Slice 1 is read-only and deliberately conservative: when NO file was loaded
 * this is a no-op. It must be, because `configGetEffective` always returns a
 * fully-populated `Config` — the built-in defaults when there is no file — and
 * blindly applying those would wipe the existing settings of every user who
 * has never written a config file. Only a file the user actually wrote may
 * override what is already stored.
 *
 * Slice 2 retires the SQLite settings path entirely, at which point this
 * becomes the only loader rather than a seed.
 */

import { commands, type EffectiveConfig } from "./bindings";
import { useSettingsStore, type Theme } from "../stores/settings-store";
import { useAiTtsStore } from "../stores/ai-tts-store";

/** Log a config finding once, in a form that names the file. */
function reportFindings(effective: EffectiveConfig): void {
  if (effective.error) {
    console.error(`[config] ${effective.error}`);
  }
  for (const warning of effective.warnings) {
    console.warn(`[config] ${warning}`);
  }
}

/**
 * Read the effective config and apply it to the stores.
 *
 * Never throws: a reader that cannot start because its config could not be
 * read would be a worse bug than any misconfiguration.
 */
export async function seedStoresFromConfigFile(): Promise<void> {
  let effective: EffectiveConfig;
  try {
    effective = await commands.configGetEffective();
  } catch (error) {
    console.error("[config] could not read the effective config:", error);
    return;
  }

  reportFindings(effective);

  // No file (or a file that failed to parse) — leave the stored settings alone.
  if (!effective.loaded) return;

  const { config } = effective;

  useSettingsStore.setState({
    theme: config.appearance?.theme as Theme,
    highlightDefaultColor: config.highlight?.default_color,
    highlightColors: config.highlight?.colors,
    ttsRate: config.tts?.rate,
    ttsVoice: config.tts?.voice ?? null,
    ttsFollowAlong: config.tts?.follow_along,
    telemetryAnalytics: config.telemetry?.analytics,
    telemetryErrors: config.telemetry?.errors,
  });

  useAiTtsStore.setState({
    selectedVoiceId: config.ai_tts?.voice_id,
    speed: config.ai_tts?.speed,
    autoPageEnabled: config.ai_tts?.auto_page,
  });
}
