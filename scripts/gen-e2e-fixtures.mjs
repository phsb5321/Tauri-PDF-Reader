#!/usr/bin/env node
/* global Buffer, process, console */
/**
 * Generates the hermetic-profile fixture PDFs for the packaged home-journey
 * E2E (e2e/home-journey.e2e.mjs).
 *
 * Dependency-free and deterministic: emits minimal, spec-compliant PDFs with
 * UNCOMPRESSED content streams (pdf.js reads them fine — no Filter needed).
 * Each page carries one text item so the text layer has real words, exactly
 * like the bundled public/e2e-fixture.pdf.
 *
 * Usage: node scripts/gen-e2e-fixtures.mjs <app-data-dir>
 * Writes e2e-resume-fixture-a.pdf (5 pages) and e2e-resume-fixture-b.pdf
 * (3 pages) into that directory — the observer's prelaunch step, so the
 * library seed (real `library_add_document` IPC, which validates that the
 * file exists) can reference real files.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Minimal single-file PDF: catalog, pages tree, one page object + one
 * uncompressed content stream per page, one Helvetica font object.
 */
function buildPdf(pageCount, pageText) {
  // object index -> body (no trailing newline; assembler adds framing)
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
  console.error("usage: node scripts/gen-e2e-fixtures.mjs <app-data-dir>");
  process.exit(2);
}
mkdirSync(outDir, { recursive: true });

writeFileSync(
  join(outDir, "e2e-resume-fixture-a.pdf"),
  buildPdf(5, (n) => {
    if (n === 2) {
      // The resume-and-play journey narrates PAGE 2. The e2e-tts-fixture
      // backend meters karaoke at 0.4s/word, and auto-page is ON by default,
      // so a 5-word page would finish in ~2s and jump to the next page
      // before the "TTS store reached playing" oracle can observe it. A
      // ~50-word paragraph gives ~20s of narrating on the resume target.
      return (
        "alpha lectrice fixture page two the catch-up resume and play journey " +
        "narrates this paragraph so the karaoke state stays observable long " +
        "enough for the packaged user gate to assert that narration started " +
        "and advanced word by word across wall clock time without any human " +
        "listener being required for the verdict"
      );
    }
    return `alpha lectrice fixture page ${n}`;
  }),
);
writeFileSync(
  join(outDir, "e2e-resume-fixture-b.pdf"),
  buildPdf(3, (n) => `bravo lectrice fixture page ${n}`),
);
console.log(`[gen-e2e-fixtures] wrote 5-page A + 3-page B into ${outDir}`);
