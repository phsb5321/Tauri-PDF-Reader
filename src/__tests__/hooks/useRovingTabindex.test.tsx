/**
 * useRovingTabindex Hook Tests
 *
 * Tests for the roving tabindex pattern used in toolbars and composite widgets.
 * Follows the WAI-ARIA APG toolbar pattern.
 *
 * @feature 007-ui-ux-overhaul (P1-1)
 * @see https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useRef } from "react";
import { useRovingTabindex } from "../../hooks/useRovingTabindex";

/**
 * Test component that uses the useRovingTabindex hook
 */
function TestToolbar({
  orientation = "horizontal" as const,
  loop = true,
  initialIndex = 0,
  onFocusChange,
}: {
  orientation?: "horizontal" | "vertical" | "both";
  loop?: boolean;
  initialIndex?: number;
  onFocusChange?: (index: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  const { getItemProps, currentIndex } = useRovingTabindex({
    containerRef,
    itemSelector: '[role="button"]',
    orientation,
    loop,
    initialIndex,
    onFocusChange,
  });

  return (
    <div
      ref={containerRef}
      role="toolbar"
      aria-label="Test toolbar"
      data-testid="toolbar"
    >
      <button {...getItemProps(0)} role="button" data-testid="btn-0">
        Open
      </button>
      <button {...getItemProps(1)} role="button" data-testid="btn-1">
        Save
      </button>
      <button {...getItemProps(2)} role="button" data-testid="btn-2">
        Print
      </button>
      <span data-testid="current-index">{currentIndex}</span>
    </div>
  );
}

describe("useRovingTabindex", () => {
  describe("initial state", () => {
    it("should set tabIndex=0 on the first item by default", () => {
      render(<TestToolbar />);

      expect(screen.getByTestId("btn-0")).toHaveAttribute("tabindex", "0");
      expect(screen.getByTestId("btn-1")).toHaveAttribute("tabindex", "-1");
      expect(screen.getByTestId("btn-2")).toHaveAttribute("tabindex", "-1");
    });

    it("should respect initialIndex option", () => {
      render(<TestToolbar initialIndex={1} />);

      expect(screen.getByTestId("btn-0")).toHaveAttribute("tabindex", "-1");
      expect(screen.getByTestId("btn-1")).toHaveAttribute("tabindex", "0");
      expect(screen.getByTestId("btn-2")).toHaveAttribute("tabindex", "-1");
    });

    it("should report currentIndex correctly", () => {
      render(<TestToolbar initialIndex={2} />);

      expect(screen.getByTestId("current-index")).toHaveTextContent("2");
    });
  });

  describe("horizontal navigation", () => {
    it("should move focus right on ArrowRight", () => {
      render(<TestToolbar orientation="horizontal" />);

      const btn0 = screen.getByTestId("btn-0");
      btn0.focus();
      fireEvent.keyDown(btn0, { key: "ArrowRight" });

      expect(screen.getByTestId("btn-0")).toHaveAttribute("tabindex", "-1");
      expect(screen.getByTestId("btn-1")).toHaveAttribute("tabindex", "0");
      expect(document.activeElement).toBe(screen.getByTestId("btn-1"));
    });

    it("should move focus left on ArrowLeft", () => {
      render(<TestToolbar orientation="horizontal" initialIndex={2} />);

      const btn2 = screen.getByTestId("btn-2");
      btn2.focus();
      fireEvent.keyDown(btn2, { key: "ArrowLeft" });

      expect(screen.getByTestId("btn-1")).toHaveAttribute("tabindex", "0");
      expect(document.activeElement).toBe(screen.getByTestId("btn-1"));
    });

    it("should NOT respond to ArrowUp/ArrowDown in horizontal mode", () => {
      render(<TestToolbar orientation="horizontal" />);

      const btn0 = screen.getByTestId("btn-0");
      btn0.focus();
      fireEvent.keyDown(btn0, { key: "ArrowDown" });

      // Should remain on first item
      expect(screen.getByTestId("btn-0")).toHaveAttribute("tabindex", "0");
      expect(document.activeElement).toBe(screen.getByTestId("btn-0"));
    });
  });

  describe("vertical navigation", () => {
    it("should move focus down on ArrowDown", () => {
      render(<TestToolbar orientation="vertical" />);

      const btn0 = screen.getByTestId("btn-0");
      btn0.focus();
      fireEvent.keyDown(btn0, { key: "ArrowDown" });

      expect(screen.getByTestId("btn-1")).toHaveAttribute("tabindex", "0");
      expect(document.activeElement).toBe(screen.getByTestId("btn-1"));
    });

    it("should move focus up on ArrowUp", () => {
      render(<TestToolbar orientation="vertical" initialIndex={2} />);

      const btn2 = screen.getByTestId("btn-2");
      btn2.focus();
      fireEvent.keyDown(btn2, { key: "ArrowUp" });

      expect(screen.getByTestId("btn-1")).toHaveAttribute("tabindex", "0");
      expect(document.activeElement).toBe(screen.getByTestId("btn-1"));
    });

    it("should NOT respond to ArrowLeft/ArrowRight in vertical mode", () => {
      render(<TestToolbar orientation="vertical" />);

      const btn0 = screen.getByTestId("btn-0");
      btn0.focus();
      fireEvent.keyDown(btn0, { key: "ArrowRight" });

      // Should remain on first item
      expect(screen.getByTestId("btn-0")).toHaveAttribute("tabindex", "0");
    });
  });

  describe("both orientation", () => {
    it("should respond to all arrow keys when orientation is both", () => {
      render(<TestToolbar orientation="both" />);

      const btn0 = screen.getByTestId("btn-0");
      btn0.focus();

      // Right works
      fireEvent.keyDown(btn0, { key: "ArrowRight" });
      expect(document.activeElement).toBe(screen.getByTestId("btn-1"));

      // Down works
      fireEvent.keyDown(document.activeElement!, { key: "ArrowDown" });
      expect(document.activeElement).toBe(screen.getByTestId("btn-2"));

      // Left works
      fireEvent.keyDown(document.activeElement!, { key: "ArrowLeft" });
      expect(document.activeElement).toBe(screen.getByTestId("btn-1"));

      // Up works
      fireEvent.keyDown(document.activeElement!, { key: "ArrowUp" });
      expect(document.activeElement).toBe(screen.getByTestId("btn-0"));
    });
  });

  describe("loop behavior", () => {
    it("should wrap from last to first when loop=true", () => {
      render(<TestToolbar loop={true} initialIndex={2} />);

      const btn2 = screen.getByTestId("btn-2");
      btn2.focus();
      fireEvent.keyDown(btn2, { key: "ArrowRight" });

      expect(document.activeElement).toBe(screen.getByTestId("btn-0"));
    });

    it("should wrap from first to last when loop=true", () => {
      render(<TestToolbar loop={true} initialIndex={0} />);

      const btn0 = screen.getByTestId("btn-0");
      btn0.focus();
      fireEvent.keyDown(btn0, { key: "ArrowLeft" });

      expect(document.activeElement).toBe(screen.getByTestId("btn-2"));
    });

    it("should NOT wrap when loop=false", () => {
      render(<TestToolbar loop={false} initialIndex={2} />);

      const btn2 = screen.getByTestId("btn-2");
      btn2.focus();
      fireEvent.keyDown(btn2, { key: "ArrowRight" });

      // Should stay on last item
      expect(document.activeElement).toBe(screen.getByTestId("btn-2"));
    });
  });

  describe("Home and End keys", () => {
    it("should move to first item on Home key", () => {
      render(<TestToolbar initialIndex={2} />);

      const btn2 = screen.getByTestId("btn-2");
      btn2.focus();
      fireEvent.keyDown(btn2, { key: "Home" });

      expect(document.activeElement).toBe(screen.getByTestId("btn-0"));
      expect(screen.getByTestId("btn-0")).toHaveAttribute("tabindex", "0");
    });

    it("should move to last item on End key", () => {
      render(<TestToolbar initialIndex={0} />);

      const btn0 = screen.getByTestId("btn-0");
      btn0.focus();
      fireEvent.keyDown(btn0, { key: "End" });

      expect(document.activeElement).toBe(screen.getByTestId("btn-2"));
      expect(screen.getByTestId("btn-2")).toHaveAttribute("tabindex", "0");
    });
  });

  describe("onFocusChange callback", () => {
    it("should call onFocusChange when focus changes", () => {
      const handleFocusChange = vi.fn();
      render(<TestToolbar onFocusChange={handleFocusChange} />);

      const btn0 = screen.getByTestId("btn-0");
      btn0.focus();
      fireEvent.keyDown(btn0, { key: "ArrowRight" });

      expect(handleFocusChange).toHaveBeenCalledWith(1);
    });

    it("should call onFocusChange with correct index on Home/End", () => {
      const handleFocusChange = vi.fn();
      render(
        <TestToolbar onFocusChange={handleFocusChange} initialIndex={1} />,
      );

      const btn1 = screen.getByTestId("btn-1");
      btn1.focus();
      fireEvent.keyDown(btn1, { key: "End" });

      expect(handleFocusChange).toHaveBeenCalledWith(2);
    });
  });

  describe("focus management on direct click", () => {
    it("should update currentIndex when item is focused directly", () => {
      render(<TestToolbar />);

      // Click on the third button directly
      const btn2 = screen.getByTestId("btn-2");
      btn2.focus();
      fireEvent.focus(btn2);

      expect(screen.getByTestId("current-index")).toHaveTextContent("2");
    });
  });

  describe("preventDefault behavior", () => {
    it("should prevent default on navigation keys", () => {
      render(<TestToolbar />);

      const btn0 = screen.getByTestId("btn-0");
      btn0.focus();

      const event = new KeyboardEvent("keydown", {
        key: "ArrowRight",
        bubbles: true,
        cancelable: true,
      });
      const preventDefaultSpy = vi.spyOn(event, "preventDefault");

      btn0.dispatchEvent(event);

      expect(preventDefaultSpy).toHaveBeenCalled();
    });
  });
});

describe("useRovingTabindex edge cases", () => {
  function EmptyToolbar() {
    const containerRef = useRef<HTMLDivElement>(null);
    const { currentIndex, itemCount } = useRovingTabindex({
      containerRef,
      itemSelector: '[role="button"]',
    });

    return (
      <div ref={containerRef} role="toolbar" data-testid="empty-toolbar">
        <span data-testid="current-index">{currentIndex}</span>
        <span data-testid="item-count">{itemCount}</span>
      </div>
    );
  }

  it("should handle empty container gracefully", () => {
    render(<EmptyToolbar />);

    expect(screen.getByTestId("item-count")).toHaveTextContent("0");
  });

  it("should clamp initialIndex to valid range", () => {
    render(<TestToolbar initialIndex={999} />);

    // Should clamp to last valid index
    expect(screen.getByTestId("btn-2")).toHaveAttribute("tabindex", "0");
  });

  it("should clamp negative initialIndex to 0", () => {
    render(<TestToolbar initialIndex={-5} />);

    expect(screen.getByTestId("btn-0")).toHaveAttribute("tabindex", "0");
  });
});
