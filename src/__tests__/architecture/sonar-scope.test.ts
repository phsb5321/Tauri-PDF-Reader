/**
 * Architecture Test: Sonar main/test scope disjointness
 *
 * SonarQube aborts the entire scan the first time one path is reachable as both
 * a main file and a test file:
 *
 *   ERROR File src/__tests__/fixtures/kokoro-af-heart-single-chunk.json can't be
 *   indexed twice. Please check that inclusion/exclusion patterns produce
 *   disjoint sets for main and test files
 *   INFO  EXECUTION FAILURE
 *
 * `sonar.tests` is nested inside `sonar.sources`, so every file under the test
 * root is a candidate. That overlap was survivable only by accident — each file
 * there happened to be named `*.test.ts(x)`, which `sonar.exclusions` already
 * drops from the main set — until PR #48 added two JSON fixtures.
 *
 * So this asserts the structural property rather than the accident: where one
 * root nests inside the other, the nested subtree must be excluded from the
 * enclosing set. The next helper, setup file or fixture added under it then
 * cannot resurrect the abort.
 *
 * It lives in vitest rather than in the scan because `sonar.yml` runs on `main`
 * ONLY, by design (SonarQube Community analyses a single branch, so a
 * pull_request run would overwrite the dashboard instead of gating the PR).
 * Nothing about the failure is visible from a PR, which is why it rode along
 * under six consecutive merges before anyone looked.
 *
 * Two shapes it deliberately refuses to judge rather than wave through: glob
 * roots and identical roots. Both are legal for the scanner and neither is
 * decidable by prefix comparison, so each throws with the reason.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Anchored to this file rather than to `process.cwd()`, so it does not care
 * where vitest was started from.
 *
 * Deliberately NOT the `readFileSync(new URL(path, import.meta.url))` spelling
 * used in `src/__tests__/ui/native-html-semantics.test.ts`. That idiom is fine
 * there and broken here, for a reason worth writing down: **Vite rewrites
 * `new URL(<string literal>, import.meta.url)`** as an asset reference. With a
 * literal path it returns `http://localhost:3000/sonar-project.properties` and
 * `readFileSync` rejects it — `The URL must be of scheme file`. The same path
 * held in a `const` is not transformed and resolves to a real `file:` URL. The
 * neighbouring test survives only because its paths come out of an array, so
 * "copy how that file does it" quietly turns red the moment the path is
 * inlined. `fileURLToPath` has no such special case.
 */
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");

const PROPERTIES = readFileSync(
  join(REPO_ROOT, "sonar-project.properties"),
  "utf8",
);

/**
 * Read `key=a,b,c` as a trimmed list, taking the LAST assignment. A duplicate
 * key is a config bug in its own right, but reading the last one means a stale
 * duplicate cannot hide behind an earlier correct line.
 *
 * Absent keys throw unless a fallback is given, so a renamed property fails the
 * test rather than quietly reducing it to a no-op.
 */
function readListProperty(name: string, fallback?: string[]): string[] {
  const line = PROPERTIES.split("\n")
    .filter((candidate) => candidate.trimStart().startsWith(`${name}=`))
    .at(-1);

  if (line === undefined) {
    if (fallback !== undefined) {
      return fallback;
    }
    throw new Error(`sonar-project.properties declares no ${name}`);
  }

  return line
    .slice(line.indexOf("=") + 1)
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

/** Wildcard syntax that makes a root a pattern rather than a directory. */
const GLOB_SYNTAX = /[*?[\]]/;

describe("Sonar analysis scope", () => {
  it("keeps the main and test file sets disjoint", () => {
    const sources = readListProperty("sonar.sources");
    const tests = readListProperty("sonar.tests");
    const mainExclusions = readListProperty("sonar.exclusions", []);
    const testExclusions = readListProperty("sonar.test.exclusions", []);

    for (const root of [...sources, ...tests]) {
      // Overlap is decided below by directory-prefix comparison. A glob root
      // would need real pattern matching, so refuse it instead of passing it.
      expect(
        GLOB_SYNTAX.test(root),
        `${root} is a pattern, not a directory root — this guard compares directory prefixes and cannot judge it`,
      ).toBe(false);
    }

    for (const testRoot of tests) {
      for (const sourceRoot of sources) {
        // Identical roots are legal — SonarQube's own Example 2 sets
        // sonar.sources and sonar.tests to the same directory — but they are
        // split by sonar.test.inclusions, not by excluding the root, which
        // would empty the main set. Not modelled here.
        expect(
          testRoot === sourceRoot,
          `sonar.sources and sonar.tests are both ${testRoot}; identical roots are split by inclusion patterns — extend this guard before adopting that shape`,
        ).toBe(false);

        if (testRoot.startsWith(`${sourceRoot}/`)) {
          expect(mainExclusions).toContain(`${testRoot}/**`);
        }

        // The mirror image: a source root nested inside a test root indexes the
        // same files twice just as readily, and is cleared from the other side.
        if (sourceRoot.startsWith(`${testRoot}/`)) {
          expect(testExclusions).toContain(`${sourceRoot}/**`);
        }
      }
    }
  });
});
