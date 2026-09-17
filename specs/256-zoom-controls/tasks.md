# Spec 256 — Tasks

Seat `lectrice-ux` (p11) · branch `256-zoom-controls` · 20 active authoring
minutes · live 225 owns execution → authoring only, frozen after delivery.

## 1. Production (leaf-scoped)

- [x] T1 Remove unimplemented `Ctrl+-`/`Ctrl++` chord text from titles
      (aria labels retained; no bindings added — p16 acceptance).
- [x] T2 Key-scoped `stopPropagation` containment on the zoom select
      (Home/End/Escape/arrows/PageUp/PageDown never reach document-level
      handlers; native option movement preserved).
- [x] T3 Leaf-scoped `color-scheme` (light default; dark via `[data-theme]` + media fallback) so the native popup follows the application theme.

## 2. Tests (authored, NOT run — 225 owns execution)

- [x] T4 `zoom-controls-256.test.tsx`: 11 gates — chord removal, retained
      effective-% fit labels, exact non-preset option, preset selection,
      boundary disablement, window-probe containment (6 keys), pass-through
      proof, non-prevented Escape, scoped color-scheme contract, token option
      colors.

## 3. Reporting

- [x] T5 `reports/DELIVERY.md` (root/files/hashes/commands/limits) +
      READY-FOR-CHECK sent to the coordinator pane via `herdr-prompt`
      (box-consumed verification). Native popup painting = 251-owned check.
