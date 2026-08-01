/**
 * Shelves api wire-contract tests.
 *
 * Same shape as `ai-tts.test.ts`: every wrapper in `lib/api/collections.ts`
 * asserts the exact Tauri command name and argument keys it dispatches, via
 * the repo's IPC mock (`mockInvoke` in tests/setup).
 *
 * The wrappers are one-liners, so the only thing that can be wrong in them is
 * the wire itself — a renamed Rust command, or an argument key that is
 * `collection_id` on one side and `collectionId` on the other. Neither is a
 * type error, so nothing else in the suite catches it; it surfaces as a
 * runtime IPC rejection with the shelf silently not filed.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { mockInvoke } from "../../../tests/setup";
import * as api from "./collections";

beforeEach(() => {
  mockInvoke.mockResolvedValue(undefined);
});

describe("collections api → invoke wire contract", () => {
  it("collectionsCreate → collections_create", async () => {
    await api.collectionsCreate("Unfiled reading");
    expect(mockInvoke).toHaveBeenCalledWith("collections_create", {
      name: "Unfiled reading",
    });
  });

  it("collectionsList → collections_list", async () => {
    await api.collectionsList();
    expect(mockInvoke).toHaveBeenCalledWith("collections_list");
  });

  it("collectionsRename → collections_rename", async () => {
    await api.collectionsRename("shelf-1", "Renamed");
    expect(mockInvoke).toHaveBeenCalledWith("collections_rename", {
      id: "shelf-1",
      name: "Renamed",
    });
  });

  it("collectionsDelete → collections_delete", async () => {
    await api.collectionsDelete("shelf-1");
    expect(mockInvoke).toHaveBeenCalledWith("collections_delete", {
      id: "shelf-1",
    });
  });

  it("collectionsAddDocument → collections_add_document", async () => {
    await api.collectionsAddDocument("shelf-1", "doc-9");
    expect(mockInvoke).toHaveBeenCalledWith("collections_add_document", {
      collectionId: "shelf-1",
      documentId: "doc-9",
    });
  });

  it("collectionsRemoveDocument → collections_remove_document", async () => {
    await api.collectionsRemoveDocument("shelf-1", "doc-9");
    expect(mockInvoke).toHaveBeenCalledWith("collections_remove_document", {
      collectionId: "shelf-1",
      documentId: "doc-9",
    });
  });

  it("collectionsListMemberships → collections_list_memberships", async () => {
    await api.collectionsListMemberships();
    expect(mockInvoke).toHaveBeenCalledWith("collections_list_memberships");
  });

  it("passes the backend's value back to the caller unchanged", async () => {
    const shelf = {
      id: "shelf-1",
      name: "Unfiled reading",
      documentCount: 3,
      createdAt: "2026-08-01T00:00:00Z",
      updatedAt: "2026-08-01T00:00:00Z",
    };
    mockInvoke.mockResolvedValue(shelf);

    await expect(api.collectionsCreate("Unfiled reading")).resolves.toBe(shelf);
  });
});
