/**
 * useFocusTrap Hook Tests
 *
 * Tests for focus trapping in modal dialogs.
 * Ensures keyboard focus stays within the dialog while it's open.
 *
 * @feature 007-ui-ux-overhaul (P1-2)
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import { useRef, useState } from "react";
import {
  useFocusTrap,
  FOCUSABLE_SELECTOR,
  getFocusableElements,
} from "../../hooks/useFocusTrap";

/**
 * Test component that uses the useFocusTrap hook
 */
function TestDialog({
  initialOpen = false,
  onEscape,
  preventScroll = true,
}: {
  initialOpen?: boolean;
  onEscape?: () => void;
  preventScroll?: boolean;
}) {
  const [open, setOpen] = useState(initialOpen);
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const { isActive } = useFocusTrap({
    containerRef: dialogRef,
    active: open,
    returnFocus: triggerRef,
    onEscape: onEscape ?? (() => setOpen(false)),
    preventScroll,
  });

  return (
    <div>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        data-testid="trigger"
      >
        Open Dialog
      </button>

      {open && (
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          data-testid="dialog"
        >
          <button
            type="button"
            data-testid="close-btn"
            onClick={() => setOpen(false)}
          >
            Close
          </button>
          <input type="text" data-testid="input" />
          <button type="button" data-testid="save-btn">
            Save
          </button>
        </div>
      )}

      <span data-testid="is-active">{isActive ? "true" : "false"}</span>
    </div>
  );
}

describe("useFocusTrap", () => {
  // Clean up after each test
  afterEach(() => {
    // Reset body overflow style if modified
    document.body.style.overflow = "";
  });

  describe("activation", () => {
    it("should activate when active prop becomes true", async () => {
      render(<TestDialog initialOpen={false} />);

      expect(screen.getByTestId("is-active")).toHaveTextContent("false");

      // Open the dialog
      await act(async () => {
        fireEvent.click(screen.getByTestId("trigger"));
      });

      await waitFor(() => {
        expect(screen.getByTestId("is-active")).toHaveTextContent("true");
      });
    });

    it("should focus first focusable element on activation", async () => {
      render(<TestDialog initialOpen={false} />);

      await act(async () => {
        fireEvent.click(screen.getByTestId("trigger"));
      });

      // Wait for dialog to appear and focus to be set
      await waitFor(() => {
        expect(screen.getByTestId("dialog")).toBeInTheDocument();
      });

      // The hook focuses the first focusable element
      await waitFor(() => {
        expect(document.activeElement).toBe(screen.getByTestId("close-btn"));
      });
    });

    it("should be active when initialOpen is true", async () => {
      await act(async () => {
        render(<TestDialog initialOpen={true} />);
      });

      expect(screen.getByTestId("is-active")).toHaveTextContent("true");
    });
  });

  describe("Tab key trapping", () => {
    it("should trap focus within the dialog - Tab from last wraps to first", async () => {
      await act(async () => {
        render(<TestDialog initialOpen={true} />);
      });

      const closeBtn = screen.getByTestId("close-btn");
      const saveBtn = screen.getByTestId("save-btn");

      // Focus the last focusable element
      await act(async () => {
        saveBtn.focus();
      });
      expect(document.activeElement).toBe(saveBtn);

      // Tab should wrap to first element (keydown on document triggers the handler)
      await act(async () => {
        fireEvent.keyDown(document, { key: "Tab", shiftKey: false });
      });

      expect(document.activeElement).toBe(closeBtn);
    });

    it("should trap focus within the dialog - Shift+Tab from first wraps to last", async () => {
      await act(async () => {
        render(<TestDialog initialOpen={true} />);
      });

      const closeBtn = screen.getByTestId("close-btn");
      const saveBtn = screen.getByTestId("save-btn");

      // Focus the first focusable element
      await act(async () => {
        closeBtn.focus();
      });
      expect(document.activeElement).toBe(closeBtn);

      // Shift+Tab should wrap to last element
      await act(async () => {
        fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
      });

      expect(document.activeElement).toBe(saveBtn);
    });
  });

  describe("Escape key", () => {
    it("should call onEscape when Escape is pressed", async () => {
      const handleEscape = vi.fn();
      await act(async () => {
        render(<TestDialog initialOpen={true} onEscape={handleEscape} />);
      });

      await act(async () => {
        fireEvent.keyDown(document, { key: "Escape" });
      });

      expect(handleEscape).toHaveBeenCalledTimes(1);
    });

    it("should close dialog on Escape by default", async () => {
      await act(async () => {
        render(<TestDialog initialOpen={true} />);
      });

      expect(screen.getByTestId("dialog")).toBeInTheDocument();

      await act(async () => {
        fireEvent.keyDown(document, { key: "Escape" });
      });

      await waitFor(() => {
        expect(screen.queryByTestId("dialog")).not.toBeInTheDocument();
      });
    });
  });

  describe("deactivation", () => {
    it("should return focus to trigger on close", async () => {
      render(<TestDialog initialOpen={false} />);

      const trigger = screen.getByTestId("trigger");
      trigger.focus();

      // Open dialog
      await act(async () => {
        fireEvent.click(trigger);
      });

      await waitFor(() => {
        expect(screen.getByTestId("dialog")).toBeInTheDocument();
      });

      // Close dialog by clicking close button
      await act(async () => {
        fireEvent.click(screen.getByTestId("close-btn"));
      });

      await waitFor(() => {
        expect(document.activeElement).toBe(trigger);
      });
    });

    it("should update isActive to false on deactivation", async () => {
      await act(async () => {
        render(<TestDialog initialOpen={true} />);
      });

      expect(screen.getByTestId("is-active")).toHaveTextContent("true");

      await act(async () => {
        fireEvent.click(screen.getByTestId("close-btn"));
      });

      await waitFor(() => {
        expect(screen.getByTestId("is-active")).toHaveTextContent("false");
      });
    });
  });

  describe("scroll prevention", () => {
    it("should prevent body scroll when preventScroll is true", async () => {
      await act(async () => {
        render(<TestDialog initialOpen={true} preventScroll={true} />);
      });

      await waitFor(() => {
        expect(document.body.style.overflow).toBe("hidden");
      });
    });

    it("should restore body scroll on close", async () => {
      await act(async () => {
        render(<TestDialog initialOpen={true} preventScroll={true} />);
      });

      await waitFor(() => {
        expect(document.body.style.overflow).toBe("hidden");
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId("close-btn"));
      });

      await waitFor(() => {
        expect(document.body.style.overflow).toBe("");
      });
    });

    it("should NOT prevent scroll when preventScroll is false", async () => {
      await act(async () => {
        render(<TestDialog initialOpen={true} preventScroll={false} />);
      });

      // Should not be 'hidden'
      expect(document.body.style.overflow).not.toBe("hidden");
    });
  });
});

describe("getFocusableElements helper", () => {
  afterEach(() => {
    // Clean up any added elements
    const testContainer = document.getElementById("test-container");
    if (testContainer) {
      testContainer.remove();
    }
  });

  it("should return all focusable elements in a container", () => {
    const container = document.createElement("div");
    container.id = "test-container";
    container.innerHTML = `
      <button>Button</button>
      <input type="text" />
      <a href="#">Link</a>
      <select><option>Option</option></select>
      <textarea></textarea>
      <div tabindex="0">Focusable div</div>
      <div tabindex="-1">Not focusable by tab</div>
      <button disabled>Disabled</button>
      <input type="hidden" />
    `;
    document.body.appendChild(container);

    const focusables = getFocusableElements(container);

    // Should include: button, input, link, select, textarea, div[tabindex="0"]
    // Should NOT include: disabled button, hidden input, div[tabindex="-1"]
    expect(focusables.length).toBe(6);

    // Verify specific elements
    expect(focusables[0].tagName).toBe("BUTTON");
    expect(focusables[1].tagName).toBe("INPUT");
    expect(focusables[2].tagName).toBe("A");
    expect(focusables[3].tagName).toBe("SELECT");
    expect(focusables[4].tagName).toBe("TEXTAREA");
    expect(focusables[5].getAttribute("tabindex")).toBe("0");
  });

  it("should exclude elements with display:none", () => {
    const container = document.createElement("div");
    container.id = "test-container";
    container.innerHTML = `
      <button>Visible</button>
      <button style="display: none;">Hidden</button>
    `;
    document.body.appendChild(container);

    const focusables = getFocusableElements(container);

    expect(focusables.length).toBe(1);
    expect(focusables[0].textContent).toBe("Visible");
  });

  it("should return empty array for empty container", () => {
    const container = document.createElement("div");
    const focusables = getFocusableElements(container);

    expect(focusables).toEqual([]);
  });
});

describe("FOCUSABLE_SELECTOR constant", () => {
  it("should be a valid CSS selector string", () => {
    expect(typeof FOCUSABLE_SELECTOR).toBe("string");
    expect(FOCUSABLE_SELECTOR.length).toBeGreaterThan(0);
  });

  it("should include common focusable element selectors", () => {
    expect(FOCUSABLE_SELECTOR).toContain("a[href]");
    expect(FOCUSABLE_SELECTOR).toContain("button:not([disabled])");
    expect(FOCUSABLE_SELECTOR).toContain("input:not([disabled])");
    expect(FOCUSABLE_SELECTOR).toContain("select:not([disabled])");
    expect(FOCUSABLE_SELECTOR).toContain("textarea:not([disabled])");
    expect(FOCUSABLE_SELECTOR).toContain('[tabindex]:not([tabindex="-1"])');
  });
});

describe("useFocusTrap with no focusable elements", () => {
  function NoFocusablesDialog() {
    const [open, setOpen] = useState(true);
    const dialogRef = useRef<HTMLDivElement>(null);

    useFocusTrap({
      containerRef: dialogRef,
      active: open,
      onEscape: () => setOpen(false),
    });

    if (!open) return null;

    return (
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        data-testid="empty-dialog"
      >
        <p>This dialog has no focusable elements</p>
      </div>
    );
  }

  it("should handle container with no focusable elements gracefully", async () => {
    // Should not throw
    await act(async () => {
      expect(() => render(<NoFocusablesDialog />)).not.toThrow();
    });
  });
});
