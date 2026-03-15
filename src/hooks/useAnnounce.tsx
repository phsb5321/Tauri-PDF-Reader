/**
 * useAnnounce Hook
 *
 * Provides screen reader announcements via an aria-live region.
 * Enables accessible feedback for dynamic content changes.
 *
 * @module hooks/useAnnounce
 * @feature 007-ui-ux-overhaul (P0-4)
 *
 * @example
 * ```tsx
 * // In AppLayout.tsx - render the announcement region
 * function AppLayout({ children }) {
 *   const { AnnouncementRegion } = useAnnounce();
 *   return (
 *     <>
 *       {children}
 *       <AnnouncementRegion />
 *     </>
 *   );
 * }
 *
 * // In PageNavigation.tsx - announce page changes
 * function PageNavigation() {
 *   const { announce } = useAnnounce();
 *
 *   const goToPage = (page: number) => {
 *     setCurrentPage(page);
 *     announce(`Page ${page} of ${totalPages}`);
 *   };
 * }
 * ```
 */

import { useState, useCallback, useEffect, useRef } from "react";

/**
 * Announcement priority level
 *
 * - 'polite': Waits for user to finish current activity (default)
 * - 'assertive': Interrupts immediately (use sparingly for critical updates)
 */
export type AnnouncementPriority = "polite" | "assertive";

/**
 * Announcement data
 */
export interface Announcement {
  /** Message to be read by screen reader */
  message: string;

  /** Announcement priority */
  priority: AnnouncementPriority;

  /** Timestamp for deduplication */
  timestamp: number;
}

/**
 * useAnnounce hook options
 */
export interface UseAnnounceOptions {
  /** Default priority for announcements (default: 'polite') */
  defaultPriority?: AnnouncementPriority;

  /** Auto-clear announcement after delay in ms (default: 3000) */
  clearDelay?: number;

  /** Debounce rapid announcements in ms (default: 100) */
  debounce?: number;
}

/**
 * useAnnounce hook return type
 */
export interface UseAnnounceReturn {
  /**
   * Announce a message to screen readers
   *
   * @param message - Text to announce
   * @param priority - Override default priority
   */
  announce: (message: string, priority?: AnnouncementPriority) => void;

  /**
   * Current announcement (null if none)
   */
  current: Announcement | null;

  /**
   * Clear current announcement immediately
   */
  clear: () => void;

  /**
   * React component that renders the aria-live region
   * Must be rendered once in the app layout
   */
  AnnouncementRegion: React.FC;
}

/**
 * Hook for screen reader announcements via aria-live region
 */
export function useAnnounce(
  options: UseAnnounceOptions = {},
): UseAnnounceReturn {
  const {
    defaultPriority = "polite",
    clearDelay = 3000,
    debounce: _debounce = 100,
  } = options;

  const [current, setCurrent] = useState<Announcement | null>(null);
  const clearTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear any existing timeout when unmounting or when current changes
  useEffect(() => {
    return () => {
      if (clearTimeoutRef.current) {
        clearTimeout(clearTimeoutRef.current);
      }
    };
  }, []);

  const clear = useCallback(() => {
    if (clearTimeoutRef.current) {
      clearTimeout(clearTimeoutRef.current);
      clearTimeoutRef.current = null;
    }
    setCurrent(null);
  }, []);

  const announce = useCallback(
    (message: string, priority?: AnnouncementPriority) => {
      const finalPriority = priority ?? defaultPriority;

      // Clear any existing timeout
      if (clearTimeoutRef.current) {
        clearTimeout(clearTimeoutRef.current);
        clearTimeoutRef.current = null;
      }

      // To trigger re-announcement of the same message, briefly clear then set
      // Using requestAnimationFrame ensures the DOM updates between clear and set
      setCurrent(null);
      requestAnimationFrame(() => {
        setCurrent({
          message,
          priority: finalPriority,
          timestamp: Date.now(),
        });

        // Set auto-clear timeout
        clearTimeoutRef.current = setTimeout(() => {
          setCurrent(null);
          clearTimeoutRef.current = null;
        }, clearDelay);
      });
    },
    [defaultPriority, clearDelay],
  );

  /**
   * React component that renders the aria-live region
   * Visually hidden but accessible to screen readers
   */
  const AnnouncementRegion: React.FC = useCallback(() => {
    return (
      <div
        role="status"
        aria-live={current?.priority ?? "polite"}
        aria-atomic="true"
        className="sr-only"
      >
        {current?.message}
      </div>
    );
  }, [current]);

  return {
    announce,
    current,
    clear,
    AnnouncementRegion,
  };
}

/**
 * Predefined announcement templates
 */
export const ANNOUNCEMENTS = {
  pageChange: (currentPage: number, total: number) =>
    `Page ${currentPage} of ${total}`,
  zoomChange: (zoom: number) => `Zoom ${zoom}%`,
  ttsPlaying: () => "Playing",
  ttsPaused: () => "Paused",
  ttsStopped: () => "Stopped",
  highlightAdded: () => "Highlight added",
  highlightRemoved: () => "Highlight removed",
  settingsSaved: () => "Settings saved",
  error: (message: string) => `Error: ${message}`,
} as const;
