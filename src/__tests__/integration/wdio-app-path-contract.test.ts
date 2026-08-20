/**
 * wdio.conf.mjs must launch the binary cargo actually WROTE, not a guessed
 * path. On the CI runner the lanes set CARGO_TARGET_DIR (scripts/e2e-toolchain.sh
 * redirects nix-devShell artifacts away from the host-toolchain ones), so the
 * debug app lands in $CARGO_TARGET_DIR/debug/tauri-pdf-reader — while the
 * hardcoded "src-tauri/target/debug/..." no longer exists. tauri-driver then
 * fails every session with:
 *
 *   WebDriverError: Failed to connect to browser: Failed to execute child
 *   process ".../src-tauri/target/debug/tauri-pdf-reader" (No such file or
 *   directory)
 *
 * Observed 18/08/2026 on the packaged-user-gate pr-fast lane (run
 * 32167890996): "Spec Files: 0 passed, 1 failed".
 *
 * The config is loaded in a real node subprocess, not via import(): vitest
 * runs modules through Vite, whose loader rewrites a dynamic import into an
 * http request the plain ESM loader rejects. A subprocess also gives each
 * case a clean env, which a cached module graph cannot.
 */

import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(join(HERE, "../../.."));
const CONF_URL = pathToFileURL(join(REPO_ROOT, "wdio.conf.mjs")).href;

/** Read the launched-application capability out of the real config. */
function applicationUnder(env: Record<string, string | undefined>): string {
  const script = `const { config } = await import(${JSON.stringify(CONF_URL)});
process.stdout.write(config.capabilities[0]["tauri:options"].application);`;
  const { CARGO_TARGET_DIR: _drop, ...base } = process.env;
  return execFileSync(process.execPath, ["--input-type=module", "-e", script], {
    cwd: REPO_ROOT,
    env: { ...base, ...env },
    encoding: "utf8",
  });
}

describe("wdio APP-path contract (launch the binary cargo wrote)", () => {
  it("uses the in-workspace target when CARGO_TARGET_DIR is unset", () => {
    expect(applicationUnder({})).toBe(
      join(REPO_ROOT, "src-tauri/target/debug/tauri-pdf-reader"),
    );
  });

  it("follows an absolute CARGO_TARGET_DIR (the CI lane redirect)", () => {
    const dir = "/home/runner/ci-cargo/lectrice/packaged-nix-target";
    expect(applicationUnder({ CARGO_TARGET_DIR: dir })).toBe(
      `${dir}/debug/tauri-pdf-reader`,
    );
  });

  it("resolves a relative CARGO_TARGET_DIR against the repo root, as cargo does", () => {
    expect(applicationUnder({ CARGO_TARGET_DIR: "build-out" })).toBe(
      join(REPO_ROOT, "build-out/debug/tauri-pdf-reader"),
    );
  });
});
