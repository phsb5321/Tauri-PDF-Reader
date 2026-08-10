import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  initialize: vi.fn(),
  onClose: vi.fn(),
  useAiTts: vi.fn(),
  cacheInfo: vi.fn(async () => ({
    totalSizeBytes: 0,
    entryCount: 0,
    oldestEntry: null,
    newestEntry: null,
  })),
  cacheClear: vi.fn(),
}));

vi.mock("../../hooks/useAiTts", () => ({ useAiTts: mocks.useAiTts }));
vi.mock("../../lib/api/ai-tts", () => ({
  aiTtsCacheInfo: mocks.cacheInfo,
  aiTtsCacheClear: mocks.cacheClear,
}));

import { AiTtsSettings } from "../../components/playback-bar/AiTtsSettings";
import { useAiTtsStore } from "../../stores/ai-tts-store";

describe("AiTtsSettings session-secret setup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.initialize.mockResolvedValue(undefined);
    mocks.useAiTts.mockReturnValue({
      initialized: false,
      apiKey: null,
      needsApiKey: true,
      initialize: mocks.initialize,
      error: null,
    });
  });

  afterEach(cleanup);

  it("opens at h2 with the cache section at h3, matching every sibling panel", async () => {
    await act(async () => {
      render(<AiTtsSettings onClose={mocks.onClose} />);
    });

    // This popover has no h1/h2 ancestor of its own (it mounts directly under
    // the playback bar, unlike SettingsPanel/Dialog which open at h2) — so it
    // must itself start the sequence at h2, not skip to h3.
    expect(
      screen.getByRole("heading", { level: 2, name: "AI TTS Settings" }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { level: 3, name: "Audio Cache" }),
    ).toBeVisible();
  });

  it("masks the key and exposes stable visibility semantics and the egress disclosure", async () => {
    await act(async () => {
      render(<AiTtsSettings onClose={mocks.onClose} />);
    });

    const input = screen.getByLabelText("ElevenLabs API Key");
    const visibility = screen.getByRole("button", {
      name: "API key visibility",
    });

    expect(screen.getByRole("button", { name: "Connect" })).toBeVisible();
    expect(input).toHaveAttribute("type", "password");
    expect(visibility).toHaveAttribute("aria-pressed", "false");
    expect(input).toHaveAccessibleDescription(
      /requested PDF-derived text leaves this device and is sent to ElevenLabs for speech generation/i,
    );

    fireEvent.click(visibility);

    expect(input).toHaveAttribute("type", "text");
    expect(visibility).toHaveAccessibleName("API key visibility");
    expect(visibility).toHaveAttribute("aria-pressed", "true");
  });

  it("keeps render, typing, visibility, clear, and close passive", async () => {
    await act(async () => {
      render(<AiTtsSettings onClose={mocks.onClose} />);
    });

    const input = screen.getByLabelText("ElevenLabs API Key");
    fireEvent.change(input, { target: { value: "typed-but-not-submitted" } });
    fireEvent.click(screen.getByRole("button", { name: "API key visibility" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Clear API key field" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Close AI TTS settings" }),
    );

    expect(mocks.initialize).not.toHaveBeenCalled();
    expect(mocks.onClose).toHaveBeenCalledTimes(1);
  });

  it("prioritizes the pending label during duplicate Update submissions", async () => {
    let resolveInitialize!: () => void;
    mocks.initialize.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveInitialize = resolve;
      }),
    );
    mocks.useAiTts.mockReturnValue({
      initialized: true,
      apiKey: "current-session-key",
      needsApiKey: false,
      initialize: mocks.initialize,
      error: null,
    });
    await act(async () => {
      // Slice 109 B2: the dialog closes only on ACTUAL success — the store
      // must be initialized (a successful initialize sets it), matching the
      // real flow.
      useAiTtsStore.setState({ initialized: true });
      render(<AiTtsSettings onClose={mocks.onClose} />);
    });

    expect(screen.getByRole("button", { name: "Update" })).toBeVisible();

    const form = screen.getByLabelText("Connect ElevenLabs");
    fireEvent.submit(form);
    fireEvent.submit(form);

    expect(mocks.initialize).toHaveBeenCalledTimes(1);
    expect(mocks.initialize).toHaveBeenCalledWith("current-session-key");
    expect(
      screen.getByRole("button", { name: "Connecting..." }),
    ).toBeDisabled();

    await act(async () => {
      resolveInitialize();
    });
    expect(mocks.onClose).toHaveBeenCalledTimes(1);
  });
});
