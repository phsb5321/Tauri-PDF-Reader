import {
  continueReading,
  progressPercent,
} from "../../domain/library/reading-progress";
import type { Document } from "../../lib/schemas";
import "./ContinueReading.css";

interface ContinueReadingProps {
  documents: readonly Document[];
  onResume: (document: Document) => void;
}

/**
 * The books in flight, most recently opened first. Renders nothing when
 * nothing is in flight, so a fresh library is not padded with an empty shelf.
 */
export function ContinueReading({
  documents,
  onResume,
}: Readonly<ContinueReadingProps>) {
  const inFlight = continueReading(documents);

  if (inFlight.length === 0) return null;

  return (
    <section
      className="continue-reading"
      aria-labelledby="continue-reading-heading"
    >
      <h2 id="continue-reading-heading" className="continue-reading-heading">
        Continue reading
      </h2>
      <ul className="continue-reading-list">
        {inFlight.map((document) => {
          const percent = progressPercent(document);
          const label = document.title || document.filePath;
          return (
            <li key={document.id}>
              <button
                type="button"
                className="continue-reading-item"
                onClick={() => onResume(document)}
                aria-label={`Resume ${label}, page ${document.currentPage}${
                  document.pageCount ? ` of ${document.pageCount}` : ""
                }, ${percent}%`}
              >
                <span className="continue-reading-title">{label}</span>
                <span className="continue-reading-place">
                  {document.pageCount
                    ? `Page ${document.currentPage} of ${document.pageCount}`
                    : `Page ${document.currentPage}`}
                </span>
                {/* Native <progress> carries the semantics; the bar next to
                    it is decoration. Styling a real <progress> means
                    per-engine ::-webkit-progress-value rules, so this follows
                    CacheProgressBar: sr-only element for assistive tech, a
                    plain span for the pixels. */}
                <progress
                  className="sr-only"
                  value={percent}
                  max={100}
                  aria-label={`${label} progress`}
                />
                <span className="continue-reading-bar" aria-hidden="true">
                  <span
                    className="continue-reading-bar-fill"
                    style={{ width: `${percent}%` }}
                  />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
