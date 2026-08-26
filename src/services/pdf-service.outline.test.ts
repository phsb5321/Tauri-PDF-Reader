import { describe, expect, it, vi } from "vitest";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { pdfService } from "./pdf-service";

describe("pdfService.getOutline", () => {
  it("resolves numeric, referenced, and nested PDF destinations", async () => {
    const ref = { num: 7, gen: 0 };
    const pdf = {
      getOutline: vi.fn().mockResolvedValue([
        { title: "Numeric", dest: [0], items: [] },
        {
          title: "Referenced",
          dest: [ref],
          items: [{ title: "Nested", dest: [2], items: [] }],
        },
      ]),
      getDestination: vi.fn(),
      getPageIndex: vi.fn().mockResolvedValue(4),
    } as unknown as PDFDocumentProxy;

    await expect(pdfService.getOutline(pdf)).resolves.toEqual([
      { title: "Numeric", pageNumber: 1, children: [] },
      {
        title: "Referenced",
        pageNumber: 5,
        children: [{ title: "Nested", pageNumber: 3, children: [] }],
      },
    ]);
  });

  it("resolves named destinations and keeps missing destinations honest", async () => {
    const ref = { num: 9, gen: 0 };
    const pdf = {
      getOutline: vi.fn().mockResolvedValue([
        { title: "Named", dest: "chapter-one", items: [] },
        { title: "Heading only", dest: null, items: [] },
      ]),
      getDestination: vi.fn().mockResolvedValue([ref]),
      getPageIndex: vi.fn().mockResolvedValue(1),
    } as unknown as PDFDocumentProxy;

    await expect(pdfService.getOutline(pdf)).resolves.toEqual([
      { title: "Named", pageNumber: 2, children: [] },
      { title: "Heading only", pageNumber: null, children: [] },
    ]);
  });
});
