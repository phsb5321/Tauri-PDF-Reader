import { open } from '@tauri-apps/plugin-dialog';
import { useDocumentStore } from '../stores/document-store';
import { pdfService } from '../services/pdf-service';
import { commands } from '../lib/bindings';
import { PageNavigation } from './PageNavigation';
import { ZoomControls } from './ZoomControls';
import './Toolbar.css';

export function Toolbar() {
  const {
    currentDocument,
    pdfDocument,
    isLoading,
    setDocument,
    setPdfDocument,
    setLoading,
    setError,
    setCurrentPage,
  } = useDocumentStore();

  const handleOpenFile = async () => {
    try {
      setLoading(true);
      setError(null);

      // Open file dialog for PDF selection
      const selected = await open({
        multiple: false,
        filters: [
          {
            name: 'PDF Documents',
            extensions: ['pdf'],
          },
        ],
      });

      if (!selected) {
        setLoading(false);
        return;
      }

      const filePath = selected as string;

      // Load the PDF document
      const pdf = await pdfService.loadDocument(filePath);
      setPdfDocument(pdf);

      // Check if document exists in library (using tauri-specta generated bindings)
      const existingResult = await commands.libraryGetDocumentByPath(filePath);
      let document = existingResult.status === 'ok' ? existingResult.data : null;

      if (document) {
        // Document exists, mark as opened and restore progress
        const openResult = await commands.libraryOpenDocument(document.id);
        if (openResult.status === 'ok') {
          document = openResult.data;
          setCurrentPage(document.currentPage);
        }
      } else {
        // New document, add to library
        const addResult = await commands.libraryAddDocument(filePath, null, pdf.numPages);
        if (addResult.status === 'error') {
          throw new Error(addResult.error);
        }
        document = addResult.data;
      }

      // Update page count if it wasn't set
      if (!document.pageCount) {
        await commands.libraryUpdateDocument(document.id, null, pdf.numPages, null);
        document = { ...document, pageCount: pdf.numPages };
      }

      setDocument(document);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to open PDF';
      setError(message);
      console.error('Error opening PDF:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="toolbar">
      <div className="toolbar-section toolbar-left">
        <button
          className="toolbar-button open-button"
          onClick={handleOpenFile}
          disabled={isLoading}
          title="Open PDF file"
        >
          <svg viewBox="0 0 24 24" className="toolbar-icon">
            <path d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h6l2 2h6a2 2 0 012 2v10a2 2 0 01-2 2z" />
          </svg>
          <span className="button-text">Open</span>
        </button>

        {currentDocument && (
          <span className="document-title" title={currentDocument.filePath}>
            {currentDocument.title || 'Untitled'}
          </span>
        )}
      </div>

      <div className="toolbar-section toolbar-center">
        {pdfDocument && <PageNavigation />}
      </div>

      <div className="toolbar-section toolbar-right">
        {pdfDocument && <ZoomControls />}
      </div>
    </div>
  );
}
