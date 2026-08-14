#!/usr/bin/env node
/**
 * check-packaged-gate-contract.mjs — the REAL-YAML-parser gate contract for
 * the packaged-user-gate workflow candidate.
 *
 * Replaces the grep-based checker: a text matcher cannot enforce YAML
 * semantics (flow mappings, explicit keys, escaped keys, block-scalar keys,
 * anchors/aliases all spell the same object differently). This checker
 * parses the workflow with the `yaml` package (explicit devDependency,
 * lockfile-pinned 2.9.0) and asserts on the PARSED OBJECT.
 *
 * Fail-CLOSED: an unreadable file, an unparseable file, or a multi-document
 * file exits non-zero with a distinct message. Anchors/aliases are resolved
 * (bounded) — an aliased pin is the same pin.
 *
 * Usage: node tools/check-packaged-gate-contract.mjs [workflow.yml]
 *        (default: tools/test/fixtures/packaged-user-gate.yml)
 * Exit: 0 = contract holds · 1 = violation · 2 = tooling/parse failure
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const YAML = require("yaml");

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_WF = path.join(
  SCRIPT_DIR,
  "..",
  "tools",
  "test",
  "fixtures",
  "packaged-user-gate.yml",
);
const WF = process.argv[2] || DEFAULT_WF;

let status = 0;
const fail = (msg) => {
  console.error(`CONTRACT VIOLATION: ${msg}`);
  status = 1;
};

// ── Fail-closed loading ─────────────────────────────────────────────────────
let source;
try {
  source = readFileSync(WF, "utf8");
} catch (e) {
  console.error(`CONTRACT VIOLATION: workflow file unreadable: ${WF} (${e.message})`);
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
const doc = docs[0];
if (doc.errors && doc.errors.length > 0) {
  console.error(`CONTRACT VIOLATION: workflow unparseable: ${doc.errors[0].message}`);
  process.exit(2);
}
// M1: anchors/aliases/merge keys are REJECTED BY PRESENCE — GitHub really
// executes them, so the contract must not claim fail-closed by expanding
// them. A manual AST walk (the visit() Pair callback resolves values and
// hides the pair keys) inspects every pair key and node property.
const hasForbiddenYaml = (node) => {
  if (!node || typeof node !== "object") return false;
  if (node.anchor || node.type === "ALIAS" || node.type === "MERGE_KEY") return true;
  if (node.items && Array.isArray(node.items)) {
    for (const it of node.items) {
      if (!it || typeof it !== "object") continue;
      if (it.key && (it.key.value === "<<" || it.key.type === "MERGE_KEY")) return true;
      if (hasForbiddenYaml(it.key)) return true;
      if (hasForbiddenYaml(it.value)) return true;
      // Sequence items that are not pairs: the item node itself is the child.
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
  // Bounded alias expansion: the workflow is tiny; a pathological alias bomb
  // fails closed below the cap.
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

// ── Concurrency ──────────────────────────────────────────────────────────────
if (!wf.concurrency || wf.concurrency.group !== "packaged-user-gate")
  fail("concurrency group is not the fixed runner-wide packaged-user-gate");

// ── M2: workflow-level permissions must be exactly contents: read ───────────
const PERMS = JSON.stringify(wf.permissions || null);
if (PERMS !== JSON.stringify({ contents: "read" }))
  fail("permissions must be exactly contents: read");

// ── Jobs: closed canonical set ───────────────────────────────────────────────
if (!wf.jobs || typeof wf.jobs !== "object")
  fail("jobs section missing or not a mapping");
else {
  const expected = ["contract", "full-matrix", "pr-fast", "real-corpus"];
  const actual = Object.keys(wf.jobs).sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected))
    fail(
      `unexpected self-hosted job set (${actual.join(" ")}) — only contract pr-fast full-matrix real-corpus are permitted`,
    );
}

const CANONICAL_IF = {
  contract:
    "github.event_name != 'pull_request' || github.event.pull_request.head.repo.full_name == github.repository",
  "full-matrix": "github.event_name != 'pull_request'",
  "pr-fast":
    "github.event_name == 'pull_request' && github.event.pull_request.head.repo.full_name == github.repository",
  "real-corpus": "github.event_name == 'workflow_dispatch'",
};
const USES_RE = /^[\w.-]+\/[\w.-]+(\/[^@]+)?@[0-9a-f]{40}$/;
// Exact approved lane command text: after normalizing only trailing
// whitespace, the run line must BE the approved command — no suffix, no
// prefix, no operators (`bash … || true` would turn a failed lane green).
const LANE_EXACT = {
  "pr-fast": (line) => line === "bash e2e/run-critical-loop.sh",
  "full-matrix": (line) => line === "bash scripts/e2e-matrix.sh",
  "real-corpus": (line) =>
    /^LECTRICE_CORPUS_OUT="[^"]*" bash scripts\/e2e-real-corpus\.sh$/.test(line),
};
const RECEIPT_STEP = "Prerequisite receipt enforced";

for (const jobName of Object.keys(CANONICAL_IF)) {
  const job = wf.jobs[jobName];
  if (!job || typeof job !== "object")
    fail(`${jobName} job missing from the workflow`);
  else {
    // Exact canonical condition (a missing or skip-capable variant fails).
    // B2: every lane job must gate on the contract job.
    if (jobName !== "contract") {
      const needsOk =
        job.needs === "contract" ||
        (Array.isArray(job.needs) && job.needs.includes("contract"));
      if (!needsOk)
        fail(`${jobName} job does not require needs: contract — a failing base contract must gate every lane job`);
    }

    // M2: runs-on must be the exact vm103 label set.
    if (JSON.stringify(job["runs-on"] || null) !== JSON.stringify(["self-hosted", "Linux", "X64", "vm103"]))
      fail(`${jobName} runs-on is not the exact vm103 label set [self-hosted, Linux, X64, vm103]`);

    // BLOCKER: job-level continue-on-error is rejected (same class as the
    // step-level skip-green).
    if (job["continue-on-error"])
      fail("continue-on-error found (skip-green)");

    // BLOCKER: a job-local permissions block overrides the global one.
    if (job.permissions !== undefined)
      fail("job-level permissions are not permitted — the global permissions must be exactly contents: read");

    if (job.if === undefined) {
      if (jobName === "pr-fast")
        fail("pr-fast job-level if: is not the PR trigger + same-repo guard — the gate can be skipped or fork-executed");
      else
        fail(`${jobName} job has no job-level if — it runs on every event including fork PRs`);
    } else if (job.if !== CANONICAL_IF[jobName]) {
      if (jobName === "pr-fast")
        fail(
          "pr-fast job-level if: is not the PR trigger + same-repo guard — the gate can be skipped or fork-executed",
        );
      else if (jobName === "contract")
        fail("contract job-level if: is not the exact canonical guard");
      else if (jobName === "full-matrix")
        fail("full-matrix job-level if: is not the exact canonical condition");
      else fail("real-corpus job-level if: is not exactly the workflow_dispatch trigger");
    }

    const steps = Array.isArray(job.steps) ? job.steps : [];
    const runs = steps
      .filter((s) => s && typeof s.run === "string")
      .map((s) => s.run);

    if (jobName !== "contract") {
      // Driver prerequisite: the pinned devShell must be asserted in a run.
      if (
        !runs.some(
          (r) => r.includes("nix develop") && r.includes("command -v tauri-driver"),
        )
      )
        fail("driver assert does not check command -v tauri-driver inside nix develop");

      // Prerequisite receipts: the enforcement step must exist, be
      // failure-gated, and test the receipt's presence.
      const enf = steps.find((s) => s && typeof s.name === "string" && s.name.startsWith(RECEIPT_STEP));
      if (!enf)
        fail(`${jobName} job lacks the prerequisite-receipt enforcement step`);
      else {
        if (enf.if !== "failure()")
          fail(`${jobName} enforcement step is not failure-gated`);
        if (typeof enf.run !== "string" || !enf.run.includes("ci-evidence/prerequisite-failure.json"))
          fail(`${jobName} enforcement step does not test the receipt's presence`);
      }

      // Lane invocations: found in the PARSED run text (any YAML spelling of
      // the run block is normalized by the parser).
      if (LANE_EXACT[jobName]) {
        const hit = runs.some((r) =>
          r.split("\n").some((line) => LANE_EXACT[jobName](line.trimEnd())),
        );
        if (!hit) {
          if (jobName === "pr-fast")
            fail("pr-fast job does not run e2e/run-critical-loop.sh");
          else if (jobName === "full-matrix")
            fail("full-matrix job does not run scripts/e2e-matrix.sh");
          else fail("real-corpus job does not run scripts/e2e-real-corpus.sh");
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
    }

    // B1: step-level if is only permitted on the receipt-enforcement,
    // evidence-copy and upload steps — a step-level `if: false` on the lane
    // or a driver assertion would skip the gate silently.
    const IF_ALLOWED_NAME = "Prerequisite receipt enforced";
    for (const s of steps) {
      if (!s || s.if === undefined) continue;
      const name = typeof s.name === "string" ? s.name : "";
      const isEnforcement = name.startsWith(IF_ALLOWED_NAME);
      const isCopy = name.startsWith("Copy ") && name.includes("evidence");
      const isUpload =
        typeof s.uses === "string" && s.uses.includes("upload-artifact");
      if (!(isEnforcement || isCopy || isUpload))
        fail(`step-level if: not permitted on step "${name}" — only the receipt-enforcement, evidence-copy and upload steps may be conditionally gated`);
    }

    // Every step.uses must be a pinned SHA (any YAML key/value spelling
    // normalizes to the same parsed value).
    for (const s of steps) {
      if (s && typeof s.uses === "string" && !USES_RE.test(s.uses))
        fail(
          `mutable action ref found — every uses: must be owner/repo(/path)?@<40 lowercase hex> (got: ${s.uses})`,
        );
      if (s && (s["continue-on-error"] || s.continueOnError))
        fail("continue-on-error found (skip-green)");
    }
  }
}

// ── Contract job specifics (trusted base + bootstrap-inert) ─────────────────
const contract = wf.jobs.contract;
const cRuns = (Array.isArray(contract.steps) ? contract.steps : [])
  .filter((s) => s && typeof s.run === "string")
  .map((s) => s.run);
if (!cRuns.some((r) => r.includes("BOOTSTRAP-INERT")))
  fail("contract job lacks the bootstrap-inert anchor check");
if (!cRuns.some((r) => r.includes("contents/.github/workflows/packaged-user-gate.yml")))
  fail("contract job does not fetch the head workflow file via the API");
if (!cRuns.some((r) => r.includes("gh api")))
  fail("contract job does not use gh api to fetch the head file");
const checkoutRef = (Array.isArray(contract.steps) ? contract.steps : [])
  .filter((s) => s && typeof s.uses === "string" && s.uses.includes("actions/checkout"))
  .map((s) => (s.with && s.with.ref) || "")
  .join(" ");
if (!checkoutRef.includes("pull_request.base.sha"))
  fail("contract job does not pin its checkout to the base sha");

process.exit(status);
