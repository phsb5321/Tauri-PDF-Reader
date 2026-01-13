import { useState, useEffect, useCallback } from 'react';
import { useDocumentStore } from '../../stores/document-store';
import { pdfService, OutlineItem } from '../../services/pdf-service';
import './TableOfContents.css';

interface TableOfContentsProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TableOfContents({ isOpen, onClose }: TableOfContentsProps) {
  const { pdfDocument, currentPage, setCurrentPage } = useDocumentStore();
  const [outline, setOutline] = useState<OutlineItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function loadOutline() {
      if (!pdfDocument || !isOpen) return;

      setIsLoading(true);
      try {
        const pdfOutline = await pdfService.getOutline(pdfDocument);
        setOutline(pdfOutline);
      } catch (err) {
        console.error('Failed to load outline:', err);
      } finally {
        setIsLoading(false);
      }
    }

    loadOutline();
  }, [pdfDocument, isOpen]);

  const handleItemClick = useCallback((pageNumber: number | null) => {
    if (pageNumber !== null) {
      setCurrentPage(pageNumber);
    }
  }, [setCurrentPage]);

  const toggleExpanded = useCallback((key: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="toc-backdrop" onClick={handleBackdropClick}>
      <div className="toc-panel">
        <div className="toc-header">
          <h2 className="toc-title">Table of Contents</h2>
          <button
            className="toc-close"
            onClick={onClose}
            aria-label="Close table of contents"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="toc-content">
          {isLoading ? (
            <div className="toc-loading">
              <div className="loading-spinner" />
              <p>Loading outline...</p>
            </div>
          ) : outline.length === 0 ? (
            <div className="toc-empty">
              <TocIcon />
              <p>No table of contents available</p>
              <span>This PDF does not have an embedded outline.</span>
            </div>
          ) : (
            <nav className="toc-nav" aria-label="Table of contents">
              <OutlineList
                items={outline}
                level={0}
                currentPage={currentPage}
                expandedItems={expandedItems}
                onItemClick={handleItemClick}
                onToggleExpand={toggleExpanded}
                parentKey=""
              />
            </nav>
          )}
        </div>
      </div>
    </div>
  );
}

interface OutlineListProps {
  items: OutlineItem[];
  level: number;
  currentPage: number;
  expandedItems: Set<string>;
  onItemClick: (pageNumber: number | null) => void;
  onToggleExpand: (key: string) => void;
  parentKey: string;
}

function OutlineList({
  items,
  level,
  currentPage,
  expandedItems,
  onItemClick,
  onToggleExpand,
  parentKey,
}: OutlineListProps) {
  return (
    <ul className="toc-list" style={{ paddingLeft: level > 0 ? 16 : 0 }}>
      {items.map((item, index) => {
        const itemKey = `${parentKey}-${index}`;
        const hasChildren = item.children.length > 0;
        const isExpanded = expandedItems.has(itemKey);
        const isCurrent = item.pageNumber === currentPage;

        return (
          <li key={itemKey} className="toc-item">
            <div className={`toc-item-row ${isCurrent ? 'current' : ''}`}>
              {hasChildren && (
                <button
                  className={`toc-expand-btn ${isExpanded ? 'expanded' : ''}`}
                  onClick={() => onToggleExpand(itemKey)}
                  aria-label={isExpanded ? 'Collapse' : 'Expand'}
                >
                  <ChevronIcon />
                </button>
              )}
              <button
                className="toc-item-btn"
                onClick={() => onItemClick(item.pageNumber)}
                disabled={item.pageNumber === null}
              >
                <span className="toc-item-title">{item.title}</span>
                {item.pageNumber !== null && (
                  <span className="toc-item-page">{item.pageNumber}</span>
                )}
              </button>
            </div>
            {hasChildren && isExpanded && (
              <OutlineList
                items={item.children}
                level={level + 1}
                currentPage={currentPage}
                expandedItems={expandedItems}
                onItemClick={onItemClick}
                onToggleExpand={onToggleExpand}
                parentKey={itemKey}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 16 16" className="icon" aria-hidden="true">
      <path
        d="M4.646 4.646a.5.5 0 01.708 0L8 7.293l2.646-2.647a.5.5 0 01.708.708L8.707 8l2.647 2.646a.5.5 0 01-.708.708L8 8.707l-2.646 2.647a.5.5 0 01-.708-.708L7.293 8 4.646 5.354a.5.5 0 010-.708z"
        fill="currentColor"
      />
    </svg>
  );
}

function TocIcon() {
  return (
    <svg viewBox="0 0 24 24" className="empty-icon" aria-hidden="true">
      <path
        d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"
        fill="currentColor"
        opacity="0.5"
      />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg viewBox="0 0 16 16" className="chevron-icon" aria-hidden="true">
      <path
        d="M6 4l4 4-4 4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
