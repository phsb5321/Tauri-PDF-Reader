import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  ParagraphActionOverlay,
  paragraphActionName,
} from "../../components/pdf-viewer/ParagraphActionOverlay";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("paragraph action overlay", () => {
  it("exposes a keyboard-sized public action with exact tail and offset", () => {
    const onReadFromHere = vi.fn();
    render(
      <ParagraphActionOverlay
        actions={[
          {
            index: 1,
            sourceStart: 42,
            narrationText: "Selected paragraph. Following paragraph.",
            previewText: "Selected paragraph.",
            x: 12,
            y: 80,
          },
        ]}
        onReadFromHere={onReadFromHere}
      />,
    );

    const action = screen.getByRole("button", {
      name: "Read from paragraph 2: Selected paragraph.",
    });
    expect(action).toHaveStyle({ left: "12px", top: "80px" });
    expect(action).not.toHaveAttribute("title");
    expect(action.querySelector(".paragraph-action-tick")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    fireEvent.click(action);
    expect(onReadFromHere).toHaveBeenCalledWith(
      "Selected paragraph. Following paragraph.",
      42,
    );
  });

  it("keeps long accessible previews on a code-point-safe word boundary", () => {
    const name = paragraphActionName(
      0,
      "A professional paragraph action keeps the reader focused 😀 without clipping words",
    );

    expect(name).toMatch(/^Read from paragraph 1: .+…$/u);
    expect(name).not.toMatch(/[\uD800-\uDBFF]$/u);
    expect(name).not.toContain("focus…");
  });

  it("uses a quiet paper marker with individual focus instead of page-wide low-opacity discs", () => {
    const css = readFileSync(
      resolve(ROOT, "src/components/pdf-viewer/ParagraphActionOverlay.css"),
      "utf8",
    );

    expect(css).toContain("background: var(--color-paper-tick)");
    expect(css).toMatch(
      /\.paragraph-action-button:focus-visible\s*\{[^}]*outline:/s,
    );
    expect(css).not.toContain(".pdf-page-container:hover");
    expect(css).not.toMatch(/opacity:\s*0\./);
    expect(css).not.toContain("scale(");
    expect(css).not.toContain("var(--shadow-md)");
  });
});
