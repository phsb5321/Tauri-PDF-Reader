import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, cleanup } from "@testing-library/react";
import {
  COMMAND_CHORDS,
  resolveChord,
  useCommandKeys,
  type Chord,
} from "./useCommandKeys";
import { dispatchMenuAction, type MenuActionHandlers } from "./useMenuActions";
import type { MenuAction } from "../lib/api/menu";

afterEach(cleanup);

/** A `KeyboardEvent` as the window listener would see it. */
function keyEvent(
  key: string,
  init: {
    ctrl?: boolean;
    shift?: boolean;
    alt?: boolean;
    target?: Element;
  } = {},
): KeyboardEvent {
  const event = new KeyboardEvent("keydown", {
    key,
    ctrlKey: init.ctrl ?? false,
    shiftKey: init.shift ?? false,
    altKey: init.alt ?? false,
    bubbles: true,
    cancelable: true,
  });
  if (init.target) {
    Object.defineProperty(event, "target", {
      value: init.target,
      configurable: true,
    });
  }
  return event;
}

function inputElement(): HTMLInputElement {
  return document.createElement("input");
}

function contentEditable(): HTMLElement {
  const el = document.createElement("div");
  el.contentEditable = "true";
  // jsdom does not derive isContentEditable from the attribute.
  Object.defineProperty(el, "isContentEditable", { value: true });
  return el;
}

describe("resolveChord", () => {
  it("resolves every declared chord to its command", () => {
    for (const chord of COMMAND_CHORDS) {
      expect(resolveChord(keyEvent(chord.key, { ctrl: chord.ctrl }))).toBe(
        chord.action,
      );
    }
  });

  it("requires the modifier state the chord declares", () => {
    // Ctrl+O is a command; a bare "o" is a letter someone is typing.
    expect(resolveChord(keyEvent("o", { ctrl: true }))).toBe("open");
    expect(resolveChord(keyEvent("o"))).toBeNull();

    // ...and the reverse: PageDown is a command, Ctrl+PageDown is not one
    // this app claims, so it stays available to the platform.
    expect(resolveChord(keyEvent("PageDown"))).toBe("next-page");
    expect(resolveChord(keyEvent("PageDown", { ctrl: true }))).toBeNull();
  });

  it("ignores chords carrying Shift or Alt", () => {
    expect(resolveChord(keyEvent("o", { ctrl: true, shift: true }))).toBeNull();
    expect(resolveChord(keyEvent("o", { ctrl: true, alt: true }))).toBeNull();
    expect(resolveChord(keyEvent("ArrowRight", { shift: true }))).toBeNull();
  });

  it("leaves unmodified keys to the field the user is typing in", () => {
    for (const target of [
      inputElement(),
      document.createElement("textarea"),
      contentEditable(),
    ]) {
      expect(resolveChord(keyEvent("PageDown", { target }))).toBeNull();
      expect(resolveChord(keyEvent("ArrowLeft", { target }))).toBeNull();
    }
  });

  it("still runs a modified chord while typing", () => {
    // No text field claims Ctrl+O, and having to click away from the search
    // box before opening a document would be a worse bug than the one this
    // suppression exists to prevent.
    expect(
      resolveChord(keyEvent("o", { ctrl: true, target: inputElement() })),
    ).toBe("open");
  });

  it("does not claim the keys other components own", () => {
    // Escape belongs to the highlight toolbar, the context menu and the
    // playback bar; Ctrl+Shift+H to the highlight creation handler; Ctrl+Space
    // to the playback bar, whose handler can start playback from idle.
    expect(resolveChord(keyEvent("Escape"))).toBeNull();
    expect(resolveChord(keyEvent("h", { ctrl: true, shift: true }))).toBeNull();
    expect(resolveChord(keyEvent(" ", { ctrl: true }))).toBeNull();
  });

  it("returns null for a key with no binding", () => {
    expect(resolveChord(keyEvent("q"))).toBeNull();
    expect(resolveChord(keyEvent("F5"))).toBeNull();
  });

  it("yields to a component that already handled the key", () => {
    // The enforcement half of FR-005. An element-level React `onKeyDown` runs
    // before the event reaches `window`, so a list using arrows for its own
    // navigation (useRovingTabindex) has already called preventDefault by the
    // time this sees it. Without the guard the page would turn under the user
    // while they were moving through a list.
    const claimed = keyEvent("ArrowRight");
    claimed.preventDefault();
    expect(claimed.defaultPrevented).toBe(true);
    expect(resolveChord(claimed)).toBeNull();

    // ...and the same key is still a command when nobody claimed it.
    expect(resolveChord(keyEvent("ArrowRight"))).toBe("next-page");
  });

  it("treats Space as next page, the binding PdfViewer used to own", () => {
    // PdfViewer bound Space to next-page on its own window listener. It is a
    // real, live binding, so it moves into the table rather than disappearing;
    // what changes is that it now goes through the same handler the menu does.
    expect(resolveChord(keyEvent(" "))).toBe("next-page");
    // Still suppressed while typing, which PdfViewer's version got right only
    // for input and textarea.
    expect(
      resolveChord(keyEvent(" ", { target: contentEditable() })),
    ).toBeNull();
  });
});

describe("COMMAND_CHORDS", () => {
  it("only binds commands the menu can also reach", () => {
    // The registry is `MenuActionHandlers`; a chord pointing at an id outside
    // it could never be dispatched. `satisfies` catches this at compile time,
    // and this asserts it at runtime for the same reason the contract tests
    // exist: a type is not a test.
    const reachable: Record<MenuAction, keyof MenuActionHandlers> = {
      open: "onOpen",
      settings: "onSettings",
      "toggle-library": "onToggleLibrary",
      "toggle-highlights": "onToggleHighlights",
      find: "onFind",
      "play-pause": "onPlayPause",
      "prev-page": "onPrevPage",
      "next-page": "onNextPage",
    };
    for (const chord of COMMAND_CHORDS) {
      expect(reachable[chord.action]).toBeDefined();
    }
  });

  it("binds each chord exactly once", () => {
    const seen = COMMAND_CHORDS.map(
      (c: Chord) => `${c.ctrl ? "ctrl+" : ""}${c.key.toLowerCase()}`,
    );
    expect(new Set(seen).size).toBe(seen.length);
  });

  it("gives every chord a label a human can read", () => {
    for (const chord of COMMAND_CHORDS) {
      expect(chord.label.trim().length).toBeGreaterThan(0);
    }
  });
});

describe("useCommandKeys", () => {
  function handlers() {
    return {
      onOpen: vi.fn(),
      onSettings: vi.fn(),
      onToggleLibrary: vi.fn(),
      onToggleHighlights: vi.fn(),
      onFind: vi.fn(),
      onPlayPause: vi.fn(),
      onPrevPage: vi.fn(),
      onNextPage: vi.fn(),
    } satisfies Required<MenuActionHandlers>;
  }

  it("runs the handler for a bound chord", () => {
    const h = handlers();
    renderHook(() => useCommandKeys(h));

    window.dispatchEvent(keyEvent("PageDown"));
    expect(h.onNextPage).toHaveBeenCalledOnce();

    window.dispatchEvent(keyEvent("PageUp"));
    expect(h.onPrevPage).toHaveBeenCalledOnce();

    window.dispatchEvent(keyEvent("o", { ctrl: true }));
    expect(h.onOpen).toHaveBeenCalledOnce();
  });

  it("runs nothing for an unbound key", () => {
    const h = handlers();
    renderHook(() => useCommandKeys(h));

    window.dispatchEvent(keyEvent("q"));
    window.dispatchEvent(keyEvent("Escape"));
    window.dispatchEvent(keyEvent(" ", { ctrl: true }));

    for (const fn of Object.values(h)) {
      expect(fn).not.toHaveBeenCalled();
    }
  });

  it("calls preventDefault only when a chord matched", () => {
    renderHook(() => useCommandKeys(handlers()));

    const bound = keyEvent("PageDown");
    window.dispatchEvent(bound);
    expect(bound.defaultPrevented).toBe(true);

    const unbound = keyEvent("q");
    window.dispatchEvent(unbound);
    expect(unbound.defaultPrevented).toBe(false);
  });

  it("dispatches to the handlers from the latest render", () => {
    // The listener is registered once with an empty dependency list. Without
    // the ref it would keep calling the first render's handlers forever, which
    // is exactly the stale-closure bug `useMenuActions` documents.
    const first = handlers();
    const second = handlers();
    const { rerender } = renderHook(
      ({ h }: { h: Required<MenuActionHandlers> }) => useCommandKeys(h),
      { initialProps: { h: first } },
    );

    rerender({ h: second });
    window.dispatchEvent(keyEvent("PageDown"));

    expect(first.onNextPage).not.toHaveBeenCalled();
    expect(second.onNextPage).toHaveBeenCalledOnce();
  });

  it("stops listening once unmounted", () => {
    const h = handlers();
    const { unmount } = renderHook(() => useCommandKeys(h));

    unmount();
    window.dispatchEvent(keyEvent("PageDown"));

    expect(h.onNextPage).not.toHaveBeenCalled();
  });

  it("reaches the same handler the menu path reaches", () => {
    // The point of the feature: not "the keyboard also works", but "the
    // keyboard and the menu run the same function". Drive one handlers object
    // both ways and assert the same mock answered.
    const h = handlers();
    renderHook(() => useCommandKeys(h));

    dispatchMenuAction("next-page", h);
    expect(h.onNextPage).toHaveBeenCalledTimes(1);

    window.dispatchEvent(keyEvent("PageDown"));
    expect(h.onNextPage).toHaveBeenCalledTimes(2);
  });
});
