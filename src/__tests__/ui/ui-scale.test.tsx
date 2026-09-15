import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "../../App";
import { ThemeToggle } from "../../components/settings/ThemeToggle";
import {
  UI_SCALE_DEFAULT,
  useSettingsStore,
} from "../../stores/settings-store";
import { mockInvoke } from "../../../tests/setup";

vi.mock("../../components/reader/ReaderView", () => ({
  ReaderView: () => <main>Reader</main>,
}));

beforeEach(() => {
  mockInvoke.mockImplementation(async (command) =>
    command === "get_render_settings"
      ? {
          qualityMode: "balanced",
          maxMegapixels: 24,
          hwAccelerationEnabled: true,
          debugOverlayEnabled: false,
        }
      : undefined,
  );
  document.documentElement.style.removeProperty("font-size");
  act(() => {
    useSettingsStore.setState({ uiScale: UI_SCALE_DEFAULT, theme: "system" });
  });
});

describe("adjustable UI scale", () => {
  it("applies the persisted scale to the whole app", () => {
    render(<App />);
    expect(document.documentElement.style.fontSize).toBe("125%");

    act(() => useSettingsStore.getState().setUiScale(1.5));
    expect(document.documentElement.style.fontSize).toBe("150%");
  });

  it("exposes a keyboard-native percentage slider in Appearance", () => {
    render(<ThemeToggle />);
    const slider = screen.getByRole("slider", { name: "UI scale" });

    expect(slider).toHaveValue("125");
    expect(slider).toHaveAttribute("aria-valuetext", "125%");

    fireEvent.change(slider, { target: { value: "140" } });
    expect(useSettingsStore.getState().uiScale).toBe(1.4);
    expect(screen.getByText("140%")).toBeVisible();
  });
});
