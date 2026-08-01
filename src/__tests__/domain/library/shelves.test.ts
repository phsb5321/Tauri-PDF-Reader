import { describe, it, expect } from "vitest";
import {
  ALL_DOCUMENTS,
  UNFILED,
  documentsOnShelf,
  shelvesForDocument,
  unfiledDocuments,
  type Membership,
} from "../../../domain/library/shelves";

const docs = [{ id: "a" }, { id: "b" }, { id: "c" }];

const memberships: Membership[] = [
  { documentId: "a", collectionId: "philosophy" },
  { documentId: "b", collectionId: "philosophy" },
  { documentId: "a", collectionId: "reread" },
];

describe("documentsOnShelf", () => {
  it("returns the whole library when no shelf is selected", () => {
    expect(documentsOnShelf(docs, memberships, ALL_DOCUMENTS)).toEqual(docs);
  });

  it("keeps only the documents filed on the shelf", () => {
    expect(documentsOnShelf(docs, memberships, "philosophy")).toEqual([
      { id: "a" },
      { id: "b" },
    ]);
  });

  it("preserves the order it was given, not the membership order", () => {
    const reversed = [{ id: "b" }, { id: "a" }];

    expect(documentsOnShelf(reversed, memberships, "philosophy")).toEqual([
      { id: "b" },
      { id: "a" },
    ]);
  });

  it("is empty for a shelf nothing is filed on", () => {
    expect(documentsOnShelf(docs, memberships, "empty")).toEqual([]);
  });

  it("shows what is on no shelf when the unfiled pseudo-shelf is selected", () => {
    expect(documentsOnShelf(docs, memberships, UNFILED)).toEqual([{ id: "c" }]);
  });

  it("treats the unfiled sentinel as a shelf nothing can be filed under", () => {
    // A real shelf id is a UUID, so a membership can never name the sentinel.
    // If one somehow did, it must not smuggle a filed document into the
    // unfiled view.
    const smuggled: Membership[] = [
      ...memberships,
      { documentId: "a", collectionId: UNFILED },
    ];

    expect(documentsOnShelf(docs, smuggled, UNFILED)).toEqual([{ id: "c" }]);
  });

  it("does not mutate the library it was given", () => {
    const input = [...docs];

    documentsOnShelf(input, memberships, ALL_DOCUMENTS).push({ id: "d" });

    expect(input).toEqual(docs);
  });
});

describe("shelvesForDocument", () => {
  it("finds every shelf a document sits on", () => {
    expect(shelvesForDocument(memberships, "a")).toEqual(
      new Set(["philosophy", "reread"]),
    );
  });

  it("is empty for a document on no shelf", () => {
    expect(shelvesForDocument(memberships, "c")).toEqual(new Set());
  });
});

describe("unfiledDocuments", () => {
  it("finds the documents on no shelf at all", () => {
    expect(unfiledDocuments(docs, memberships)).toEqual([{ id: "c" }]);
  });

  it("is the whole library when nothing has been filed", () => {
    expect(unfiledDocuments(docs, [])).toEqual(docs);
  });
});
