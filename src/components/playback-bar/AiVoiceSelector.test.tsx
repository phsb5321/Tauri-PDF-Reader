/**
 * Scoped checks for AiVoiceSelector (spec 258).
 *
 * Synthetic hook fixtures only — no provider calls, no store/network. The
 * useAiTts mock models the production contract per p16: setVoice catches,
 * logs, and RESOLVES void; fulfillment is not a success signal, so the
 * component must keep rendering store state. Locators are scoped per
 * instance (the selector mounts in both AiPlaybackBar and NarrationCockpit).
 *
 * Run in the 251 serialized slot:
 *   pnpm test:run -- src/components/playback-bar/AiVoiceSelector.test.tsx
 */

import { cleanup, fireEvent, render, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AiVoiceInfo } from '../../lib/api/ai-tts';
import { AiVoiceSelector } from './AiVoiceSelector';

const hookState = vi.hoisted(() => ({
  current: {
    voices: [] as AiVoiceInfo[],
    selectedVoiceId: null as string | null,
    setVoice: vi.fn(async () => {}),
    initialized: true,
    initError: null as string | null,
    error: null as string | null,
    connections: {
      elevenlabs: { status: 'connected', error: null },
      local: { status: 'connected', error: null },
      groq: { status: 'connected', error: null },
    },
  },
}));

vi.mock('../../hooks/useAiTts', () => ({
  useAiTts: () => hookState.current,
}));

const VOICES: AiVoiceInfo[] = [
  {
    id: 'el-1',
    name: 'Rachel',
    provider: 'elevenlabs',
    previewUrl: null,
    labels: { gender: 'female' },
  },
  {
    id: 'el-2',
    name: 'Adam',
    provider: 'elevenlabs',
    previewUrl: null,
    labels: null,
  },
  { id: 'loc-1', name: 'Piper', provider: 'local', previewUrl: null, labels: null },
  { id: 'grq-1', name: 'Playai', provider: 'groq', previewUrl: null, labels: null },
];

function setHookState(overrides: Partial<(typeof hookState)['current']>): void {
  hookState.current = {
    ...hookState.current,
    setVoice: vi.fn(async () => {}),
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
});

describe('AiVoiceSelector', () => {
  it('groups voices by provider with native optgroups and preserved labels', () => {
    setHookState({ voices: VOICES, selectedVoiceId: 'el-1' });
    const { container } = render(<AiVoiceSelector />);
    const select = within(container).getByLabelText('Voice') as HTMLSelectElement;
    const groups = Array.from(select.querySelectorAll('optgroup'));
    expect(groups.map((group) => group.label)).toEqual([
      'ElevenLabs',
      'Local',
      'Groq',
    ]);
    const rachel = groups[0].querySelector('option[value="el-1"]');
    expect(rachel?.textContent).toBe('Rachel (female)');
  });

  it('gives each mounted instance a unique id and working label association', () => {
    setHookState({ voices: VOICES, selectedVoiceId: 'el-1' });
    const first = render(<AiVoiceSelector />);
    const second = render(<AiVoiceSelector />);
    const firstSelect = within(first.container).getByLabelText(
      'Voice',
    ) as HTMLSelectElement;
    const secondSelect = within(second.container).getByLabelText(
      'Voice',
    ) as HTMLSelectElement;
    expect(firstSelect.id).not.toBe(secondSelect.id);
    expect(firstSelect.id).toBeTruthy();
    // Label association is per-instance, not a shared literal id.
    expect(
      first.container.querySelector(`label[for="${firstSelect.id}"]`),
    ).not.toBeNull();
  });

  it('never fakes a selection: unknown/null id shows the placeholder, not the first option', () => {
    setHookState({ voices: VOICES, selectedVoiceId: 'ghost-id' });
    const { container } = render(<AiVoiceSelector />);
    const select = within(container).getByLabelText('Voice') as HTMLSelectElement;
    expect(select.value).toBe('');
    expect(select.selectedOptions[0]?.textContent).toBe('Select a voice…');
    expect(select.dataset.empty).toBe('true');
  });

  it('binds the store selection strictly when the id is known', () => {
    setHookState({ voices: VOICES, selectedVoiceId: 'grq-1' });
    const { container } = render(<AiVoiceSelector />);
    const select = within(container).getByLabelText('Voice') as HTMLSelectElement;
    expect(select.value).toBe('grq-1');
    expect(select.dataset.empty).toBe('false');
  });

  it('keeps store truth on failure: resolved setVoice without store change shows no success', async () => {
    setHookState({
      voices: VOICES,
      selectedVoiceId: 'el-1',
      // Production contract: setVoice catches/logs and resolves void even on
      // failure; the store selection stays 'el-1'.
      setVoice: vi.fn(async () => {}),
    });
    const { container } = render(<AiVoiceSelector />);
    const select = within(container).getByLabelText('Voice') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'el-2' } });
    await waitFor(() => expect(select.getAttribute('aria-busy')).toBe('false'));
    // No success announcement; the control still shows the store selection.
    expect(container.querySelector('[role="status"]')).toBeNull();
    expect(select.value).toBe('el-1');
    expect(hookState.current.setVoice).toHaveBeenCalledWith('el-2');
  });

  it('marks the control busy only while the setVoice promise is in flight', async () => {
    setHookState({ voices: VOICES, selectedVoiceId: 'el-1' });
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    setHookState({
      voices: VOICES,
      selectedVoiceId: 'el-1',
      setVoice: vi.fn(() => gate),
    });
    const { container } = render(<AiVoiceSelector />);
    const select = within(container).getByLabelText('Voice') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'loc-1' } });
    expect(select.getAttribute('aria-busy')).toBe('true');
    expect(select.className).toContain('is-pending');
    release();
    await waitFor(() => expect(select.getAttribute('aria-busy')).toBe('false'));
  });

  it('shows truthful error, loading, and empty feedback instead of hiding', () => {
    setHookState({
      initialized: false,
      initError: 'API key missing',
      voices: [],
    });
    const { container } = render(<AiVoiceSelector />);
    const note = within(container).getByRole('status');
    expect(note.textContent).toBe('API key missing');
    expect(note.className).toContain('is-error');

    setHookState({ initialized: false, initError: null, error: null });
    expect(render(<AiVoiceSelector />).container.textContent).toBe('');

    setHookState({
      initialized: true,
      voices: [],
      connections: {
        elevenlabs: { status: 'connecting', error: null },
        local: { status: 'connected', error: null },
        groq: { status: 'connected', error: null },
      },
    });
    const loading = render(<AiVoiceSelector />);
    expect(within(loading.container).getByRole('status').textContent).toBe(
      'Loading voices…',
    );

    // Explicit connected-empty fixture: the previous case left elevenlabs
    // connecting — a spread alone would leak it and show "Loading voices…".
    setHookState({
      initialized: true,
      voices: [],
      connections: {
        elevenlabs: { status: 'connected', error: null },
        local: { status: 'connected', error: null },
        groq: { status: 'connected', error: null },
      },
    });
    const empty = render(<AiVoiceSelector />);
    expect(within(empty.container).getByRole('status').textContent).toBe(
      'No voices available',
    );
  });

  it('disables the control via the prop and while uninitialized', () => {
    setHookState({ voices: VOICES, selectedVoiceId: 'el-1' });
    const { container, unmount } = render(<AiVoiceSelector disabled />);
    expect(
      (within(container).getByLabelText('Voice') as HTMLSelectElement).disabled,
    ).toBe(true);
    unmount();
    setHookState({ voices: VOICES, initialized: false });
    const uninitialized = render(<AiVoiceSelector />);
    expect(uninitialized.container.querySelector('select')).toBeNull();
  });

  it('shows loading while uninitialized but connecting — no invented quiet', () => {
    setHookState({
      initialized: false,
      initError: null,
      error: null,
      voices: [],
      connections: {
        elevenlabs: { status: 'connecting', error: null },
        local: { status: 'connected', error: null },
        groq: { status: 'connected', error: null },
      },
    });
    const { container } = render(<AiVoiceSelector />);
    const note = within(container).getByRole('status');
    expect(note.textContent).toBe('Loading voices…');
    expect(note.className).toContain('is-loading');
  });

  it('prefers store error over empty text and shows it beside a populated selector', () => {
    // Explicit connected fixtures: test 9 left elevenlabs connecting.
    const allConnected = {
      elevenlabs: { status: 'connected', error: null },
      local: { status: 'connected', error: null },
      groq: { status: 'connected', error: null },
    };
    setHookState({
      initialized: true,
      voices: [],
      error: 'Voice list unavailable',
      selectedVoiceId: null,
      connections: allConnected,
    });
    const { container } = render(<AiVoiceSelector />);
    expect(within(container).getByRole('status').textContent).toBe(
      'Voice list unavailable',
    );

    setHookState({
      voices: VOICES,
      selectedVoiceId: 'el-1',
      error: 'Switch failed: quota',
      connections: allConnected,
    });
    const populated = render(<AiVoiceSelector />);
    const note = within(populated.container).getByRole('status');
    expect(note.textContent).toBe('Switch failed: quota');
    expect(note.className).toContain('is-error');
    const select = within(populated.container).getByLabelText(
      'Voice',
    ) as HTMLSelectElement;
    expect(select.getAttribute('aria-invalid')).toBe('true');
    // The error does not touch the selection.
    expect(select.value).toBe('el-1');
  });
});
