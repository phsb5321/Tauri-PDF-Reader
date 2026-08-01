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
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
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

// Held in a const rather than written inline as `new URL("../…",
// import.meta.url)`: Vite rewrites that literal form into an asset reference,
// so it resolves to http://localhost:3000/… and readFileSync rejects the
// scheme. `import.meta.url` itself is a perfectly good file: URL under jsdom.
const LIB_RS = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../src-tauri/src/lib.rs",
);

/** Every command name registered in `generate_handler!`. */
function registeredCommands(): ReadonlySet<string> {
  // Comments go first, for two reasons: a command named inside one must not
  // vouch for itself, and a `]` inside one would throw off the depth scan.
  const code = readFileSync(LIB_RS, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");

  const open = code.indexOf("generate_handler![");
  expect(open).toBeGreaterThan(-1);

  // Depth scan, not `/generate_handler!\[([\s\S]*?)\]/`. The macro body holds
  // `#[cfg(feature = "native-tts")]` attributes and the non-greedy form stops
  // at the first of them — measured, it captured 45 of the 91 registered
  // commands and silently ignored everything after that line.
  const body = open + "generate_handler![".length;
  let depth = 1;
  let i = body;
  for (; i < code.length && depth > 0; i++) {
    if (code[i] === "[") depth++;
    else if (code[i] === "]") depth--;
  }
  expect(depth).toBe(0);

  return new Set(
    code
      .slice(body, i - 1)
      .split(/[\s,]+/)
      .filter((token) => /^[a-z][a-z0-9_]*$/.test(token)),
  );
}

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
    const registered = registeredCommands();

    // A command declared after the first `#[cfg(...)]` block. Asserting it
    // here is what keeps the extractor honest: a truncating parser still finds
    // all nineteen contracts below, because they happen to sit in the prefix
    // before that attribute. This one does not.
    expect(registered.has("audio_export_cancel")).toBe(true);

    const missing = CONTRACTS.map(([, , command]) => command).filter(
      (command) => !registered.has(command),
    );
    expect(missing).toEqual([]);
  });
});
