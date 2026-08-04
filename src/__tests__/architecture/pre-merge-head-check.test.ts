/**
 * The merge guard has to fail closed, so its comparison is asserted here rather
 * than trusted.
 *
 * Scar it encodes (PR #72, 04/08/2026): a PR merged at a remote head one commit
 * behind the branch tip. The checks were green — against the older commit. The
 * repair in the tip was dropped and unreferenced by the branch delete.
 *
 * Only the pure `--compare` path is exercised: it is the whole decision, and it
 * needs neither `gh`, a network, nor a repository.
 */

import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// NB: held in a const. Vite rewrites `new URL("<literal>", import.meta.url)`
// into an asset reference that resolves to an http:// URL.
const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(HERE, "../../../scripts/pre-merge-head-check.sh");

const AHEAD = "2264163debf87db81f5f849be2eff2a622ec24e5";
const BEHIND = "5c9155ac7d7e9a6c140c34b560d2c10b38d27fbd";

/** Runs the guard and returns its exit code, never throwing on refusal. */
function runCompare(a: string, b: string): { code: number; stderr: string } {
  try {
    execFileSync(SCRIPT, ["--compare", a, b], { encoding: "utf8" });
    return { code: 0, stderr: "" };
  } catch (error) {
    const err = error as { status?: number; stderr?: string };
    return { code: err.status ?? -1, stderr: err.stderr ?? "" };
  }
}

describe("pre-merge head guard", () => {
  it("allows a merge when the PR head is the branch tip", () => {
    expect(runCompare(AHEAD, AHEAD).code).toBe(0);
  });

  it("refuses the exact PR #72 shape: local tip ahead of the PR head", () => {
    const { code, stderr } = runCompare(AHEAD, BEHIND);

    expect(code).toBe(1);
    expect(stderr).toContain("REFUSING");
    // The operator has to be able to see WHICH commit was about to be dropped.
    expect(stderr).toContain(AHEAD);
    expect(stderr).toContain(BEHIND);
  });

  it("refuses rather than passes when a head cannot be determined", () => {
    // An empty head is the fail-open trap: a `gh` call that returns nothing
    // must not read as "the heads match".
    expect(runCompare(AHEAD, "").code).toBe(2);
    expect(runCompare("", BEHIND).code).toBe(2);
  });
});
