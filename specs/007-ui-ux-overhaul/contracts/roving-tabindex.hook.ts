/**
 * useRovingTabindex Hook Contract
 *
 * @module hooks/useRovingTabindex
 * @feature 007-ui-ux-overhaul (P1-1)
 *
 * This hook implements the roving tabindex pattern for keyboard navigation
 * within composite widgets like toolbars, menus, and tab lists.
 *
 * The pattern ensures:
 * - Single Tab stop for the entire widget (efficient keyboard nav)
 * - Arrow keys move focus between items
 * - Home/End jump to first/last item
 * - Focus is visually indicated
 *
 * @see https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/
 *
 * @example
 * ```tsx
 * function Toolbar() {
 *   const containerRef = useRef<HTMLDivElement>(null);
 *
 *   const { getItemProps, currentIndex } = useRovingTabindex({
 *     containerRef,
 *     itemSelector: '[role="button"]',
 *     orientation: 'horizontal',
 *     loop: true,
 *   });
 *
 *   return (
 *     <div ref={containerRef} role="toolbar" aria-label="Main toolbar">
 *       <button {...getItemProps(0)}>Open</button>
 *       <button {...getItemProps(1)}>Save</button>
 *       <button {...getItemProps(2)}>Print</button>
 *     </div>
 *   );
 * }
 * ```
 */

import type { RefObject, HTMLAttributes } from "react";

/**
 * Navigation orientation
 */
export type Orientation = "horizontal" | "vertical" | "both";

/**
 * useRovingTabindex configuration options
 */
export interface RovingTabindexOptions {
  /**
   * Ref to the container element (toolbar, menu, etc.)
   */
  containerRef: RefObject<HTMLElement>;

  /**
   * CSS selector for focusable items within container
   * @example '[role="button"]', '[role="tab"]', 'button'
   */
  itemSelector: string;

  /**
   * Navigation orientation
   * - 'horizontal': Left/Right arrow keys
   * - 'vertical': Up/Down arrow keys
   * - 'both': All arrow keys work
   * @default 'horizontal'
   */
  orientation?: Orientation;

  /**
   * Whether navigation wraps from last to first item
   * @default true
   */
  loop?: boolean;

  /**
   * Initial focused item index
   * @default 0
   */
  initialIndex?: number;

  /**
   * Callback when focused item changes
   */
  onFocusChange?: (index: number) => void;

  /**
   * Enable type-ahead to focus items by first letter
   * @default false
   */
  typeAhead?: boolean;
}

/**
 * Props returned by getItemProps for each item
 */
export interface RovingItemProps extends HTMLAttributes<HTMLElement> {
  /** tabIndex: 0 if focused, -1 otherwise */
  tabIndex: 0 | -1;
  /** Focus this item */
  onFocus: () => void;
  /** Keyboard navigation */
  onKeyDown: (e: React.KeyboardEvent) => void;
}

/**
 * useRovingTabindex hook return type
 */
export interface UseRovingTabindexReturn {
  /**
   * Index of currently focused item
   */
  currentIndex: number;

  /**
   * Set focused item by index
   */
  setCurrentIndex: (index: number) => void;

  /**
   * Get props to spread on each item
   *
   * @param index - Item index in the list
   * @returns Props object with tabIndex, onFocus, onKeyDown
   *
   * @example
   * ```tsx
   * <button {...getItemProps(0)}>First</button>
   * <button {...getItemProps(1)}>Second</button>
   * ```
   */
  getItemProps: (index: number) => RovingItemProps;

  /**
   * Focus the first item
   */
  focusFirst: () => void;

  /**
   * Focus the last item
   */
  focusLast: () => void;

  /**
   * Focus the next item
   */
  focusNext: () => void;

  /**
   * Focus the previous item
   */
  focusPrevious: () => void;

  /**
   * Total number of items
   */
  itemCount: number;
}

/**
 * Implementation notes:
 *
 * 1. Key mappings by orientation:
 *    ```typescript
 *    const keyMap = {
 *      horizontal: { next: 'ArrowRight', prev: 'ArrowLeft' },
 *      vertical: { next: 'ArrowDown', prev: 'ArrowUp' },
 *      both: { next: ['ArrowRight', 'ArrowDown'], prev: ['ArrowLeft', 'ArrowUp'] },
 *    };
 *    ```
 *
 * 2. Keyboard handler:
 *    ```typescript
 *    const handleKeyDown = (e: KeyboardEvent, index: number) => {
 *      switch (e.key) {
 *        case 'ArrowRight':
 *        case 'ArrowDown':
 *          if (matchesOrientation(e.key)) {
 *            e.preventDefault();
 *            focusNext();
 *          }
 *          break;
 *        case 'ArrowLeft':
 *        case 'ArrowUp':
 *          if (matchesOrientation(e.key)) {
 *            e.preventDefault();
 *            focusPrevious();
 *          }
 *          break;
 *        case 'Home':
 *          e.preventDefault();
 *          focusFirst();
 *          break;
 *        case 'End':
 *          e.preventDefault();
 *          focusLast();
 *          break;
 *      }
 *    };
 *    ```
 *
 * 3. Focus management:
 *    ```typescript
 *    useEffect(() => {
 *      const items = container.querySelectorAll(itemSelector);
 *      items.forEach((item, i) => {
 *        item.setAttribute('tabindex', i === currentIndex ? '0' : '-1');
 *      });
 *    }, [currentIndex]);
 *    ```
 *
 * 4. When focus changes, actually focus the element:
 *    ```typescript
 *    const focusItem = (index: number) => {
 *      const items = container.querySelectorAll(itemSelector);
 *      if (items[index]) {
 *        (items[index] as HTMLElement).focus();
 *        setCurrentIndex(index);
 *      }
 *    };
 *    ```
 */

/**
 * ARIA roles that typically use roving tabindex
 */
export const ROVING_ROLES = [
  "toolbar",
  "tablist",
  "listbox",
  "menu",
  "menubar",
  "tree",
  "treegrid",
  "grid",
] as const;

export type RovingRole = (typeof ROVING_ROLES)[number];
