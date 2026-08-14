#!/usr/bin/env node
/* global process, console */
/**
 * check-packaged-gate-trust-anchor.mjs — static validation of the TRUST
 * ANCHOR workflow fixture (tools/test/fixtures/packaged-gate-trust-anchor.yml).
 *
 * The anchor is the trust root: it runs on pull_request_target with BASE
 * tools, checks out the BASE SHA only, fetches the candidate execution
 * workflow at the HEAD sha via the GitHub API AS DATA (never checked out,
 * never executed, no head scripts), and runs the BASE checker against it.
 * A head-controlled workflow cannot modify the anchor (pull_request_target
 * resolves the workflow from the BASE branch), so the anchor's own shape is
 * validated by THIS static checker plus review.
 *
 * Invariants (all explicit):
 *   - triggers: pull_request_target ONLY;
 *   - permissions: exactly contents: read;
 *   - concurrency: the fixed packaged-gate-trust-anchor group;
 *   - exactly ONE job (contract) with the exact same-repo guard;
 *   - checkout pinned to pull_request.base.sha;
 *   - the head file is fetched ONLY via gh api as data (HEAD_SHA via env —
 *     no event-payload shell interpolation, no git fetch of the head);
 *   - the checker + NC run from the BASE checkout against the fetched file;
 *   - every uses: SHA-pinned; no step env beyond the two pinned maps;
 *   - deep structural equality of the whole object to the canonical anchor.
 *
 * Usage: node tools/check-packaged-gate-trust-anchor.mjs [anchor.yml]
 * Exit: 0 = holds · 1 = violation · 2 = tooling/parse failure
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const YAML = require("yaml");

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const CANONICAL = path.join(SCRIPT_DIR, "test", "fixtures", "packaged-gate-trust-anchor.yml");
const WF = process.argv[2] || CANONICAL;

let status = 0;
const fail = (msg) => {
  console.error(`TRUST-ANCHOR VIOLATION: ${msg}`);
  status = 1;
};

function loadWorkflow(file) {
  let source;
  try {
    source = readFileSync(file, "utf8");
  } catch (e) {
    console.error(`TRUST-ANCHOR VIOLATION: anchor file unreadable: ${file} (${e.message})`);
    process.exit(2);
  }
  let docs;
  try {
    docs = YAML.parseAllDocuments(source);
  } catch (e) {
    console.error(`TRUST-ANCHOR VIOLATION: anchor unparseable: ${e.message}`);
    process.exit(2);
  }
  if (docs.length !== 1) {
    console.error(
      `TRUST-ANCHOR VIOLATION: expected exactly one YAML document, found ${docs.length} (multi-document workflows are rejected)`,
    );
    process.exit(2);
  }
  const d = docs[0];
  if (d.errors && d.errors.length > 0) {
    console.error(`TRUST-ANCHOR VIOLATION: anchor unparseable: ${d.errors[0].message}`);
    process.exit(2);
  }
  return d;
}
const doc = loadWorkflow(WF);

// Anchors/aliases/merge keys rejected by presence (same walker as the
// execution checker — the anchor is the trust root, nothing exotic allowed).
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
  fail("anchors/aliases/merge keys are not permitted in the trust anchor");

let wf;
try {
  wf = doc.toJS({ maxAliasCount: 100 });
} catch (e) {
  console.error(`TRUST-ANCHOR VIOLATION: alias expansion failed: ${e.message}`);
  process.exit(2);
}
if (wf === null || typeof wf !== "object" || Array.isArray(wf)) {
  console.error("TRUST-ANCHOR VIOLATION: anchor root is not a mapping");
  process.exit(2);
}

// ── Invariants ───────────────────────────────────────────────────────────────
// 1. Trigger: pull_request_target ONLY.
if (!wf.on || typeof wf.on !== "object") fail("no on: triggers");
else {
  const triggers = Object.keys(wf.on);
  if (
    triggers.length !== 1 ||
    !("pull_request_target" in wf.on)
  )
    fail("the trust anchor must trigger on pull_request_target ONLY (the head cannot modify a pull_request_target workflow)");
}

// 2. Permissions exactly contents: read.
if (JSON.stringify(wf.permissions || null) !== JSON.stringify({ contents: "read" }))
  fail("permissions must be exactly contents: read");

// 3. Fixed concurrency group.
if (!wf.concurrency || wf.concurrency.group !== "packaged-gate-trust-anchor")
  fail("concurrency group is not the fixed packaged-gate-trust-anchor");

// 4. Exactly ONE job, named contract, with the exact same-repo guard.
if (!wf.jobs || typeof wf.jobs !== "object")
  fail("jobs section missing or not a mapping");
else {
  const jobs = Object.keys(wf.jobs);
  if (jobs.length !== 1 || jobs[0] !== "contract")
    fail(`the trust anchor must have exactly one job (contract), got: ${jobs.join(" ")}`);
}
const contract = wf.jobs.contract;
if (!contract || typeof contract !== "object")
  fail("contract job missing");
else {
  if (contract.if !== "github.event.pull_request.head.repo.full_name == github.repository")
    fail("contract job if: is not the exact same-repo guard");
  if (JSON.stringify(contract["runs-on"] || null) !== JSON.stringify(["self-hosted", "Linux", "X64", "vm103"]))
    fail("contract runs-on is not the exact vm103 label set");
  if (contract.env !== undefined) fail("job-level env is not permitted in the anchor");
  if (contract.defaults !== undefined) fail("job-level defaults are not permitted in the anchor");
  if (contract["continue-on-error"]) fail("continue-on-error found (skip-green)");
  if (contract.permissions !== undefined) fail("job-level permissions are not permitted in the anchor");

  const steps = Array.isArray(contract.steps) ? contract.steps : [];

  // 5. Checkout pinned to the BASE sha (never the head).
  const checkout = steps.find((s) => s && typeof s.uses === "string" && s.uses.includes("actions/checkout"));
  if (!checkout) fail("anchor has no checkout step");
  else if (!(checkout.with && checkout.with.ref && String(checkout.with.ref).includes("pull_request.base.sha")))
    fail("anchor checkout must be pinned to pull_request.base.sha (never the head)");

  // 6. The head file is fetched ONLY via gh api as DATA; HEAD_SHA travels
  // via env (no event-payload shell interpolation, no git fetch of head).
  const fetchStep = steps.find(
    (s) => s && typeof s.name === "string" && s.name.startsWith("Fetch the candidate EXECUTION workflow"),
  );
  if (!fetchStep) fail("anchor lacks the head-file fetch step");
  else {
    const run = typeof fetchStep.run === "string" ? fetchStep.run : "";
    if (!run.includes("gh api")) fail("head file must be fetched via gh api");
    if (!run.includes("contents/.github/workflows/packaged-user-gate.yml"))
      fail("fetch step must target the packaged-user-gate.yml contents endpoint");
    if (!(fetchStep.env && fetchStep.env.HEAD_SHA && fetchStep.env.GH_TOKEN))
      fail("fetch step env must carry exactly GH_TOKEN and HEAD_SHA");
    if (
      JSON.stringify(fetchStep.env) !==
      JSON.stringify({ GH_TOKEN: "${{ github.token }}", HEAD_SHA: "${{ github.event.pull_request.head.sha }}", REPO: "${{ github.repository }}" })
    )
      fail("fetch step env is not the exact pinned map (GH_TOKEN, HEAD_SHA, REPO)");
  }

  // 7. The checker + NC run from the BASE checkout against the fetched file.
  const checkerStep = steps.find(
    (s) => s && typeof s.name === "string" && s.name.startsWith("Run the BASE checker"),
  );
  if (!checkerStep || typeof checkerStep.run !== "string" || !checkerStep.run.includes("./tools/check-packaged-gate-contract.sh /tmp/head-execution-workflow.yml"))
    fail("anchor must run the BASE checker against the fetched head execution workflow");
  const ncStep = steps.find(
    (s) => s && typeof s.name === "string" && s.name.startsWith("Contract negative-control"),
  );
  if (!ncStep || typeof ncStep.run !== "string" || !ncStep.run.includes("./tools/test/packaged-gate-contract-negative-control.sh"))
    fail("anchor must run the negative control from the base checkout");
  if (JSON.stringify(ncStep.env || null) !== JSON.stringify({ PACKAGED_GATE_WF: "/tmp/head-execution-workflow.yml" }))
    fail("negative-control step env is not the exact pinned map");

  // 8. NO head execution anywhere: no step may check out/fetch/execute the
  // head, and no run may interpolate the head sha into a shell command.
  for (const s of steps) {
    if (!s) continue;
    if (typeof s.uses === "string" && !/^[\w.-]+\/[\w.-]+(\/[^@]+)?@[0-9a-f]{40}$/.test(s.uses))
      fail(`mutable action ref found — every uses: must be SHA-pinned (got: ${s.uses})`);
    if (s["continue-on-error"] || s.continueOnError) fail("continue-on-error found (skip-green)");
    if (s.env !== undefined) {
      const name = typeof s.name === "string" ? s.name : "";
      if (!(name.startsWith("Fetch the candidate EXECUTION workflow") || name.startsWith("Contract negative-control")))
        fail(`step-level env is not permitted on step "${name}"`);
    }
    if (typeof s.run === "string" && s.run.includes("github.event.pull_request.head.sha"))
      fail("event-payload head sha must never be shell-interpolated — HEAD_SHA travels via env only");
  }
  // No git fetch/checkout of the head anywhere in run text.
  for (const s of steps) {
    const run = typeof s.run === "string" ? s.run : "";
    if (/git (fetch|checkout)[^|]*head/i.test(run))
      fail("the anchor must never git-fetch or checkout the head");
  }
}

// ── Deep structural equality to the canonical anchor (LAST) ─────────────────
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
  fail("candidate anchor is not deep-structural-equal to the canonical trust anchor");

process.exit(status);
