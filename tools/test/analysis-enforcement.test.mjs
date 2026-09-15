import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const root =
  process.env.ANALYSIS_SUBJECT_ROOT ||
  fileURLToPath(new URL("../../", import.meta.url));
const coverage = JSON.parse(
  readFileSync(join(root, "package.json"), "utf8"),
).scripts["test:coverage:check"];
const bash = execFileSync("bash", ["-c", "command -v bash"], {
  encoding: "utf8",
}).trim();

for (const status of [0, 17, "missing"]) {
  test(`coverage propagates analyzer status ${status}`, () => {
    const dir = mkdtempSync(join(tmpdir(), "lectrice-analysis-"));
    const calls = join(dir, "calls");
    try {
      // ponytail: test shell exit propagation, not filesystem shim discovery.
      // Explicitly empty PATH prevents a missing fake from invoking real Vitest.
      const fake =
        status === "missing"
          ? ""
          : 'vitest() { printf "%s\\n" "$*" > "$CALLS"; return "$STATUS"; };';
      const result = spawnSync(
        bash,
        ["--noprofile", "--norc", "-c", `PATH=; export PATH; ${fake}\n${coverage}`],
        {
          cwd: dir,
          env: { HOME: dir, TMPDIR: dir, CALLS: calls, STATUS: String(status) },
          encoding: "utf8",
          timeout: 5000,
        },
      );
      assert.ifError(result.error);
      assert.equal(result.signal, null);
      assert.equal(
        result.status,
        status === "missing" ? 127 : status,
        JSON.stringify({ bash, stderr: result.stderr, stdout: result.stdout }),
      );
      assert.equal(
        coverage,
        "vitest run --coverage --coverage.thresholds.100",
      );
      if (status !== "missing") {
        assert.equal(
          readFileSync(calls, "utf8").trim(),
          "run --coverage --coverage.thresholds.100",
        );
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
}
