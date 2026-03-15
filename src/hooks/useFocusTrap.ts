/**
 * useFocusTrap Hook
 *
 * Implements focus trapping for modal dialogs to prevent
 * keyboard focus from escaping the modal while it's open.
 *
 * @module hooks/useFocusTrap
 * @feature 007-ui-ux-overhaul (P1-2)
 *
 * @example
 * ```tsx
 * function SettingsDialog({ open, onClose }) {
 *   const dialogRef = useRef<HTMLDivElement>(null);
 *   const triggerRef = useRef<HTMLButtonElement>(null);
 *
 *   useFocusTrap({
 *     containerRef: dialogRef,
 *     active: open,
 *     returnFocus: triggerRef,
 *     onEscape: onClose,
 *   });
 *
 *   if (!open) return null;
 *
 *   return (
 *     <div ref={dialogRef} role="dialog" aria-modal="true">
 *       <button onClick={onClose}>Close</button>
 *       <input type="text" />
 *       <button>Save</button>
 *     </div>
 *   );
 * }
 * ```
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";

/**
 * Selector for focusable elements
 */
export const FOCUSABLE_SELECTOR = [
  "a[href]",
  "area[href]",
  'input:not([disabled]):not([type="hidden"])',
  "select:not([disabled])",
  "textarea:not([disabled])",
  "button:not([disabled])",
  "iframe",
  "object",
  "embed",
  "[contenteditable]",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

/**
 * Check if an element is visible (has layout)
 */
function isVisible(element: HTMLElement): boolean {
  // offsetParent is null for hidden elements, but also for fixed/body elements
  // Use a combination of checks for better jsdom compatibility
  if (element.offsetParent !== null) return true;

  // Check computed style as fallback (works better in jsdom)
  const style = getComputedStyle(element);
  return style.display !== "none" && style.visibility !== "hidden";
}

/**
 * Helper to get all focusable elements in a container
 */
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const elements = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
  return Array.from(elements).filter(isVisible);
}

/**
 * Focus trap configuration options
 */
export interface FocusTrapOptions {
  /**
   * Ref to the container element that bounds the focus trap
   */
  containerRef: RefObject<HTMLElement | null>;

  /**
   * Whether the focus trap is currently active
   */
  active: boolean;

  /**
   * Element to focus when trap activates
   * Defaults to first focusable element in container
   */
  initialFocus?: RefObject<HTMLElement | null>;

  /**
   * Element to return focus to when trap deactivates
   * Defaults to document.activeElement at activation time
   */
  returnFocus?: RefObject<HTMLElement | null>;

  /**
   * Callback when Escape key is pressed
   */
  onEscape?: () => void;

  /**
   * Prevent scrolling on body while trap is active
   * @default true
   */
  preventScroll?: boolean;
}

/**
 * useFocusTrap hook return type
 */
export interface UseFocusTrapReturn {
  /** Whether the trap is currently active */
  isActive: boolean;
  /** Manually activate the focus trap */
  activate: () => void;
  /** Manually deactivate the focus trap */
  deactivate: () => void;
  /** Pause the focus trap (allows focus to leave temporarily) */
  pause: () => void;
  /** Resume a paused focus trap */
  resume: () => void;
}

/**
 * Hook implementing focus trapping for modal dialogs
 */
export function useFocusTrap({
  containerRef,
  active,
  initialFocus,
  returnFocus,
  onEscape,
  preventScroll = true,
}: FocusTrapOptions): UseFocusTrapReturn {
  const [isActive, setIsActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const previousOverflowRef = useRef<string>("");

  /**
   * Get first focusable element in container
   */
  const getFirstFocusable = useCallback((): HTMLElement | null => {
    if (!containerRef.current) return null;
    const focusables = getFocusableElements(containerRef.current);
    return focusables[0] ?? null;
  }, [containerRef]);

  /**
   * Get last focusable element in container
   */
  const getLastFocusable = useCallback((): HTMLElement | null => {
    if (!containerRef.current) return null;
    const focusables = getFocusableElements(containerRef.current);
    return focusables[focusables.length - 1] ?? null;
  }, [containerRef]);

  /**
   * Activate the focus trap
   */
  const activate = useCallback(() => {
    if (!containerRef.current) return;

    // Store currently focused element for later restoration
    previouslyFocusedRef.current = document.activeElement as HTMLElement;

    // Focus initial element or first focusable
    const elementToFocus = initialFocus?.current ?? getFirstFocusable();
    if (elementToFocus) {
      elementToFocus.focus();
    }

    // Prevent body scroll if enabled
    if (preventScroll) {
      previousOverflowRef.current = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }

    setIsActive(true);
  }, [containerRef, initialFocus, getFirstFocusable, preventScroll]);

  /**
   * Deactivate the focus trap
   */
  const deactivate = useCallback(() => {
    // Restore body scroll
    if (preventScroll) {
      document.body.style.overflow = previousOverflowRef.current;
    }

    // Return focus to previous element or returnFocus ref
    const elementToFocus = returnFocus?.current ?? previouslyFocusedRef.current;
    if (elementToFocus && document.contains(elementToFocus)) {
      elementToFocus.focus();
    }

    setIsActive(false);
  }, [preventScroll, returnFocus]);

  /**
   * Pause the focus trap
   */
  const pause = useCallback(() => {
    setIsPaused(true);
  }, []);

  /**
   * Resume the focus trap
   */
  const resume = useCallback(() => {
    setIsPaused(false);
  }, []);

  /**
   * Handle keydown for Tab trapping and Escape
   */
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isActive || isPaused || !containerRef.current) return;

      // Handle Escape
      if (e.key === "Escape" && onEscape) {
        e.preventDefault();
        onEscape();
        return;
      }

      // Handle Tab
      if (e.key === "Tab") {
        const firstFocusable = getFirstFocusable();
        const lastFocusable = getLastFocusable();

        if (!firstFocusable || !lastFocusable) return;

        // Shift+Tab on first element -> focus last
        if (e.shiftKey && document.activeElement === firstFocusable) {
          e.preventDefault();
          lastFocusable.focus();
        }
        // Tab on last element -> focus first
        else if (!e.shiftKey && document.activeElement === lastFocusable) {
          e.preventDefault();
          firstFocusable.focus();
        }
      }
    },
    [
      isActive,
      isPaused,
      containerRef,
      onEscape,
      getFirstFocusable,
      getLastFocusable,
    ],
  );

  /**
   * Activate/deactivate based on `active` prop
   */
  useEffect(() => {
    if (active && !isActive) {
      activate();
    } else if (!active && isActive) {
      deactivate();
    }
  }, [active, isActive, activate, deactivate]);

  /**
   * Set up keydown listener
   */
  useEffect(() => {
    if (!isActive) return;

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isActive, handleKeyDown]);

  /**
   * Clean up on unmount
   */
  useEffect(() => {
    return () => {
      // Restore body scroll on unmount if trap was active
      if (preventScroll && isActive) {
        document.body.style.overflow = previousOverflowRef.current;
      }
    };
  }, [preventScroll, isActive]);

  return {
    isActive,
    activate,
    deactivate,
    pause,
    resume,
  };
}
