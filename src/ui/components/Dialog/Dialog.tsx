import { useRef, useCallback, type ReactNode } from "react";
import { useFocusTrap } from "../../../hooks/useFocusTrap";
import "./Dialog.css";

export interface DialogProps {
  /** Whether dialog is open */
  open: boolean;
  /** Close handler */
  onClose: () => void;
  /** Dialog title */
  title: string;
  /** Optional description */
  description?: string;
  /** Dialog size */
  size?: "sm" | "md" | "lg" | "xl";
  /** Dialog content */
  children: ReactNode;
  /** Footer actions */
  footer?: ReactNode;
  /** Close on Escape key (default: true) */
  closeOnEscape?: boolean;
  /** Close on backdrop click (default: true) */
  closeOnBackdrop?: boolean;
}

export function Dialog({
  open,
  onClose,
  title,
  description,
  size = "md",
  children,
  footer,
  closeOnEscape = true,
  closeOnBackdrop = true,
}: DialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useFocusTrap({
    containerRef: dialogRef,
    active: open,
    onEscape: closeOnEscape ? onClose : undefined,
    preventScroll: true,
  });

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (closeOnBackdrop && e.target === e.currentTarget) {
        onClose();
      }
    },
    [closeOnBackdrop, onClose],
  );

  if (!open) return null;

  return (
    <div
      className="dialog-backdrop"
      onClick={handleBackdropClick}
      role="presentation"
    >
      <div
        ref={dialogRef}
        className={`dialog dialog--${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        aria-describedby={description ? "dialog-description" : undefined}
      >
        <div className="dialog__header">
          <h2 id="dialog-title" className="dialog__title">
            {title}
          </h2>
          <button
            type="button"
            className="dialog__close"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        {description && (
          <p id="dialog-description" className="dialog__description">
            {description}
          </p>
        )}
        <div className="dialog__content">{children}</div>
        {footer && <div className="dialog__footer">{footer}</div>}
      </div>
    </div>
  );
}
