/**
 * Runner contract for the packaged cover journey (slice 121, Codex gate).
 *
 * The shell NC the gate demanded: the runner must be PROVABLY non-zero when
 * the first phase fails, must never mutate the profile/cache in that case,
 * and must gate cache corruption on a complete two-cover cache. The lane
 * itself cannot run in CI (WebKitGTK + display), so this test pins the
 * runner's control-flow shape statically — a regression that reintroduces
 * the masked-exit or mutate-on-failure bug turns this RED.
 */

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const RUNNER = join(HERE, "../../../e2e/run-cover-journey.sh");

const runner = readFileSync(RUNNER, "utf8");

describe("cover journey runner contract (121)", () => {
  it("exits with the first-phase status BEFORE any cache mutation on failure", () => {
    // The early-exit guard must precede the source deletion, and the phase-1
    // status must be the exit code — never a masked 0 (the Codex gate's
    // root cause: toolchain_exec exec'ing and normalizing the status).
    const guardIdx = runner.indexOf('exit "$FIRST_STATUS"');
    const deleteIdx = runner.indexOf("e2e-resume-fixture-a.pdf");
    expect(guardIdx, "early-exit guard must exist").toBeGreaterThan(-1);
    expect(
      deleteIdx,
      "the guard must come BEFORE the source deletion",
    ).toBeGreaterThan(guardIdx);
  });

  it("captures the toolchain status outside the exec and exits with it", () => {
    expect(runner).toMatch(/toolchain_run/);
    expect(runner).toMatch(/TOOLCHAIN_STATUS=\$\?/);
    expect(runner).toMatch(/exit "\$TOOLCHAIN_STATUS"/);
    // No exec: the status must be observable by the runner's own shell.
    expect(runner).not.toMatch(/toolchain_exec/);
  });

  it("gates cache corruption on exactly two cached covers", () => {
    expect(runner).toMatch(/COVER_COUNT=\$\(ls "\$COVERS_DIR" 2>\/dev\/null \| grep -c -- "-v1\.png" \|\| true\)/);
    expect(runner).toMatch(/if \[ "\$COVER_COUNT" -eq 2 \]/);
    // The skipped-corruption path must be visible to the verify spec.
    expect(runner).toMatch(/echo "==> observer: WARNING expected 2 cached covers/);
  });
});
