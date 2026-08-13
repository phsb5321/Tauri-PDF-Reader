/**
 * Tauri cover repository adapter — the typed IPC boundary for the cover cache.
 *
 * One narrow backend command (`cover_cache`): `store=null` reads, `Some(bytes)`
 * writes. The backend pins the format version, validates the document id
 * against the library DB, validates the PNG bytes, and writes atomically —
 * none of that policy lives here.
 */

import { commands } from "../../lib/bindings";
import type { CoverRepositoryPort } from "../../ports/cover-repository.port";

function blobToBytes(blob: Blob): Promise<number[]> {
  return blob.arrayBuffer().then((buffer) => Array.from(new Uint8Array(buffer)));
}

export class TauriCoverRepositoryAdapter implements CoverRepositoryPort {
  async get(documentId: string): Promise<Blob | null> {
    const result = await commands.coverCache(documentId, null);
    if (result.status === "error") {
      throw new Error(result.error);
    }
    if (result.data === null) return null;
    return new Blob([new Uint8Array(result.data)], { type: "image/png" });
  }

  async store(documentId: string, png: Blob): Promise<void> {
    const bytes = await blobToBytes(png);
    const result = await commands.coverCache(documentId, bytes);
    if (result.status === "error") {
      throw new Error(result.error);
    }
  }

  async sourceSize(filePath: string): Promise<number> {
    const result = await commands.coverSourceSize(filePath);
    if (result.status === "error") {
      throw new Error(result.error);
    }
    return result.data;
  }
}

/** Singleton — every cover hook shares one adapter. */
export const tauriCoverRepository: CoverRepositoryPort =
  new TauriCoverRepositoryAdapter();
