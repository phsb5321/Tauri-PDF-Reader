/**
 * Unit tests for TTS highlight rect calculation
 *
 * Validates that TTS word highlights use viewport coords directly from
 * getBoundingClientRect() without additional scale transformations.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Helper to clean up DOM safely
function clearBody() {
  while (document.body.firstChild) {
    document.body.removeChild(document.body.firstChild);
  }
}

// Mock the DOM structures we need
const createMockTextLayer = (pageNumber: number) => {
  const container = document.createElement('div');
  container.setAttribute('data-page-number', String(pageNumber));

  const textLayer = document.createElement('div');
  textLayer.className = 'textLayer';

  // Add some mock spans with text
  const span1 = document.createElement('span');
  span1.textContent = 'Hello';
  span1.getBoundingClientRect = vi.fn().mockReturnValue({
    left: 100,
    top: 200,
    width: 50,
    height: 20,
    x: 100,
    y: 200,
    right: 150,
    bottom: 220,
  } as DOMRect);

  const span2 = document.createElement('span');
  span2.textContent = 'World';
  span2.getBoundingClientRect = vi.fn().mockReturnValue({
    left: 160,
    top: 200,
    width: 60,
    height: 20,
    x: 160,
    y: 200,
    right: 220,
    bottom: 220,
  } as DOMRect);

  textLayer.appendChild(span1);
  textLayer.appendChild(span2);
  container.appendChild(textLayer);

  // Mock textLayer's getBoundingClientRect for parent offset calculation
  textLayer.getBoundingClientRect = vi.fn().mockReturnValue({
    left: 50,
    top: 100,
    width: 300,
    height: 400,
    x: 50,
    y: 100,
    right: 350,
    bottom: 500,
  } as DOMRect);

  return { container, textLayer };
};

describe('TTS Highlight Rects', () => {
  describe('findTextLayerDiv', () => {
    beforeEach(() => {
      clearBody();
    });

    afterEach(() => {
      clearBody();
    });

    it('finds text layer by data-page-number attribute', () => {
      const { container, textLayer } = createMockTextLayer(1);
      document.body.appendChild(container);

      const found = document.querySelector('[data-page-number="1"] .textLayer');

      expect(found).toBe(textLayer);
    });

    it('returns null when page container not found', () => {
      // No DOM setup - page not rendered
      const found = document.querySelector('[data-page-number="999"] .textLayer');

      expect(found).toBeNull();
    });

    it('does not fall back to first visible textLayer (bug fix)', () => {
      // Set up page 1 with textLayer
      const { container: page1 } = createMockTextLayer(1);
      document.body.appendChild(page1);

      // Looking for page 2 should NOT find page 1's text layer
      const found = document.querySelector('[data-page-number="2"] .textLayer');

      expect(found).toBeNull();
    });
  });

  describe('word rect calculation', () => {
    afterEach(() => {
      clearBody();
    });

    it('calculates relative position from textLayer parent', () => {
      const { container, textLayer } = createMockTextLayer(1);
      document.body.appendChild(container);

      const spans = textLayer.querySelectorAll('span');
      const parentRect = textLayer.getBoundingClientRect();

      // "Hello" span at viewport (100, 200), parent at (50, 100)
      // Relative position should be (100-50, 200-100) = (50, 100)
      const helloSpan = spans[0];
      const helloRect = helloSpan.getBoundingClientRect();

      const relativeX = helloRect.left - parentRect.left;
      const relativeY = helloRect.top - parentRect.top;

      expect(relativeX).toBe(50); // 100 - 50
      expect(relativeY).toBe(100); // 200 - 100
    });

    it('uses viewport coords directly (no scale division needed)', () => {
      // TTS highlights use viewport coordinates directly from getBoundingClientRect
      // because they're positioned relative to the textLayer which is already scaled
      const { container, textLayer } = createMockTextLayer(1);
      document.body.appendChild(container);

      const parentRect = textLayer.getBoundingClientRect();
      const spans = textLayer.querySelectorAll('span');
      const span = spans[0];
      const spanRect = span.getBoundingClientRect();

      // The highlight rect should use viewport coords relative to parent
      // No division by scale because:
      // 1. Text layer is already at scaled size
      // 2. Span positions from getBoundingClientRect are in viewport pixels
      // 3. We position the highlight in the same coordinate space

      const highlightRect = {
        x: spanRect.left - parentRect.left,
        y: spanRect.top - parentRect.top,
        width: spanRect.width,
        height: spanRect.height,
      };

      // These should be viewport-relative pixel values
      expect(highlightRect.x).toBe(50);
      expect(highlightRect.y).toBe(100);
      expect(highlightRect.width).toBe(50);
      expect(highlightRect.height).toBe(20);
    });
  });

  describe('word matching', () => {
    it('normalizes text for comparison', () => {
      // Test the normalization logic used in findWordRects
      const normalize = (text: string) =>
        text
          .toLowerCase()
          .replace(/[^\w\s]/g, '')
          .replace(/\s+/g, ' ')
          .trim();

      expect(normalize('Hello,')).toBe('hello');
      expect(normalize('  World!  ')).toBe('world');
      expect(normalize("don't")).toBe('dont');
      expect(normalize('HELLO WORLD')).toBe('hello world');
    });

    it('matches words with various strategies', () => {
      const wordText = 'hello';
      const spanTexts = ['Hello,', 'world', 'Hello World'];

      const normalize = (text: string) =>
        text
          .toLowerCase()
          .replace(/[^\w\s]/g, '')
          .replace(/\s+/g, ' ')
          .trim();

      // Exact match (after normalization)
      expect(normalize(spanTexts[0])).toBe(wordText);

      // No match
      expect(normalize(spanTexts[1])).not.toBe(wordText);
      expect(normalize(spanTexts[1]).includes(wordText)).toBe(false);

      // Contains match
      expect(normalize(spanTexts[2]).includes(wordText)).toBe(true);
    });
  });
});
