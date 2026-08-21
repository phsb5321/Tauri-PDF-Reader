/**
 * M2.4 — the verify receipt: a machine-readable record of what ran, against
 * which commit, and what each gate said.
 *
 * The trap this test exists to catch: a receipt that only exists after a
 * successful run cannot record failure. The falsifier is two-sided:
 *
 *  - force a gate to fail and assert the receipt records THAT gate as failed
 *    (a receipt that says "passed" on a failed run is the defect);
 *  - the DEFAULT gate list (no override) must also emit on failure — proven
 *    by shadowing `pnpm` with a failing stub, so the first gate dies fast.
 *
 * The gate-list override (`VERIFY_GATES`) is a documented test/CI seam in
 * verify.sh; it replaces the gate list, it never weakens a gate.
 */

import { execFileSync } from "node:child_process";
import { readFileSync, mkdtempSync, writeFileSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "../../..");
const VERIFY = join(REPO_ROOT, "scripts/verify.sh");

function runVerify(env: Record<string, string>): { status: number } {
  try {
    execFileSync("bash", [VERIFY], {
      cwd: REPO_ROOT,
      env: {
        ...process.env,
        // Receipt tests exercise verify.sh, not durable seat discovery inherited
        // from the self-hosted runner. Policy behavior has its own falsifiers.
        PI_SESSION_ID: "",
        PI_AGENT_NAME: "",
        ...env,
      },
      stdio: "pipe",
      timeout: 60_000,
    });
    return { status: 0 };
  } catch (error) {
    const status = (error as { status?: number }).status;
    if (status === undefined) throw error;
    return { status };
  }
}

describe("the verify receipt (M2.4)", () => {
  it("records the failing gate when a gate fails", () => {
    const receipt = join(
      mkdtempSync(join(tmpdir(), "verify-receipt-")),
      "r.json",
    );

    const { status } = runVerify({
      VERIFY_GATES: "typecheck|false",
      VERIFY_RECEIPT_PATH: receipt,
    });
    expect(status).toBe(1);

    const json = JSON.parse(readFileSync(receipt, "utf8"));
    expect(json.status).toBe("failed");
    expect(json.failedGate).toBe("typecheck");
    expect(json.commit).toMatch(/^[0-9a-f]{7,40}$/);
    expect(json.timestamp).toBeTruthy();
    expect(json.gates).toContainEqual({
      gate: "typecheck",
      status: "fail",
    });
  });

  it("emits a passing receipt when every gate passes", () => {
    const receipt = join(
      mkdtempSync(join(tmpdir(), "verify-receipt-")),
      "r.json",
    );

    const { status } = runVerify({
      VERIFY_GATES: "typecheck|true\nlint|true",
      VERIFY_RECEIPT_PATH: receipt,
    });
    expect(status).toBe(0);

    const json = JSON.parse(readFileSync(receipt, "utf8"));
    expect(json.status).toBe("passed");
    expect(json.failedGate).toBeUndefined();
    expect(json.gates).toEqual([
      { gate: "typecheck", status: "pass" },
      { gate: "lint", status: "pass" },
    ]);
  });

  it("records failure on the default gate list too (a failed pnpm is a failed gate)", () => {
    // Shadow `pnpm` with a stub that always fails: the default list's first
    // gate ("dependencies") dies instantly — no cargo, no minutes. This is
    // the case that would have shipped a success-only receipt.
    const fakeBin = mkdtempSync(join(tmpdir(), "verify-fakebin-"));
    writeFileSync(join(fakeBin, "pnpm"), "#!/bin/sh\nexit 1\n");
    chmodSync(join(fakeBin, "pnpm"), 0o755);

    const receipt = join(
      mkdtempSync(join(tmpdir(), "verify-receipt-")),
      "r.json",
    );

    const { status } = runVerify({
      VERIFY_RECEIPT_PATH: receipt,
      PATH: `${fakeBin}:${process.env.PATH ?? ""}`,
    });
    expect(status).toBe(1);

    const json = JSON.parse(readFileSync(receipt, "utf8"));
    expect(json.status).toBe("failed");
    expect(json.failedGate).toBe("dependencies");
  });
});
