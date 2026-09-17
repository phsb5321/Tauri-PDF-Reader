# Feature Specification: 261 — narration cockpit key isolation and lock feedback

**Branch/worktree:** `261-narration-controls` @ `35801daa` (locked, exclusive pW)
**Own files:** `NarrationCockpit.tsx`, `NarrationCockpit.css`,
`src/__tests__/ui/narration-cockpit-keys-261.test.tsx`, specs/261-narration-controls/.

## Problem

The cockpit's Arrow/Home/End tab navigation calls only `preventDefault` — the
reader's document-level keydown handler (PdfViewer, Home/End page jumps)
still receives those events, so tabbing inside the cockpit also jumps
document pages. Additionally, when transport is active the cockpit's
controls silently disable with no explanation.

## User Scenarios & Testing

1. **Isolated tab navigation (keyboard):** with focus on a cockpit tab,
   ArrowRight/ArrowLeft/Home/End move `aria-selected` across the four tabs
   and NEVER reach the reader's document-level keydown seam (verified with a
   real registered window handler).
2. **Unconsumed keys flow:** keys the cockpit does not consume (e.g. `b`)
   still propagate to the document-level seam with the tab as target.
3. **Escape preserved:** Escape closes the cockpit (parent return-focus path
   in AiPlaybackBar, unchanged) and stays isolated from the seam.
4. **Truthful lock note:** with `controlsDisabled` the cockpit shows a
   neutral lock note (`role="note"`); the single bool cannot name the
   reason (transport, setup, or provider switching all pass it), so the
   note claims none — landing wording: "These controls are temporarily
   locked." Without the flag, no note renders.

## Functional requirements

- **FR-261-1:** Consumed tab keys are isolated in the owned leaf
  (`preventDefault` + `stopPropagation`); unconsumed keys propagate.
- **FR-261-2:** `controlsDisabled` renders a truthful lock note bound ONLY to
  that flag (no invented paused/loading/state labels — transport lives in
  AiPlaybackBar).
- **FR-261-3:** Existing Escape close + parent settings-button return focus
  are preserved; no store/backend/AiPlaybackBar edits; existing tokens only.

## Out of scope

Transport buttons (AiPlaybackBar), speed/backend work, native combined
focus/transport journey (251 gate), global token/theme changes.
