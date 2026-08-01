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
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

/**
 * Walk up from the working directory to the repo root, i.e. the directory
 * holding `sonar-project.properties`. `import.meta.url` is not usable here:
 * under the jsdom environment it is not a `file:` URL, so `fileURLToPath`
 * throws and `new URL('.', import.meta.url).pathname` yields a URL path rather
 * than a filesystem one. Walking up also survives being run from a
 * subdirectory, which a bare cwd-relative read does not.
 */
function readPropertiesFile(): string {
  let directory = resolve(process.cwd());

  for (;;) {
    const candidate = join(directory, "sonar-project.properties");
    if (existsSync(candidate)) {
      return readFileSync(candidate, "utf8");
    }

    const parent = dirname(directory);
    if (parent === directory) {
      throw new Error(
        `no sonar-project.properties in or above ${process.cwd()}`,
      );
    }
    directory = parent;
  }
}

const PROPERTIES = readPropertiesFile();

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
