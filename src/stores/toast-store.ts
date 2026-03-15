import { create } from "zustand";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface Toast {
  id: string;
  message: string;
  variant: "info" | "success" | "warning" | "error";
  duration: number;
  action?: ToastAction;
  createdAt: number;
}

interface ToastStore {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, "id" | "createdAt">) => string;
  removeToast: (id: string) => void;
  clearAll: () => void;
  success: (message: string) => string;
  error: (message: string) => string;
  warning: (message: string) => string;
  info: (message: string) => string;
}

let counter = 0;

function createToastId(): string {
  return `toast-${++counter}-${Date.now()}`;
}

function addToastToState(
  set: (fn: (state: ToastStore) => Partial<ToastStore>) => void,
  toast: Omit<Toast, "id" | "createdAt">,
): string {
  const id = createToastId();
  console.debug("[Toast] add:", toast.variant, toast.message);
  set((state) => ({
    toasts: [...state.toasts, { ...toast, id, createdAt: Date.now() }],
  }));
  return id;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],

  addToast: (toast) => addToastToState(set, toast),

  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },

  clearAll: () => {
    set({ toasts: [] });
  },

  success: (message) =>
    addToastToState(set, { message, variant: "success", duration: 3000 }),

  error: (message) =>
    addToastToState(set, { message, variant: "error", duration: 8000 }),

  warning: (message) =>
    addToastToState(set, { message, variant: "warning", duration: 5000 }),

  info: (message) =>
    addToastToState(set, { message, variant: "info", duration: 5000 }),
}));
