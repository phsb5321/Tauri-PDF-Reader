/**
 * useFocusTrap Hook Contract
 *
 * @module hooks/useFocusTrap
 * @feature 007-ui-ux-overhaul (P1-2)
 *
 * This hook implements focus trapping for modal dialogs to prevent
 * keyboard focus from escaping the modal while it's open.
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

import type { RefObject } from "react";

/**
 * Focus trap configuration options
 */
export interface FocusTrapOptions {
  /**
   * Ref to the container element that bounds the focus trap
   */
  containerRef: RefObject<HTMLElement>;

  /**
   * Whether the focus trap is currently active
   */
  active: boolean;

  /**
   * Element to focus when trap activates
   * Defaults to first focusable element in container
   */
  initialFocus?: RefObject<HTMLElement>;

  /**
   * Element to return focus to when trap deactivates
   * Defaults to document.activeElement at activation time
   */
  returnFocus?: RefObject<HTMLElement>;

  /**
   * Callback when Escape key is pressed
   */
  onEscape?: () => void;

  /**
   * Allow click outside container to deactivate trap
   * @default false
   */
  clickOutsideDeactivates?: boolean;

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
  /**
   * Whether the trap is currently active
   */
  isActive: boolean;

  /**
   * Manually activate the focus trap
   */
  activate: () => void;

  /**
   * Manually deactivate the focus trap
   */
  deactivate: () => void;

  /**
   * Pause the focus trap (allows focus to leave temporarily)
   */
  pause: () => void;

  /**
   * Resume a paused focus trap
   */
  resume: () => void;
}

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
 * Implementation notes:
 *
 * 1. On activation:
 *    - Store currently focused element for returnFocus
 *    - Find all focusable elements in container
 *    - Focus initialFocus or first focusable element
 *    - Add keydown listener for Tab and Escape
 *
 * 2. Tab key handling:
 *    ```typescript
 *    const handleKeyDown = (e: KeyboardEvent) => {
 *      if (e.key === 'Tab') {
 *        const focusables = container.querySelectorAll(FOCUSABLE_SELECTOR);
 *        const first = focusables[0];
 *        const last = focusables[focusables.length - 1];
 *
 *        if (e.shiftKey && document.activeElement === first) {
 *          e.preventDefault();
 *          last.focus();
 *        } else if (!e.shiftKey && document.activeElement === last) {
 *          e.preventDefault();
 *          first.focus();
 *        }
 *      }
 *
 *      if (e.key === 'Escape' && onEscape) {
 *        onEscape();
 *      }
 *    };
 *    ```
 *
 * 3. On deactivation:
 *    - Remove keydown listener
 *    - Return focus to stored element or returnFocus ref
 *    - Re-enable body scroll if preventScroll was true
 *
 * 4. Handle edge cases:
 *    - No focusable elements: focus container itself (add tabindex="-1")
 *    - Focus leaves container via mouse: refocus first element
 */

/**
 * Helper to get all focusable elements in a container
 */
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const elements = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
  return Array.from(elements).filter(
    (el) => el.offsetParent !== null, // visible
  );
}
