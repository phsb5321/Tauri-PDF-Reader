/**
 * M2.6 precondition (slice 101): e2e toolchain provisioning must live in
 * exactly ONE pinned place — the flake devShell — so no lane silently falls
 * back to a hand-maintained package list.
 *
 * Falsifier, machine-checked (the lane-level falsifier — delete a package
 * from the flake and a lane fails — is enforced here structurally, because
 * running a lane in CI costs a cargo build):
 *
 *  1. no `NIX_PKGS` literal may survive in any lane script (a hand-maintained
 *     list is the failure mode — the comment asking to keep it "aligned" with
 *     flake.nix is the bug report);
 *  2. every lane must source the ONE shared toolchain entry point
 *     (`scripts/e2e-toolchain.sh`), which must invoke `nix develop` (the
 *     flake) and never `nix-shell -p <list>`;
 *  3. the flake devShell must declare the packages the lanes need that it
 *     previously lacked (perl, speechd, xvfb) — deleting any of them from the
 *     flake turns this RED.
 */

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "../../..");

const LANES = [
  "scripts/e2e-all.sh",
  "scripts/e2e-home.sh",
  "scripts/e2e-native.sh",
];
const TOOLCHAIN = join(REPO_ROOT, "scripts/e2e-toolchain.sh");
const FLAKE = join(REPO_ROOT, "flake.nix");

describe("e2e toolchain provisioning (101)", () => {
  it("no lane carries its own package list or nix-shell invocation", () => {
    for (const lane of LANES) {
      const src = readFileSync(join(REPO_ROOT, lane), "utf8");
      expect(
        src,
        `${lane} must not carry a NIX_PKGS literal — the flake is the one source`,
      ).not.toContain("NIX_PKGS");
      expect(
        src,
        `${lane} must not invoke nix-shell -p with a package list`,
      ).not.toMatch(/nix-shell\s+-p/);
      expect(
        src,
        `${lane} must route through the shared toolchain entry point`,
      ).toContain("scripts/e2e-toolchain.sh");
    }
  });

  it("the shared toolchain entry point uses the flake devShell, never a list", () => {
    const toolchain = readFileSync(TOOLCHAIN, "utf8");
    expect(toolchain).toMatch(/nix\s+develop/);
    expect(toolchain).not.toMatch(/nix-shell\s+-p/);
  });

  it("the flake devShell declares every package the lanes need", () => {
    const flake = readFileSync(FLAKE, "utf8");
    // The three packages the lanes' hand-maintained list had that the flake
    // lacked — deleting any of them here must fail this test (and, via the
    // shared entry point, every lane).
    for (const pkg of ["perl", "speechd", "xvfb", "pnpm_10"]) {
      expect(flake, `flake.nix devShell must declare ${pkg}`).toContain(pkg);
    }
  });
});
