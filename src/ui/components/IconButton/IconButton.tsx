import { ButtonHTMLAttributes, ReactNode } from 'react';
import './IconButton.css';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Icon element to display */
  children: ReactNode;
  /** Accessible label (required for screen readers) */
  label: string;
  /** Visual style variant */
  variant?: 'default' | 'primary' | 'ghost';
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Active/pressed state */
  active?: boolean;
}

export function IconButton({
  children,
  label,
  variant = 'default',
  size = 'md',
  active = false,
  disabled,
  className = '',
  ...props
}: IconButtonProps) {
  const classes = [
    'icon-button',
    `icon-button--${variant}`,
    `icon-button--${size}`,
    active && 'icon-button--active',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      className={classes}
      aria-label={label}
      disabled={disabled}
      {...props}
    >
      <span className="icon-button__icon">{children}</span>
    </button>
  );
}
