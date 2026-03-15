import "./PdfSkeleton.css";

interface PdfSkeletonProps {
  className?: string;
}

/**
 * Skeleton loading placeholder for PDF pages.
 * Shows expected page layout with animated pulse effect.
 */
export function PdfSkeleton({ className = "" }: PdfSkeletonProps) {
  return (
    <div className={`pdf-skeleton ${className}`} aria-label="Loading PDF page">
      <div className="pdf-skeleton__page">
        {/* Simulated text lines */}
        <div className="pdf-skeleton__line pdf-skeleton__line--title" />
        <div className="pdf-skeleton__line pdf-skeleton__line--full" />
        <div className="pdf-skeleton__line pdf-skeleton__line--full" />
        <div className="pdf-skeleton__line pdf-skeleton__line--short" />
        <div className="pdf-skeleton__spacer" />
        <div className="pdf-skeleton__line pdf-skeleton__line--full" />
        <div className="pdf-skeleton__line pdf-skeleton__line--full" />
        <div className="pdf-skeleton__line pdf-skeleton__line--medium" />
        <div className="pdf-skeleton__spacer" />
        <div className="pdf-skeleton__line pdf-skeleton__line--full" />
        <div className="pdf-skeleton__line pdf-skeleton__line--full" />
        <div className="pdf-skeleton__line pdf-skeleton__line--full" />
        <div className="pdf-skeleton__line pdf-skeleton__line--short" />
      </div>
    </div>
  );
}
