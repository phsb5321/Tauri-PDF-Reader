import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Dialog } from "./Dialog";

describe("Dialog", () => {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    title: "Test Dialog",
  };

  it("renders when open", () => {
    render(<Dialog {...defaultProps}>Content</Dialog>);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Test Dialog")).toBeInTheDocument();
    expect(screen.getByText("Content")).toBeInTheDocument();
  });

  it("does not render when closed", () => {
    render(
      <Dialog {...defaultProps} open={false}>
        Content
      </Dialog>,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders title and description", () => {
    render(
      <Dialog {...defaultProps} description="Some description">
        Content
      </Dialog>,
    );
    expect(screen.getByText("Some description")).toBeInTheDocument();
  });

  it("renders footer when provided", () => {
    render(
      <Dialog {...defaultProps} footer={<button type="button">Save</button>}>
        Content
      </Dialog>,
    );
    expect(screen.getByText("Save")).toBeInTheDocument();
  });

  it("calls onClose when close button is clicked", () => {
    const onClose = vi.fn();
    render(
      <Dialog {...defaultProps} onClose={onClose}>
        Content
      </Dialog>,
    );
    fireEvent.click(screen.getByLabelText("Close dialog"));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("calls onClose when backdrop is clicked", () => {
    const onClose = vi.fn();
    const { container } = render(
      <Dialog {...defaultProps} onClose={onClose}>
        Content
      </Dialog>,
    );
    const backdrop = container.querySelector(".dialog-backdrop");
    fireEvent.click(backdrop!);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("does not call onClose when dialog body is clicked", () => {
    const onClose = vi.fn();
    render(
      <Dialog {...defaultProps} onClose={onClose}>
        Content
      </Dialog>,
    );
    fireEvent.click(screen.getByText("Content"));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("does not close on backdrop when closeOnBackdrop is false", () => {
    const onClose = vi.fn();
    const { container } = render(
      <Dialog {...defaultProps} onClose={onClose} closeOnBackdrop={false}>
        Content
      </Dialog>,
    );
    const backdrop = container.querySelector(".dialog-backdrop");
    fireEvent.click(backdrop!);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("applies size class", () => {
    render(
      <Dialog {...defaultProps} size="lg">
        Content
      </Dialog>,
    );
    expect(screen.getByRole("dialog")).toHaveClass("dialog--lg");
  });

  it("has proper aria attributes", () => {
    render(
      <Dialog {...defaultProps} description="Desc">
        Content
      </Dialog>,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-labelledby", "dialog-title");
    expect(dialog).toHaveAttribute("aria-describedby", "dialog-description");
  });
});
