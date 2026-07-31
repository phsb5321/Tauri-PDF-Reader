# Lectrice Reader Redesign · Direction Choice

> Date: 31/07/2026
> Status: waiting on one decision — which direction goes to production

Everything mechanizable about the three directions is already asserted by
`design-demos/render-screenshots.py` (offline assets — including no WebSocket
and no worker, 1440×900, zero console errors, 44×44 hit targets, 4.5:1 text
contrast, no motion under `prefers-reduced-motion`, working play/pause +
surface reveal + page change, and the page staying visible and unoccluded when
the session surface opens). All three pass. What remains is a taste call, so it
is the one thing left for a human.

## 60-second checklist

Open the three files side by side (or the PNGs in `design-demos/screenshots/`):

```bash
xdg-open specs/054-reader-redesign/design-demos/direction-a-signal-desk.html
xdg-open specs/054-reader-redesign/design-demos/direction-b-calm-listen.html
xdg-open specs/054-reader-redesign/design-demos/direction-c-editorial-focus.html
```

In each, do exactly three things: press the main listening control, open the
sessions/library surface, advance the page. Then answer:

1. **Which one makes "this app reads pages aloud" obvious in the first second?**
2. **Which one would you rather stare at for two hours of reading?**

Both questions are irreducibly about taste. The third question this checklist
used to ask — whether the page stayed the thing you were looking at when the
session surface opened — was a layout claim, not a taste one, so it is now
asserted by the gate instead (≥60% of the page still visible, centre not
occluded). Reply with `A`, `B`, or `C` (plus any single element you want
carried over from a loser).

## What each direction is betting

| | A — Signal Desk | B — Calm Listen | C — Editorial Focus |
|---|---|---|---|
| **Theme** | dark, Catppuccin Mocha | light, Catppuccin Latte | light, Catppuccin Latte |
| **Bet** | every control visible, nothing hidden | one obvious listening action, everything else revealable | the page is the document, chrome recedes |
| **Voice state lives in** | permanent right rail + full transport band | one centered mauve control + revealable inspector | a voice panel docked under the page |
| **Cost of the bet** | densest chrome; page gets the least area | two clicks to reach voice/speed/export | voice panel competes with the page for the lower half |
| **Smallest type** | 10px eyebrow labels | 10px eyebrow labels | 12px |
| **Risk** | reads as an instrument panel, not a reader | inspector may hide controls users want pinned | least distinctive — closest to a generic reader |

## After the choice

Production implementation lands separately against the existing `ReaderView` →
`AppLayout` shell, existing Zustand stores, and generated Tauri bindings. The
chosen HTML file is the visual reference only — none of its inline JS ships.
Two items carry into that work regardless of which direction wins:

- The 10px eyebrow labels in A and B must rise to meet the brief's 14px body
  floor, or be demoted to genuinely non-essential metadata.
- The 44×44, contrast, reduced-motion and page-anchor rules are currently
  asserted on the prototypes only; the production shell needs the same
  assertions in its own test layer.
- Catppuccin Latte's `blue`, `mauve` and `subtext0` fail 4.5:1 on `base` at
  small sizes. The prototypes use hue-matched darker variants; production needs
  the same decision made once, in the token layer, not per component.
