/**
 * useRovingTabindex Hook
 *
 * Implements the roving tabindex pattern for keyboard navigation
 * within composite widgets like toolbars, menus, and tab lists.
 *
 * The pattern ensures:
 * - Single Tab stop for the entire widget (efficient keyboard nav)
 * - Arrow keys move focus between items
 * - Home/End jump to first/last item
 * - Focus is visually indicated
 *
 * @module hooks/useRovingTabindex
 * @feature 007-ui-ux-overhaul (P1-1)
 * @see https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/
 *
 * @example
 * ```tsx
 * function Toolbar() {
 *   const containerRef = useRef<HTMLDivElement>(null);
 *
 *   const { getItemProps, currentIndex } = useRovingTabindex({
 *     containerRef,
 *     itemSelector: 'button',
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

import { useCallback, useEffect, useState, type RefObject } from "react";

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
  containerRef: RefObject<HTMLElement | null>;

  /**
   * CSS selector for focusable items within container
   * @example 'button', '[role="tab"]'
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
}

/**
 * Props returned by getItemProps for each item
 */
export interface RovingItemProps {
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
  /** Index of currently focused item */
  currentIndex: number;
  /** Set focused item by index */
  setCurrentIndex: (index: number) => void;
  /** Get props to spread on each item */
  getItemProps: (index: number) => RovingItemProps;
  /** Focus the first item */
  focusFirst: () => void;
  /** Focus the last item */
  focusLast: () => void;
  /** Focus the next item */
  focusNext: () => void;
  /** Focus the previous item */
  focusPrevious: () => void;
  /** Total number of items */
  itemCount: number;
}

/**
 * Key mappings by orientation
 */
const KEY_MAP = {
  horizontal: {
    next: ["ArrowRight"],
    prev: ["ArrowLeft"],
  },
  vertical: {
    next: ["ArrowDown"],
    prev: ["ArrowUp"],
  },
  both: {
    next: ["ArrowRight", "ArrowDown"],
    prev: ["ArrowLeft", "ArrowUp"],
  },
};

/**
 * Hook implementing the roving tabindex pattern for keyboard navigation
 */
export function useRovingTabindex({
  containerRef,
  itemSelector,
  orientation = "horizontal",
  loop = true,
  initialIndex = 0,
  onFocusChange,
}: RovingTabindexOptions): UseRovingTabindexReturn {
  const [itemCount, setItemCount] = useState(0);
  const [currentIndex, setCurrentIndexState] = useState(() =>
    Math.max(0, initialIndex),
  );

  /**
   * Get all focusable items in the container
   */
  const getItems = useCallback((): HTMLElement[] => {
    if (!containerRef.current) return [];
    return Array.from(
      containerRef.current.querySelectorAll<HTMLElement>(itemSelector),
    );
  }, [containerRef, itemSelector]);

  /**
   * Update item count when container changes
   */
  useEffect(() => {
    const items = getItems();
    setItemCount(items.length);

    // Clamp current index to valid range
    if (items.length > 0 && currentIndex >= items.length) {
      setCurrentIndexState(items.length - 1);
    }
  }, [getItems, currentIndex]);

  /**
   * Focus an item by index and update state
   */
  const focusItem = useCallback(
    (index: number) => {
      const items = getItems();
      if (items.length === 0) return;

      // Clamp to valid range
      const clampedIndex = Math.max(0, Math.min(index, items.length - 1));

      const item = items[clampedIndex];
      if (item) {
        item.focus();
        setCurrentIndexState(clampedIndex);
        onFocusChange?.(clampedIndex);
      }
    },
    [getItems, onFocusChange],
  );

  /**
   * Set current index (with clamping)
   */
  const setCurrentIndex = useCallback(
    (index: number) => {
      const items = getItems();
      if (items.length === 0) return;

      const clampedIndex = Math.max(0, Math.min(index, items.length - 1));
      setCurrentIndexState(clampedIndex);
    },
    [getItems],
  );

  /**
   * Focus navigation helpers
   */
  const focusFirst = useCallback(() => {
    focusItem(0);
  }, [focusItem]);

  const focusLast = useCallback(() => {
    const items = getItems();
    focusItem(items.length - 1);
  }, [focusItem, getItems]);

  const focusNext = useCallback(() => {
    const items = getItems();
    if (items.length === 0) return;

    let nextIndex = currentIndex + 1;
    if (nextIndex >= items.length) {
      nextIndex = loop ? 0 : items.length - 1;
    }
    focusItem(nextIndex);
  }, [currentIndex, focusItem, getItems, loop]);

  const focusPrevious = useCallback(() => {
    const items = getItems();
    if (items.length === 0) return;

    let prevIndex = currentIndex - 1;
    if (prevIndex < 0) {
      prevIndex = loop ? items.length - 1 : 0;
    }
    focusItem(prevIndex);
  }, [currentIndex, focusItem, getItems, loop]);

  /**
   * Handle keyboard navigation
   */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const keyMap = KEY_MAP[orientation];

      if (keyMap.next.includes(e.key)) {
        e.preventDefault();
        focusNext();
      } else if (keyMap.prev.includes(e.key)) {
        e.preventDefault();
        focusPrevious();
      } else if (e.key === "Home") {
        e.preventDefault();
        focusFirst();
      } else if (e.key === "End") {
        e.preventDefault();
        focusLast();
      }
    },
    [orientation, focusNext, focusPrevious, focusFirst, focusLast],
  );

  /**
   * Get props to spread on each item
   */
  const getItemProps = useCallback(
    (index: number): RovingItemProps => ({
      tabIndex: index === currentIndex ? 0 : -1,
      onFocus: () => setCurrentIndex(index),
      onKeyDown: handleKeyDown,
    }),
    [currentIndex, handleKeyDown, setCurrentIndex],
  );

  return {
    currentIndex,
    setCurrentIndex,
    getItemProps,
    focusFirst,
    focusLast,
    focusNext,
    focusPrevious,
    itemCount,
  };
}

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
