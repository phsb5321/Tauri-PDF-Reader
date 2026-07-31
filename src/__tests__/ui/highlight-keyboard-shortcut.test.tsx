/**
 * Ctrl+Shift+H — commit the pending selection without touching the toolbar.
 *
 * The claim being asserted is the one that matters for cost-per-highlight: a
 * selection plus one chord produces a persisted highlight in the default
 * colour. Not "the listener is registered" — the highlight itself.
 *
 * Only the persistence hook is mocked (it goes over IPC). The stores are the
 * real ones, so the default colour comes from the real settings store and the
 * created highlight lands in the real document store.
 */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useHighlightCreation } from '../../components/pdf-viewer/HighlightCreationHandler';
import { useDocumentStore } from '../../stores/document-store';
import { useSettingsStore } from '../../stores/settings-store';
import type { TextSelection } from '../../components/TextLayer';

const createHighlight = vi.fn();

vi.mock('../../hooks/useHighlightPersistence', () => ({
  useHighlightPersistence: () => ({
    createHighlight,
    retryFailed: vi.fn(),
    pendingCount: 0,
  }),
}));

const SELECTION: TextSelection = {
  text: 'Reliability means the system continues to work correctly.',
  rects: [{ x: 10, y: 20, width: 300, height: 12 }],
  pageNumber: 42,
  anchorNode: null,
  focusNode: null,
};

function press(
  key: string,
  modifiers: Partial<Record<'ctrlKey' | 'shiftKey' | 'altKey', boolean>> = {}
): void {
  act(() => {
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key, bubbles: true, ...modifiers })
    );
  });
}

function mount() {
  return renderHook(() =>
    useHighlightCreation({
      documentId: 'doc-1',
      scale: 1,
      containerRef: { current: document.createElement('div') },
    })
  );
}

describe('Ctrl+Shift+H highlights the pending selection', () => {
  beforeEach(() => {
    createHighlight.mockClear();
    useDocumentStore.setState({ highlights: [] });
  });

  it('persists a highlight in the default colour, without a toolbar click', () => {
    const { result } = mount();
    act(() => result.current.handleTextSelect(SELECTION));
    expect(result.current.pendingSelection).not.toBeNull();

    press('H', { ctrlKey: true, shiftKey: true });

    expect(createHighlight).toHaveBeenCalledTimes(1);
    const saved = createHighlight.mock.calls[0][0];
    expect(saved).toMatchObject({
      documentId: 'doc-1',
      pageNumber: 42,
      textContent: SELECTION.text,
      color: useSettingsStore.getState().highlightDefaultColor,
      note: null,
    });

    // The store update is what the page re-renders from.
    expect(useDocumentStore.getState().highlights).toHaveLength(1);

    // And the selection is consumed, so holding the chord cannot stack
    // duplicates of the same span.
    expect(result.current.pendingSelection).toBeNull();
    press('H', { ctrlKey: true, shiftKey: true });
    expect(createHighlight).toHaveBeenCalledTimes(1);
  });

  it('stays inert with no selection pending', () => {
    mount();
    press('H', { ctrlKey: true, shiftKey: true });
    expect(createHighlight).not.toHaveBeenCalled();
  });

  it('does not fire on the chords it must not shadow', () => {
    const { result } = mount();
    act(() => result.current.handleTextSelect(SELECTION));

    press('h', { ctrlKey: true }); // Ctrl+H — toggles the highlights panel
    press('H', { shiftKey: true }); // plain Shift+H — typing
    press('H', { ctrlKey: true, shiftKey: true, altKey: true }); // different chord
    press('G', { ctrlKey: true, shiftKey: true }); // wrong key

    expect(createHighlight).not.toHaveBeenCalled();
    expect(result.current.pendingSelection).not.toBeNull();
  });

  it('accepts the lowercase key report, since layouts differ on whether Shift folds', () => {
    const { result } = mount();
    act(() => result.current.handleTextSelect(SELECTION));

    press('h', { ctrlKey: true, shiftKey: true });

    expect(createHighlight).toHaveBeenCalledTimes(1);
  });
});
