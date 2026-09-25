/**
 * Unit tests for the user-visible message boundary (issue #294).
 *
 * `friendlyError` is the single strip point every error message crosses on
 * its way to `setError`, `onError`, or a status banner. Internal machine
 * codes (`HASH_MISMATCH`, `SESSION_RESTORE_FAILED`, …) are control-flow
 * signals and must never reach a rendered string.
 */

import { describe, expect, it } from "vitest";
import { friendlyError } from "./user-message";

describe("friendlyError (user-visible message boundary)", () => {
  it("passes already-friendly strings through unchanged", () => {
    expect(friendlyError("The book could not be opened.")).toBe(
      "The book could not be opened.",
    );
  });

  it("strips one leading internal code", () => {
    expect(
      friendlyError(
        "SESSION_RESTORE_FAILED: The reading session could not be restored.",
      ),
    ).toBe("The reading session could not be restored.");
  });

  it("strips NESTED leading codes until the friendly remainder (m-1)", () => {
    expect(
      friendlyError("HTTP_ERROR: API_ERROR: The backend refused the request."),
    ).toBe("The backend refused the request.");
  });

  it("strips digit-bearing codes (GROQ_HTTP_429-class)", () => {
    expect(
      friendlyError("GROQ_HTTP_429: The provider rate limit was reached."),
    ).toBe("The provider rate limit was reached.");
    expect(friendlyError("OPEN_2_BUSY: try again")).toBe("try again");
  });

  it("an all-code message degrades to the original rather than an empty string", () => {
    expect(friendlyError("DROP_INVALID:")).toBe("DROP_INVALID:");
  });

  it("does not strip codes that appear mid-message", () => {
    expect(friendlyError("The backend said DROP_INVALID: retry.")).toBe(
      "The backend said DROP_INVALID: retry.",
    );
  });
});
