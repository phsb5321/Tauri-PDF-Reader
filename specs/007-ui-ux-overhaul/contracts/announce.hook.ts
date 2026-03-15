/**
 * useAnnounce Hook Contract
 *
 * @module hooks/useAnnounce
 * @feature 007-ui-ux-overhaul (P0-4)
 *
 * This hook provides screen reader announcements via an aria-live region.
 * It enables accessible feedback for dynamic content changes.
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
   *
   * @example
   * ```typescript
   * announce('Page 5 of 20');
   * announce('Error: File not found', 'assertive');
   * ```
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
 * Implementation notes:
 *
 * 1. The AnnouncementRegion component should render:
 *    ```tsx
 *    <div
 *      role="status"
 *      aria-live={priority}
 *      aria-atomic="true"
 *      className="sr-only" // visually hidden
 *    >
 *      {current?.message}
 *    </div>
 *    ```
 *
 * 2. The sr-only class should be:
 *    ```css
 *    .sr-only {
 *      position: absolute;
 *      width: 1px;
 *      height: 1px;
 *      padding: 0;
 *      margin: -1px;
 *      overflow: hidden;
 *      clip: rect(0, 0, 0, 0);
 *      white-space: nowrap;
 *      border: 0;
 *    }
 *    ```
 *
 * 3. To trigger re-announcement of the same message, briefly clear then set:
 *    ```typescript
 *    const announce = (message: string) => {
 *      setCurrent(null);
 *      requestAnimationFrame(() => setCurrent({ message, ... }));
 *    };
 *    ```
 */

/**
 * Predefined announcement templates
 */
export const ANNOUNCEMENTS = {
  pageChange: (current: number, total: number) => `Page ${current} of ${total}`,
  zoomChange: (zoom: number) => `Zoom ${zoom}%`,
  ttsPlaying: () => "Playing",
  ttsPaused: () => "Paused",
  ttsStopped: () => "Stopped",
  highlightAdded: () => "Highlight added",
  highlightRemoved: () => "Highlight removed",
  settingsSaved: () => "Settings saved",
  error: (message: string) => `Error: ${message}`,
} as const;
