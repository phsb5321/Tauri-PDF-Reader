#!/usr/bin/env node
/* global Buffer, process, console */
import { writeFileSync } from "node:fs";

const output = process.argv[2];
if (!output) {
  console.error("usage: node scripts/gen-e2e-prosody-fixture.mjs <output.pdf>");
  process.exit(2);
}

const heading = "What This Book Is About";
const body =
  "This book aims to fill a gap. It connects the dots. Readers benefit.";
const stream =
  `BT /F1 21.2475 Tf 72 700.5 Td (${heading}) Tj ET\n` +
  `BT /F2 15 Tf 72 673.5 Td (${body}) Tj ET`;
const objects = [
  "<< /Type /Catalog /Pages 2 0 R >>",
  "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
  "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 6 0 R /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> >>",
  "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
  "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  `<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`,
];

let pdf = "%PDF-1.4\n";
const offsets = [0];
for (const [index, body] of objects.entries()) {
  offsets[index + 1] = Buffer.byteLength(pdf, "latin1");
  pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
}
const xref = Buffer.byteLength(pdf, "latin1");
pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f\n`;
for (const offset of offsets.slice(1)) {
  pdf += `${String(offset).padStart(10, "0")} 00000 n\n`;
}
pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
writeFileSync(output, pdf, "latin1");
console.log(`[gen-e2e-prosody-fixture] wrote ${output}`);
