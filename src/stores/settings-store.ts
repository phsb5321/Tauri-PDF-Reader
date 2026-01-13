import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  DEFAULT_HIGHLIGHT_COLOR,
  DEFAULT_HIGHLIGHT_COLORS,
  DEFAULT_TTS_RATE,
} from '../lib/constants';
import { settingsGetAll, settingsSet, settingsSetBatch } from '../lib/tauri-invoke';

export type Theme = 'light' | 'dark' | 'system';

interface SettingsState {
  // Loading state
  isLoading: boolean;
  error: string | null;
  dbInitialized: boolean;

  // TTS settings
  ttsVoice: string | null;
  ttsRate: number;
  ttsFollowAlong: boolean;

  // Highlight settings
  highlightColors: string[];
  highlightDefaultColor: string;

  // Theme
  theme: Theme;

  // Telemetry
  telemetryAnalytics: boolean;
  telemetryErrors: boolean;

  // TTS runtime state (not persisted)
  ttsAvailable: boolean;
  ttsInitialized: boolean;

  // Actions
  loadFromDatabase: () => Promise<void>;
  syncToDatabase: () => Promise<void>;
  setHighlightDefaultColor: (color: string) => void;
  setHighlightColors: (colors: string[]) => void;
  setTtsVoice: (voice: string | null) => void;
  setTtsRate: (rate: number) => void;
  setTtsFollowAlong: (followAlong: boolean) => void;
  setTheme: (theme: Theme) => void;
  setTelemetryAnalytics: (enabled: boolean) => void;
  setTelemetryErrors: (enabled: boolean) => void;
  setTtsAvailable: (available: boolean) => void;
  setTtsInitialized: (initialized: boolean) => void;
  reset: () => void;
}

const initialState = {
  isLoading: false,
  error: null as string | null,
  dbInitialized: false,
  ttsVoice: null as string | null,
  ttsRate: DEFAULT_TTS_RATE,
  ttsFollowAlong: true,
  highlightColors: DEFAULT_HIGHLIGHT_COLORS,
  highlightDefaultColor: DEFAULT_HIGHLIGHT_COLOR,
  theme: 'system' as Theme,
  telemetryAnalytics: false,
  telemetryErrors: true,
  ttsAvailable: false,
  ttsInitialized: false,
};

// Helper to parse stored JSON values from database
function parseValue<T>(value: unknown, fallback: T): T {
  if (value === undefined || value === null) return fallback;
  return value as T;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      ...initialState,

      loadFromDatabase: async () => {
        set({ isLoading: true, error: null });
        try {
          const result = await settingsGetAll();
          const settings = result.settings;

          set({
            theme: parseValue<Theme>(settings['theme'], get().theme),
            ttsRate: parseValue<number>(settings['tts.rate'], get().ttsRate),
            ttsVoice: parseValue<string | null>(settings['tts.voice'], get().ttsVoice),
            ttsFollowAlong: parseValue<boolean>(settings['tts.followAlong'], get().ttsFollowAlong),
            highlightDefaultColor: parseValue<string>(settings['highlight.defaultColor'], get().highlightDefaultColor),
            highlightColors: parseValue<string[]>(settings['highlight.colors'], get().highlightColors),
            telemetryAnalytics: parseValue<boolean>(settings['telemetry.analytics'], get().telemetryAnalytics),
            telemetryErrors: parseValue<boolean>(settings['telemetry.errors'], get().telemetryErrors),
            isLoading: false,
            dbInitialized: true,
          });
        } catch (err) {
          console.error('Failed to load settings from database:', err);
          set({
            error: err instanceof Error ? err.message : 'Failed to load settings',
            isLoading: false,
            dbInitialized: true,
          });
        }
      },

      syncToDatabase: async () => {
        const state = get();
        try {
          await settingsSetBatch({
            'theme': state.theme,
            'tts.rate': state.ttsRate,
            'tts.voice': state.ttsVoice,
            'tts.followAlong': state.ttsFollowAlong,
            'highlight.defaultColor': state.highlightDefaultColor,
            'highlight.colors': state.highlightColors,
            'telemetry.analytics': state.telemetryAnalytics,
            'telemetry.errors': state.telemetryErrors,
          });
        } catch (err) {
          console.error('Failed to sync settings to database:', err);
        }
      },

      setHighlightDefaultColor: (color) => {
        set({ highlightDefaultColor: color });
        settingsSet('highlight.defaultColor', color).catch(console.error);
      },

      setHighlightColors: (colors) => {
        set({ highlightColors: colors });
        settingsSet('highlight.colors', colors).catch(console.error);
      },

      setTtsVoice: (voice) => {
        set({ ttsVoice: voice });
        settingsSet('tts.voice', voice).catch(console.error);
      },

      setTtsRate: (rate) => {
        const clampedRate = Math.max(0.5, Math.min(3.0, rate));
        set({ ttsRate: clampedRate });
        settingsSet('tts.rate', clampedRate).catch(console.error);
      },

      setTtsFollowAlong: (followAlong) => {
        set({ ttsFollowAlong: followAlong });
        settingsSet('tts.followAlong', followAlong).catch(console.error);
      },

      setTheme: (theme) => {
        set({ theme });
        settingsSet('theme', theme).catch(console.error);
      },

      setTelemetryAnalytics: (enabled) => {
        set({ telemetryAnalytics: enabled });
        settingsSet('telemetry.analytics', enabled).catch(console.error);
      },

      setTelemetryErrors: (enabled) => {
        set({ telemetryErrors: enabled });
        settingsSet('telemetry.errors', enabled).catch(console.error);
      },

      setTtsAvailable: (available) => set({ ttsAvailable: available }),

      setTtsInitialized: (initialized) => set({ ttsInitialized: initialized }),

      reset: () => {
        set(initialState);
        settingsSetBatch({
          'theme': initialState.theme,
          'tts.rate': initialState.ttsRate,
          'tts.voice': initialState.ttsVoice,
          'tts.followAlong': initialState.ttsFollowAlong,
          'highlight.defaultColor': initialState.highlightDefaultColor,
          'highlight.colors': initialState.highlightColors,
          'telemetry.analytics': initialState.telemetryAnalytics,
          'telemetry.errors': initialState.telemetryErrors,
        }).catch(console.error);
      },
    }),
    {
      name: 'pdf-reader-settings',
      partialize: (state) => ({
        highlightDefaultColor: state.highlightDefaultColor,
        highlightColors: state.highlightColors,
        ttsVoice: state.ttsVoice,
        ttsRate: state.ttsRate,
        ttsFollowAlong: state.ttsFollowAlong,
        theme: state.theme,
        telemetryAnalytics: state.telemetryAnalytics,
        telemetryErrors: state.telemetryErrors,
      }),
    }
  )
);
