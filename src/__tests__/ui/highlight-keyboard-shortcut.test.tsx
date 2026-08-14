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

  it('creates one highlight when the chord is held down, not one per repeat', () => {
    // Harsher than a real keyboard: an auto-repeat burst arrives as separate
    // tasks, so React flushes the `pendingSelection = null` update between
    // them. Dispatching the whole burst inside ONE act() denies it that flush,
    // which is the only way the handler could still be holding the stale
    // selection when the second event lands.
    const { result } = mount();
    act(() => result.current.handleTextSelect(SELECTION));

    act(() => {
      for (let i = 0; i < 5; i++) {
        document.dispatchEvent(
          new KeyboardEvent('keydown', {
            key: 'H',
            ctrlKey: true,
            shiftKey: true,
            repeat: i > 0,
            bubbles: true,
          })
        );
      }
    });

    expect(createHighlight).toHaveBeenCalledTimes(1);
    expect(useDocumentStore.getState().highlights).toHaveLength(1);
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

  it('defers the success callback until the persistence attempt completes', async () => {
    // The exact-head Codex review's MAJOR (toast-before-write): the handler
    // must gate its success UX on the write attempt — "Highlight created"
    // (the onSuccess callback next to the toast) must never precede the
    // backend write. Pre-fix the callback fired synchronously after
    // enqueueing, before the IPC had even started.
    let resolveCreate!: () => void;
    createHighlight.mockImplementationOnce(
      () =>
        new Promise<{ failed: boolean; failedIds: string[] }>((r) => {
          resolveCreate = () => r({ failed: false, failedIds: [] });
        }),
    );

    const onSuccess = vi.fn();
    const { result } = renderHook(() =>
      useHighlightCreation({
        documentId: 'doc-1',
        scale: 1,
        containerRef: { current: document.createElement('div') },
        onSuccess,
      }),
    );
    act(() => result.current.handleTextSelect(SELECTION));
    press('H', { ctrlKey: true, shiftKey: true });

    expect(createHighlight).toHaveBeenCalledTimes(1);
    // The write is still in flight — no success signal yet.
    expect(onSuccess).not.toHaveBeenCalled();

    await act(async () => {
      resolveCreate();
    });
    expect(onSuccess).toHaveBeenCalledTimes(1);
    // The store update still lands immediately (the page renders the
    // highlight regardless of persistence timing).
    expect(useDocumentStore.getState().highlights).toHaveLength(1);
  });

  it('does NOT signal success when the persistence attempt failed', async () => {
    // A failed first attempt resolves { failed: true } with THIS highlight's
    // id in failedIds (the background retry path re-queues and surfaces via
    // onError) — the success UX must not fire; "Highlight created" would be
    // a lie for a write that did not land (exact-head Codex review, MAJOR).
    createHighlight.mockImplementationOnce(() =>
      Promise.resolve({
        failed: true,
        error: new Error('backend down'),
        // The handler adds the highlight to the store BEFORE calling
        // createHighlight, so the generated id is already knowable here.
        failedIds: [useDocumentStore.getState().highlights[0].id],
      }),
    );

    const onSuccess = vi.fn();
    const { result } = renderHook(() =>
      useHighlightCreation({
        documentId: 'doc-1',
        scale: 1,
        containerRef: { current: document.createElement('div') },
        onSuccess,
      }),
    );
    act(() => result.current.handleTextSelect(SELECTION));
    press('H', { ctrlKey: true, shiftKey: true });

    await act(async () => {
      await Promise.resolve();
    });
    expect(onSuccess).not.toHaveBeenCalled();
    // The store update still lands (the page shows the highlight; the
    // retry path owns eventual persistence).
    expect(useDocumentStore.getState().highlights).toHaveLength(1);
  });

  it("signals success when a sibling's write failed but this one landed", async () => {
    // The pass outcome is shared across the entries it drains: a failing
    // sibling (a different highlight id in failedIds) must not suppress
    // THIS highlight's success signal when its own write landed (exact-head
    // Codex review, MAJOR).
    createHighlight.mockImplementationOnce(() =>
      Promise.resolve({
        failed: true,
        error: new Error('backend down'),
        failedIds: ['some-other-highlight-id'],
      }),
    );

    const onSuccess = vi.fn();
    const { result } = renderHook(() =>
      useHighlightCreation({
        documentId: 'doc-1',
        scale: 1,
        containerRef: { current: document.createElement('div') },
        onSuccess,
      }),
    );
    act(() => result.current.handleTextSelect(SELECTION));
    press('H', { ctrlKey: true, shiftKey: true });

    await act(async () => {
      await Promise.resolve();
    });
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });
});
