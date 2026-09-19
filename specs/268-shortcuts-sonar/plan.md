# Implementation Plan: 268 shortcuts Sonar fix

## Technical Context

TypeScript 5.6 + React 18 + vitest/jsdom. No new dependency.
`KeyboardShortcuts.tsx` is a display-only component deriving from
`COMMAND_CHORDS`/`COMPONENT_CHORDS`; `useAnnounce.tsx` is the shared aria-live
hook used by the reader and library surfaces.

## Smallest sequence

1. Replace `isMacPlatform(): boolean` with `detectPlatform(userAgent): "mac" | "other"`
   (drops the deprecated `navigator.platform` read, removes the boolean-driver
   parameter from `displayChordLabel`/`buildShortcutGroups`).
2. Track the announcement frame id in a ref and cancel it in the existing
   unmount cleanup; assert with a new test that fails without the cancel.

## Provenance / gates

Authored and executed by the delivery seat on 18/09/2026 (generator: this seat).
Review: the 262 slice this repairs already passed a fresh-process different-family
review; the deltas here are two mechanical fixes with negative controls. Revert is
one `git revert` of the squash commit.
