import { useCallback } from 'react';
import { AppLayout } from '../layout/AppLayout';
import { Toolbar } from '../Toolbar';
import { PdfViewer } from '../PdfViewer';
import { AiPlaybackBar } from '../playback-bar/AiPlaybackBar';
import { useDocumentStore } from '../../stores/document-store';
import { pdfService } from '../../services/pdf-service';
import './ReaderView.css';

export function ReaderView() {
  const { pdfDocument, currentPage } = useDocumentStore();

  // Get text content from current page for TTS
  const getCurrentPageText = useCallback(async (): Promise<string | null> => {
    if (!pdfDocument) return null;

    try {
      const page = await pdfService.getPage(pdfDocument, currentPage);
      const textContent = await page.getTextContent();

      // Extract text from text items
      const text = textContent.items
        .map((item) => {
          if ('str' in item) {
            return item.str;
          }
          return '';
        })
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();

      return text || null;
    } catch (error) {
      console.error('Error extracting text:', error);
      return null;
    }
  }, [pdfDocument, currentPage]);

  return (
    <AppLayout
      header={<Toolbar />}
      footer={pdfDocument && <AiPlaybackBar getText={getCurrentPageText} />}
    >
      <PdfViewer />
    </AppLayout>
  );
}
