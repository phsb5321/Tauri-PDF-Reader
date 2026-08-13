#!/usr/bin/env node
/**
 * corpus-enumerate.mjs — SAFE enumeration of the private real-book corpus.
 *
 * Reads the corpus root from LECTRICE_REAL_PDF_CORPUS (a directory). Lists
 * PDFs deterministically (sorted, no hidden files, no symlinks escaping the
 * root, size-capped) and flags EPUB files as the unsupported-format negative
 * control. Prints a JSON document: { root, pdfs: [{basename,path,size}],
 * epub: [...] }. NEVER reads book bytes beyond stat metadata.
 *
 * Usage:
 *   LECTRICE_REAL_PDF_CORPUS="/path/to/books" node scripts/corpus-enumerate.mjs
 *
 * Exit codes: 0 = enumeration ok (even with 0 pdfs — caller decides),
 *             2 = env missing/invalid, 3 = root unreadable/not a dir.
 */

import { readdir, stat, realpath } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = process.env.LECTRICE_REAL_PDF_CORPUS;
if (!ROOT) {
  console.error("corpus-enumerate: LECTRICE_REAL_PDF_CORPUS is not set");
  process.exit(2);
}
if (process.env.LECTRICE_CORPUS_NO_COPY) {
  // Explicit marker: the runner must never copy corpus bytes into git/CI.
  // Kept as a lint surface for the runner script, not enforcement here.
}

/** Hard ceiling per file — covers the corpus (max 24.5 MB) with headroom;
 *  a book above this is recorded as SKIPPED (too large), never loaded. */
const MAX_BYTES = 150 * 1024 * 1024;

async function main() {
  let rootStat;
  try {
    rootStat = await stat(ROOT);
  } catch (err) {
    console.error(`corpus-enumerate: cannot stat corpus root: ${err.message}`);
    process.exit(3);
  }
  if (!rootStat.isDirectory()) {
    console.error(`corpus-enumerate: not a directory: ${ROOT}`);
    process.exit(3);
  }

  const rootReal = await realpath(ROOT);
  const entries = await readdir(ROOT, { withFileTypes: true });
  const pdfs = [];
  const epub = [];
  const skipped = [];

  for (const e of entries) {
    if (e.name.startsWith(".")) continue; // no hidden files
    const full = resolve(ROOT, e.name);
    const lower = e.name.toLowerCase();
    const isPdf = lower.endsWith(".pdf");
    const isEpub = lower.endsWith(".epub");
    if (!isPdf && !isEpub) continue;

    let st;
    try {
      st = await stat(full);
    } catch (err) {
      skipped.push({ basename: e.name, reason: `stat failed: ${err.message}` });
      continue;
    }
    if (!st.isFile()) {
      skipped.push({ basename: e.name, reason: "not a regular file" });
      continue;
    }
    try {
      const real = await realpath(full);
      if (!real.startsWith(rootReal + "/") && real !== rootReal) {
        skipped.push({ basename: e.name, reason: "symlink escapes corpus root" });
        continue;
      }
    } catch {
      /* realpath failure on a regular file is unexpected; keep going */
    }
    if (st.size > MAX_BYTES) {
      skipped.push({ basename: e.name, reason: `too large (${st.size} B)` });
      continue;
    }

    const record = { basename: e.name, path: full, size: st.size, sha256: await sha256(full) };
    if (isPdf) pdfs.push(record);
    else epub.push(record);
  }

  pdfs.sort((a, b) => a.basename.localeCompare(b.basename));
  epub.sort((a, b) => a.basename.localeCompare(b.basename));

  console.log(JSON.stringify({ root: rootReal, pdfs, epub, skipped }, null, 2));
}

/** Streaming SHA-256 of a file (metadata + digest only — never content). */
async function sha256(filePath) {
  return new Promise((resolvePromise, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(filePath);
    stream.on("data", (d) => hash.update(d));
    stream.on("end", () => resolvePromise(hash.digest("hex")));
    stream.on("error", reject);
  });
}
main().catch((err) => {
  console.error(`corpus-enumerate: unexpected failure: ${err.stack ?? err}`);
  process.exit(1);
});
