import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  AiVoiceInfo,
  AiTtsState as BackendTtsState,
} from "../lib/tauri-invoke";
import type { CoverageResponse } from "../lib/api/audio-cache";

export type AiTtsProvider = "elevenlabs" | "local" | "groq";
export const AI_TTS_PROVIDERS: readonly AiTtsProvider[] = [
  "local",
  "elevenlabs",
  "groq",
];

export type AiTtsConnectionStatus =
  | "setup"
  | "connecting"
  | "connected"
  | "error";

export interface AiTtsConnectionState {
  status: AiTtsConnectionStatus;
  error: string | null;
  destination: string | null;
  supportsWordTimings: boolean;
  maxTextUtf8Bytes: number;
}

export type AiTtsPlaybackState =
  | "idle"
  | "playing"
  | "paused"
  | "loading"
  | "error";

const VALID_TRANSITIONS: Record<AiTtsPlaybackState, AiTtsPlaybackState[]> = {
  idle: ["loading", "error"],
  loading: ["playing", "idle", "error"],
  playing: ["paused", "idle", "error"],
  paused: ["playing", "idle", "error"],
  error: ["idle", "loading"],
};

export type ProviderVoiceIds = Record<AiTtsProvider, string | null>;

interface AiTtsState {
  initialized: boolean;
  apiKey: string | null;
  initError: string | null;
  provider: AiTtsProvider;
  localUrl: string | null;
  supportsWordTimings: boolean;
  maxTextUtf8Bytes: number;
  connections: Record<AiTtsProvider, AiTtsConnectionState>;
  providerVoiceIds: ProviderVoiceIds;
  providerOperationGeneration: number;
  switchingProvider: AiTtsProvider | null;

  playbackState: AiTtsPlaybackState;
  currentText: string | null;
  error: string | null;
  naturalCompletionCount: number;

  voices: AiVoiceInfo[];
  selectedVoiceId: string | null;
  speed: number;
  autoPageEnabled: boolean;
  cacheCoverage: CoverageResponse | null;

  setApiKey: (key: string | null) => void;
  setProviderConfig: (
    provider: AiTtsProvider,
    localUrl: string | null,
    supportsWordTimings?: boolean,
    maxTextUtf8Bytes?: number,
  ) => void;
  setConnectionStatus: (
    provider: AiTtsProvider,
    status: AiTtsConnectionStatus,
    patch?: Partial<Omit<AiTtsConnectionState, "status">>,
  ) => void;
  beginProviderOperation: (provider: AiTtsProvider) => number;
  isCurrentProviderOperation: (generation: number) => boolean;
  setSwitchingProvider: (provider: AiTtsProvider | null) => void;
  setInitialized: (initialized: boolean, error?: string) => void;
  setVoices: (voices: AiVoiceInfo[]) => void;
  setSelectedVoice: (voiceId: string | null) => void;
  setSpeed: (speed: number) => void;
  setAutoPageEnabled: (enabled: boolean) => void;
  setCacheCoverage: (coverage: CoverageResponse | null) => void;
  setPlaybackState: (state: AiTtsPlaybackState) => void;
  transitionTo: (nextState: AiTtsPlaybackState, force?: boolean) => boolean;
  setCurrentText: (text: string | null) => void;
  setError: (error: string | null) => void;
  markNaturalCompletion: () => void;
  clearError: () => void;
  updateFromBackend: (state: BackendTtsState) => void;
  reset: () => void;
}

const DEFAULT_SPEED = 1.0;
const MIN_SPEED = 0.5;
const MAX_SPEED = 4.5;
const DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM";

function initialConnections(): Record<AiTtsProvider, AiTtsConnectionState> {
  return {
    elevenlabs: {
      status: "setup",
      error: null,
      destination: "https://api.elevenlabs.io",
      supportsWordTimings: true,
      maxTextUtf8Bytes: 10_000,
    },
    local: {
      status: "setup",
      error: null,
      destination: null,
      supportsWordTimings: false,
      maxTextUtf8Bytes: 8_192,
    },
    groq: {
      status: "setup",
      error: null,
      destination: "https://api.groq.com/openai/v1/audio/speech",
      supportsWordTimings: false,
      maxTextUtf8Bytes: 200,
    },
  };
}

const initialState = {
  initialized: false,
  apiKey: null as string | null,
  initError: null as string | null,
  provider: "elevenlabs" as AiTtsProvider,
  localUrl: null as string | null,
  supportsWordTimings: true,
  maxTextUtf8Bytes: 10_000,
  connections: initialConnections(),
  providerVoiceIds: {
    elevenlabs: DEFAULT_VOICE_ID,
    local: null,
    groq: "autumn",
  } as ProviderVoiceIds,
  providerOperationGeneration: 0,
  switchingProvider: null as AiTtsProvider | null,
  playbackState: "idle" as AiTtsPlaybackState,
  currentText: null as string | null,
  error: null as string | null,
  naturalCompletionCount: 0,
  voices: [] as AiVoiceInfo[],
  selectedVoiceId: DEFAULT_VOICE_ID,
  speed: DEFAULT_SPEED,
  autoPageEnabled: true,
  cacheCoverage: null as CoverageResponse | null,
};

interface PersistedAiTtsPreferences {
  selectedVoiceId: string | null;
  providerVoiceIds: ProviderVoiceIds;
  speed: number;
  autoPageEnabled: boolean;
}

const PERSISTENCE_VERSION = 2;
const PERSISTENCE_KEY = "ai-tts-storage";

function safeVoice(value: unknown, fallback: string | null): string | null {
  return typeof value === "string" || value === null ? value : fallback;
}

function sanitizePersistedPreferences(
  persistedState: unknown,
): PersistedAiTtsPreferences {
  const candidate =
    persistedState && typeof persistedState === "object"
      ? (persistedState as Partial<
          PersistedAiTtsPreferences & { apiKey?: unknown }
        >)
      : {};
  const legacyVoice = safeVoice(
    candidate.selectedVoiceId,
    initialState.selectedVoiceId,
  );
  const providerVoices =
    candidate.providerVoiceIds && typeof candidate.providerVoiceIds === "object"
      ? candidate.providerVoiceIds
      : ({} as Partial<ProviderVoiceIds>);

  return {
    selectedVoiceId: legacyVoice,
    providerVoiceIds: {
      elevenlabs: safeVoice(providerVoices.elevenlabs, legacyVoice),
      local: safeVoice(
        providerVoices.local,
        initialState.providerVoiceIds.local,
      ),
      groq: safeVoice(providerVoices.groq, initialState.providerVoiceIds.groq),
    },
    speed:
      typeof candidate.speed === "number" && Number.isFinite(candidate.speed)
        ? Math.max(MIN_SPEED, Math.min(MAX_SPEED, candidate.speed))
        : initialState.speed,
    autoPageEnabled:
      typeof candidate.autoPageEnabled === "boolean"
        ? candidate.autoPageEnabled
        : initialState.autoPageEnabled,
  };
}

export const useAiTtsStore = create<AiTtsState>()(
  persist<AiTtsState, [], [], PersistedAiTtsPreferences>(
    (set, get) => ({
      ...initialState,

      setApiKey: (key) => set({ apiKey: key }),

      setProviderConfig: (
        provider,
        localUrl,
        supportsWordTimings = provider === "elevenlabs",
        maxTextUtf8Bytes = get().connections[provider].maxTextUtf8Bytes,
      ) => {
        console.debug("[AiTtsStore] provider:", get().provider, "->", provider);
        const rememberedVoice = get().providerVoiceIds[provider];
        set({
          provider,
          localUrl,
          supportsWordTimings,
          maxTextUtf8Bytes,
          selectedVoiceId: rememberedVoice,
          connections: {
            ...get().connections,
            [provider]: {
              ...get().connections[provider],
              destination:
                provider === "local"
                  ? localUrl
                  : get().connections[provider].destination,
              supportsWordTimings,
              maxTextUtf8Bytes,
            },
          },
        });
      },

      setConnectionStatus: (provider, status, patch = {}) => {
        console.debug(
          "[AiTtsStore] connection:",
          provider,
          get().connections[provider].status,
          "->",
          status,
        );
        set({
          connections: {
            ...get().connections,
            [provider]: {
              ...get().connections[provider],
              ...patch,
              status,
            },
          },
        });
      },

      beginProviderOperation: (provider) => {
        const generation = get().providerOperationGeneration + 1;
        set({ providerOperationGeneration: generation });
        get().setConnectionStatus(
          provider,
          get().connections[provider].status === "connected"
            ? "connected"
            : "connecting",
          { error: null },
        );
        return generation;
      },

      isCurrentProviderOperation: (generation) =>
        get().providerOperationGeneration === generation,

      setSwitchingProvider: (provider) => set({ switchingProvider: provider }),

      setInitialized: (initialized, error) => {
        const provider = get().provider;
        get().setConnectionStatus(
          provider,
          initialized ? "connected" : error ? "error" : "setup",
          { error: error ?? null },
        );
        set({
          initialized,
          initError: error ?? null,
          playbackState: initialized ? "idle" : error ? "error" : "idle",
        });
      },

      setVoices: (voices) => {
        const provider = get().provider;
        const remembered = get().providerVoiceIds[provider];
        const selectedVoiceId = voices.some((voice) => voice.id === remembered)
          ? remembered
          : (voices[0]?.id ?? null);
        set({ voices, selectedVoiceId });
      },

      setSelectedVoice: (voiceId) => {
        const provider = get().provider;
        set({
          selectedVoiceId: voiceId,
          providerVoiceIds: {
            ...get().providerVoiceIds,
            [provider]: voiceId,
          },
        });
      },

      setSpeed: (speed) => {
        const clampedSpeed = Math.max(MIN_SPEED, Math.min(MAX_SPEED, speed));
        set({ speed: clampedSpeed });
      },

      setAutoPageEnabled: (enabled) => set({ autoPageEnabled: enabled }),
      setCacheCoverage: (coverage) => set({ cacheCoverage: coverage }),

      setPlaybackState: (state) => {
        const currentState = get().playbackState;
        console.debug(
          "[AiTtsStore] setPlaybackState:",
          currentState,
          "->",
          state,
        );
        if (currentState === "playing" && state === "idle") {
          console.debug("[AiTtsStore] playing->idle stack:", new Error().stack);
        }
        set({ playbackState: state });
      },

      transitionTo: (nextState, force = false) => {
        const currentState = get().playbackState;
        const validNextStates = VALID_TRANSITIONS[currentState];
        if (!force && !validNextStates.includes(nextState)) {
          console.warn(
            `[AiTtsStore] Invalid state transition: ${currentState} -> ${nextState}. ` +
              `Valid transitions: ${validNextStates.join(", ")}`,
          );
          return false;
        }
        console.debug(
          "[AiTtsStore] transitionTo:",
          currentState,
          "->",
          nextState,
          force ? "(forced)" : "",
        );
        set({ playbackState: nextState });
        return true;
      },

      setCurrentText: (text) => set({ currentText: text }),
      setError: (error) =>
        set({ error, playbackState: error ? "error" : get().playbackState }),
      markNaturalCompletion: () =>
        set({ naturalCompletionCount: get().naturalCompletionCount + 1 }),
      clearError: () => set({ error: null, playbackState: "idle" }),

      updateFromBackend: (backendState) => {
        set({
          initialized: backendState.initialized,
          playbackState: backendState.isPlaying
            ? "playing"
            : backendState.isPaused
              ? "paused"
              : "idle",
          selectedVoiceId: backendState.currentVoiceId ?? get().selectedVoiceId,
        });
      },

      reset: () => {
        const current = get();
        const connections = initialConnections();
        connections.local.destination = current.localUrl;
        set({
          ...initialState,
          connections,
          provider: current.provider,
          localUrl: current.localUrl,
          supportsWordTimings: current.supportsWordTimings,
          maxTextUtf8Bytes: current.maxTextUtf8Bytes,
          selectedVoiceId: current.providerVoiceIds[current.provider],
          providerVoiceIds: current.providerVoiceIds,
          providerOperationGeneration: current.providerOperationGeneration + 1,
        });
      },
    }),
    {
      name: PERSISTENCE_KEY,
      version: PERSISTENCE_VERSION,
      partialize: (state) => ({
        selectedVoiceId: state.selectedVoiceId,
        providerVoiceIds: state.providerVoiceIds,
        speed: state.speed,
        autoPageEnabled: state.autoPageEnabled,
      }),
      migrate: (persistedState) => sanitizePersistedPreferences(persistedState),
      merge: (persistedState, currentState) => ({
        ...currentState,
        ...sanitizePersistedPreferences(persistedState),
        apiKey: null,
      }),
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          localStorage.removeItem(PERSISTENCE_KEY);
          return;
        }
        state?.setApiKey(null);
      },
    },
  ),
);

export const selectIsPlaying = (state: AiTtsState) =>
  state.playbackState === "playing";
export const selectIsPaused = (state: AiTtsState) =>
  state.playbackState === "paused";
export const selectIsLoading = (state: AiTtsState) =>
  state.playbackState === "loading";
export const selectCanPlay = (state: AiTtsState) =>
  state.initialized && !state.error;
export const selectNeedsApiKey = (state: AiTtsState) =>
  (state.provider === "elevenlabs" || state.provider === "groq") &&
  !state.apiKey &&
  state.connections[state.provider].status !== "connected";
export const selectConnectedProviders = (state: AiTtsState) =>
  AI_TTS_PROVIDERS.filter(
    (provider) => state.connections[provider].status === "connected",
  );
export const selectSelectedVoice = (state: AiTtsState) =>
  state.voices.find((voice) => voice.id === state.selectedVoiceId) ?? null;
export const selectCacheCoverage = (state: AiTtsState) => state.cacheCoverage;
export const selectCacheCoveragePercent = (state: AiTtsState) =>
  state.cacheCoverage?.coveragePercent ?? 0;
