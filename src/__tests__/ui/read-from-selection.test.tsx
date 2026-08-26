import { createRef } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HighlightToolbar } from "../../components/pdf-viewer/HighlightToolbar";

describe("selection narration affordance", () => {
  it("exposes a visible Read from here action beside highlight colours", () => {
    const container = document.createElement("div");
    document.body.append(container);
    const containerRef = createRef<HTMLElement>();
    Object.defineProperty(containerRef, "current", { value: container });
    const onReadFromHere = vi.fn();

    render(
      <HighlightToolbar
        position={{ x: 40, y: 40 }}
        onHighlight={vi.fn()}
        onReadFromHere={onReadFromHere}
        onCancel={vi.fn()}
        selectedRects={[{ x: 20, y: 40, width: 40, height: 12 }]}
        containerRef={containerRef}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Read from here" }));
    expect(onReadFromHere).toHaveBeenCalledOnce();
  });
});
