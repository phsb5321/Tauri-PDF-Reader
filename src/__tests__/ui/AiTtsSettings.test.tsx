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

  it("masks the key and exposes stable visibility semantics and the egress disclosure", async () => {
    await act(async () => {
      render(<AiTtsSettings onClose={mocks.onClose} />);
    });

    const input = screen.getByLabelText("ElevenLabs API Key");
    const visibility = screen.getByRole("button", {
      name: "API key visibility",
    });

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

  it("coalesces rapid duplicate Connect submissions while the first is pending", async () => {
    let resolveInitialize!: () => void;
    mocks.initialize.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveInitialize = resolve;
      }),
    );
    await act(async () => {
      render(<AiTtsSettings onClose={mocks.onClose} />);
    });

    fireEvent.change(screen.getByLabelText("ElevenLabs API Key"), {
      target: { value: "one-explicit-submit" },
    });
    const form = screen.getByLabelText("Connect ElevenLabs");
    fireEvent.submit(form);
    fireEvent.submit(form);

    expect(mocks.initialize).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveInitialize();
    });
    expect(mocks.onClose).toHaveBeenCalledTimes(1);
  });
});
