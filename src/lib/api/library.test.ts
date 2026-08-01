/**
 * Library api wire-contract tests.
 *
 * Same shape as `ai-tts.test.ts` — every wrapper in `lib/api/library.ts`
 * asserts the exact Tauri command name and argument keys it dispatches.
 *
 * Two of these carry more than the usual wire risk. `libraryUpdateDocument`
 * spreads its `updates` object into the payload rather than nesting it, so a
 * caller's key lands at the top level and a nested one would silently not; and
 * `libraryListDocuments` has a default `orderBy` that must still be sent when
 * the caller omits it, since the backend does not supply one.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { mockInvoke } from "../../../tests/setup";
import * as api from "./library";

beforeEach(() => {
  mockInvoke.mockResolvedValue(undefined);
});

describe("library api → invoke wire contract", () => {
  it("libraryAddDocument → library_add_document", async () => {
    await api.libraryAddDocument("/books/a.pdf", "A", 120);
    expect(mockInvoke).toHaveBeenCalledWith("library_add_document", {
      filePath: "/books/a.pdf",
      title: "A",
      pageCount: 120,
    });
  });

  it("libraryAddDocument leaves the optional fields undefined rather than null", async () => {
    // Deliberately NOT titled "sends undefined on the wire" — it does not.
    // `invoke` serialises with JSON.stringify, which drops undefined-valued
    // keys entirely: {filePath:"/a.pdf",title:undefined} -> {"filePath":"/a.pdf"}.
    // The backend therefore sees a *missing* key, which serde maps to `None`
    // for an Option<T> field. What this asserts is the step before that — the
    // wrapper must not substitute `null` or `""`, which would serialise and
    // mean something different on the Rust side.
    await api.libraryAddDocument("/books/a.pdf");
    expect(mockInvoke).toHaveBeenCalledWith("library_add_document", {
      filePath: "/books/a.pdf",
      title: undefined,
      pageCount: undefined,
    });
  });

  it("libraryGetDocument → library_get_document", async () => {
    await api.libraryGetDocument("doc-1");
    expect(mockInvoke).toHaveBeenCalledWith("library_get_document", {
      id: "doc-1",
    });
  });

  it("libraryGetDocumentByPath → library_get_document_by_path", async () => {
    await api.libraryGetDocumentByPath("/books/a.pdf");
    expect(mockInvoke).toHaveBeenCalledWith("library_get_document_by_path", {
      filePath: "/books/a.pdf",
    });
  });

  it("libraryListDocuments defaults orderBy to last_opened", async () => {
    await api.libraryListDocuments();
    expect(mockInvoke).toHaveBeenCalledWith("library_list_documents", {
      orderBy: "last_opened",
      limit: undefined,
      offset: undefined,
    });
  });

  it("libraryListDocuments → library_list_documents", async () => {
    await api.libraryListDocuments("title", 10, 20);
    expect(mockInvoke).toHaveBeenCalledWith("library_list_documents", {
      orderBy: "title",
      limit: 10,
      offset: 20,
    });
  });

  it("libraryUpdateProgress → library_update_progress", async () => {
    await api.libraryUpdateProgress("doc-1", 42, 0.5, "chunk-7");
    expect(mockInvoke).toHaveBeenCalledWith("library_update_progress", {
      id: "doc-1",
      currentPage: 42,
      scrollPosition: 0.5,
      lastTtsChunkId: "chunk-7",
    });
  });

  it("libraryUpdateDocument flattens updates into the payload", async () => {
    await api.libraryUpdateDocument("doc-1", { title: "B", pageCount: 7 });
    expect(mockInvoke).toHaveBeenCalledWith("library_update_document", {
      id: "doc-1",
      title: "B",
      pageCount: 7,
    });
  });

  it("libraryUpdateTitle → library_update_title", async () => {
    await api.libraryUpdateTitle("doc-1", "B");
    expect(mockInvoke).toHaveBeenCalledWith("library_update_title", {
      id: "doc-1",
      title: "B",
    });
  });

  it("libraryRelocateDocument → library_relocate_document", async () => {
    await api.libraryRelocateDocument("doc-1", "/moved/a.pdf");
    expect(mockInvoke).toHaveBeenCalledWith("library_relocate_document", {
      id: "doc-1",
      newFilePath: "/moved/a.pdf",
    });
  });

  it("libraryHealDocument → library_heal_document", async () => {
    await api.libraryHealDocument("doc-1");
    expect(mockInvoke).toHaveBeenCalledWith("library_heal_document", {
      id: "doc-1",
    });
  });

  it("libraryRemoveDocument → library_remove_document", async () => {
    await api.libraryRemoveDocument("doc-1");
    expect(mockInvoke).toHaveBeenCalledWith("library_remove_document", {
      id: "doc-1",
    });
  });

  it("libraryOpenDocument → library_open_document", async () => {
    await api.libraryOpenDocument("doc-1");
    expect(mockInvoke).toHaveBeenCalledWith("library_open_document", {
      id: "doc-1",
    });
  });

  it("libraryCheckFileExists → library_check_file_exists", async () => {
    await api.libraryCheckFileExists("doc-1");
    expect(mockInvoke).toHaveBeenCalledWith("library_check_file_exists", {
      id: "doc-1",
    });
  });
});
