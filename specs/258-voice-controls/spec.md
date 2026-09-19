# 258 — Voice selection controls (AiVoiceSelector)

## Technical Context

- Baseline 35801daa; branch `258-voice-controls`; sole write root
  `/home/notroot/Documents/Code/personal/tauri-pdf-reader-258-voice-controls`.
- Owned files ONLY: `src/components/playback-bar/AiVoiceSelector.tsx` +
  `AiVoiceSelector.css` + this scoped test + own spec/report. No
  AiPlaybackBar/AiTtsSettings/NarrationCockpit edits, no hook/store changes,
  no new fetching/provider layer, no new UI dependency.
- Data contract reused as-is: `useAiTts()` (voices, selectedVoiceId, setVoice,
  initialized, initError, error, connections). `AiVoiceInfo` carries
  `provider: elevenlabs|local|groq` — grouping needs no new data.

## User Scenarios & Testing

1. Voices render grouped by provider via native `<optgroup>` (ElevenLabs /
   Local / Groq), first-seen order, labels preserved as `Name (labels)`.
2. Selector mounts in bar AND cockpit: each instance gets a unique DOM id via
   `useId`; label association is per-instance; tests use scoped locators
   (`within(container)`) — coordinated with p14, no shared literal id.
3. Unknown/null `selectedVoiceId` renders the explicit "Select a voice…"
   placeholder (`data-empty="true"`) — never the browser first-option
   fallback faking a selection.
4. `setVoice` resolves void even on failure (p16 contract): the control is
   `aria-busy` only while in flight; outcome is rendered from store state
   only — unchanged selection stays visible, no success announcement, store
   errors are never cleared by fulfillment.
5. `!initialized` + `initError`/`error` → truthful `role="status"` error note;
   uninitialized without error → renders nothing (unchanged semantics);
   voices empty → "Loading voices…" while any connection is `connecting`,
   else "No voices available".
6. Keyboard/feedback parity: `:focus-visible` outline (no outline:none),
   hover/active/disabled/pending states, `prefers-reduced-motion` disables
   transitions, select shrinks (`clamp`) before clipping at narrow widths.
   Styling via existing tokens (`--text-xs`, `--space-*`, `--color-error-*`,
   `--transition-fast`) with literal fallbacks; dark/light coherent via the
   same token layer.

## Gates

- One runnable check:
  `pnpm test:run -- src/components/playback-bar/AiVoiceSelector.test.tsx`
  (251 serialized slot only; synthetic fixtures, no provider calls).
- Flash-authored: exact-head Codex Sol review before any acceptance (251/lead
  sequencing). READY sent once to 251 with root/files/hashes/command/caps.
