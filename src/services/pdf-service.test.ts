/**
 * The reauthorization read contract: the bytes that are opened must hash to
 * the verified SHA-256, or the open is refused.
 *
 * Issue #120 reauthorization rung: `library_relocate_document` re-verifies
 * the picked file's hash server-side, then the read retries — but a file
 * swapped between that verification and the read would render different
 * bytes. `loadDocument(path, { expectedSha256 })` closes the window by
 * hashing the read buffer (WebCrypto) BEFORE pdf.js sees it; a mismatch or a
 * missing WebCrypto refuses the open (fail closed).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const readFileMock = vi.fn();
vi.mock("@tauri-apps/plugin-fs", () => ({
  readFile: (...args: unknown[]) => readFileMock(...args),
}));

const getDocumentMock = vi.fn(() => ({
  promise: Promise.resolve({ numPages: 1, _contractStub: true }),
}));
vi.mock("pdfjs-dist", () => ({
  getDocument: (...args: unknown[]) => getDocumentMock(...args),
  GlobalWorkerOptions: {},
}));

import { pdfService } from "./pdf-service";

const PATH = "/books/verified.pdf";

// %PDF-1.7 + payload; the SHA-256 is computed here with the same WebCrypto
// the service uses, so the fixture's expected hash is always exact.
const FIXTURE = new Uint8Array([
  0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37, 0x0a, 0x73, 0x74, 0x75, 0x62,
  0x20, 0x63, 0x6f, 0x6e, 0x74, 0x65, 0x6e, 0x74,
]);

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(window, "__TAURI_INTERNALS__", {
    value: {},
    configurable: true,
  });
  readFileMock.mockResolvedValue(FIXTURE);
});

describe("pdf-service reauthorization read contract", () => {
  it("opens bytes whose hash matches the verified fingerprint", async () => {
    const expected = await sha256Hex(FIXTURE);

    const pdf = await pdfService.loadDocument(PATH, {
      expectedSha256: expected,
    });

    expect(pdf.numPages).toBe(1);
    const data = (getDocumentMock.mock.calls[0] as [Record<string, unknown>])[0]
      .data as Uint8Array;
    expect(Array.from(data)).toEqual(Array.from(FIXTURE));
  });

  it("refuses to open bytes swapped after verification", async () => {
    const swapped = new Uint8Array([...FIXTURE, 0x78]); // different bytes
    readFileMock.mockResolvedValue(swapped);
    const expected = await sha256Hex(FIXTURE);

    await expect(
      pdfService.loadDocument(PATH, { expectedSha256: expected }),
    ).rejects.toThrow(/PDF_HASH_MISMATCH/);

    expect(getDocumentMock).not.toHaveBeenCalled();
  });

  it("accepts an uppercase expected hash", async () => {
    const expected = (await sha256Hex(FIXTURE)).toUpperCase();

    const pdf = await pdfService.loadDocument(PATH, {
      expectedSha256: expected,
    });

    expect(pdf.numPages).toBe(1);
  });

  it("fails closed when WebCrypto is unavailable", async () => {
    const realSubtle = globalThis.crypto?.subtle;
    vi.stubGlobal("crypto", { subtle: undefined });
    try {
      await expect(
        pdfService.loadDocument(PATH, { expectedSha256: "anything" }),
      ).rejects.toThrow(/PDF_VERIFY_UNAVAILABLE/);
      expect(getDocumentMock).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
      vi.stubGlobal("crypto", realSubtle ?? { subtle: undefined });
      vi.unstubAllGlobals();
    }
  });
});
