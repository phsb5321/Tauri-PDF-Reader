/**
 * 257 page controls — scoped draft-commit regression for PageNavigation.
 *
 * p16 corrective acceptance (15/09/2026): the draft must behave as one
 * deliberate edit. Full-string integer policy (parseInt accepted "12junk"/
 * "1.5"), clamp valid out-of-range values exactly once, invalid/cancel resets
 * with zero navigation and zero progress calls, Enter-then-blur dispatches
 * once, and an external page change while the draft is dirty must never
 * replay the stale intent.
 *
 * Oracles: the real zustand document store (page + its clamp), counted
 * progress-chain enqueues, counted TTS stops. The frozen usePageNavigation
 * hook is intentionally not involved: this leaf owns only its own dispatch.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import { PageNavigation } from "./PageNavigation";
import { useDocumentStore } from "../stores/document-store";
import { useAiTtsStore } from "../stores/ai-tts-store";

vi.mock("../lib/tauri-invoke", () => ({
  aiTtsStop: vi.fn(async () => undefined),
}));
vi.mock("../lib/bindings", () => ({
  commands: {
    libraryUpdateProgress: vi.fn(async () => ({ status: "ok" })),
  },
}));
vi.mock("../hooks/useAutoSave", () => ({
  enqueueProgressWrite: vi.fn((task: () => Promise<void>) => task()),
}));
vi.mock("../hooks/useAnnounce", () => ({
  useAnnounce: () => ({ announce: vi.fn() }),
  ANNOUNCEMENTS: {
    pageChange: (page: number, total: number) => `Page ${page} of ${total}`,
  },
}));

const { aiTtsStop } = await import("../lib/tauri-invoke");
const { commands } = await import("../lib/bindings");
const { enqueueProgressWrite } = await import("../hooks/useAutoSave");

const DOC = { id: "doc-1" } as ReturnType<
  typeof useDocumentStore.getState
>["currentDocument"];

function renderAtPage(page: number, total = 40) {
  useDocumentStore.setState({
    currentDocument: DOC,
    currentPage: page,
    totalPages: total,
  });
  return render(<PageNavigation />);
}

const input = () => screen.getByLabelText("Current page") as HTMLInputElement;
const type = (value: string) => fireEvent.change(input(), { target: { value } });
const press = (key: string) => fireEvent.keyDown(input(), { key });

beforeEach(() => {
  vi.clearAllMocks();
  useDocumentStore.getState().reset();
  useAiTtsStore.setState({ playbackState: "idle" });
});

describe("PageNavigation draft commit policy", () => {
  it("commits on Enter and a trailing blur never dispatches the page twice", async () => {
    useAiTtsStore.setState({ playbackState: "playing" });
    renderAtPage(2);
    type("5");
    press("Enter");
    // Blur lands in the same tick, before the stop-audio await resolves —
    // exactly the window where the old code dispatched a second time.
    fireEvent.blur(input());

    await waitFor(() =>
      expect(useDocumentStore.getState().currentPage).toBe(5),
    );
    expect(aiTtsStop).toHaveBeenCalledTimes(1);
    expect(enqueueProgressWrite).toHaveBeenCalledTimes(1);
    expect(commands.libraryUpdateProgress).toHaveBeenCalledTimes(1);
    expect(input().value).toBe("5");
  });

  it("commits once on blur without any Enter", async () => {
    renderAtPage(2);
    type("5");
    fireEvent.blur(input());

    await waitFor(() =>
      expect(useDocumentStore.getState().currentPage).toBe(5),
    );
    expect(enqueueProgressWrite).toHaveBeenCalledTimes(1);
  });

  it("Escape then blur makes zero navigation and zero progress calls", () => {
    renderAtPage(2);
    type("9");
    press("Escape");
    fireEvent.blur(input());

    expect(useDocumentStore.getState().currentPage).toBe(2);
    expect(enqueueProgressWrite).not.toHaveBeenCalled();
    expect(aiTtsStop).not.toHaveBeenCalled();
    expect(input().value).toBe("2");
  });

  it("rejects non-integer and precision-lost drafts with zero calls", () => {
    renderAtPage(2);
    type("12junk");
    press("Enter");
    expect(useDocumentStore.getState().currentPage).toBe(2);
    expect(enqueueProgressWrite).not.toHaveBeenCalled();
    expect(input().value).toBe("2");

    type("1.5");
    fireEvent.blur(input());
    expect(useDocumentStore.getState().currentPage).toBe(2);
    expect(enqueueProgressWrite).not.toHaveBeenCalled();
    expect(input().value).toBe("2");

    // Beyond Number.isSafeInteger the value has already lost precision:
    // invalid reset, never a clamp-and-navigate.
    type("9007199254740993");
    press("Enter");
    expect(useDocumentStore.getState().currentPage).toBe(2);
    expect(enqueueProgressWrite).not.toHaveBeenCalled();

    type("9".repeat(300));
    fireEvent.blur(input());
    expect(useDocumentStore.getState().currentPage).toBe(2);
    expect(enqueueProgressWrite).not.toHaveBeenCalled();
    expect(input().value).toBe("2");
  });

  it("rejects signed input as a marked policy divergence from the parseInt era", () => {
    // EXPLICIT POLICY MARK (p16 readback 16:50, queued with READY): the old
    // parseInt accepted "-1" and clamped it; acceptance N1 preserves
    // out-of-range MAGNITUDE clamping for unsigned integers only. Signed
    // input ("-1", "+2") is deliberately invalid under the digits-only
    // contract — this test pins that divergence so it can never regress
    // silently in either direction.
    renderAtPage(5);
    type("-1");
    press("Enter");
    expect(useDocumentStore.getState().currentPage).toBe(5);
    expect(enqueueProgressWrite).not.toHaveBeenCalled();
    expect(aiTtsStop).not.toHaveBeenCalled();
    expect(input().value).toBe("5");

    type("+2");
    fireEvent.blur(input());
    expect(useDocumentStore.getState().currentPage).toBe(5);
    expect(enqueueProgressWrite).not.toHaveBeenCalled();
    expect(input().value).toBe("5");
  });

  it("treats a draft clamping to the current page as a no-op with zero calls", () => {
    renderAtPage(1);
    type("0");
    press("Enter");
    fireEvent.blur(input());

    expect(useDocumentStore.getState().currentPage).toBe(1);
    expect(enqueueProgressWrite).not.toHaveBeenCalled();
    expect(aiTtsStop).not.toHaveBeenCalled();
    expect(input().value).toBe("1");
  });

  it("trims surrounding whitespace and commits the integer once", async () => {
    renderAtPage(2);
    type(" 5 ");
    press("Enter");

    await waitFor(() =>
      expect(useDocumentStore.getState().currentPage).toBe(5),
    );
    expect(enqueueProgressWrite).toHaveBeenCalledTimes(1);
  });

  it("clamps a valid out-of-range draft once at commit", async () => {
    renderAtPage(2);
    type("9999");
    press("Enter");

    await waitFor(() =>
      expect(useDocumentStore.getState().currentPage).toBe(40),
    );
    expect(enqueueProgressWrite).toHaveBeenCalledTimes(1);
    expect(input().value).toBe("40");
  });

  it("an external page change while the draft is dirty never replays stale intent", () => {
    renderAtPage(2);
    type("25");
    // External navigation (menu, follow-narration, another dispatcher).
    act(() => {
      useDocumentStore.getState().setCurrentPage(7);
    });
    expect(input().value).toBe("7");
    fireEvent.blur(input());

    expect(useDocumentStore.getState().currentPage).toBe(7);
    expect(enqueueProgressWrite).not.toHaveBeenCalled();
    expect(aiTtsStop).not.toHaveBeenCalled();
  });

  it("a document swap landing on the same page number still invalidates the draft", () => {
    renderAtPage(2);
    type("25");
    act(() => {
      // Different document identity, coincidentally the same page number:
      // the dirty draft must still not survive into the new book.
      useDocumentStore.setState({ currentDocument: { id: "doc-2" } as never });
    });
    expect(input().value).toBe("2");
    fireEvent.blur(input());

    expect(useDocumentStore.getState().currentPage).toBe(2);
    expect(enqueueProgressWrite).not.toHaveBeenCalled();
    expect(aiTtsStop).not.toHaveBeenCalled();
  });
});

describe("PageNavigation limits and context", () => {
  it("disables previous on the first page and next on the last", () => {
    renderAtPage(1);
    expect(screen.getByLabelText("Previous page")).toBeDisabled();
    expect(screen.getByLabelText("Next page")).toBeEnabled();

    fireEvent.click(screen.getByLabelText("Next page"));
    expect(useDocumentStore.getState().currentPage).toBe(2);

    act(() => {
      useDocumentStore.setState({ currentPage: 40 });
    });
    expect(screen.getByLabelText("Next page")).toBeDisabled();
    expect(screen.getByLabelText("Previous page")).toBeEnabled();
  });

  it("keeps the exact accessible name and adds context via describedby/group", () => {
    renderAtPage(2);
    expect(screen.getByLabelText("Current page")).toBeTruthy();
    expect(input().getAttribute("aria-describedby")).toBe("page-total-readout");
    expect(document.getElementById("page-total-readout")?.textContent).toBe(
      "40",
    );
    expect(screen.getByRole("group", { name: "Page position" })).toBeTruthy();
  });

  it("a draft equal to the current page commits nothing", () => {
    renderAtPage(2);
    type("2");
    press("Enter");
    fireEvent.blur(input());

    expect(useDocumentStore.getState().currentPage).toBe(2);
    expect(enqueueProgressWrite).not.toHaveBeenCalled();
    expect(aiTtsStop).not.toHaveBeenCalled();
  });
});
