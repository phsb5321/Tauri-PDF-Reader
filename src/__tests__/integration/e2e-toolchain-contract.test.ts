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
 *  3. the flake devShell must declare every executable the lanes call;
 *  4. process observers must use the same app path as Cargo/WebdriverIO when
 *     CI redirects CARGO_TARGET_DIR.
 */

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "../../..");

const LANES = [
  "e2e/run-critical-loop.sh",
  "scripts/e2e-home.sh",
  "scripts/e2e-native.sh",
  "e2e/run-open-journey.sh",
  "e2e/run-session-journey.sh",
  "e2e/run-reader-journey.sh",
  "e2e/run-highlight-journey.sh",
  "e2e/run-close-journey.sh",
];
const APP_OBSERVERS = [
  "e2e/run-close-journey.sh",
  "e2e/close-journey.e2e.mjs",
  "e2e/real-corpus.e2e.mjs",
];
const TOOLCHAIN = join(REPO_ROOT, "scripts/e2e-toolchain.sh");
const PROFILE = join(REPO_ROOT, "scripts/e2e-profile.sh");
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

  it("the shared profile stays under the cross-shell Linux temp root", () => {
    expect(readFileSync(PROFILE, "utf8")).toContain(
      "mktemp -d /tmp/lectrice-e2e-profile.XXXXXX",
    );
  });

  it("the shared toolchain entry point uses the flake and exports Cargo's app path", () => {
    const toolchain = readFileSync(TOOLCHAIN, "utf8");
    expect(toolchain).toMatch(/nix\s+develop/);
    expect(toolchain).not.toMatch(/nix-shell\s+-p/);
    expect(toolchain).toContain("E2E_APP_PATH");
    expect(toolchain).toContain("CARGO_TARGET_DIR");
    expect(toolchain).toContain("--option min-free 0");
    expect(toolchain).toContain("--option max-free 0");
  });

  it("every process observer follows the shared app path", () => {
    for (const observer of APP_OBSERVERS) {
      const src = readFileSync(join(REPO_ROOT, observer), "utf8");
      expect(src, `${observer} must follow Cargo's app path`).toContain(
        "E2E_APP_PATH",
      );
    }
  });

  it("the flake devShell declares every package the lanes need", () => {
    const flake = readFileSync(FLAKE, "utf8");
    // Deleting any executable used by a lane must fail here and, via the
    // shared entry point, in the packaged matrix.
    for (const pkg of [
      "perl",
      "speechd",
      "xvfb",
      "sqlite",
      "xdotool",
      "dragon-drop",
      "pnpm_10",
    ]) {
      expect(flake, `flake.nix devShell must declare ${pkg}`).toContain(pkg);
    }
  });
});
