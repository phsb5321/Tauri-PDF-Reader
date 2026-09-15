#!/usr/bin/env node
/* global Buffer, process, console */
/**
 * Zero-progress fixture for slice 202's packaged user gate
 * (e2e/library-202-journey.e2e.mjs, lane `zero`).
 *
 * Dependency-free and deterministic — same minimal-PDF builder as
 * scripts/gen-e2e-fixtures.mjs (kept separate so the shared generator's
 * lanes stay byte-identical). 500 pages: registered at page 2 the stored
 * progress is round(2/500*100) = 0% while readingState() is "reading"
 * (currentPage > 1) — the exact in-flight-zero book the resume line's
 * divider-confusion bug (#183) is about, unreachable through any public
 * control or pre-existing seed.
 *
 * Usage: node scripts/gen-e2e-zero-fixture.mjs <app-data-dir>
 * Writes e2e-resume-fixture-zero.pdf (500 pages) into that directory.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

function buildPdf(pageCount, pageText) {
  const bodies = [];
  bodies[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  const kids = Array.from({ length: pageCount }, (_, i) => `${3 + i} 0 R`).join(
    " ",
  );
  bodies[2] = `<< /Type /Pages /Kids [${kids}] /Count ${pageCount} >>`;
  const fontObj = 3 + pageCount;
  const firstContent = fontObj + 1;
  bodies[fontObj] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  for (let i = 0; i < pageCount; i++) {
    bodies[3 + i] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] ` +
      `/Contents ${firstContent + i} 0 R ` +
      `/Resources << /Font << /F1 ${fontObj} 0 R >> >> >>`;
  }
  for (let i = 0; i < pageCount; i++) {
    const stream = `BT /F1 24 Tf 72 700 Td (${pageText(i + 1)}) Tj ET`;
    const len = Buffer.byteLength(stream, "latin1");
    bodies[firstContent + i] =
      `<< /Length ${len} >>\nstream\n${stream}\nendstream`;
  }

  let out = "%PDF-1.4\n";
  const offsets = new Array(bodies.length);
  for (let i = 1; i < bodies.length; i++) {
    offsets[i] = Buffer.byteLength(out, "latin1");
    out += `${i} 0 obj\n${bodies[i]}\nendobj\n`;
  }
  const xrefPos = Buffer.byteLength(out, "latin1");
  out += `xref\n0 ${bodies.length}\n0000000000 65535 f \n`;
  for (let i = 1; i < bodies.length; i++) {
    out += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  out += `trailer\n<< /Size ${bodies.length} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`;
  return out;
}

const outDir = process.argv[2];
if (!outDir) {
  console.error("usage: node scripts/gen-e2e-zero-fixture.mjs <app-data-dir>");
  process.exit(2);
}
mkdirSync(outDir, { recursive: true });

writeFileSync(
  join(outDir, "e2e-resume-fixture-zero.pdf"),
  buildPdf(500, (n) => `zero lectrice fixture page ${n}`),
);
console.log(
  `[gen-e2e-zero-fixture] wrote 500-page zero fixture into ${outDir}`,
);
