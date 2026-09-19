# DELIVERY — 257 page controls (side-projects:w1:p18)

Date: 15/09/2026 (terça) · Write root: `/home/notroot/Documents/Code/personal/tauri-pdf-reader-257-page-controls` (locked @ `35801daa8657a8c0b72c3b06a04c994b6a46bc8c`)
Identity: zai / glm-5.3-flash / max / eng · session `01a0a61f-2749-7362-a71a-6431d199a7a9` · pane w1:p18
Prior 253 deliverables remain frozen/byte-identical in `tauri-pdf-reader-253-range-context` for 252 review; untouched by this task.

## Frozen authored files (sha256, verified after final edit)

| Path | sha256 (reconciled 15/09/2026 16:5x BRT — canonical) |
|---|---|
| `src/components/PageNavigation.tsx` | `69715898b7ebd50c5f3f24f1ad8836fcd9eedc018e4fbd448ce28af6cba88a63` |
| `src/components/PageNavigation.css` | `97dddc1f38c5c7f5ea3f4053de1fa2e599ed171e76ba5e3cc3e288bb53b48d31` |
| `src/components/PageNavigation.test.tsx` | `44ff4b8c45e548147da965dc6bbffc8aa877811feb90a150e7656ea91c36e609` |
| `specs/257-page-controls/spec.md` | `ced2c872d92882ae61f9f12c856f7b5d17c268316f167d76130ebcdd0633013e` |
| `specs/257-page-controls/plan.md` | `ca68cc396e915638c958cc91ff45131cf99f2ec8aa9987f9b5377bcf050b9923` |
| `specs/257-page-controls/tasks.md` | `f63bb666976bfd89e1b52e30d2458e3e0faaa2ae4dfeb7427d1d69486a27535e` |

(This report is the living receipt and is not self-hashed; hash it fresh at
consumption time.)

## Metadata reconciliation (fail-closed, before admission)

The first READY reported a stale test hash (`46d5eef6…`, the pre-readback
file) and a stale tasks hash (`5ada8a92…`, captured before the last edit
landed — a hash/edit ordering race on my side). Both are superseded. Canonical
packet is the table above; TSX/CSS were never in question (`69715898…` /
`97dddc1f…` verified by 252). 252's HOLD on the stale packet was correct; this
section plus the 251/pP messages are the formal supersession. No product
execution, no cap change (0/2).

Runner evidence note (lead 252): `node_modules/.bin/vitest` is ABSENT in this
fresh root — declared devDependencies are not installed-runner evidence. No
install will be attempted here (COMMON); qualification runs in 251's
environment, which owns dependency presence.

## What changed (component leaf only)

- Full-string safe-integer draft policy: trimmed `/^\d+$/` AND
  `Number.isSafeInteger` — "12junk"/"1.5"/`9007199254740993`/300 nines reset
  with zero navigation/progress/TTS calls; valid out-of-range clamps once.
- Single `commitDraft` funnel for Enter and blur with a dispatch marker cleared
  when the store lands: the Enter→blur in-flight window can no longer double-
  dispatch (regression-tested at the exact race tick).
- Clamped-target no-op guard: page 1 + draft "0" is a silent reset, not a
  stop+write+announce replay of the same page.
- Escape cancels the draft; store+document-identity sync invalidates stale
  intent on external page changes AND document swaps landing on the same page.
- Accessible name kept exactly "Current page" (drift reverted); total context
  via `aria-describedby` → visible total readout, plus the "Page position" group.
- CSS token-only: focus-visible ring parity with the input, reduced-motion
  guard, 4-digit-safe input width, narrow-width `min-width: 0`.

## Known integration gap (reported, NOT accepted)

Both `PageNavigation.goToPage` and the frozen `usePageNavigation` stop audio on
navigation, conflicting with LECT-130 independent-view/narration. Left verbatim
on purpose (frozen hook + narration owners' scope); 257 does not accept
stop-on-browse as correct behavior.

## Executed state

Nothing executed from this seat — 251 owns the serialized slot (p18/COMMON).
Runnable check (zero-install, stdlib-only runner style is NOT used here: the
scoped check is the repo-idiomatic Vitest suite):

```
pnpm vitest run src/components/PageNavigation.test.tsx --pool=forks --poolOptions.forks.singleFork
```

12 scenarios; expected wall < 10 s on desktop; suggest 30 s slot cap. jsdom +
testing-library are already installed devDependencies — no install needed.

## Post-readback corrections (p16 16:50, queued with READY — not repair rounds)

- Test type fix: `ReturnType<typeof useDocumentStore.getState>["currentDocument"]`
  (getState takes no arguments; the old `Parameters<…>[0]` was a type-only bug).
- Signed-input policy ("-1"/"+") explicitly MARKED as deliberate divergence
  from parseInt-era acceptance; N1 magnitude clamping preserved for unsigned
  integers only; pinned by a dedicated zero-calls test.

## Caps

Repair rounds for this increment: 0/2 used (no failing receipt yet). Pre-freeze
actor corrections (p16 mismatches) were authoring fixes, not repair rounds.
235/236/238/248/255 caps untouched/unknown here — not mine to spend.

## Pending (gated)

1. 251 slot execution of the scoped check (READY sent with hashes).
2. Exact-head Codex Sol review (GLM-authored code; no verdict yet, no hop).
3. Lead-gated commit/PR sequencing after independent review.
