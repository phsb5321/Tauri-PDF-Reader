import { useEffect, type RefObject } from "react";

interface UseDialogBackdropCloseOptions {
  dialogRef: RefObject<HTMLDialogElement | null>;
  active: boolean;
  enabled?: boolean;
  onClose: () => void;
}

export function useDialogBackdropClose({
  dialogRef,
  active,
  enabled = true,
  onClose,
}: UseDialogBackdropCloseOptions) {
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!active || !enabled || !dialog) return;

    const handleClick = (event: MouseEvent) => {
      if (event.target === dialog) onClose();
    };

    dialog.addEventListener("click", handleClick);
    return () => dialog.removeEventListener("click", handleClick);
  }, [active, dialogRef, enabled, onClose]);
}
