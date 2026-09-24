/**
 * Open-lease unit tests (issues #185/#294 fix round).
 *
 * The lease is the shared open mutex with latest-wins semantics: acquiring
 * one while another is held SUPERSEDES the older lease, and supersession is
 * a MONOTONIC fact — it survives release — because a lease released by its
 * owner before its logical transaction ends must still report superseded,
 * or a superseded transaction would commit over the winner (B-1).
 */

import { beforeEach, describe, expect, it } from "vitest";
import {
  beginOpenTransaction,
  useDocumentStore,
} from "../../stores/document-store";

describe("beginOpenTransaction lease (issue #185/#294)", () => {
  beforeEach(() => {
    useDocumentStore.getState().reset();
  });

  it("isSuperseded is monotonic: a superseded lease stays superseded after release", () => {
    const first = beginOpenTransaction();
    const second = beginOpenTransaction();

    expect(first.isSuperseded()).toBe(true);
    expect(second.isSuperseded()).toBe(false);
    expect(useDocumentStore.getState().isLoading).toBe(true);

    // The stale lease releases its slot (so the counter can never strand
    // the busy flag) but must NOT become "not superseded" again.
    first.release();
    expect(first.isSuperseded()).toBe(true);
    expect(useDocumentStore.getState().isLoading).toBe(true); // successor still live

    second.release();
    expect(useDocumentStore.getState().isLoading).toBe(false);
  });

  it("release is idempotent — each lease releases exactly one slot", () => {
    const lease = beginOpenTransaction();
    lease.release();
    lease.release(); // no-op
    expect(useDocumentStore.getState().isLoading).toBe(false);
  });
});
