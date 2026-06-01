import { describe, it, expect, vi } from "vitest";
import { dispatchMenuAction, type MenuActionHandlers } from "./useMenuActions";

describe("dispatchMenuAction", () => {
  function allHandlers() {
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

  it("invokes the matching handler and reports it ran", () => {
    const onOpen = vi.fn();
    expect(dispatchMenuAction("open", { onOpen })).toBe(true);
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it("routes every action to its own handler", () => {
    const cases: Array<
      [Parameters<typeof dispatchMenuAction>[0], keyof MenuActionHandlers]
    > = [
      ["open", "onOpen"],
      ["settings", "onSettings"],
      ["toggle-library", "onToggleLibrary"],
      ["toggle-highlights", "onToggleHighlights"],
      ["find", "onFind"],
      ["play-pause", "onPlayPause"],
      ["prev-page", "onPrevPage"],
      ["next-page", "onNextPage"],
    ];

    for (const [action, key] of cases) {
      const handlers = allHandlers();
      dispatchMenuAction(action, handlers);
      expect(handlers[key], `handler for ${action}`).toHaveBeenCalledOnce();
      // No other handler should have fired.
      for (const [otherAction, otherKey] of cases) {
        if (otherKey !== key) {
          expect(
            handlers[otherKey],
            `${otherKey} on ${action}`,
          ).not.toHaveBeenCalled();
        }
        void otherAction;
      }
    }
  });

  it("is a no-op (returns false) for an action with no handler", () => {
    expect(dispatchMenuAction("find", {})).toBe(false);
    expect(dispatchMenuAction("toggle-library", {})).toBe(false);
    expect(dispatchMenuAction("open", {})).toBe(false);
  });

  it("does not cross-fire unrelated handlers", () => {
    const onOpen = vi.fn();
    const onNextPage = vi.fn();
    dispatchMenuAction("prev-page", { onOpen, onNextPage });
    expect(onOpen).not.toHaveBeenCalled();
    expect(onNextPage).not.toHaveBeenCalled();
  });
});
