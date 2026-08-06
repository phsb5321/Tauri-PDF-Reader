import {
  continueReading,
  progressPercent,
} from "../../domain/library/reading-progress";
import { formatRelativeReadTime } from "../../domain/library/relative-time";
import { Button } from "../../ui/components/Button/Button";
import { ListRow } from "../../ui/components/ListRow/ListRow";
import type { Document } from "../../lib/schemas";
import "./ResumeSection.css";

interface ResumeSectionProps {
  documents: readonly Document[];
  onResume: (document: Document) => void;
  onResumeAndPlay: (document: Document) => void;
}

function placeText(document: Document): string {
  return document.pageCount
    ? `Page ${document.currentPage} of ${document.pageCount}`
    : `Page ${document.currentPage}`;
}

/**
 * The catch-up moment: one book gets the answer, not a shelf of equal-weight
 * cards. The most recently opened in-flight book becomes a typographic resume
 * line; anything else in flight drops to compact rows below it.
 *
 * Renders nothing when nothing is in flight — same rule `ContinueReading` had,
 * kept exactly, so a fresh library is not padded with an empty section.
 */
export function ResumeSection({
  documents,
  onResume,
  onResumeAndPlay,
}: Readonly<ResumeSectionProps>) {
  const inFlight = continueReading(documents);
  if (inFlight.length === 0) return null;

  const [primary, ...rest] = inFlight;
  const label = primary.title || primary.filePath;
  const percent = progressPercent(primary);
  const relative = formatRelativeReadTime(primary.lastOpenedAt);
  const meta = [placeText(primary), `${percent}%`, relative && `last read ${relative}`]
    .filter(Boolean)
    .join(" · ");

  return (
    <section
      className="resume-section"
      aria-labelledby="continue-reading-heading"
    >
      <h2 id="continue-reading-heading" className="resume-section-heading">
        Continue reading
      </h2>

      <div className="resume-line">
        <span className="resume-line-title">{label}</span>
        <p className="resume-line-meta">{meta}</p>
        {/* Native <progress> carries the semantics; the bar next to it is
            decoration — same sr-only + decorative-span pattern ContinueReading
            used, reused rather than reinvented. */}
        <progress
          className="sr-only"
          value={percent}
          max={100}
          aria-label={`${label} progress`}
        />
        <span className="resume-line-bar" aria-hidden="true">
          <span
            className="resume-line-bar-fill"
            style={{ width: `${percent}%` }}
          />
        </span>
        <div className="resume-line-actions">
          <Button variant="primary" onClick={() => onResume(primary)}>
            Resume
          </Button>
          <Button
            variant="secondary"
            onClick={() => onResumeAndPlay(primary)}
          >
            Resume &amp; Read Aloud
          </Button>
        </div>
      </div>

      {rest.length > 0 && (
        <div className="also-in-progress">
          <h3 className="also-in-progress-heading">Also in progress</h3>
          <ul className="also-in-progress-list">
            {rest.map((document) => (
              <li key={document.id}>
                <ListRow
                  primary={document.title || document.filePath}
                  metadata={placeText(document)}
                  trailing={<ChevronIcon />}
                  onClick={() => onResume(document)}
                />
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function ChevronIcon() {
  return (
    <svg viewBox="0 0 16 16" className="resume-also-chevron" aria-hidden="true">
      <path
        d="M6 4l4 4-4 4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
    </svg>
  );
}
