#!/usr/bin/env node
/**
 * check-packaged-gate-contract.mjs — the REAL-YAML-parser contract for the
 * packaged-user-gate EXECUTION workflow candidate.
 *
 * Architecture (3-stage): the candidate execution workflow (only the lane
 * jobs — pr-fast/full-matrix/real-corpus) is validated by the BASE-OWNED
 * trust anchor (packaged-gate-trust-anchor.yml), which runs on
 * pull_request_target with BASE tools and fetches the candidate file as
 * DATA. This checker is the anchor's enforcement: parse with `yaml`
 * (explicit devDependency, lockfile-pinned), fail-closed on unreadable /
 * unparseable / multi-document files, reject anchors/aliases/merge keys by
 * presence, assert the specific semantic invariants, and LAST require deep
 * structural equality of the whole candidate object against the canonical
 * execution fixture.
 *
 * Usage: node tools/check-packaged-gate-contract.mjs [workflow.yml]
 * Exit: 0 = contract holds · 1 = violation · 2 = tooling/parse failure
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const YAML = require("yaml");

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const CANONICAL = path.join(SCRIPT_DIR, "test", "fixtures", "packaged-user-gate.yml");
const WF = process.argv[2] || CANONICAL;

let status = 0;
const fail = (msg) => {
  console.error(`CONTRACT VIOLATION: ${msg}`);
  status = 1;
};

// ── Fail-closed loading ─────────────────────────────────────────────────────
function loadWorkflow(file) {
  let source;
  try {
    source = readFileSync(file, "utf8");
  } catch (e) {
    console.error(`CONTRACT VIOLATION: workflow file unreadable: ${file} (${e.message})`);
    process.exit(2);
  }
  let docs;
  try {
    docs = YAML.parseAllDocuments(source);
  } catch (e) {
    console.error(`CONTRACT VIOLATION: workflow unparseable: ${e.message}`);
    process.exit(2);
  }
  if (docs.length !== 1) {
    console.error(
      `CONTRACT VIOLATION: expected exactly one YAML document, found ${docs.length} (multi-document workflows are rejected)`,
    );
    process.exit(2);
  }
  const d = docs[0];
  if (d.errors && d.errors.length > 0) {
    console.error(`CONTRACT VIOLATION: workflow unparseable: ${d.errors[0].message}`);
    process.exit(2);
  }
  return d;
}
const doc = loadWorkflow(WF);

// M1: anchors/aliases/merge keys are REJECTED BY PRESENCE — GitHub really
// executes them. A manual AST walk (the visit() Pair callback resolves
// values and hides the pair keys) inspects every pair key and node property.
const hasForbiddenYaml = (node) => {
  if (!node || typeof node !== "object") return false;
  if (node.anchor || node.type === "ALIAS" || node.type === "MERGE_KEY") return true;
  if (node.items && Array.isArray(node.items)) {
    for (const it of node.items) {
      if (!it || typeof it !== "object") continue;
      if (it.key && (it.key.value === "<<" || it.key.type === "MERGE_KEY")) return true;
      if (hasForbiddenYaml(it.key)) return true;
      if (hasForbiddenYaml(it.value)) return true;
      if (it.key === undefined && it.value === undefined) {
        if (hasForbiddenYaml(it)) return true;
      }
    }
    return false;
  }
  return false;
};
if (hasForbiddenYaml(doc.contents))
  fail("YAML anchors/aliases/merge keys are not permitted — GitHub executes them; presence is rejected, not expanded");

let wf;
try {
  wf = doc.toJS({ maxAliasCount: 100 });
} catch (e) {
  console.error(`CONTRACT VIOLATION: alias expansion failed: ${e.message}`);
  process.exit(2);
}
if (wf === null || typeof wf !== "object" || Array.isArray(wf)) {
  console.error("CONTRACT VIOLATION: workflow root is not a mapping");
  process.exit(2);
}

// ── Triggers ─────────────────────────────────────────────────────────────────
if (!wf.on || typeof wf.on !== "object") fail("no on: triggers");
else {
  if (!("pull_request" in wf.on)) fail("no pull_request trigger");
  if (wf.on.pull_request && Array.isArray(wf.on.pull_request.paths))
    fail("pull_request is path-filtered — the gate can be silently skipped");
  if (!("workflow_dispatch" in wf.on))
    fail("no manual dispatch for the full matrix");
  if (!("schedule" in wf.on) || !Array.isArray(wf.on.schedule) || wf.on.schedule.length === 0)
    fail("no nightly schedule for the full matrix");
}

// ── Concurrency / permissions / env / defaults (workflow level) ──────────────
if (!wf.concurrency || wf.concurrency.group !== "packaged-user-gate")
  fail("concurrency group is not the fixed runner-wide packaged-user-gate");

if (JSON.stringify(wf.permissions || null) !== JSON.stringify({ contents: "read" }))
  fail("permissions must be exactly contents: read");

if (
  JSON.stringify(wf.env || null) !==
  JSON.stringify({ CARGO_TERM_COLOR: "always", RUST_BACKTRACE: "1", CI: "true" })
)
  fail("workflow env is not the exact pinned map (CARGO_TERM_COLOR=always, RUST_BACKTRACE=1, CI=true)");

if (wf.defaults !== undefined)
  fail("workflow-level defaults are not permitted — the fixture owns the default shell");

// ── Jobs: closed canonical set (execution jobs only) ─────────────────────────
if (!wf.jobs || typeof wf.jobs !== "object")
  fail("jobs section missing or not a mapping");
else {
  const expected = ["full-matrix", "pr-fast", "real-corpus"];
  const actual = Object.keys(wf.jobs).sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected))
    fail(
      `unexpected self-hosted job set (${actual.join(" ")}) — only pr-fast full-matrix real-corpus are permitted`,
    );
}

const CANONICAL_IF = {
  "full-matrix": "github.event_name != 'pull_request'",
  "pr-fast":
    "github.event_name == 'pull_request' && github.event.pull_request.head.repo.full_name == github.repository",
  "real-corpus": "github.event_name == 'workflow_dispatch'",
};
const USES_RE = /^[\w.-]+\/[\w.-]+(\/[^@]+)?@[0-9a-f]{40}$/;
const RECEIPT_STEP = "Prerequisite receipt enforced";
const LANE_STEP = {
  "pr-fast": {
    name: "Packaged PR-fast lane",
    run: (r) => r === "bash e2e/run-critical-loop.sh",
    canonical: "bash e2e/run-critical-loop.sh",
  },
  "full-matrix": {
    name: "Run all packaged lanes",
    run: (r) => r === "bash scripts/e2e-matrix.sh",
    canonical: "bash scripts/e2e-matrix.sh",
  },
  "real-corpus": {
    name: "Run the real-corpus soak",
    run: (r) =>
      /^LECTRICE_CORPUS_OUT="[^"]*" bash scripts\/e2e-real-corpus\.sh$/.test(r),
    canonical: 'LECTRICE_CORPUS_OUT="$RUNNER_TEMP/lectrice-corpus" bash scripts/e2e-real-corpus.sh',
  },
};

for (const jobName of Object.keys(CANONICAL_IF)) {
  const job = wf.jobs[jobName];
  if (!job || typeof job !== "object")
    fail(`${jobName} job missing from the workflow`);
  else {
    // Exact canonical condition (a missing or skip-capable variant fails).
    if (job.if === undefined) {
      if (jobName === "pr-fast")
        fail("pr-fast job-level if: is not the PR trigger + same-repo guard — the gate can be skipped or fork-executed");
      else
        fail(`${jobName} job has no job-level if — it runs on every event including fork PRs`);
    } else if (job.if !== CANONICAL_IF[jobName]) {
      if (jobName === "pr-fast")
        fail("pr-fast job-level if: is not the PR trigger + same-repo guard — the gate can be skipped or fork-executed");
      else if (jobName === "full-matrix")
        fail("full-matrix job-level if: is not the exact canonical condition");
      else fail("real-corpus job-level if: is not exactly the workflow_dispatch trigger");
    }

    // M2: runs-on must be the exact vm103 label set.
    if (JSON.stringify(job["runs-on"] || null) !== JSON.stringify(["self-hosted", "Linux", "X64", "vm103"]))
      fail(`${jobName} runs-on is not the exact vm103 label set [self-hosted, Linux, X64, vm103]`);

    // Banned job-level keys (BASH_ENV/PATH injection + override classes).
    if (job["continue-on-error"])
      fail("continue-on-error found (skip-green)");
    if (job.permissions !== undefined)
      fail("job-level permissions are not permitted — the global permissions must be exactly contents: read");
    if (job.defaults !== undefined)
      fail("job-level defaults are not permitted — the fixture owns the default shell");
    if (job.env !== undefined)
      fail("job-level env is not permitted — BASH_ENV/PATH injection class");

    const steps = Array.isArray(job.steps) ? job.steps : [];
    const runs = steps
      .filter((s) => s && typeof s.run === "string")
      .map((s) => s.run);

    // Driver prerequisite: the pinned devShell must be asserted in a run.
    if (
      !runs.some(
        (r) => r.includes("nix develop") && r.includes("command -v tauri-driver"),
      )
    )
      fail("driver assert does not check command -v tauri-driver inside nix develop");

    // Prerequisite receipts: the enforcement step must exist, be
    // failure-gated, and test the receipt's presence.
    const enf = steps.find(
      (s) => s && typeof s.name === "string" && s.name.startsWith(RECEIPT_STEP),
    );
    if (!enf)
      fail(`${jobName} job lacks the prerequisite-receipt enforcement step`);
    else {
      if (enf.if !== "failure()")
        fail(`${jobName} enforcement step is not failure-gated`);
      if (typeof enf.run !== "string" || !enf.run.includes("ci-evidence/prerequisite-failure.json"))
        fail(`${jobName} enforcement step does not test the receipt's presence`);
    }

    // Lane invocation: the REQUIRED NAMED step's COMPLETE run must equal the
    // single canonical command (one trailing newline normalized).
    if (LANE_STEP[jobName]) {
      const spec = LANE_STEP[jobName];
      const laneStep = steps.find(
        (st) => st && typeof st.name === "string" && st.name.startsWith(spec.name),
      );
      if (!laneStep)
        fail(`${jobName} job lacks the required lane step "${spec.name}"`);
      else {
        if (laneStep.shell !== undefined)
          fail(`${jobName} lane step shell override is not permitted — the fixture owns the default shell`);
        const run = typeof laneStep.run === "string" ? laneStep.run.replace(/\n$/, "") : "";
        if (!spec.run(run))
          fail(`${jobName} lane step run is not the exact canonical command (${spec.canonical})`);
      }
    }

    // Failure/always evidence uploads.
    if (jobName === "real-corpus") {
      const up = steps.find((s) => s && typeof s.uses === "string" && s.uses.includes("upload-artifact"));
      if (!up) fail("real-corpus job has no evidence upload");
      else if (up.if !== "always()")
        fail("real-corpus evidence upload is not if: always() — a BLOCKED receipt would never upload");
    } else {
      const ups = steps.filter((s) => s && typeof s.uses === "string" && s.uses.includes("upload-artifact"));
      if (ups.length === 0) fail("no failure-artifact upload");
      else if (!ups.some((u) => u.if === "failure()"))
        fail("artifact upload not gated on failure");
    }

    // Step-level closure: no env anywhere, no continue-on-error, no
    // step-level if except the enforcement/copy/upload allowlist, SHA-only
    // uses.
    const IF_ALLOWED_NAME = "Prerequisite receipt enforced";
    for (const s of steps) {
      if (!s) continue;
      if (s.env !== undefined)
        fail(`step-level env is not permitted on step "${typeof s.name === "string" ? s.name : ""}" — BASH_ENV/PATH injection class`);
      if (s["continue-on-error"] || s.continueOnError)
        fail("continue-on-error found (skip-green)");
      if (typeof s.uses === "string" && !USES_RE.test(s.uses))
        fail(
          `mutable action ref found — every uses: must be owner/repo(/path)?@<40 lowercase hex> (got: ${s.uses})`,
        );
      if (s.if !== undefined) {
        const name = typeof s.name === "string" ? s.name : "";
        const isEnforcement = name.startsWith(IF_ALLOWED_NAME);
        const isCopy = name.startsWith("Copy ") && name.includes("evidence");
        const isUpload = typeof s.uses === "string" && s.uses.includes("upload-artifact");
        if (!(isEnforcement || isCopy || isUpload))
          fail(`step-level if: not permitted on step "${name}" — only the receipt-enforcement, evidence-copy and upload steps may be conditionally gated`);
      }
    }
  }
}

// ── EXHAUSTIVE CLOSURE: deep structural equality against the BASE-OWNED
// canonical execution fixture (resolved relative to THIS checker, never the
// candidate or workspace cwd). Extra steps, command suffixes, token-bearing
// modifications, env overrides and any unknown nested key all fail here.
const canonicalDoc = loadWorkflow(CANONICAL);
const deepEqual = (a, b) => {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== typeof b) return false;
  if (Array.isArray(a) || Array.isArray(b))
    return (
      Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((x, i) => deepEqual(x, b[i]))
    );
  if (typeof a === "object") {
    const ka = Object.keys(a);
    const kb = Object.keys(b);
    return (
      ka.length === kb.length &&
      ka.every((k) => kb.includes(k) && deepEqual(a[k], b[k]))
    );
  }
  return false;
};
if (!deepEqual(wf, canonicalDoc.toJS({ maxAliasCount: 100 })))
  fail(
    "candidate workflow is not deep-structural-equal to the canonical execution fixture — extra steps, command suffixes, token-bearing modifications and unknown fields are rejected",
  );

process.exit(status);
