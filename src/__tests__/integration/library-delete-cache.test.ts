/**
 * Slice 104 — deleting a library document must not strand its cached audio.
 *
 * `library_remove_document` used to be a bare DELETE FROM documents: the
 * document's tts_cache/ .mp3 files (and their metadata rows) survived on
 * disk forever. The fix wires the existing `AudioCacheService::clear_document`
 * (which provably removes files + metadata, tested in the Rust adapter) into
 * the delete command. This source-level pin keeps the wiring honest: remove
 * the call and this test goes RED. The behavioral half lives in
 * `audio_cache_repo.rs::delete_for_document_removes_files_and_drops_stats`.
 */

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "../../..");
const LIBRARY_MOD = join(
  REPO_ROOT,
  "src-tauri/src/commands/library/mod.rs",
);

describe("library delete clears the document's cached audio (104)", () => {
  it("library_remove_document invokes the audio-cache service clear", () => {
    const src = readFileSync(LIBRARY_MOD, "utf8");
    const fnStart = src.indexOf("pub async fn library_remove_document");
    expect(fnStart).toBeGreaterThan(-1);
    const fnBody = src.slice(fnStart);

    // The delete path must construct the audio-cache service and clear the
    // document's cache BEFORE the row delete.
    expect(fnBody).toContain("create_audio_cache_service");
    expect(fnBody).toContain("clear_document");
    expect(fnBody).toContain("DELETE FROM documents");
    // The clear must appear before the row delete (files first, then row).
    expect(fnBody.indexOf("clear_document")).toBeLessThan(
      fnBody.indexOf("DELETE FROM documents"),
    );
  });
});
