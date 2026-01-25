import { ReactNode } from 'react';
import './EmptyState.css';

export interface EmptyStateAction {
  label: string;
  onClick: () => void;
}

export interface EmptyStateProps {
  /** Main heading */
  title: string;
  /** Description text */
  description?: string;
  /** Icon element */
  icon?: ReactNode;
  /** Primary action button */
  action?: EmptyStateAction;
  /** Secondary action button */
  secondaryAction?: EmptyStateAction;
  /** Visual variant */
  variant?: 'default' | 'compact';
  /** Additional CSS class */
  className?: string;
}

export function EmptyState({
  title,
  description,
  icon,
  action,
  secondaryAction,
  variant = 'default',
  className = '',
}: EmptyStateProps) {
  const classes = [
    'empty-state',
    `empty-state--${variant}`,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes}>
      {icon && <div className="empty-state__icon">{icon}</div>}
      <h3 className="empty-state__title">{title}</h3>
      {description && (
        <p className="empty-state__description">{description}</p>
      )}
      {(action || secondaryAction) && (
        <div className="empty-state__actions">
          {action && (
            <button
              className="empty-state__action empty-state__action--primary"
              onClick={action.onClick}
            >
              {action.label}
            </button>
          )}
          {secondaryAction && (
            <button
              className="empty-state__action empty-state__action--secondary"
              onClick={secondaryAction.onClick}
            >
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
