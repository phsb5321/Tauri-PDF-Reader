/**
 * Tests for the ResumeSection (the catch-up surface).
 *
 * Verifies:
 * - Only in-flight documents appear (unread and finished are excluded)
 * - Nothing renders when nothing is in flight
 * - Most recently opened becomes the resume line, the rest drop to rows
 * - Clicking the line's Resume / a row resumes silently; the play control
 *   resumes AND starts narration — and never fires the plain resume
 * - Place, percent, and relative last-read time are reported
 * - Accessible names carry "Resume" for assistive tech
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ResumeSection } from "../../components/library/ResumeSection";
import type { Document } from "../../lib/schemas";

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

describe("ResumeSection", () => {
  it("renders nothing when no document is in flight", () => {
    const { container } = render(
      <ResumeSection
        documents={[
          doc({ currentPage: 1 }),
          doc({ id: "d2", currentPage: 100 }),
        ]}
        onResume={noop}
        onResumeAndPlay={noop}
        onOpenSettings={noop}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("renders the resume-line cover with the document's accessible name", () => {
    render(
      <ResumeSection
        documents={[doc({ title: "Covered Book", currentPage: 2 })]}
        onResume={noop}
        onResumeAndPlay={noop}
        onOpenSettings={noop}
      />,
    );

    // The resume line is cover-led: a cover named by the document renders
    // beside the text (the also-in-progress rows are decorative and must
    // not duplicate the name).
    expect(
      screen.getByRole("img", { name: "Covered Book" }),
    ).toBeInTheDocument();
  });

  it("renders decorative covers on the 'also in progress' rows", () => {
    render(
      <ResumeSection
        documents={[
          doc({ id: "primary", title: "Primary", currentPage: 2, lastOpenedAt: "2026-08-10T10:00:00Z" }),
          doc({ id: "row", title: "Row Book", currentPage: 3, lastOpenedAt: "2026-08-09T10:00:00Z" }),
        ]}
        onResume={noop}
        onResumeAndPlay={noop}
        onOpenSettings={noop}
      />,
    );

    // Exactly ONE named img (the resume line's cover); the row cover is
    // decorative (aria-hidden) — the row's ListRow already names the book.
    const named = screen.getAllByRole("img");
    expect(named).toHaveLength(1);
    expect(screen.getByRole("img", { name: "Primary" })).toBeInTheDocument();
    const rowGlyph = document.querySelector(
      ".also-in-progress-row .cover-fallback-glyph",
    );
    expect(rowGlyph).not.toBeNull();
    expect(rowGlyph?.getAttribute("aria-hidden")).toBe("true");
  });

  it("lists only the documents in flight", () => {
    render(
      <ResumeSection
        documents={[
          doc({ id: "unread", title: "Unread", currentPage: 1 }),
          doc({ id: "reading", title: "Reading", currentPage: 42 }),
          doc({ id: "done", title: "Done", currentPage: 100 }),
        ]}
        onResume={noop}
        onResumeAndPlay={noop}
        onOpenSettings={noop}
      />,
    );

    expect(screen.getByText("Reading")).toBeInTheDocument();
    expect(screen.queryByText("Unread")).not.toBeInTheDocument();
    expect(screen.queryByText("Done")).not.toBeInTheDocument();
  });

  it("puts the most recently opened first as the resume line", () => {
    render(
      <ResumeSection
        documents={[
          doc({
            id: "older",
            title: "Older",
            currentPage: 10,
            lastOpenedAt: "2026-07-01T00:00:00Z",
          }),
          doc({
            id: "newer",
            title: "Newer",
            currentPage: 10,
            lastOpenedAt: "2026-07-29T00:00:00Z",
          }),
        ]}
        onResume={noop}
        onResumeAndPlay={noop}
        onOpenSettings={noop}
      />,
    );

    // The newer book is the resume line (h2 section's primary button); the
    // older one is an "also in progress" row. Assert via heading positions:
    // the primary title sits in the resume line, the other in the list.
    const resumeLineTitle = screen.getByText("Newer");
    expect(resumeLineTitle.className).toContain("resume-line-title");
    expect(screen.getByText("Older").className).toContain("list-row__primary");
  });

  it("resumes the document that was clicked (line)", () => {
    const onResume = vi.fn();
    const reading = doc({ id: "reading", title: "Reading", currentPage: 42 });

    render(
      <ResumeSection
        documents={[reading]}
        onResume={onResume}
        onResumeAndPlay={noop}
        onOpenSettings={noop}
      />,
    );
    // The resume line is typographic — the title is NOT inside the button
    // (unlike the old card row), so click the actual Resume button.
    fireEvent.click(
      screen.getByRole("button", {
        name: /^Resume Reading, page 42 of 100, 42%$/,
      }),
    );

    expect(onResume).toHaveBeenCalledWith(reading);
  });

  it("resumes through an 'also in progress' row — by accessible name, not by text", () => {
    const onResume = vi.fn();
    const primary = doc({ id: "primary", title: "Primary", currentPage: 10 });
    const secondary = doc({
      id: "secondary",
      title: "Secondary",
      currentPage: 5,
    });

    render(
      <ResumeSection
        documents={[primary, secondary]}
        onResume={onResume}
        onResumeAndPlay={noop}
        onOpenSettings={noop}
      />,
    );
    // Role + name, never by text: a query-by-text cannot notice a missing
    // accessible name — the exact blind spot that let the rows ship without
    // a resume verb in their name.
    const row = screen.getByRole("button", {
      name: /^Resume Secondary, page 5 of 100/,
    });
    fireEvent.click(row);

    expect(onResume).toHaveBeenCalledWith(secondary);
  });

  it("resumes AND plays through each play control, without touching plain resume", () => {
    const onResume = vi.fn();
    const onResumeAndPlay = vi.fn();
    const primary = doc({ id: "primary", title: "Primary", currentPage: 10 });
    const secondary = doc({
      id: "secondary",
      title: "Secondary",
      currentPage: 5,
    });

    render(
      <ResumeSection
        documents={[primary, secondary]}
        onResume={onResume}
        onResumeAndPlay={onResumeAndPlay}
        onOpenSettings={noop}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /Primary and start reading aloud/ }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: /Secondary and start reading aloud/ }),
    );

    expect(onResumeAndPlay).toHaveBeenCalledWith(primary);
    expect(onResumeAndPlay).toHaveBeenCalledWith(secondary);
    expect(onResume).not.toHaveBeenCalled();
  });

  it("reports the place in the book and percent", () => {
    render(
      <ResumeSection
        documents={[doc({ currentPage: 42, pageCount: 100 })]}
        onResume={noop}
        onResumeAndPlay={noop}
        onOpenSettings={noop}
      />,
    );

    expect(screen.getByText("Page 42 of 100")).toBeInTheDocument();
    expect(screen.getByText("42%")).toBeInTheDocument();
    // Native <progress> carries value/max rather than the aria-value* trio.
    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("value", "42");
    expect(bar).toHaveAttribute("max", "100");
  });

  it("omits the total when the page count is unknown", () => {
    render(
      <ResumeSection
        documents={[doc({ currentPage: 42, pageCount: null })]}
        onResume={noop}
        onResumeAndPlay={noop}
        onOpenSettings={noop}
      />,
    );

    expect(screen.getByText("Page 42")).toBeInTheDocument();
  });

  it("falls back to the file path when a document has no title", () => {
    render(
      <ResumeSection
        documents={[
          doc({ title: null, filePath: "/books/untitled.pdf", currentPage: 5 }),
        ]}
        onResume={noop}
        onResumeAndPlay={noop}
        onOpenSettings={noop}
      />,
    );

    expect(screen.getByText("/books/untitled.pdf")).toBeInTheDocument();
  });

  it("names both actions with the resume verb for assistive tech", () => {
    render(
      <ResumeSection
        documents={[doc({ currentPage: 42, pageCount: 100 })]}
        onResume={noop}
        onResumeAndPlay={noop}
        onOpenSettings={noop}
      />,
    );

    expect(
      screen.getByRole("button", { name: /^Resume One, page 42 of 100, 42%$/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: /Resume One and start reading aloud/,
      }),
    ).toBeInTheDocument();
  });
});
