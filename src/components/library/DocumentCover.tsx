import { useMemo, type Ref } from "react";
import { useCover } from "../../hooks/useCover";
import "./DocumentCover.css";

interface DocumentCoverProps {
  documentId: string;
  title: string | null;
  filePath: string;
  size?: "sm" | "md" | "lg";
}

/** Number of deterministic fallback variants (indexed by the seed). */
const FALLBACK_PALETTE_SIZE = 6;

function fileNameFromPath(filePath: string): string {
  const parts = filePath.split(/[/\\]/);
  return parts[parts.length - 1] || filePath;
}

/**
 * A document's cover: the real first-page raster when the pipeline produced
 * one, otherwise the deterministic seed fallback — same id, same colors,
 * every run. The wrapper is ALWAYS `role="img"` named by the title (the inner
 * raster is `alt=""` to avoid double-announcing), and the placeholder IS the
 * fallback, so the box never shifts shape when the raster arrives: the 2:3
 * wrapper is the skeleton.
 */
export function DocumentCover({
  documentId,
  title,
  filePath,
  size = "md",
}: DocumentCoverProps) {
  const { ref, state, url } = useCover({ documentId, filePath });
  const name = useMemo(
    () => (title && title.trim() ? title.trim() : fileNameFromPath(filePath)),
    [title, filePath],
  );
  // Deterministic seed: first 8 hex chars of the SHA-256 id.
  const seed = useMemo(() => {
    const slice = documentId.slice(0, 8);
    return parseInt(slice || "0", 16);
  }, [documentId]);
  const variant = seed % FALLBACK_PALETTE_SIZE;

  return (
    <div
      ref={ref as Ref<HTMLDivElement>}
      className={`document-cover document-cover--${size}`}
      role="img"
      aria-label={name}
      data-state={state}
      data-seed={String(seed)}
    >
      {state === "ready" && url ? (
        <img
          src={url}
          alt=""
          draggable={false}
          className="document-cover-img"
        />
      ) : (
        <div
          className={`cover-fallback cover-fallback--${variant}`}
          aria-hidden="true"
        >
          <svg viewBox="0 0 24 24" className="cover-fallback-glyph">
            <path
              d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"
              fill="currentColor"
              opacity="0.9"
            />
            <path d="M14 2v6h6" fill="currentColor" opacity="0.45" />
          </svg>
        </div>
      )}
    </div>
  );
}
