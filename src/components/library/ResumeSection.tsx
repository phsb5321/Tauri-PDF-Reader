import {
  continueReading,
  progressPercent,
} from "../../domain/library/reading-progress";
import { formatRelativeReadTime } from "../../domain/library/relative-time";
import { Button } from "../../ui/components/Button/Button";
import { ListRow } from "../../ui/components/ListRow/ListRow";
import { IconButton } from "../../ui/components/IconButton/IconButton";
import { DocumentCover } from "./DocumentCover";
import { useAiTtsStore, selectNeedsApiKey } from "../../stores/ai-tts-store";
import { AI_TTS_SETUP_MESSAGE } from "../../lib/constants";
import type { Document } from "../../lib/schemas";
import "./ResumeSection.css";

interface ResumeSectionProps {
  documents: readonly Document[];
  onResume: (document: Document) => void;
  /**
   * Opt-in: land on the stored page AND start narrating in one action. The
   * plain resume paths (`onResume`) stay silent — a reader who wants to read
   * quietly must never be ambushed by audio.
   */
  onResumeAndPlay: (document: Document) => void;
  /** Opens the app-wide settings panel (the TTS-setup signal's action). */
  onOpenSettings: () => void;
}

function placeText(document: Document): string {
  return document.pageCount
    ? `Page ${document.currentPage} of ${document.pageCount}`
    : `Page ${document.currentPage}`;
}

/**
 * The catch-up moment (UX spec §5): one book gets the answer, not a shelf of
 * equal-weight cards. The most recently opened in-flight book becomes a
 * typographic resume line; anything else in flight drops to compact rows
 * below it. Renders nothing when nothing is in flight — same rule
 * `ContinueReading` had, kept exactly.
 */
export function ResumeSection({
  documents,
  onResume,
  onResumeAndPlay,
  onOpenSettings,
}: Readonly<ResumeSectionProps>) {
  // The key is session-only (#73), so a fresh launch has none — and the
  // resume-and-play affordances below cannot play until it is configured.
  // Signal that once, quietly, with a path to fix it; never auto-open.
  // Read before the early return: hooks must run unconditionally.
  const needsApiKey = useAiTtsStore(selectNeedsApiKey);

  const inFlight = continueReading(documents);
  if (inFlight.length === 0) return null;

  const [primary, ...rest] = inFlight;

  return (
    <section
      className="resume-section"
      aria-labelledby="continue-reading-heading"
    >
      <h2 id="continue-reading-heading" className="resume-section-heading">
        Continue reading
      </h2>

      <ResumeLine
        document={primary}
        onResume={onResume}
        onResumeAndPlay={onResumeAndPlay}
      />

      {needsApiKey && (
        <p className="resume-section-tts-signal">
          <span>{AI_TTS_SETUP_MESSAGE}</span>
          <button
            type="button"
            className="resume-section-tts-signal-action"
            onClick={onOpenSettings}
          >
            Configure
          </button>
        </p>
      )}

      {rest.length > 0 && (
        <AlsoInProgress
          documents={rest}
          onResume={onResume}
          onResumeAndPlay={onResumeAndPlay}
        />
      )}    </section>
  );
}

interface ResumeLineProps {
  document: Document;
  onResume: (document: Document) => void;
  onResumeAndPlay: (document: Document) => void;
}

function ResumeLine({
  document,
  onResume,
  onResumeAndPlay,
}: Readonly<ResumeLineProps>) {
  const percent = progressPercent(document);
  const label = document.title || document.filePath;
  const relative = formatRelativeReadTime(document.lastOpenedAt);

  return (
    <div className="resume-line">
      {/* The cover-led moment: the resume line shows the book, not just its
          title. Named by the document (not decorative) — the same accessible
          name the card grid uses, so assistive tech sees the book twice at
          most, never a nameless box. */}
      <DocumentCover
        documentId={document.id}
        title={document.title}
        filePath={document.filePath}
        fileHash={document.fileHash}
        size="lg"
      />
      <div className="resume-line-body">
        <span className="resume-line-title">{label}</span>
        <p className="resume-line-meta">
          {/* The place text is its own leaf node on purpose: the reading-home
              test finds "Page N of M" as an exact standalone string. */}
          <span>{placeText(document)}</span>
          <span aria-hidden="true"> · </span>
          <span>{percent}%</span>
          {relative && (
            <>
              <span aria-hidden="true"> · </span>
              <span>last read {relative}</span>
            </>
          )}
        </p>
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
          {/* The accessible name keeps the exact "Resume {label}, page …"
              shape the shelf rows shipped with — tests and screen readers
              depend on it. */}
          <Button
            variant="primary"
            aria-label={`Resume ${label}, page ${document.currentPage}${
              document.pageCount ? ` of ${document.pageCount}` : ""
            }, ${percent}%`}
            onClick={() => onResume(document)}
          >
            Resume
          </Button>
          <IconButton
            label={`Resume ${label} and start reading aloud`}
            variant="ghost"
            size="sm"
            className="resume-line-play"
            onClick={() => onResumeAndPlay(document)}
          >
            <PlayIcon />
          </IconButton>
        </div>
      </div>
    </div>
  );
}

interface AlsoInProgressProps {
  documents: readonly Document[];
  onResume: (document: Document) => void;
  onResumeAndPlay: (document: Document) => void;
}

function AlsoInProgress({
  documents,
  onResume,
  onResumeAndPlay,
}: Readonly<AlsoInProgressProps>) {
  return (
    <div className="also-in-progress">
      <h3 className="also-in-progress-heading">Also in progress</h3>
      <ul className="also-in-progress-list">
        {documents.map((document) => {
          const label = document.title || document.filePath;
          return (
            <li key={document.id} className="also-in-progress-row">
              {/* Small cover before the row text — decorative, the ListRow's
                  primary text already names the book. */}
              <DocumentCover
                documentId={document.id}
                title={document.title}
                filePath={document.filePath}
                fileHash={document.fileHash}
                size="sm"
                decorative
              />
              <ListRow
                className="also-in-progress-row-main"
                primary={label}
                metadata={placeText(document)}
                trailing={<ChevronIcon />}
                onClick={() => onResume(document)}
                ariaLabel={`Resume ${label}, page ${document.currentPage}${
                  document.pageCount ? ` of ${document.pageCount}` : ""
                }`}
              />
              {/* Sibling, not nested — two interactive elements inside one
                  <button> is invalid HTML and mangles the accessibility tree. */}
              <IconButton
                label={`Resume ${label} and start reading aloud`}
                variant="ghost"
                size="sm"
                className="also-in-progress-row-play"
                onClick={() => onResumeAndPlay(document)}
              >
                <PlayIcon />
              </IconButton>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M4 2.5v11l9-5.5-9-5.5z" fill="currentColor" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg viewBox="0 0 16 16" className="also-in-progress-chevron" aria-hidden="true">
      <path d="M6 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
