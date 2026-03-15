import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { useToastStore } from "../../stores/toast-store";

describe("useToastStore", () => {
  beforeEach(() => {
    useToastStore.getState().clearAll();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts with empty toasts array", () => {
    expect(useToastStore.getState().toasts).toEqual([]);
  });

  describe("addToast", () => {
    it("adds a toast with generated id and timestamp", () => {
      const id = useToastStore.getState().addToast({
        message: "Hello",
        variant: "info",
        duration: 5000,
      });

      const { toasts } = useToastStore.getState();
      expect(toasts).toHaveLength(1);
      expect(toasts[0]).toMatchObject({
        id,
        message: "Hello",
        variant: "info",
        duration: 5000,
      });
      expect(typeof toasts[0].id).toBe("string");
      expect(typeof toasts[0].createdAt).toBe("number");
    });

    it("adds multiple toasts", () => {
      useToastStore
        .getState()
        .addToast({ message: "First", variant: "info", duration: 5000 });
      useToastStore
        .getState()
        .addToast({ message: "Second", variant: "success", duration: 3000 });

      expect(useToastStore.getState().toasts).toHaveLength(2);
    });

    it("returns unique ids", () => {
      const id1 = useToastStore
        .getState()
        .addToast({ message: "A", variant: "info", duration: 0 });
      const id2 = useToastStore
        .getState()
        .addToast({ message: "B", variant: "info", duration: 0 });

      expect(id1).not.toBe(id2);
    });

    it("supports toast with action", () => {
      const onClick = vi.fn();
      useToastStore.getState().addToast({
        message: "Undo?",
        variant: "info",
        duration: 5000,
        action: { label: "Undo", onClick },
      });

      const toast = useToastStore.getState().toasts[0];
      expect(toast.action).toBeDefined();
      expect(toast.action?.label).toBe("Undo");
      toast.action?.onClick();
      expect(onClick).toHaveBeenCalledOnce();
    });
  });

  describe("removeToast", () => {
    it("removes a toast by id", () => {
      const id = useToastStore
        .getState()
        .addToast({ message: "Remove me", variant: "info", duration: 0 });
      useToastStore
        .getState()
        .addToast({ message: "Keep me", variant: "success", duration: 0 });

      useToastStore.getState().removeToast(id);

      const { toasts } = useToastStore.getState();
      expect(toasts).toHaveLength(1);
      expect(toasts[0].message).toBe("Keep me");
    });

    it("does nothing for non-existent id", () => {
      useToastStore
        .getState()
        .addToast({ message: "Exists", variant: "info", duration: 0 });
      useToastStore.getState().removeToast("non-existent");

      expect(useToastStore.getState().toasts).toHaveLength(1);
    });
  });

  describe("clearAll", () => {
    it("removes all toasts", () => {
      useToastStore
        .getState()
        .addToast({ message: "A", variant: "info", duration: 0 });
      useToastStore
        .getState()
        .addToast({ message: "B", variant: "info", duration: 0 });
      useToastStore
        .getState()
        .addToast({ message: "C", variant: "info", duration: 0 });

      useToastStore.getState().clearAll();

      expect(useToastStore.getState().toasts).toEqual([]);
    });
  });

  describe("convenience methods", () => {
    it("success() adds a success toast", () => {
      useToastStore.getState().success("Done!");
      const toast = useToastStore.getState().toasts[0];
      expect(toast.variant).toBe("success");
      expect(toast.message).toBe("Done!");
    });

    it("error() adds an error toast", () => {
      useToastStore.getState().error("Failed!");
      const toast = useToastStore.getState().toasts[0];
      expect(toast.variant).toBe("error");
      expect(toast.message).toBe("Failed!");
    });

    it("warning() adds a warning toast", () => {
      useToastStore.getState().warning("Careful!");
      const toast = useToastStore.getState().toasts[0];
      expect(toast.variant).toBe("warning");
      expect(toast.message).toBe("Careful!");
    });

    it("info() adds an info toast", () => {
      useToastStore.getState().info("FYI");
      const toast = useToastStore.getState().toasts[0];
      expect(toast.variant).toBe("info");
      expect(toast.message).toBe("FYI");
    });
  });
});
