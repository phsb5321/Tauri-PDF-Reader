/**
 * The VITE_E2E fs seam must behave like the filesystem read it replaces: every
 * read hands the caller its OWN bytes.
 *
 * pdf.js takes ownership of the buffer it is given (`getDocument({ data })`
 * transfers it to the worker), which DETACHES the caller's ArrayBuffer. The
 * seam used to return the one stored `Uint8Array` by reference, so the first
 * open emptied it: the packaged open path reads twice — once to hash and
 * parse, then a final hash-bound read so a post-hash path swap is never
 * rendered (useOpenPdf) — and the second read saw a 0-byte buffer. It hashed
 * to something else and the open died with "PDF_HASH_MISMATCH: File content
 * changed after verification", leaving the library stuck with an error banner.
 *
 * Observed 19/08/2026 in the packaged critical-loop lane once the fixture path
 * was fixed; a real plugin-fs read never had this failure mode.
 */

import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/plugin-fs", () => ({
  readFile: vi.fn(async () => {
    throw new Error("the seam must serve these reads, not plugin-fs");
  }),
}));

/** Stand in for pdf.js: take ownership of the buffer, as the real one does. */
const getDocumentMock = vi.fn((opts: { data: Uint8Array }) => {
  structuredClone(opts.data.buffer, { transfer: [opts.data.buffer] });
  return { promise: Promise.resolve({ numPages: 2 }) };
});
vi.mock("pdfjs-dist", () => ({
  getDocument: (...args: unknown[]) =>
    getDocumentMock(...(args as [{ data: Uint8Array }])),
  GlobalWorkerOptions: {},
}));

import { pdfService } from "./pdf-service";

const PATH = "../public/e2e-fixture.pdf";
const FIXTURE = new Uint8Array([
  0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37, 0x0a, 0x66, 0x69, 0x78, 0x74,
  0x75, 0x72, 0x65,
]);

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("VITE_E2E", "true");
  Object.defineProperty(window, "__TAURI_INTERNALS__", {
    value: {},
    configurable: true,
  });
  (globalThis as Record<string, unknown>).__E2E_FS_FIXTURE_BYTES__ =
    new Uint8Array(FIXTURE);
});

afterEach(() => {
  vi.unstubAllEnvs();
  delete (globalThis as Record<string, unknown>).__E2E_FS_FIXTURE_BYTES__;
});

describe("E2E fs seam (must not hand the same buffer out twice)", () => {
  it("serves a second hash-bound read after pdf.js consumed the first", async () => {
    const expected = await sha256Hex(FIXTURE);

    const first = await pdfService.loadDocumentBound(PATH);
    expect(first.sha256).toBe(expected);

    // The open path's final bound read — this is the one that used to see an
    // emptied buffer and refuse the book it had just verified.
    await expect(
      pdfService.loadDocument(PATH, { expectedSha256: expected }),
    ).resolves.toBeDefined();
  });

  it("keeps the stored fixture intact across reads", async () => {
    await pdfService.loadDocumentBound(PATH);
    const stored = (globalThis as Record<string, unknown>)
      .__E2E_FS_FIXTURE_BYTES__ as Uint8Array;
    expect(stored.byteLength).toBe(FIXTURE.byteLength);
  });
});
