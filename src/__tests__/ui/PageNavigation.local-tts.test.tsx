import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  stop: vi.fn(),
  updateProgress: vi.fn(),
}));

vi.mock("../../lib/tauri-invoke", () => ({ aiTtsStop: mocks.stop }));
vi.mock("../../lib/bindings", () => ({
  commands: { libraryUpdateProgress: mocks.updateProgress },
}));

import { PageNavigation } from "../../components/PageNavigation";
import { useAiTtsStore } from "../../stores/ai-tts-store";
import { useDocumentStore } from "../../stores/document-store";

describe("PageNavigation local TTS cancellation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.stop.mockResolvedValue({ success: true });
    mocks.updateProgress.mockResolvedValue({ status: "ok", data: null });
    useAiTtsStore.setState({ playbackState: "loading" });
    useDocumentStore.setState({
      currentDocument: {
        id: "doc",
        title: "Fixture",
        filePath: "/fixture.pdf",
        pageCount: 3,
        currentPage: 1,
        scrollPosition: 0,
        lastOpenedAt: null,
      } as never,
      currentPage: 1,
      totalPages: 3,
    });
  });

  it("cancels loading before the visible Next button changes page", async () => {
    const order: string[] = [];
    mocks.stop.mockImplementation(async () => {
      order.push(`stop@${useDocumentStore.getState().currentPage}`);
      return { success: true };
    });

    render(<PageNavigation />);
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));

    await waitFor(() =>
      expect(useDocumentStore.getState().currentPage).toBe(2),
    );
    expect(order).toEqual(["stop@1"]);
    expect(mocks.stop).toHaveBeenCalledOnce();
  });
});
