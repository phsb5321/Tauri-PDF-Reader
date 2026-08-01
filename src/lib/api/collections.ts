/**
 * Shelves API
 *
 * Tauri commands for filing library documents under named shelves.
 */

import { invoke } from "@tauri-apps/api/core";
import type { Collection, CollectionMembership } from "../schemas";

export async function collectionsCreate(name: string): Promise<Collection> {
  return invoke("collections_create", { name });
}

export async function collectionsList(): Promise<Collection[]> {
  return invoke("collections_list");
}

export async function collectionsRename(
  id: string,
  name: string,
): Promise<Collection> {
  return invoke("collections_rename", { id, name });
}

export async function collectionsDelete(id: string): Promise<void> {
  return invoke("collections_delete", { id });
}

export async function collectionsAddDocument(
  collectionId: string,
  documentId: string,
): Promise<void> {
  return invoke("collections_add_document", { collectionId, documentId });
}

export async function collectionsRemoveDocument(
  collectionId: string,
  documentId: string,
): Promise<void> {
  return invoke("collections_remove_document", { collectionId, documentId });
}

export async function collectionsListMemberships(): Promise<
  CollectionMembership[]
> {
  return invoke("collections_list_memberships");
}
