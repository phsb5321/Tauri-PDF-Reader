#!/usr/bin/env node
/* global Buffer, process, console */
import { writeFileSync } from "node:fs";

const output = process.argv[2];
if (!output) {
  console.error("usage: node scripts/gen-e2e-magpie-fixture.mjs <output.pdf>");
  process.exit(2);
}

const sentences = [
  "Reliable data systems preserve source order while work moves through bounded queues.",
  "A responsive reader starts one semantic unit before preparing the context that follows.",
  "Cancellation invalidates old generations so stale audio cannot play or advance a page.",
  "Measured runtime facts identify the model backend device limits latency and real time factor.",
  "Paragraph and section boundaries remain stronger than throughput or speculative buffering.",
];
const lines = Array.from({ length: 30 }, (_, index) => sentences[index % sentences.length]);
const escapePdf = (text) =>
  text.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
const pageStream = (pageLines) =>
  `BT /F1 11 Tf 54 744 Td ${pageLines
    .map((line, index) => `${index ? "0 -23 Td " : ""}(${escapePdf(line)}) Tj`)
    .join(" ")} ET`;
const first = pageStream(lines);
const second = pageStream([
  "Second page control. Stop must prevent any stale continuation beyond this page.",
]);
const objects = [
  "<< /Type /Catalog /Pages 2 0 R >>",
  "<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>",
  "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 6 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
  "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 7 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
  "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  `<< /Length ${Buffer.byteLength(first, "latin1")} >>\nstream\n${first}\nendstream`,
  `<< /Length ${Buffer.byteLength(second, "latin1")} >>\nstream\n${second}\nendstream`,
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
console.log(`[gen-e2e-magpie-fixture] wrote ${output}`);
