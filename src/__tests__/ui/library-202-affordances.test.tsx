/**
 * Slice 202 affordance gates (#183 tail) — the fail-first suite.
 *
 * Gates the three bounded affordances before implementation (every
 * behavioral assertion here was RED on the 951c342 tree; retention guards
 * are marked as such):
 *
 *   FR-1  the resume-and-read-aloud action carries a VISIBLE "Read aloud"
 *         label whose accessible name keeps the resume verb + book title
 *         (WCAG 2.5.3 Label in Name), on the resume line AND on every
 *         "Also in progress" row — it was an icon-only IconButton before.
 *   FR-2  a 0% in-flight book renders the empty-track state
 *         (`resume-line-bar--empty`, accent start nub) and the track is a
 *         hollow container (inset ring), so it never reads as a divider.
 *   FR-3  the actions wrap at narrow widths and the stylesheet stays
 *         rem-based (legible at the declared 125% UI text scale — the
 *         150% slider max is exercised in the packaged journey). The New
 *         shelf form pinning (#183 stretch) was DROPPED from this slice —
 *         optional scope cut at review; the #183 bullet remains open debt.
 *
 * CSS assertions follow the repo's established source-contract pattern
 * (library-legibility.test.ts): the packaged computed-style checks live in
 * e2e/library-202-journey.e2e.mjs; this file pins the deterministic source
 * of truth. No assertion here was weakened from an existing suite.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { render, screen } from "@testing-library/react";
import { ResumeSection } from "../../components/library/ResumeSection";
import type { Document } from "../../lib/schemas";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const read = (path: string) => readFileSync(resolve(ROOT, path), "utf8");

const doc = (over: Partial<Document> = {}): Document =>
  ({
    id: "doc-1",
    filePath: "/books/one.pdf",
    title: "One",
    pageCount: 100,
    currentPage: 1,
    scrollPosition: 0,
    lastTtsChunkId: null,
    lastOpenedAt: null,
    fileHash: null,
    createdAt: "2026-07-01T00:00:00Z",
    ...over,
  }) as Document;

const noop = () => {};

describe("FR-1: resume-and-read-aloud is visibly labeled (not icon-only)", () => {
  it("renders a visible 'Read aloud' label on the resume line control", () => {
    render(
      <ResumeSection
        documents={[doc({ title: "Moby", currentPage: 42 })]}
        onResume={noop}
        onResumeAndPlay={noop}
        onOpenSettings={noop}
      />,
    );

    // Visible text is present INSIDE the control (not an aria-only name on
    // a glyph): the icon-only regression this gate exists for.
    const control = screen.getByRole("button", {
      name: /Resume Moby and read aloud/,
    });
    expect(control).toHaveTextContent("Read aloud");
    expect(screen.getByText("Read aloud")).toBeInTheDocument();
  });

  it("keeps the resume verb + book title in the accessible name (Label in Name)", () => {
    render(
      <ResumeSection
        documents={[doc({ title: "Moby", currentPage: 42 })]}
        onResume={noop}
        onResumeAndPlay={noop}
        onOpenSettings={noop}
      />,
    );

    // The visible "Read aloud" text must be contained in the accessible
    // name (WCAG 2.5.3): name = "Resume Moby and read aloud".
    expect(
      screen.getByRole("button", { name: "Resume Moby and read aloud" }),
    ).toBeInTheDocument();
  });

  it("labels the row control on every 'Also in progress' book", () => {
    render(
      <ResumeSection
        documents={[
          doc({ id: "primary", title: "Primary", currentPage: 10 }),
          doc({ id: "row", title: "Row Book", currentPage: 5 }),
        ]}
        onResume={noop}
        onResumeAndPlay={noop}
        onOpenSettings={noop}
      />,
    );

    const rowControl = screen.getByRole("button", {
      name: "Resume Row Book and read aloud",
    });
    expect(rowControl).toHaveTextContent("Read aloud");
  });

  it("RETENTION: the plain Resume button keeps its exact name and the silent contract", () => {
    render(
      <ResumeSection
        documents={[doc({ title: "Moby", currentPage: 42 })]}
        onResume={noop}
        onResumeAndPlay={noop}
        onOpenSettings={noop}
      />,
    );

    expect(
      screen.getByRole("button", {
        name: /^Resume Moby, page 42 of 100, 42%$/,
      }),
    ).toBeInTheDocument();
  });

  it("RETENTION: DOM tab order inside the resume line is Resume → Read aloud", () => {
    const { container } = render(
      <ResumeSection
        documents={[doc({ title: "Moby", currentPage: 42 })]}
        onResume={noop}
        onResumeAndPlay={noop}
        onOpenSettings={noop}
      />,
    );

    const buttons = [
      ...(container
        .querySelector(".resume-line-actions")
        ?.querySelectorAll("button") ?? []),
    ];
    expect(buttons).toHaveLength(2);
    expect(buttons[0].textContent).toContain("Resume");
    expect(buttons[1].textContent).toContain("Read aloud");
    // DOM order — Tab visits them in this order; no tabindex reordering.
    expect(
      buttons[0].compareDocumentPosition(buttons[1]) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    for (const button of buttons) {
      expect(button.getAttribute("tabindex")).toBeNull();
    }
  });
});

describe("FR-2: 0% progress is distinct from a divider", () => {
  it("renders the empty-track state for a 0% in-flight book", () => {
    // Page 2 of 500 → round(0.4) = 0%: in-flight ("reading"), zero percent.
    const { container } = render(
      <ResumeSection
        documents={[doc({ title: "Long", currentPage: 2, pageCount: 500 })]}
        onResume={noop}
        onResumeAndPlay={noop}
        onOpenSettings={noop}
      />,
    );

    expect(container.querySelector(".resume-line-bar--empty")).not.toBeNull();
    // The percent readout stays honest.
    expect(screen.getByText("0%")).toBeInTheDocument();
  });

  it("RETENTION: a partially read book does not get the empty modifier", () => {
    const { container } = render(
      <ResumeSection
        documents={[doc({ title: "Mid", currentPage: 42, pageCount: 100 })]}
        onResume={noop}
        onResumeAndPlay={noop}
        onOpenSettings={noop}
      />,
    );

    const bar = container.querySelector(".resume-line-bar");
    expect(bar).not.toBeNull();
    expect(bar?.className).not.toContain("resume-line-bar--empty");
    const fill = container.querySelector<HTMLElement>(".resume-line-bar-fill");
    expect(fill?.style.width).toBe("42%");
  });
});

describe("FR-3: legibility contract (wrap, hollow track, rem scale, pinned form)", () => {
  const css = read("src/components/library/ResumeSection.css");

  it("wraps the resume actions so narrow windows never clip the labels", () => {
    const actions =
      css.match(/\.resume-line-actions\s*\{([^}]*)\}/s)?.[1] ?? "";
    expect(actions).toMatch(/flex-wrap:\s*wrap/);
  });

  it("renders the track as a hollow container, never a solid divider hairline", () => {
    const bar = css.match(/\.resume-line-bar\s*\{([^}]*)\}/s)?.[1] ?? "";
    expect(bar).toMatch(/background(?:-color)?:\s*transparent/);
    expect(bar).toMatch(/box-shadow:[^;]*inset[^;]*var\(--color-border\)/);
  });

  it("draws the 0% start-position nub from the accent token", () => {
    expect(css).toMatch(/\.resume-line-bar--empty::before\s*\{[^}]*\}/s);
    const nub = css.match(
      /\.resume-line-bar--empty::before\s*\{([^}]*)\}/s,
    )?.[1];
    expect(nub).toMatch(/background:\s*var\(--color-accent\)/);
  });

  it("RETENTION: keeps the slice stylesheet rem/token-based for increased UI text scale", () => {
    // The app declares 125% root scale (slider max 150%); px font sizes
    // would opt this surface out of both.
    expect(css).not.toMatch(/font-size:\s*[\d.]+px/);
  });
});
