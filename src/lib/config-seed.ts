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

/**
 * Drop `undefined` entries from a zustand patch.
 *
 * zustand's `setState` shallow-merges with `Object.assign` semantics, so an
 * explicit `undefined` OVERWRITES the stored value rather than leaving it
 * alone. Today the Rust side serializes every field (`#[serde(default)]` plus a
 * derived `Serialize`), so nothing is ever `undefined` — but that invariant is
 * invisible in `bindings.ts`, where specta marks every field optional. The day
 * a field gains `skip_serializing_if`, a blind patch would silently wipe the
 * user's stored setting. Filtering here makes the guarantee local instead of
 * depending on a serializer three layers away.
 */
function definedOnly<T extends object>(patch: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(patch).filter(([, value]) => value !== undefined),
  ) as Partial<T>;
}

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

  useSettingsStore.setState(
    definedOnly({
      theme: config.appearance?.theme as Theme | undefined,
      highlightDefaultColor: config.highlight?.default_color,
      highlightColors: config.highlight?.colors,
      ttsRate: config.tts?.rate,
      // `voice` is genuinely nullable (null = let the platform choose), so an
      // explicit null must survive; only an ABSENT section is skipped.
      ttsVoice: config.tts ? (config.tts.voice ?? null) : undefined,
      ttsFollowAlong: config.tts?.follow_along,
      telemetryAnalytics: config.telemetry?.analytics,
      telemetryErrors: config.telemetry?.errors,
    }),
  );

  useAiTtsStore.setState(
    definedOnly({
      selectedVoiceId: config.ai_tts?.voice_id,
      providerVoiceIds:
        config.ai_tts?.provider && config.ai_tts.voice_id
          ? {
              ...useAiTtsStore.getState().providerVoiceIds,
              [config.ai_tts.provider]: config.ai_tts.voice_id,
            }
          : undefined,
      speed: config.ai_tts?.speed,
      autoPageEnabled: config.ai_tts?.auto_page,
    }),
  );
  if (config.ai_tts?.provider) {
    useAiTtsStore
      .getState()
      .setProviderConfig(
        config.ai_tts.provider,
        config.ai_tts.local_url ?? null,
        config.ai_tts.provider !== "local",
      );
  }
}
