import "./ParagraphActionOverlay.css";

export interface ParagraphActionLayout {
  index: number;
  sourceStart: number;
  narrationText: string;
  previewText: string;
  x: number;
  y: number;
}

interface ParagraphActionOverlayProps {
  actions: readonly ParagraphActionLayout[];
  onReadFromHere: (text: string, baseOffset: number) => void;
}

export function paragraphActionName(index: number, text: string): string {
  const normalized = text.trim().replace(/\s+/gu, " ");
  const points = Array.from(normalized);
  let preview = normalized;
  if (points.length > 48) {
    const candidate = points.slice(0, 48).join("");
    const wordBoundary = candidate.lastIndexOf(" ");
    preview = `${wordBoundary >= 24 ? candidate.slice(0, wordBoundary) : candidate}…`;
  }
  return `Read from paragraph ${index + 1}: ${preview}`;
}

export function ParagraphActionOverlay({
  actions,
  onReadFromHere,
}: Readonly<ParagraphActionOverlayProps>) {
  if (actions.length === 0) return null;

  return (
    <div
      className="paragraph-action-overlay"
      role="group"
      aria-label="Paragraph narration"
    >
      {actions.map((action) => (
        <button
          key={`${action.sourceStart}-${action.index}`}
          type="button"
          className="paragraph-action-button"
          style={{ left: action.x, top: action.y }}
          aria-label={paragraphActionName(action.index, action.previewText)}
          onClick={() =>
            onReadFromHere(action.narrationText, action.sourceStart)
          }
        >
          <span className="paragraph-action-tick" aria-hidden="true" />
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M5 3.5v9L12 8z" fill="currentColor" />
          </svg>
        </button>
      ))}
    </div>
  );
}
