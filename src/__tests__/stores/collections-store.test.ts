/**
 * Tests for useCollectionsStore.
 *
 * Verifies:
 * - Shelves and memberships load together, so counts and filters agree
 * - Every mutation reloads, so the shelf counts the backend computes are the
 *   ones on screen
 * - A failed call surfaces its message instead of leaving the view blank
 * - Deleting the selected shelf falls back to the whole library
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { useCollectionsStore } from "../../stores/collections-store";
import * as api from "../../lib/api";
import type { Collection } from "../../lib/schemas";

vi.mock("../../lib/api", () => ({
  collectionsList: vi.fn(),
  collectionsListMemberships: vi.fn(),
  collectionsCreate: vi.fn(),
  collectionsRename: vi.fn(),
  collectionsDelete: vi.fn(),
  collectionsAddDocument: vi.fn(),
  collectionsRemoveDocument: vi.fn(),
}));

const mocked = vi.mocked(api);

const philosophy: Collection = {
  id: "shelf-philosophy",
  name: "Philosophy",
  documentCount: 1,
  createdAt: "2026-07-01T00:00:00Z",
  updatedAt: "2026-07-01T00:00:00Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  useCollectionsStore.getState().reset();
  mocked.collectionsList.mockResolvedValue([philosophy]);
  mocked.collectionsListMemberships.mockResolvedValue([
    { documentId: "doc-1", collectionId: "shelf-philosophy" },
  ]);
});

describe("useCollectionsStore", () => {
  it("starts on the whole library with nothing loaded", () => {
    const state = useCollectionsStore.getState();

    expect(state.shelves).toEqual([]);
    expect(state.memberships).toEqual([]);
    expect(state.selectedShelfId).toBeNull();
    expect(state.error).toBeNull();
  });

  it("loads shelves and memberships together", async () => {
    await useCollectionsStore.getState().loadShelves();

    const state = useCollectionsStore.getState();
    expect(state.shelves).toEqual([philosophy]);
    expect(state.memberships).toHaveLength(1);
    expect(state.isLoading).toBe(false);
  });

  it("surfaces a load failure instead of spinning forever", async () => {
    mocked.collectionsList.mockRejectedValue(new Error("database is locked"));

    await useCollectionsStore.getState().loadShelves();

    const state = useCollectionsStore.getState();
    expect(state.error).toBe("database is locked");
    expect(state.isLoading).toBe(false);
  });

  it("keeps the Tauri message when a call rejects with a bare string", async () => {
    // Tauri IPC rejects with a plain string, not an Error.
    mocked.collectionsList.mockRejectedValue("DATABASE_ERROR: disk I/O error");

    await useCollectionsStore.getState().loadShelves();

    expect(useCollectionsStore.getState().error).toBe(
      "DATABASE_ERROR: disk I/O error",
    );
  });

  it("falls back to a readable message rather than showing the word undefined", async () => {
    // `String(undefined)` is "undefined" — truthy, so a `|| fallback` never
    // fires and the user reads a word where a reason should be.
    mocked.collectionsList.mockRejectedValue(undefined);

    await useCollectionsStore.getState().loadShelves();

    const shown = useCollectionsStore.getState().error;
    expect(shown).not.toBe("undefined");
    expect(shown).toBeTruthy();
  });

  it("reloads after creating a shelf so its count is the backend's", async () => {
    mocked.collectionsCreate.mockResolvedValue(philosophy);

    await useCollectionsStore.getState().createShelf("Philosophy");

    expect(mocked.collectionsCreate).toHaveBeenCalledWith("Philosophy");
    expect(mocked.collectionsList).toHaveBeenCalledTimes(1);
    expect(useCollectionsStore.getState().shelves).toEqual([philosophy]);
  });

  it("reports a duplicate name rather than silently doing nothing", async () => {
    mocked.collectionsCreate.mockRejectedValue(
      new Error("DUPLICATE_NAME: Philosophy"),
    );

    await useCollectionsStore.getState().createShelf("philosophy");

    expect(useCollectionsStore.getState().error).toBe(
      "DUPLICATE_NAME: Philosophy",
    );
    // A failed create must not trigger a reload — nothing changed.
    expect(mocked.collectionsList).not.toHaveBeenCalled();
  });

  it("files a document and reloads", async () => {
    mocked.collectionsAddDocument.mockResolvedValue(undefined);

    await useCollectionsStore
      .getState()
      .fileDocument("shelf-philosophy", "doc-1");

    expect(mocked.collectionsAddDocument).toHaveBeenCalledWith(
      "shelf-philosophy",
      "doc-1",
    );
    expect(mocked.collectionsListMemberships).toHaveBeenCalledTimes(1);
  });

  it("unfiles a document and reloads", async () => {
    mocked.collectionsRemoveDocument.mockResolvedValue(undefined);

    await useCollectionsStore
      .getState()
      .unfileDocument("shelf-philosophy", "doc-1");

    expect(mocked.collectionsRemoveDocument).toHaveBeenCalledWith(
      "shelf-philosophy",
      "doc-1",
    );
    expect(mocked.collectionsListMemberships).toHaveBeenCalledTimes(1);
  });

  it("falls back to the whole library when the selected shelf is deleted", async () => {
    mocked.collectionsDelete.mockResolvedValue(undefined);
    useCollectionsStore.getState().selectShelf("shelf-philosophy");

    await useCollectionsStore.getState().deleteShelf("shelf-philosophy");

    expect(useCollectionsStore.getState().selectedShelfId).toBeNull();
  });

  it("keeps the selection when a different shelf is deleted", async () => {
    mocked.collectionsDelete.mockResolvedValue(undefined);
    useCollectionsStore.getState().selectShelf("shelf-philosophy");

    await useCollectionsStore.getState().deleteShelf("shelf-reread");

    expect(useCollectionsStore.getState().selectedShelfId).toBe(
      "shelf-philosophy",
    );
  });

  it("renames a shelf and reloads", async () => {
    mocked.collectionsRename.mockResolvedValue({
      ...philosophy,
      name: "Ethics",
    });

    await useCollectionsStore
      .getState()
      .renameShelf("shelf-philosophy", "Ethics");

    expect(mocked.collectionsRename).toHaveBeenCalledWith(
      "shelf-philosophy",
      "Ethics",
    );
    expect(mocked.collectionsList).toHaveBeenCalledTimes(1);
  });
});
