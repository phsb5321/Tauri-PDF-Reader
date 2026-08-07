import {
  continueReading,
  progressPercent,
} from "../../domain/library/reading-progress";
import { IconButton } from "../../ui/components/IconButton/IconButton";
import type { Document } from "../../lib/schemas";
import "./ContinueReading.css";

interface ContinueReadingProps {
  documents: readonly Document[];
  onResume: (document: Document) => void;
  /**
   * Opt-in: land on the stored page AND start narrating in one action. The
   * row's main click (`onResume`) stays silent — a reader who wants to read
   * quietly must never be ambushed by audio.
   */
  onResumeAndPlay: (document: Document) => void;
}

/**
 * The books in flight, most recently opened first. Renders nothing when
 * nothing is in flight, so a fresh library is not padded with an empty shelf.
 */
export function ContinueReading({
  documents,
  onResume,
  onResumeAndPlay,
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
            <li key={document.id} className="continue-reading-row">
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
              {/* Sibling, not nested — two interactive elements inside one
                  <button> is invalid HTML and mangles the accessibility tree. */}
              <IconButton
                label={`Resume ${label} and start reading aloud`}
                variant="ghost"
                size="sm"
                className="continue-reading-play"
                onClick={() => onResumeAndPlay(document)}
              >
                <PlayIcon />
              </IconButton>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M4 2.5v11l9-5.5-9-5.5z" fill="currentColor" />
    </svg>
  );
}
