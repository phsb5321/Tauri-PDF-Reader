import { useState, useEffect, useCallback } from 'react';
import { useDocumentStore } from '../stores/document-store';
import { libraryService } from '../services/library-service';
import './PageNavigation.css';

export function PageNavigation() {
  const { currentDocument, currentPage, totalPages, setCurrentPage } = useDocumentStore();
  const [inputValue, setInputValue] = useState(String(currentPage));

  // Sync input value with current page
  useEffect(() => {
    setInputValue(String(currentPage));
  }, [currentPage]);

  const saveProgress = useCallback(async (page: number) => {
    if (currentDocument) {
      try {
        await libraryService.updateProgress(currentDocument.id, page);
      } catch (error) {
        console.error('Failed to save reading progress:', error);
      }
    }
  }, [currentDocument]);

  const goToPage = useCallback((page: number) => {
    const clampedPage = Math.max(1, Math.min(page, totalPages));
    setCurrentPage(clampedPage);
    saveProgress(clampedPage);
  }, [totalPages, setCurrentPage, saveProgress]);

  const handlePrevPage = () => {
    if (currentPage > 1) {
      goToPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      goToPage(currentPage + 1);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const page = parseInt(inputValue, 10);
      if (!isNaN(page)) {
        goToPage(page);
      } else {
        setInputValue(String(currentPage));
      }
    }
  };

  const handleInputBlur = () => {
    const page = parseInt(inputValue, 10);
    if (!isNaN(page)) {
      goToPage(page);
    } else {
      setInputValue(String(currentPage));
    }
  };

  return (
    <div className="page-navigation">
      <button
        className="nav-button"
        onClick={handlePrevPage}
        disabled={currentPage <= 1}
        title="Previous page (Left Arrow)"
        aria-label="Previous page"
      >
        <svg viewBox="0 0 24 24" className="nav-icon">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>

      <div className="page-input-container">
        <input
          type="text"
          className="page-input"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleInputKeyDown}
          onBlur={handleInputBlur}
          aria-label="Current page"
        />
        <span className="page-separator">/</span>
        <span className="total-pages">{totalPages}</span>
      </div>

      <button
        className="nav-button"
        onClick={handleNextPage}
        disabled={currentPage >= totalPages}
        title="Next page (Right Arrow)"
        aria-label="Next page"
      >
        <svg viewBox="0 0 24 24" className="nav-icon">
          <path d="M9 18l6-6-6-6" />
        </svg>
      </button>
    </div>
  );
}
