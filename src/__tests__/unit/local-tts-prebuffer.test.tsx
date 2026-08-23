import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PDFDocumentProxy } from "pdfjs-dist";

const mocks = vi.hoisted(() => ({
  prebuffer: vi.fn(),
  getPage: vi.fn(),
}));

vi.mock("../../lib/tauri-invoke", () => ({ aiTtsPrebuffer: mocks.prebuffer }));
vi.mock("../../services/pdf-service", () => ({
  pdfService: { getPage: mocks.getPage },
}));

import { useTtsPrebuffer } from "../../hooks/useTtsPrebuffer";
import { useAiTtsStore } from "../../stores/ai-tts-store";

describe("local TTS prebuffer privacy boundary", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    useAiTtsStore.setState({
      initialized: true,
      provider: "local",
      localUrl: "http://127.0.0.1:5301",
      selectedVoiceId: "F1-pt",
    });
    mocks.getPage.mockResolvedValue({
      getTextContent: vi
        .fn()
        .mockResolvedValue({ items: [{ str: "private page text" }] }),
    });
  });

  afterEach(() => vi.useRealTimers());

  it("does not extract or send page text before public Play", async () => {
    const pdf = { numPages: 2 } as PDFDocumentProxy;
    renderHook(() => useTtsPrebuffer(pdf, 1, { debounceMs: 0 }));

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(mocks.getPage).not.toHaveBeenCalled();
    expect(mocks.prebuffer).not.toHaveBeenCalled();
  });
});
