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
 * So this asserts the structural property rather than the accident: a nested
 * test root must be excluded from the main set wholesale. The next helper,
 * setup file or fixture added under it then cannot resurrect the abort.
 *
 * It lives in vitest rather than in the scan because `sonar.yml` runs on `main`
 * ONLY, by design (SonarQube Community analyses a single branch, so a
 * pull_request run would overwrite the dashboard instead of gating the PR).
 * Nothing about the failure is visible from a PR, which is why it rode along
 * under four consecutive merges before anyone looked.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

// Relative to the vitest root, matching how the archunit rules in this folder
// address the tree. `import.meta.url` is not usable here: under the jsdom
// environment it is not a `file:` URL, so `fileURLToPath` throws on import.
const PROPERTIES_PATH = "sonar-project.properties";

/** Read one `key=a,b,c` line as a trimmed list. Throws if the key is absent. */
function readListProperty(name: string): string[] {
  const line = readFileSync(PROPERTIES_PATH, "utf8")
    .split("\n")
    .find((candidate) => candidate.trimStart().startsWith(`${name}=`));

  if (line === undefined) {
    throw new Error(`sonar-project.properties declares no ${name}`);
  }

  return line
    .slice(line.indexOf("=") + 1)
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

describe("Sonar analysis scope", () => {
  it("excludes every nested test root from the main file set", () => {
    const sources = readListProperty("sonar.sources");
    const tests = readListProperty("sonar.tests");
    const exclusions = readListProperty("sonar.exclusions");

    const nested = tests.filter((testRoot) =>
      sources.some(
        (sourceRoot) =>
          testRoot === sourceRoot || testRoot.startsWith(`${sourceRoot}/`),
      ),
    );

    // Nothing nested means nothing to index twice — but the repo does nest, and
    // an empty list here would silently pass, so pin the premise.
    expect(nested).not.toHaveLength(0);

    for (const testRoot of nested) {
      expect(exclusions).toContain(`${testRoot}/**`);
    }
  });
});
