/**
 * Unit tests for AI TTS state machine
 *
 * Tests valid state transitions and ensures invalid transitions are rejected.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useAiTtsStore } from '../../stores/ai-tts-store';

describe('AI TTS State Machine', () => {
  beforeEach(() => {
    // Reset store to initial state
    useAiTtsStore.getState().reset();
    // Ensure we start in idle state
    useAiTtsStore.setState({ playbackState: 'idle' });
  });

  describe('VALID_TRANSITIONS map', () => {
    it('allows idle -> loading', () => {
      expect(useAiTtsStore.getState().playbackState).toBe('idle');
      const result = useAiTtsStore.getState().transitionTo('loading');
      expect(result).toBe(true);
      expect(useAiTtsStore.getState().playbackState).toBe('loading');
    });

    it('allows idle -> error', () => {
      useAiTtsStore.setState({ playbackState: 'idle' });
      const result = useAiTtsStore.getState().transitionTo('error');
      expect(result).toBe(true);
      expect(useAiTtsStore.getState().playbackState).toBe('error');
    });

    it('allows loading -> playing', () => {
      useAiTtsStore.setState({ playbackState: 'loading' });
      const result = useAiTtsStore.getState().transitionTo('playing');
      expect(result).toBe(true);
      expect(useAiTtsStore.getState().playbackState).toBe('playing');
    });

    it('allows loading -> idle (cancel)', () => {
      useAiTtsStore.setState({ playbackState: 'loading' });
      const result = useAiTtsStore.getState().transitionTo('idle');
      expect(result).toBe(true);
      expect(useAiTtsStore.getState().playbackState).toBe('idle');
    });

    it('allows loading -> error', () => {
      useAiTtsStore.setState({ playbackState: 'loading' });
      const result = useAiTtsStore.getState().transitionTo('error');
      expect(result).toBe(true);
      expect(useAiTtsStore.getState().playbackState).toBe('error');
    });

    it('allows playing -> paused', () => {
      useAiTtsStore.setState({ playbackState: 'playing' });
      const result = useAiTtsStore.getState().transitionTo('paused');
      expect(result).toBe(true);
      expect(useAiTtsStore.getState().playbackState).toBe('paused');
    });

    it('allows playing -> idle (stop)', () => {
      useAiTtsStore.setState({ playbackState: 'playing' });
      const result = useAiTtsStore.getState().transitionTo('idle');
      expect(result).toBe(true);
      expect(useAiTtsStore.getState().playbackState).toBe('idle');
    });

    it('allows playing -> error', () => {
      useAiTtsStore.setState({ playbackState: 'playing' });
      const result = useAiTtsStore.getState().transitionTo('error');
      expect(result).toBe(true);
      expect(useAiTtsStore.getState().playbackState).toBe('error');
    });

    it('allows paused -> playing (resume)', () => {
      useAiTtsStore.setState({ playbackState: 'paused' });
      const result = useAiTtsStore.getState().transitionTo('playing');
      expect(result).toBe(true);
      expect(useAiTtsStore.getState().playbackState).toBe('playing');
    });

    it('allows paused -> idle (stop)', () => {
      useAiTtsStore.setState({ playbackState: 'paused' });
      const result = useAiTtsStore.getState().transitionTo('idle');
      expect(result).toBe(true);
      expect(useAiTtsStore.getState().playbackState).toBe('idle');
    });

    it('allows paused -> error', () => {
      useAiTtsStore.setState({ playbackState: 'paused' });
      const result = useAiTtsStore.getState().transitionTo('error');
      expect(result).toBe(true);
      expect(useAiTtsStore.getState().playbackState).toBe('error');
    });

    it('allows error -> idle (reset)', () => {
      useAiTtsStore.setState({ playbackState: 'error' });
      const result = useAiTtsStore.getState().transitionTo('idle');
      expect(result).toBe(true);
      expect(useAiTtsStore.getState().playbackState).toBe('idle');
    });

    it('allows error -> loading (retry)', () => {
      useAiTtsStore.setState({ playbackState: 'error' });
      const result = useAiTtsStore.getState().transitionTo('loading');
      expect(result).toBe(true);
      expect(useAiTtsStore.getState().playbackState).toBe('loading');
    });
  });

  describe('invalid transitions', () => {
    it('rejects idle -> playing (must go through loading)', () => {
      useAiTtsStore.setState({ playbackState: 'idle' });
      const result = useAiTtsStore.getState().transitionTo('playing');
      expect(result).toBe(false);
      expect(useAiTtsStore.getState().playbackState).toBe('idle'); // unchanged
    });

    it('rejects idle -> paused', () => {
      useAiTtsStore.setState({ playbackState: 'idle' });
      const result = useAiTtsStore.getState().transitionTo('paused');
      expect(result).toBe(false);
      expect(useAiTtsStore.getState().playbackState).toBe('idle');
    });

    it('rejects loading -> paused (must be playing first)', () => {
      useAiTtsStore.setState({ playbackState: 'loading' });
      const result = useAiTtsStore.getState().transitionTo('paused');
      expect(result).toBe(false);
      expect(useAiTtsStore.getState().playbackState).toBe('loading');
    });

    it('rejects playing -> loading (must stop first)', () => {
      useAiTtsStore.setState({ playbackState: 'playing' });
      const result = useAiTtsStore.getState().transitionTo('loading');
      expect(result).toBe(false);
      expect(useAiTtsStore.getState().playbackState).toBe('playing');
    });

    it('rejects paused -> loading (must stop first)', () => {
      useAiTtsStore.setState({ playbackState: 'paused' });
      const result = useAiTtsStore.getState().transitionTo('loading');
      expect(result).toBe(false);
      expect(useAiTtsStore.getState().playbackState).toBe('paused');
    });

    it('rejects error -> playing (must go through loading)', () => {
      useAiTtsStore.setState({ playbackState: 'error' });
      const result = useAiTtsStore.getState().transitionTo('playing');
      expect(result).toBe(false);
      expect(useAiTtsStore.getState().playbackState).toBe('error');
    });

    it('rejects error -> paused', () => {
      useAiTtsStore.setState({ playbackState: 'error' });
      const result = useAiTtsStore.getState().transitionTo('paused');
      expect(result).toBe(false);
      expect(useAiTtsStore.getState().playbackState).toBe('error');
    });
  });

  describe('force parameter', () => {
    it('forces invalid transition when force=true', () => {
      useAiTtsStore.setState({ playbackState: 'idle' });
      const result = useAiTtsStore.getState().transitionTo('playing', true);
      expect(result).toBe(true);
      expect(useAiTtsStore.getState().playbackState).toBe('playing');
    });
  });

  describe('typical playback flow', () => {
    it('handles complete playback cycle: idle -> loading -> playing -> paused -> playing -> idle', () => {
      expect(useAiTtsStore.getState().playbackState).toBe('idle');

      // Start loading
      expect(useAiTtsStore.getState().transitionTo('loading')).toBe(true);
      expect(useAiTtsStore.getState().playbackState).toBe('loading');

      // Start playing
      expect(useAiTtsStore.getState().transitionTo('playing')).toBe(true);
      expect(useAiTtsStore.getState().playbackState).toBe('playing');

      // Pause
      expect(useAiTtsStore.getState().transitionTo('paused')).toBe(true);
      expect(useAiTtsStore.getState().playbackState).toBe('paused');

      // Resume
      expect(useAiTtsStore.getState().transitionTo('playing')).toBe(true);
      expect(useAiTtsStore.getState().playbackState).toBe('playing');

      // Stop
      expect(useAiTtsStore.getState().transitionTo('idle')).toBe(true);
      expect(useAiTtsStore.getState().playbackState).toBe('idle');
    });

    it('handles error recovery: idle -> loading -> error -> idle -> loading -> playing', () => {
      expect(useAiTtsStore.getState().playbackState).toBe('idle');

      // Start loading
      expect(useAiTtsStore.getState().transitionTo('loading')).toBe(true);

      // Error occurs
      expect(useAiTtsStore.getState().transitionTo('error')).toBe(true);
      expect(useAiTtsStore.getState().playbackState).toBe('error');

      // Reset
      expect(useAiTtsStore.getState().transitionTo('idle')).toBe(true);

      // Retry
      expect(useAiTtsStore.getState().transitionTo('loading')).toBe(true);
      expect(useAiTtsStore.getState().transitionTo('playing')).toBe(true);
      expect(useAiTtsStore.getState().playbackState).toBe('playing');
    });
  });
});
