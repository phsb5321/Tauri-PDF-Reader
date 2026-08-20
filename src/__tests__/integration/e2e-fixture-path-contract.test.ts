/**
 * The E2E dialog seam hands the BACKEND a fixture path, and the backend
 * resolves it against the APP's process cwd — which wdio.conf.mjs pins to
 * <repo>/src-tauri (see wdio-spawn-cwd-contract.test.ts; src-tauri/src/lib.rs
 * uses the same convention for BINDINGS_PATH = "../src/lib/bindings.ts").
 *
 * Slice 109 wrote the path when tauri-driver still launched from the repo
 * root; PR #124 moved the spawn cwd to src-tauri for the bindings rewrite and
 * silently invalidated it. Nothing caught the regression because the packaged
 * gate did not yet run on main. The result, reproduced 19/08/2026 on both the
 * CI runner and the desktop: every toolbar open fails with "FILE_NOT_FOUND:
 * File does not exist at path", the library never flips to the reader (B1
 * red), and the sticky error banner then blocks the following spec's render
 * ("fixture text never rendered in the text layer") even though that spec
 * loads the PDF over a URL and would otherwise render fine.
 *
 * This test resolves the literal exactly as the app does, so a future cwd or
 * fixture move goes RED here instead of in a 6-minute packaged lane.
 */

import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join, dirname, resolve, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(join(HERE, "../../.."));
/** The cwd wdio.conf.mjs spawns tauri-driver with — the app inherits it. */
const APP_CWD = join(REPO_ROOT, "src-tauri");

/**
 * Every fixture path the bridge hands to the dialog seam — whether written as
 * a literal at the assignment or through a module constant. Paths that come
 * in as a caller argument (the real-corpus book) are the caller's to stage.
 */
function bridgeFixturePaths(): string[] {
  const src = readFileSync(join(REPO_ROOT, "src/e2e-bridge.ts"), "utf8");
  const consts = new Map(
    [...src.matchAll(/const\s+(\w+)\s*=\s*"([^"]+)"/g)].map((m) => [m[1], m[2]]),
  );
  const assigned = [
    ...src.matchAll(/__E2E_DIALOG_FIXTURE__\s*\]?\s*=\s*\n?\s*(["\w][^;\n]*)/g),
  ].map((m) => m[1].trim());

  const paths = assigned
    .map((rhs) => {
      const literal = rhs.match(/^"([^"]+)"/);
      if (literal) return literal[1];
      return consts.get(rhs.replace(/;$/, "")) ?? null;
    })
    .filter((p): p is string => p !== null);

  return [...new Set(paths)];
}

describe("E2E dialog fixture path (resolved the way the backend resolves it)", () => {
  it("finds at least one hardcoded fixture path to check", () => {
    expect(bridgeFixturePaths().length).toBeGreaterThan(0);
  });

  it("resolves against the app cwd to a file that exists", () => {
    for (const p of bridgeFixturePaths()) {
      const resolved = isAbsolute(p) ? p : resolve(APP_CWD, p);
      expect(
        existsSync(resolved),
        `e2e-bridge.ts hands the dialog seam "${p}", which resolves to ` +
          `${resolved} from the app cwd (${APP_CWD}) — no such file, so the ` +
          `backend open fails with FILE_NOT_FOUND`,
      ).toBe(true);
    }
  });
});
