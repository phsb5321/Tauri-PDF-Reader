/**
 * The packaged debug app rewrites `src/lib/bindings.ts` at startup using
 * BINDINGS_PATH = "../src/lib/bindings.ts", resolved against the PROCESS CWD
 * (src-tauri/src/lib.rs, debug_assertions branch). tauri-driver launches the
 * app from ITS OWN cwd, so wdio.conf.mjs must spawn tauri-driver with
 * `cwd: <repo>/src-tauri` — the same cwd `cargo run` uses — or every packaged
 * debug lane panics at boot with "Failed to export TypeScript bindings:
 * Io(Os { code: 2, kind: NotFound })" (the path resolves outside the repo).
 *
 * This source-pin keeps the spawn contract honest: remove the cwd option and
 * this test goes RED. The behavioral half is the lane itself — the panic is
 * the falsifying evidence, observed on 13/08/2026 in the delete-journey seed
 * phase (log: delete-journey-8848fc3.log).
 */

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "../../..");
const WDIO_CONF = join(REPO_ROOT, "wdio.conf.mjs");

describe("wdio spawn-cwd contract (tauri-driver must launch from src-tauri)", () => {
  it("spawns tauri-driver with cwd resolved to src-tauri", () => {
    const src = readFileSync(WDIO_CONF, "utf8");
    const onPrepare = src.slice(src.indexOf("onPrepare:"));
    expect(onPrepare).toContain('cwd: path.resolve(__dirname, "src-tauri")');
  });
});
