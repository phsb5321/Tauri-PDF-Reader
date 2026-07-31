/**
 * Shelf membership rules.
 *
 * Pure functions over the membership list. The whole list is small enough to
 * hold in memory, which is what lets the shelf filter and the per-document
 * picker answer without a round trip.
 *
 * Structural input types rather than the `lib` schemas: the domain layer may
 * not import from `lib`, and these rules only ever need an id pair.
 */

export interface Membership {
  documentId: string;
  collectionId: string;
}

export interface Shelf {
  id: string;
  name: string;
}

/** Shown when no shelf is selected: every document in the library. */
export const ALL_DOCUMENTS = null;

/**
 * Pseudo-shelf holding whatever is on no shelf at all.
 *
 * Leading NUL so it can never collide with a real shelf id, which is a UUID.
 */
export const UNFILED = "\0unfiled";

/**
 * The documents filed on `shelfId`, in the order they were given.
 *
 * A null shelf means no filter, so the library is returned whole — the caller
 * does not special-case "all documents".
 */
export function documentsOnShelf<T extends { id: string }>(
  documents: readonly T[],
  memberships: readonly Membership[],
  shelfId: string | null,
): T[] {
  if (shelfId === ALL_DOCUMENTS) return [...documents];
  if (shelfId === UNFILED) return unfiledDocuments(documents, memberships);

  const filed = new Set(
    memberships
      .filter((m) => m.collectionId === shelfId)
      .map((m) => m.documentId),
  );

  return documents.filter((doc) => filed.has(doc.id));
}

/** The shelf ids a document is filed under. */
export function shelvesForDocument(
  memberships: readonly Membership[],
  documentId: string,
): Set<string> {
  return new Set(
    memberships
      .filter((m) => m.documentId === documentId)
      .map((m) => m.collectionId),
  );
}

/**
 * Documents in the library that are on no shelf at all.
 *
 * Unfiled books are the ones organising is for, so they need to stay findable
 * once shelves exist — otherwise a shelf view hides them and nothing shows
 * what is left to file.
 */
export function unfiledDocuments<T extends { id: string }>(
  documents: readonly T[],
  memberships: readonly Membership[],
): T[] {
  const filed = new Set(memberships.map((m) => m.documentId));
  return documents.filter((doc) => !filed.has(doc.id));
}
