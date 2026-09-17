# Implementation Plan: 261 cockpit key isolation

## Technical Context

- NarrationCockpit is the settings-tabs surface (147 lines); transport
  buttons live in AiPlaybackBar (outside ownership). `controlsDisabled` is a
  single boolean (isPlaying/isPaused/isLoading/switchingProvider union).
- The reader's global keydown handler (PdfViewer.tsx:864) consumes
  Home/End for page jumps; cockpit tab navigation previously called only
  `preventDefault`, leaking every Arrow/Home/End to it.

## Design

1. `handleTabKeyDown`: `stopPropagation()` added beside the existing
   `preventDefault()` for consumed keys (Arrow/Home/End). Escape keeps its
   existing prevent+stop+onClose path; unconsumed keys return untouched and
   bubble.
2. `controlsDisabled` renders a `role="note"` lock line — truthful to the
   boolean only; styled with existing text tokens (muted, text-xs).
3. Test `narration-cockpit-keys-261.test.tsx`: a REAL window keydown seam
   registered per test; asserts consumed keys never reach it, unconsumed
   keys do (with target intact), Escape isolates + closes, and the lock note
   toggles with the flag.

## Verification

Authored-unrun (execution is 251's serialized slot):
`CI=true ./node_modules/.bin/vitest run src/__tests__/ui/narration-cockpit-keys-261.test.tsx --pool=forks --poolOptions.forks.singleFork`
then `pnpm typecheck`. Native combined focus/transport journey stays 251's.

## Rollback

Revert the slice; no store/backend/dependency changes.
