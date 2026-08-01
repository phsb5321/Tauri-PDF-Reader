/**
 * Tauri command contract tests.
 *
 * The `lib/api/*` wrappers are one-liners, which is exactly why they are worth
 * pinning: nothing else in the build checks them. A typo in a command name or
 * an argument key is invisible to `tsc` — `invoke` takes a bare string and a
 * loose record — and only surfaces at runtime as a rejected promise from the
 * Rust side.
 *
 * Two things are asserted per wrapper:
 *
 * 1. It calls `invoke` with the command name and argument shape the backend
 *    expects. Tauri v2 converts camelCase keys to snake_case on the way in, so
 *    the JS-side casing is part of the contract, not a style choice.
 * 2. That command name is actually registered in `generate_handler!`. This is
 *    the half that catches drift after a Rust rename.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({ invoke }));

import {
  collectionsAddDocument,
  collectionsCreate,
  collectionsDelete,
  collectionsList,
  collectionsListMemberships,
  collectionsRemoveDocument,
  collectionsRename,
} from "../../lib/api/collections";
import {
  libraryAddDocument,
  libraryCheckFileExists,
  libraryGetDocument,
  libraryGetDocumentByPath,
  libraryHealDocument,
  libraryListDocuments,
  libraryOpenDocument,
  libraryRelocateDocument,
  libraryRemoveDocument,
  libraryUpdateDocument,
  libraryUpdateProgress,
  libraryUpdateTitle,
} from "../../lib/api/library";

/** [label, call, expected command, expected args]. */
const CONTRACTS: ReadonlyArray<
  readonly [string, () => Promise<unknown>, string, unknown]
> = [
  // Shelves — added by the shelves migration, the newest surface here.
  [
    "collectionsCreate",
    () => collectionsCreate("Philosophy"),
    "collections_create",
    { name: "Philosophy" },
  ],
  ["collectionsList", () => collectionsList(), "collections_list", undefined],
  [
    "collectionsRename",
    () => collectionsRename("c1", "Reread"),
    "collections_rename",
    { id: "c1", name: "Reread" },
  ],
  [
    "collectionsDelete",
    () => collectionsDelete("c1"),
    "collections_delete",
    { id: "c1" },
  ],
  [
    "collectionsAddDocument",
    () => collectionsAddDocument("c1", "d1"),
    "collections_add_document",
    { collectionId: "c1", documentId: "d1" },
  ],
  [
    "collectionsRemoveDocument",
    () => collectionsRemoveDocument("c1", "d1"),
    "collections_remove_document",
    { collectionId: "c1", documentId: "d1" },
  ],
  [
    "collectionsListMemberships",
    () => collectionsListMemberships(),
    "collections_list_memberships",
    undefined,
  ],

  // Library.
  [
    "libraryAddDocument",
    () => libraryAddDocument("/books/one.pdf", "One", 100),
    "library_add_document",
    { filePath: "/books/one.pdf", title: "One", pageCount: 100 },
  ],
  [
    "libraryGetDocument",
    () => libraryGetDocument("d1"),
    "library_get_document",
    { id: "d1" },
  ],
  [
    "libraryGetDocumentByPath",
    () => libraryGetDocumentByPath("/books/one.pdf"),
    "library_get_document_by_path",
    { filePath: "/books/one.pdf" },
  ],
  [
    "libraryListDocuments",
    () => libraryListDocuments(),
    "library_list_documents",
    // The default matters: the library opens on most-recently-read.
    { orderBy: "last_opened", limit: undefined, offset: undefined },
  ],
  [
    "libraryUpdateProgress",
    () => libraryUpdateProgress("d1", 42, 0.5, "chunk-3"),
    "library_update_progress",
    {
      id: "d1",
      currentPage: 42,
      scrollPosition: 0.5,
      lastTtsChunkId: "chunk-3",
    },
  ],
  [
    "libraryUpdateDocument",
    () => libraryUpdateDocument("d1", { title: "One", fileHash: "abc" }),
    "library_update_document",
    { id: "d1", title: "One", fileHash: "abc" },
  ],
  [
    "libraryUpdateTitle",
    () => libraryUpdateTitle("d1", "One"),
    "library_update_title",
    { id: "d1", title: "One" },
  ],
  [
    "libraryRelocateDocument",
    () => libraryRelocateDocument("d1", "/books/moved.pdf"),
    "library_relocate_document",
    { id: "d1", newFilePath: "/books/moved.pdf" },
  ],
  [
    "libraryHealDocument",
    () => libraryHealDocument("d1"),
    "library_heal_document",
    { id: "d1" },
  ],
  [
    "libraryRemoveDocument",
    () => libraryRemoveDocument("d1"),
    "library_remove_document",
    { id: "d1" },
  ],
  [
    "libraryOpenDocument",
    () => libraryOpenDocument("d1"),
    "library_open_document",
    { id: "d1" },
  ],
  [
    "libraryCheckFileExists",
    () => libraryCheckFileExists("d1"),
    "library_check_file_exists",
    { id: "d1" },
  ],
];

describe("Tauri command contracts", () => {
  beforeEach(() => {
    invoke.mockReset();
    invoke.mockResolvedValue(undefined);
  });

  it.each(CONTRACTS)(
    "%s invokes its command with the agreed arguments",
    async (_label, call, command, args) => {
      await call();

      expect(invoke).toHaveBeenCalledTimes(1);
      if (args === undefined) {
        expect(invoke).toHaveBeenCalledWith(command);
      } else {
        expect(invoke).toHaveBeenCalledWith(command, args);
      }
    },
  );

  it("passes the backend result straight through", async () => {
    const document = { id: "d1", filePath: "/books/one.pdf" };
    invoke.mockResolvedValue(document);

    await expect(libraryHealDocument("d1")).resolves.toBe(document);
  });

  it("every invoked command is registered in generate_handler!", () => {
    // Resolved from cwd (the vitest root), not `import.meta.url`: under
    // jsdom a relative URL that climbs out of the vite root comes back as
    // http://localhost:3000/... and readFileSync rejects the scheme. Sibling
    // suites get away with import.meta.url because their paths stay in src/.
    const lib = readFileSync(
      resolve(process.cwd(), "src-tauri/src/lib.rs"),
      "utf8",
    );
    const handler = /generate_handler!\[([\s\S]*?)\]/.exec(lib);
    expect(handler).not.toBeNull();

    // Strip comments so a command named inside one cannot vouch for itself.
    const registered = new Set(
      (handler?.[1] ?? "")
        .replace(/\/\/[^\n]*/g, "")
        .split(/[\s,]+/)
        .filter((token) => /^[a-z][a-z0-9_]*$/.test(token)),
    );

    const missing = CONTRACTS.map(([, , command]) => command).filter(
      (command) => !registered.has(command),
    );
    expect(missing).toEqual([]);
  });
});
