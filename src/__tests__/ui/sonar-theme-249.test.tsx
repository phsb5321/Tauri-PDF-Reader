import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ThemeToggle } from "../../components/settings/ThemeToggle";
import { useSettingsStore } from "../../stores/settings-store";

afterEach(() => {
  vi.restoreAllMocks();
  delete document.documentElement.dataset.theme;
});

describe("theme attribute through public appearance buttons", () => {
  it.each([
    ["Light", "light", true, "light"],
    ["Dark", "dark", false, "dark"],
    ["System", "system", true, "dark"],
    ["System", "system", false, "light"],
  ] as const)(
    "%s preserves the resolved data-theme",
    (label, theme, dark, resolved) => {
      useSettingsStore.setState({ theme: "system" });
      vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
        matches: dark,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(() => true),
      }));
      render(<ThemeToggle />);
      fireEvent.click(screen.getByRole("button", { name: label, exact: true }));
      expect(useSettingsStore.getState().theme).toBe(theme);
      expect(document.documentElement).toHaveAttribute("data-theme", resolved);
    },
  );
});
