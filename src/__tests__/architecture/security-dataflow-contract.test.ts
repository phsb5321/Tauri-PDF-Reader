/**
 * Executable contract over the SECURITY.md dataflow map (ops-parity 2.3).
 *
 * SECURITY.md names the modules that issue outbound network calls. This
 * test derives that set from the code, so the document cannot drift from
 * what ships:
 *
 *  - the set of production files carrying outbound-network markers must be
 *    EXACTLY the set SECURITY.md names — adding a new outbound call (a new
 *    `fetch`, a new reqwest client, a new remote URL handed to pdf.js)
 *    without updating the document turns this RED;
 *  - SECURITY.md must keep naming each module — gutting the document turns
 *    this RED.
 *
 * Markers are deliberately narrow to avoid false positives: `reqwest::`
 * usage (the HTTP crate, optional behind the `elevenlabs-tts` feature) for
 * the backend; `fetch(`/XHR/WebSocket/EventSource for the frontend. The
 * jsDelivr literal marker is retained as a regression guard: slice 100
 * bundled the CMap tables locally, and a reintroduced CDN URL would put
 * `pdf-service.ts` back in the egress set and turn this RED. A bare
 * `https://` in a comment or an external link is NOT a marker — links open
 * the browser via `shell:allow-open`, they do not transmit app data
 * (SECURITY.md says exactly this).
 */

import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "../../..");
const SRC = join(REPO_ROOT, "src");
const SRC_TAURI = join(REPO_ROOT, "src-tauri/src");
const SECURITY_MD = join(REPO_ROOT, "SECURITY.md");

const FRONTEND_MARKERS = [
  /fetch\(/,
  /XMLHttpRequest/,
  /new WebSocket/,
  /EventSource\(/,
  "https://cdn.jsdelivr.net/",
];
const BACKEND_MARKERS = [/reqwest::/];

/** The egress modules SECURITY.md names, relative to the repo root. */
const DOCUMENTED_FRONTEND = new Set([]);
const DOCUMENTED_BACKEND = new Set(["src-tauri/src/ai_tts/elevenlabs.rs"]);

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

function productionFiles(
  root: string,
  ext: RegExp,
  excluded: RegExp[],
): string[] {
  return walk(root).filter((file) => {
    if (!ext.test(file)) return false;
    if (excluded.some((re) => re.test(file))) return false;
    return true;
  });
}

function egressFiles(files: string[], markers: (RegExp | string)[]): string[] {
  return files.filter((file) => {
    const source = readFileSync(file, "utf8");
    return markers.some((marker) =>
      typeof marker === "string" ? source.includes(marker) : marker.test(source),
    );
  });
}

describe("SECURITY.md dataflow map", () => {
  it("names exactly the modules that issue outbound network calls", () => {
    const frontend = productionFiles(SRC, /\.(ts|tsx)$/, [
      /__tests__/,
      /\.test\./,
      /\.spec\./,
      /(^|\/)tests\//,
      // E2E harness modules — tree-shaken out of every production build by
      // the VITE_E2E/VITE_E2E_NATIVE flags (never shipped; their fetch is
      // the bundled fixture, not an egress).
      /src\/e2e-bridge\.ts$/,
      /src\/e2e-native-bootstrap\.ts$/,
    ]);
    const backend = productionFiles(SRC_TAURI, /\.rs$/, [
      /(^|\/)tests?\//,
      /\.test\./,
    ]);

    const frontendEgress = egressFiles(frontend, FRONTEND_MARKERS).map((f) =>
      relative(REPO_ROOT, f),
    );
    const backendEgress = egressFiles(backend, BACKEND_MARKERS).map((f) =>
      relative(REPO_ROOT, f),
    );

    // Adding a new outbound call lands here first: a file with markers that
    // SECURITY.md does not name. Update BOTH this test and the document.
    expect(new Set(frontendEgress)).toEqual(DOCUMENTED_FRONTEND);
    expect(new Set(backendEgress)).toEqual(DOCUMENTED_BACKEND);
  });

  it("SECURITY.md still names every documented egress module", () => {
    const doc = readFileSync(SECURITY_MD, "utf8");

    for (const module of [...DOCUMENTED_FRONTEND, ...DOCUMENTED_BACKEND]) {
      expect(
        doc,
        `SECURITY.md must name ${module} in its dataflow map`,
      ).toContain(module);
    }
  });
});
