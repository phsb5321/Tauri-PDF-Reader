import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "../../App";
import { DEFAULT_RENDER_SETTINGS } from "../../domain/rendering";
import { useRenderStore } from "../../stores/render-store";
import { mockInvoke } from "../../../tests/setup";

vi.mock("../../components/reader/ReaderView", () => ({
  ReaderView: () => <main>Reader</main>,
}));

describe("render settings bootstrap", () => {
  beforeEach(() => {
    useRenderStore.setState({
      settings: DEFAULT_RENDER_SETTINGS,
      isLoading: false,
      settingsInitialized: false,
      error: null,
      hasUnsavedChanges: false,
      pendingRestart: false,
      currentRenderPlan: null,
    });
  });

  it("loads persisted render limits before the user opens Settings", async () => {
    mockInvoke.mockImplementation(async (command) => {
      if (command === "get_render_settings") {
        return {
          qualityMode: "performance",
          maxMegapixels: 16,
          hwAccelerationEnabled: true,
          debugOverlayEnabled: false,
        };
      }
      return undefined;
    });

    render(<App />);

    await waitFor(() =>
      expect(useRenderStore.getState().settingsInitialized).toBe(true),
    );
    expect(useRenderStore.getState().settings).toMatchObject({
      qualityMode: "performance",
      maxMegapixels: 16,
    });
    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(mockInvoke).toHaveBeenCalledWith("get_render_settings");
  });
});
