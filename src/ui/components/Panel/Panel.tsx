import { ReactNode } from 'react';
import './Panel.css';

export interface PanelProps {
  /** Panel title */
  title?: string;
  /** Panel content */
  children: ReactNode;
  /** Position in layout */
  position?: 'left' | 'right';
  /** Collapsed state */
  collapsed?: boolean;
  /** Close handler (shows close button when provided) */
  onClose?: () => void;
  /** Header action elements */
  headerActions?: ReactNode;
  /** Custom width in pixels */
  width?: number;
  /** Additional CSS class */
  className?: string;
}

export function Panel({
  title,
  children,
  position = 'right',
  collapsed = false,
  onClose,
  headerActions,
  width,
  className = '',
}: PanelProps) {
  const classes = [
    'panel',
    `panel--${position}`,
    collapsed && 'panel--collapsed',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const style = width ? { width: `${width}px` } : undefined;

  return (
    <aside
      className={classes}
      style={style}
      role="complementary"
      aria-label={title}
      aria-hidden={collapsed}
    >
      {title && (
        <header className="panel__header">
          <h2 className="panel__title">{title}</h2>
          <div className="panel__header-actions">
            {headerActions}
            {onClose && (
              <button
                className="panel__close-button"
                onClick={onClose}
                aria-label="Close panel"
              >
                <svg viewBox="0 0 24 24" className="panel__close-icon">
                  <path d="M6 18L18 6M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            )}
          </div>
        </header>
      )}
      <div className="panel__content">
        {children}
      </div>
    </aside>
  );
}
