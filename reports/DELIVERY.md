# 261 narration controls — DELIVERY (15/09/2026 22:3x BRT)

**Seat:** w1:pW · **Route:** zai/glm-5.3-flash/max (receipts 16:33 + 22:2x BRT at the assigned root)
**ROOT:** /home/notroot/Documents/Code/personal/tauri-pdf-reader-261-narration-controls · **HEAD:** `35801daa8657a8c0b72c3b06a04c994b6a46bc8c` + authored working tree (UNCOMMITTED — commit is 251's slot)

## Delivered

- `NarrationCockpit.tsx`: consumed tab keys (Arrow/Home/End) now call
  `stopPropagation()` beside the existing `preventDefault()` — tab
  navigation no longer leaks into the reader's document-level Home/End page
  jump handler. Escape containment and close behavior unchanged.
  `controlsDisabled` renders a NEUTRAL truthful lock note
  (`role="note"`, "These controls are temporarily locked.") — p16 truth
  mismatch fixed: the single bool cannot name the reason (transport, setup,
  and provider switching all pass it), so it claims none.
- `NarrationCockpit.css`: `.narration-cockpit-lock` styled with existing
  text tokens only.
- `src/__tests__/ui/narration-cockpit-keys-261.test.tsx`: 4 cases —
  (1) consumed keys (ArrowRight/End/Home) isolated from a REAL registered
  window keydown seam; (2) unconsumed keys propagate to the seam with the
  tab intact as target; (3) Escape closes + stays isolated; (4) lock note
  neutral-truthful and toggles with the flag.

## Hashes / files

See `evidence/wave-261/worker-authored-state.txt` +
`worker-correction1-delta.txt` (all-seats run dir). Owned files only:
NarrationCockpit.tsx/css, the new scoped test, specs/261-narration-controls/.

## READY-FOR-CHECK (251 slot)

`cd /home/notroot/Documents/Code/personal/tauri-pdf-reader-261-narration-controls && CI=true ./node_modules/.bin/vitest run src/__tests__/ui/narration-cockpit-keys-261.test.tsx --pool=forks --poolOptions.forks.singleFork` then `pnpm typecheck`. Native combined focus/transport acceptance and commit remain 251's serialized gates. No acoustic/GPU claims. Known limits: unit suite authored-unrun; the lock note is deliberately neutral (the bool cannot discriminate reason); isolated propagation unit test is not the native operator close/focus acceptance.
