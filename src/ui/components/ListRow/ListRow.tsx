import { ReactNode } from 'react';
import './ListRow.css';

export interface ListRowProps {
  /** Primary text content */
  primary: string;
  /** Secondary text content */
  secondary?: string;
  /** Leading element (icon, avatar, etc.) */
  leading?: ReactNode;
  /** Trailing element (icon, badge, etc.) */
  trailing?: ReactNode;
  /** Metadata slot (timestamp, count, etc.) */
  metadata?: ReactNode;
  /** Click handler */
  onClick?: () => void;
  /** Selected state */
  selected?: boolean;
  /** Disabled state */
  disabled?: boolean;
  /** Additional CSS class */
  className?: string;
}

export function ListRow({
  primary,
  secondary,
  leading,
  trailing,
  metadata,
  onClick,
  selected = false,
  disabled = false,
  className = '',
}: ListRowProps) {
  const isInteractive = !!onClick;

  const classes = [
    'list-row',
    isInteractive && 'list-row--interactive',
    selected && 'list-row--selected',
    disabled && 'list-row--disabled',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const handleClick = () => {
    if (!disabled && onClick) {
      onClick();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === 'Enter' || e.key === ' ') && onClick && !disabled) {
      e.preventDefault();
      onClick();
    }
  };

  const content = (
    <>
      {leading && <div className="list-row__leading">{leading}</div>}
      <div className="list-row__content">
        <span className="list-row__primary">{primary}</span>
        {secondary && <span className="list-row__secondary">{secondary}</span>}
      </div>
      {metadata && <div className="list-row__metadata">{metadata}</div>}
      {trailing && <div className="list-row__trailing">{trailing}</div>}
    </>
  );

  if (isInteractive) {
    return (
      <button
        type="button"
        className={classes}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        aria-selected={selected}
      >
        {content}
      </button>
    );
  }

  return (
    <div className={classes}>
      {content}
    </div>
  );
}
