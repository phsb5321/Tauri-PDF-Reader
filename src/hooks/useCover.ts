import { useCallback, useEffect, useRef, useState } from "react";
import { tauriCoverRepository } from "../adapters/tauri/cover-repository.adapter";
import { pdfService } from "../services/pdf-service";

/**
 * The cover render policy. Changes here are breaking for cached rasters: bump
 * COVER_FORMAT_VERSION (both here and — the authoritative copy — in
 * `src-tauri/src/domain/cover.rs`) so old files become orphans instead of
 * silently staying on screen.
 */
export const COVER_FORMAT_VERSION = 1;
/** Generation is skipped above this source size (bounds transient memory). */
export const MAX_COVER_SOURCE_BYTES = 50 * 1024 * 1024;
/** Fixed render scale — device-independent, deterministic rasters. */
const COVER_SCALE = 0.5;
/** outputScale=1 keeps the raster byte-stable across machines (no DPR factor). */
const COVER_OUTPUT_SCALE = 1;
/** Generation concurrency cap — bounds the pdf.js worker/memory spike. */
const MAX_CONCURRENT_GENERATIONS = 3;
/** In-memory Blob URL cache bound (evict oldest, revoke its URL). */
const BLOB_CACHE_LIMIT = 64;

/**
 * Shared in-memory cover cache: one Blob URL per document, reused by every
 * card that mounts the same book. The Map owns the URLs — they are revoked on
 * eviction, never on card unmount (a second card may hold the same URL).
 */
const coverBlobCache = new Map<string, string>();
/** Mounted-consumer count per cache key — an evicted URL is only revoked
 *  when its LAST mounted card unmounts (Codex gate 121: the grid keeps cards
 *  mounted while scrolling, so revoking on eviction would break a still-
 *  visible <img> that can never regenerate — its observer is gone). */
const coverRefs = new Map<string, number>();
/** URLs whose key was evicted while consumers were still mounted. */
const pendingRevokes = new Map<string, string>();

let inflight = 0;
const waiters: Array<() => void> = [];

function acquireSlot(): Promise<void> {
  if (inflight < MAX_CONCURRENT_GENERATIONS) {
    inflight += 1;
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => waiters.push(resolve));
}

function releaseSlot(): void {
  const next = waiters.shift();
  if (next) next();
  else inflight -= 1;
}

function cacheKey(documentId: string): string {
  return `${documentId}-v${COVER_FORMAT_VERSION}`;
}

function rememberUrl(key: string, url: string): void {
  if (coverBlobCache.size >= BLOB_CACHE_LIMIT) {
    const oldest = coverBlobCache.keys().next().value;
    if (oldest !== undefined) {
      const oldUrl = coverBlobCache.get(oldest);
      coverBlobCache.delete(oldest);
      if (oldUrl) {
        if ((coverRefs.get(oldest) ?? 0) > 0) {
          // Consumers still mounted — defer the revoke to their last unmount.
          pendingRevokes.set(oldest, oldUrl);
        } else {
          URL.revokeObjectURL(oldUrl);
        }
      }
    }
  }
  coverBlobCache.set(key, url);
}

/** One mounted card per key. Returns the URL to revoke, if this was the last
 *  consumer of a pending (evicted) URL. */
function acquireCoverRef(key: string): void {
  coverRefs.set(key, (coverRefs.get(key) ?? 0) + 1);
}

function releaseCoverRef(key: string): string | null {
  const count = (coverRefs.get(key) ?? 0) - 1;
  if (count <= 0) {
    coverRefs.delete(key);
    const pending = pendingRevokes.get(key);
    if (pending) {
      pendingRevokes.delete(key);
      return pending;
    }
  } else {
    coverRefs.set(key, count);
  }
  return null;
}

export type CoverState = "loading" | "ready" | "fallback";

export interface UseCoverOptions {
  documentId: string;
  filePath: string;
  /** Cards can disable the pipeline (e.g. a missing file the store healed). */
  enabled?: boolean;
}

export interface UseCoverResult {
  /** Attach to the cover's wrapper element — generation is lazy per visibility. */
  ref: React.RefObject<HTMLDivElement | null>;
  state: CoverState;
  /** The Blob URL when ready (owned by the shared cache). */
  url: string | null;
}

/**
 * Per-card cover pipeline: lazy (IntersectionObserver), bounded (concurrency
 * cap + size cap), cached (disk via the repository, memory via the shared
 * Map). Reduced-motion does NOT suppress generation — covers are not motion;
 * only the hover animation is motion-gated, in CSS.
 */
export function useCover({
  documentId,
  filePath,
  enabled = true,
}: UseCoverOptions): UseCoverResult {
  const ref = useRef<HTMLDivElement | null>(null);
  const [state, setState] = useState<CoverState>("loading");
  const [url, setUrl] = useState<string | null>(null);
  const startedRef = useRef(false);

  const generate = useCallback(async () => {
    if (!enabled || startedRef.current) return;
    startedRef.current = true;
    const key = cacheKey(documentId);

    // 1. In-memory hit — the common case for a second mount in one session.
    const cachedUrl = coverBlobCache.get(key);
    if (cachedUrl) {
      setUrl(cachedUrl);
      setState("ready");
      return;
    }

    // 2. Disk hit — the warm-relaunch path (no re-extraction).
    try {
      const cached = await tauriCoverRepository.get(documentId);
      if (cached) {
        const url = URL.createObjectURL(cached);
        rememberUrl(key, url);
        setUrl(url);
        setState("ready");
        return;
      }
    } catch (error) {
      console.warn("[cover] cache read failed, regenerating:", error);
      // Fall through — a broken cache read must not kill the cover.
    }

    // 3. Miss — preflight the source size BEFORE any byte is read (the
    //    oversized skip must not cost a whole-file read — Codex gate 121),
    //    then render page 1 under the concurrency cap.
    try {
      const sourceBytes = await tauriCoverRepository.sourceSize(filePath);
      if (sourceBytes > MAX_COVER_SOURCE_BYTES) {
        setState("fallback");
        return;
      }
    } catch (error) {
      console.warn("[cover] source size preflight failed, skipping:", error);
      setState("fallback");
      return;
    }
    await acquireSlot();
    let loaded: Awaited<
      ReturnType<typeof pdfService.loadDocumentForCover>
    > | null = null;
    try {
      loaded = await pdfService.loadDocumentForCover(
        filePath,
        MAX_COVER_SOURCE_BYTES,
      );
      if (!loaded || "tooBig" in loaded) {
        setState("fallback");
        return;
      }
      const page = await pdfService.getPage(loaded.doc, 1);
      const canvas = document.createElement("canvas");
      await pdfService.renderPage({
        canvas,
        scale: COVER_SCALE,
        page,
        outputScale: COVER_OUTPUT_SCALE,
      }).promise;
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png");
      });
      await tauriCoverRepository.store(documentId, blob);
      const url = URL.createObjectURL(blob);
      rememberUrl(key, url);
      setUrl(url);
      setState("ready");
    } catch (error) {
      console.warn("[cover] generation failed, using fallback:", error);
      setState("fallback");
    } finally {
      // The renderer's PDF document is per-generation — destroy it so a
      // library scroll-through does not accumulate pdf.js documents.
      if (loaded && !("tooBig" in loaded) && "doc" in loaded && loaded.doc) {
        try {
          await loaded.doc.destroy();
        } catch {
          // Destroy is best-effort.
        }
      }
      releaseSlot();
    }
  }, [documentId, filePath, enabled]);

  useEffect(() => {
    // The refcount tracks MOUNTED cards (acquire here, release in the
    // cleanup) — a card that never intersected must still balance its ref so
    // a sibling's evicted URL is never revoked while it is displayed.
    const key = cacheKey(documentId);
    acquireCoverRef(key);
    const el = ref.current;
    if (!el) {
      const revoke = releaseCoverRef(key);
      if (revoke) URL.revokeObjectURL(revoke);
      return;
    }
    // jsdom has no IntersectionObserver; without one, generate immediately so
    // unit tests (and any exotic WebView) still resolve.
    if (typeof IntersectionObserver === "undefined") {
      void generate();
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          void generate();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      const revoke = releaseCoverRef(key);
      if (revoke) URL.revokeObjectURL(revoke);
    };
  }, [generate, documentId]);

  return { ref, state, url };
}
