# Spec 256 — Zoom controls: themed native popup + keyboard containment

Branch `256-zoom-controls` (locked at `35801daa`). Seat `lectrice-ux` (p11);
20 active authoring minutes; source-only (live 225 owns execution).

## Hypothesis (one sentence)

The light popup inside the dark reader is the native select painting from an
undeclared `color-scheme`, and its navigation/escape keys leak to
document-level handlers that ignore `defaultPrevented` — a leaf-scoped
`color-scheme` declaration plus key-scoped `stopPropagation` fixes both
without a custom popup, new dependency, or role change.

## Technical Context

- 35801daa already renders `Fit Width · <effective>%` / `Fit Page ·
<effective>%` and exact non-preset values — retained, not duplicated.
- Theme model at this baseline: `useTheme` always sets `data-theme`
  (explicit or system-resolved) — the leaf scopes `color-scheme` to
  `.zoom-select` under `[data-theme="dark"]`, the
  `prefers-color-scheme` fallback, and light by default. No global
  token/theme edits.
- p16 corrective acceptance (exact 358 source): `Ctrl+-`/`Ctrl++` are
  implemented nowhere (verified: only a telemetry constant mentions zoom) →
  advertised chord text removed; PdfViewer Home/End and AiPlaybackBar Escape
  ignore `defaultPrevented` → containment is `stopPropagation` on a key-
  scoped set, native option movement preserved (no `preventDefault`).
- Native dark/light POPUP painting cannot be inferred in jsdom: the
  stylesheet pins the declarations; **251 owns the actual WebKitGTK check**.

## User Scenarios & Testing

### User Story 1 — the popup belongs to the app (P1)

In dark and light themes the zoom select and its native popup follow the
application theme (scoped `color-scheme`), with token-based option colors.

### User Story 2 — keyboard is contained and preserved (P1)

With the select focused, Home/End/Escape/arrows/page keys never reach
document-level page-navigation or narration-stop handlers (window-probe
proof on the combined chain); ordinary keys still propagate; native option
movement and popup close stay native (no preventDefault).

### User Story 3 — value presentation stays honest (P2)

Fit-mode labels keep the inline effective %; non-preset zoom exposes its
exact value; preset selection updates the real zoom level; zoom-out
disables at the boundary; no advertised-but-unimplemented chords.

### Acceptance scenarios

1. `zoom-controls-256.test.tsx` (authored, NOT run): 11 gates — chord
   removal, retained value presentation, window-probe containment (6 keys +
   pass-through + non-prevented Escape), scoped color-scheme contract, token
   option colors, boundary disablement.
2. Native WebKitGTK popup painting = coordinator-owned check (BLOCKED here).
3. Public aria labels unchanged; no role change (no p14/p16 re-coordination
   needed beyond the p16 acceptance already applied).

## Out of scope

Custom popup/menu framework, stores/hooks/constants/global-token edits,
other roots, old capped repairs.
