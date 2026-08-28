import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  performance: vi.fn(),
}));

vi.mock("../../lib/bindings", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../lib/bindings")>();
  return {
    ...original,
    commands: {
      ...original.commands,
      aiTtsGetPerformance: h.performance,
    },
  };
});

import { PerformanceSettings } from "../../components/settings/PerformanceSettings";
import { SettingsPanel } from "../../components/settings/SettingsPanel";
import { useAiTtsStore } from "../../stores/ai-tts-store";
import { useSettingsStore } from "../../stores/settings-store";

const SNAPSHOT = {
  provider: "local" as const,
  supportsWordTimings: false,
  maxTextUtf8Bytes: 300,
  runtime: {
    providerRevision: "magpie-q6-vulkan-model-chunk-v1",
    model: "Magpie TTS Multilingual 357M",
    modelRevision: "model-sha",
    quantization: "Q6_K",
    backend: "Vulkan/RADV",
    device: "AMD Radeon RX 5700 XT",
    acceleration: "gpu",
    queueCapacity: 1,
    chunkMaxUtf8Bytes: 300,
  },
  latestUncached: {
    requestUtf8Bytes: 292,
    generationMs: 4_200,
    audioDuration: 12,
    standardRtf: 0.35,
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  h.performance.mockResolvedValue({ status: "ok", data: SNAPSHOT });
  useAiTtsStore.setState({
    performanceProfile: "balanced",
    playbackState: "idle",
  });
  useSettingsStore.setState({ dbInitialized: true });
});

describe("narration Performance settings", () => {
  it("shows factual engine metadata and uncached standard RTF", async () => {
    render(<PerformanceSettings />);

    expect(
      await screen.findByText("Magpie TTS Multilingual 357M"),
    ).toBeVisible();
    expect(screen.getByText("Vulkan/RADV")).toBeVisible();
    expect(screen.getByText("AMD Radeon RX 5700 XT")).toBeVisible();
    expect(screen.getByText("0.350 RTF")).toBeVisible();
    expect(
      screen.getByText(/292 bytes · 4.20 s for 12.00 s audio/u),
    ).toBeVisible();
    expect(screen.getByRole("radio", { name: /Balanced/u })).toBeChecked();
  });

  it("persists one coherent policy and locks changes during playback", async () => {
    const view = render(<PerformanceSettings />);
    await screen.findByText("Magpie TTS Multilingual 357M");

    fireEvent.click(screen.getByRole("radio", { name: /Continuous/u }));
    expect(useAiTtsStore.getState().performanceProfile).toBe("continuous");

    view.unmount();
    render(<PerformanceSettings />);
    await screen.findByText("Magpie TTS Multilingual 357M");
    expect(screen.getByRole("radio", { name: /Continuous/u })).toBeChecked();

    act(() => useAiTtsStore.setState({ playbackState: "playing" }));
    expect(screen.getByRole("radio", { name: /Responsive/u })).toBeDisabled();
    expect(
      screen.getByText("Stop narration before changing its queue policy."),
    ).toBeVisible();
  });

  it("renders unknown runtime data as unavailable rather than claiming GPU", async () => {
    h.performance.mockResolvedValue({
      status: "ok",
      data: {
        ...SNAPSHOT,
        runtime: {
          ...SNAPSHOT.runtime,
          model: null,
          backend: null,
          device: null,
          acceleration: null,
        },
        latestUncached: null,
      },
    });
    render(<PerformanceSettings />);

    await waitFor(() => expect(h.performance).toHaveBeenCalled());
    expect(screen.getAllByText("Unavailable").length).toBeGreaterThanOrEqual(4);
    expect(screen.queryByText(/^gpu$/iu)).not.toBeInTheDocument();
    expect(
      screen.getByText(/Cache hits never replace this result/u),
    ).toBeVisible();
  });

  it("never renders missing duration as a perfect zero RTF", async () => {
    h.performance.mockResolvedValue({
      status: "ok",
      data: {
        ...SNAPSHOT,
        latestUncached: { ...SNAPSHOT.latestUncached, standardRtf: null },
      },
    });
    render(<PerformanceSettings />);

    expect(await screen.findByText("RTF unavailable")).toBeVisible();
    expect(
      screen.getByText("Generated-audio duration was unavailable"),
    ).toBeVisible();
    expect(screen.queryByText("0.000 RTF")).not.toBeInTheDocument();
  });

  it("is reachable as a named Settings navigation section", async () => {
    render(<SettingsPanel isOpen onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Performance" }));
    expect(
      await screen.findByRole("heading", { name: "Narration performance" }),
    ).toBeVisible();
  });
});
