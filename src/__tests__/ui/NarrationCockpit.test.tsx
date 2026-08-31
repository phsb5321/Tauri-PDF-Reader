import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NarrationCockpit } from "../../components/playback-bar/NarrationCockpit";
import { useAiTtsStore } from "../../stores/ai-tts-store";
import { useSettingsStore } from "../../stores/settings-store";

vi.mock("../../hooks/useAiTts", () => ({
  useAiTts: () => ({
    initialized: true,
    initialize: vi.fn(),
    initializeGroq: vi.fn(),
    initializeLocal: vi.fn(),
    switchProvider: vi.fn(),
    provider: "local",
    localUrl: "http://127.0.0.1:5301",
    supportsWordTimings: false,
    initError: null,
    error: null,
    switchingProvider: null,
    connections: useAiTtsStore.getState().connections,
    voices: [{ id: "voice-1", name: "Reader", labels: {} }],
    selectedVoiceId: "voice-1",
    setVoice: vi.fn(),
    speed: useAiTtsStore.getState().speed,
    setSpeed: vi.fn(),
  }),
}));

vi.mock("../../lib/api/ai-tts", () => ({
  aiTtsCacheInfo: vi.fn(() => new Promise(() => undefined)),
  aiTtsCacheClear: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../lib/bindings", () => ({
  commands: {
    aiTtsGetPerformance: vi.fn(() => new Promise(() => undefined)),
  },
}));

describe("NarrationCockpit", () => {
  beforeEach(() => {
    localStorage.clear();
    useAiTtsStore.setState({
      initialized: true,
      provider: "local",
      playbackState: "idle",
      autoPageEnabled: true,
      performanceProfile: "balanced",
      numberNormalizationEnabled: true,
      narrationLanguage: "auto",
    });
    useSettingsStore.setState({ ttsFollowAlong: true });
  });

  it("mounts only the selected panel and makes all four tabs operable", () => {
    render(<NarrationCockpit onClose={vi.fn()} controlsDisabled={false} />);

    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      "Voice & route",
      "Delivery",
      "Performance",
      "Selection",
    ]);
    expect(screen.getByRole("tabpanel")).toHaveAttribute(
      "aria-labelledby",
      "narration-tab-voice",
    );

    fireEvent.click(screen.getByRole("tab", { name: "Delivery" }));
    expect(
      screen.getByRole("checkbox", { name: /^Follow read-along/ }),
    ).toBeChecked();
    fireEvent.click(
      screen.getByRole("checkbox", { name: /^Follow read-along/ }),
    );
    expect(useSettingsStore.getState().ttsFollowAlong).toBe(false);
    expect(
      screen.getByRole("checkbox", { name: /^Speak written numbers/ }),
    ).toBeChecked();
    fireEvent.click(
      screen.getByRole("checkbox", { name: /^Speak written numbers/ }),
    );
    fireEvent.change(
      screen.getByRole("combobox", { name: /^Narration language/ }),
      { target: { value: "pt-BR" } },
    );
    expect(useAiTtsStore.getState()).toMatchObject({
      numberNormalizationEnabled: false,
      narrationLanguage: "pt-BR",
    });

    fireEvent.click(screen.getByRole("tab", { name: "Performance" }));
    expect(screen.getByText("Narration performance")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Selection" }));
    expect(screen.getByText("Selection & highlights")).toBeInTheDocument();
    expect(screen.queryByText("Narration performance")).not.toBeInTheDocument();
  });

  it("owns the persisted delivery policy and locks it during narration", () => {
    const view = render(
      <NarrationCockpit onClose={vi.fn()} controlsDisabled={false} />,
    );
    fireEvent.click(screen.getByRole("tab", { name: "Delivery" }));

    fireEvent.click(screen.getByRole("radio", { name: /^Continuous/ }));
    expect(useAiTtsStore.getState().performanceProfile).toBe("continuous");
    expect(screen.getByRole("radio", { name: /^Continuous/ })).toBeChecked();

    view.rerender(<NarrationCockpit onClose={vi.fn()} controlsDisabled />);
    expect(screen.getByRole("radio", { name: /^Responsive/ })).toBeDisabled();
    expect(
      screen.getByRole("checkbox", { name: /^Speak written numbers/ }),
    ).toBeDisabled();
    expect(
      screen.getByRole("combobox", { name: /^Narration language/ }),
    ).toBeDisabled();
    expect(
      screen.getByText("Stop narration before changing speed or queue policy."),
    ).toBeVisible();
  });

  it("supports roving Arrow/Home/End keys and Escape closes", () => {
    const onClose = vi.fn();
    render(<NarrationCockpit onClose={onClose} controlsDisabled={false} />);

    const voice = screen.getByRole("tab", { name: "Voice & route" });
    voice.focus();
    fireEvent.keyDown(voice, { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: "Delivery" })).toHaveFocus();
    fireEvent.keyDown(document.activeElement as Element, { key: "End" });
    expect(screen.getByRole("tab", { name: "Selection" })).toHaveFocus();
    fireEvent.keyDown(document.activeElement as Element, { key: "Home" });
    expect(voice).toHaveFocus();
    fireEvent.keyDown(voice, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
