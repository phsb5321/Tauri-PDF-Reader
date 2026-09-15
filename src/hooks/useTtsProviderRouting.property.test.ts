import fc from "fast-check";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/tauri-invoke", () => ({
  settingsSet: vi.fn(() => Promise.resolve()),
  settingsSetBatch: vi.fn(() => Promise.resolve()),
}));
import {
  AI_TTS_PROVIDERS,
  selectConnectedProviders,
  useAiTtsStore,
  type AiTtsProvider,
  type NarrationLanguage,
} from "../stores/ai-tts-store";
import type { NarrationPerformanceProfile } from "../lib/narration-performance";
import { useSettingsStore } from "../stores/settings-store";

type Operation =
  | { kind: "connect"; provider: AiTtsProvider }
  | { kind: "switch"; provider: AiTtsProvider }
  | { kind: "voice"; provider: AiTtsProvider; voice: string }
  | { kind: "key"; value: string }
  | { kind: "begin"; provider: AiTtsProvider }
  | { kind: "profile"; profile: NarrationPerformanceProfile }
  | { kind: "autoPage"; enabled: boolean }
  | { kind: "normalize"; enabled: boolean }
  | { kind: "language"; language: NarrationLanguage }
  | { kind: "follow"; enabled: boolean };

const providerArbitrary = fc.constantFrom<AiTtsProvider>(
  "local",
  "elevenlabs",
  "groq",
);
const profileArbitrary = fc.constantFrom<NarrationPerformanceProfile>(
  "responsive",
  "balanced",
  "continuous",
);
const languageArbitrary = fc.constantFrom<NarrationLanguage>(
  "auto",
  "en",
  "pt-BR",
);
const operationArbitrary: fc.Arbitrary<Operation> = fc.oneof(
  providerArbitrary.map((provider) => ({ kind: "connect", provider })),
  providerArbitrary.map((provider) => ({ kind: "switch", provider })),
  fc
    .tuple(providerArbitrary, fc.string({ minLength: 1, maxLength: 24 }))
    .map(([provider, voice]) => ({ kind: "voice", provider, voice })),
  fc.string({ minLength: 20, maxLength: 48 }).map((value) => ({
    kind: "key",
    value: `sk_${value}`,
  })),
  providerArbitrary.map((provider) => ({ kind: "begin", provider })),
  profileArbitrary.map((profile) => ({ kind: "profile", profile })),
  fc.boolean().map((enabled) => ({ kind: "autoPage", enabled })),
  fc.boolean().map((enabled) => ({ kind: "normalize", enabled })),
  languageArbitrary.map((language) => ({ kind: "language", language })),
  fc.boolean().map((enabled) => ({ kind: "follow", enabled })),
);

beforeEach(() => {
  vi.spyOn(console, "debug").mockImplementation(() => undefined);
  localStorage.clear();
  useSettingsStore.setState({ ttsFollowAlong: true });
  const current = useAiTtsStore.getState();
  useAiTtsStore.setState({
    provider: "elevenlabs",
    initialized: false,
    apiKey: null,
    providerOperationGeneration: 0,
    performanceProfile: "balanced",
    providerVoiceIds: { elevenlabs: null, local: null, groq: null },
    connections: {
      elevenlabs: {
        ...current.connections.elevenlabs,
        status: "setup",
        error: null,
      },
      local: { ...current.connections.local, status: "setup", error: null },
      groq: { ...current.connections.groq, status: "setup", error: null },
    },
  });
  localStorage.clear();
});

afterEach(() => vi.restoreAllMocks());

describe("TTS provider routing model", () => {
  it("never activates a disconnected route or persists a cloud key", () => {
    const seed = Number(process.env.FC_SEED ?? 20260825);
    const numRuns = Number(process.env.FC_NUM_RUNS ?? 500);
    fc.assert(
      fc.property(
        fc.array(operationArbitrary, { minLength: 1, maxLength: 80 }),
        (operations) => {
          const initial = useAiTtsStore.getState();
          useAiTtsStore.setState({
            provider: "elevenlabs",
            initialized: false,
            apiKey: null,
            providerOperationGeneration: 0,
            performanceProfile: "balanced",
            providerVoiceIds: { elevenlabs: null, local: null, groq: null },
            connections: {
              elevenlabs: {
                ...initial.connections.elevenlabs,
                status: "setup",
                error: null,
              },
              local: {
                ...initial.connections.local,
                status: "setup",
                error: null,
              },
              groq: {
                ...initial.connections.groq,
                status: "setup",
                error: null,
              },
            },
          });
          localStorage.clear();
          useSettingsStore.setState({ ttsFollowAlong: true });
          useAiTtsStore.getState().setPerformanceProfile("balanced");
          const connected = new Set<AiTtsProvider>();
          const voices: Partial<Record<AiTtsProvider, string>> = {};
          let active: AiTtsProvider | null = null;
          let latestSecret: string | null = null;
          let latestProfile: NarrationPerformanceProfile = "balanced";
          let latestAutoPage = initial.autoPageEnabled;
          let latestNormalization = initial.numberNormalizationEnabled;
          let latestLanguage = initial.narrationLanguage;
          let latestFollow = useSettingsStore.getState().ttsFollowAlong;

          for (const operation of operations) {
            const store = useAiTtsStore.getState();
            if (operation.kind === "connect") {
              connected.add(operation.provider);
              store.setConnectionStatus(operation.provider, "connected");
            } else if (
              operation.kind === "switch" &&
              connected.has(operation.provider)
            ) {
              active = operation.provider;
              store.setProviderConfig(
                operation.provider,
                operation.provider === "local" ? "http://127.0.0.1:5301" : null,
                operation.provider === "elevenlabs",
                operation.provider === "groq" ? 200 : 8192,
              );
              store.setInitialized(true);
            } else if (
              operation.kind === "voice" &&
              connected.has(operation.provider)
            ) {
              active = operation.provider;
              store.setProviderConfig(operation.provider, null);
              store.setSelectedVoice(operation.voice);
              voices[operation.provider] = operation.voice;
            } else if (operation.kind === "key") {
              latestSecret = operation.value;
              store.setApiKey(operation.value);
            } else if (operation.kind === "begin") {
              store.beginProviderOperation(operation.provider);
            } else if (operation.kind === "profile") {
              latestProfile = operation.profile;
              store.setPerformanceProfile(operation.profile);
            } else if (operation.kind === "autoPage") {
              latestAutoPage = operation.enabled;
              store.setAutoPageEnabled(operation.enabled);
            } else if (operation.kind === "normalize") {
              latestNormalization = operation.enabled;
              store.setNumberNormalizationEnabled(operation.enabled);
            } else if (operation.kind === "language") {
              latestLanguage = operation.language;
              store.setNarrationLanguage(operation.language);
            } else if (operation.kind === "follow") {
              latestFollow = operation.enabled;
              useSettingsStore.getState().setTtsFollowAlong(operation.enabled);
            }

            const state = useAiTtsStore.getState();
            expect(selectConnectedProviders(state)).toEqual(
              AI_TTS_PROVIDERS.filter((provider) => connected.has(provider)),
            );
            if (active) {
              expect(connected.has(active)).toBe(true);
              expect(state.provider).toBe(active);
            }
            for (const [provider, voice] of Object.entries(voices)) {
              expect(state.providerVoiceIds[provider as AiTtsProvider]).toBe(
                voice,
              );
            }
            expect(state.performanceProfile).toBe(latestProfile);
            expect(state.autoPageEnabled).toBe(latestAutoPage);
            expect(state.numberNormalizationEnabled).toBe(latestNormalization);
            expect(state.narrationLanguage).toBe(latestLanguage);
            expect(useSettingsStore.getState().ttsFollowAlong).toBe(
              latestFollow,
            );
            const persisted = localStorage.getItem("ai-tts-storage") ?? "";
            expect(persisted).toContain(
              `"performanceProfile":"${latestProfile}"`,
            );
            expect(persisted).toContain(
              `"autoPageEnabled":${String(latestAutoPage)}`,
            );
            expect(persisted).toContain(
              `"numberNormalizationEnabled":${String(latestNormalization)}`,
            );
            expect(persisted).toContain(
              `"narrationLanguage":"${latestLanguage}"`,
            );
            expect(persisted).not.toContain("apiKey");
            expect(localStorage.getItem("pdf-reader-settings") ?? "").toContain(
              `"ttsFollowAlong":${String(latestFollow)}`,
            );
            if (latestSecret) expect(persisted).not.toContain(latestSecret);
          }
        },
      ),
      {
        seed,
        numRuns,
        path: process.env.FC_PATH,
        endOnFailure: true,
      },
    );
  });
});
