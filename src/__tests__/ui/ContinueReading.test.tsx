/**
 * Tests for the Continue reading shelf.
 *
 * Verifies:
 * - Only in-flight documents appear (unread and finished are excluded)
 * - Nothing renders when nothing is in flight
 * - Most recently opened comes first
 * - Clicking the row resumes silently; the secondary control resumes and plays
 * - Place and progress are reported for assistive technology
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ContinueReading } from "../../components/library/ContinueReading";
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

describe("ContinueReading", () => {
  it("renders nothing when no document is in flight", () => {
    const { container } = render(
      <ContinueReading
        documents={[
          doc({ currentPage: 1 }),
          doc({ id: "d2", currentPage: 100 }),
        ]}
        onResume={noop}
        onResumeAndPlay={noop}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("lists only the documents in flight", () => {
    render(
      <ContinueReading
        documents={[
          doc({ id: "unread", title: "Unread", currentPage: 1 }),
          doc({ id: "reading", title: "Reading", currentPage: 42 }),
          doc({ id: "done", title: "Done", currentPage: 100 }),
        ]}
        onResume={noop}
        onResumeAndPlay={noop}
      />,
    );

    expect(screen.getByText("Reading")).toBeInTheDocument();
    expect(screen.queryByText("Unread")).not.toBeInTheDocument();
    expect(screen.queryByText("Done")).not.toBeInTheDocument();
  });

  it("puts the most recently opened first", () => {
    render(
      <ContinueReading
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
      />,
    );

    const titles = screen
      .getAllByRole("button", { name: /^Resume / })
      .filter((button) => /%$/.test(button.getAttribute("aria-label") ?? ""))
      .map((b) => b.textContent ?? "");
    expect(titles[0]).toContain("Newer");
    expect(titles[1]).toContain("Older");
  });

  it("resumes the document that was clicked", () => {
    const onResume = vi.fn();
    const reading = doc({ id: "reading", title: "Reading", currentPage: 42 });

    render(
      <ContinueReading
        documents={[reading]}
        onResume={onResume}
        onResumeAndPlay={noop}
      />,
    );
    fireEvent.click(screen.getByText("Reading"));

    expect(onResume).toHaveBeenCalledWith(reading);
  });

  it("resumes and plays through the secondary control, without touching plain resume", () => {
    const onResume = vi.fn();
    const onResumeAndPlay = vi.fn();
    const reading = doc({ id: "reading", title: "Reading", currentPage: 42 });

    render(
      <ContinueReading
        documents={[reading]}
        onResume={onResume}
        onResumeAndPlay={onResumeAndPlay}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: /Reading and start reading aloud/ }),
    );

    expect(onResumeAndPlay).toHaveBeenCalledWith(reading);
    expect(onResume).not.toHaveBeenCalled();
  });

  it("reports the place in the book", () => {
    render(
      <ContinueReading
        documents={[doc({ currentPage: 42, pageCount: 100 })]}
        onResume={noop}
        onResumeAndPlay={noop}
      />,
    );

    expect(screen.getByText("Page 42 of 100")).toBeInTheDocument();
    // Native <progress> carries value/max rather than the aria-value* trio.
    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("value", "42");
    expect(bar).toHaveAttribute("max", "100");
  });

  it("omits the total when the page count is unknown", () => {
    render(
      <ContinueReading
        documents={[doc({ currentPage: 42, pageCount: null })]}
        onResume={noop}
        onResumeAndPlay={noop}
      />,
    );

    expect(screen.getByText("Page 42")).toBeInTheDocument();
  });

  it("falls back to the file path when a document has no title", () => {
    render(
      <ContinueReading
        documents={[
          doc({ title: null, filePath: "/books/untitled.pdf", currentPage: 5 }),
        ]}
        onResume={noop}
        onResumeAndPlay={noop}
      />,
    );

    expect(screen.getByText("/books/untitled.pdf")).toBeInTheDocument();
  });
});
