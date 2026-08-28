# Feature Specification: Narration cockpit and synchronized reader motion

**Issue:** #196

**Base:** `182-gpu-performance` / PR #194

## Problem

The reader footer reserves most of its width as empty space while separating transport, progress, and tuning into unrelated islands. Its tuning button bypasses useful delivery/performance surfaces. Read-along scrolling queries a class that CSS Custom Highlight never creates, delayed mutation callbacks can repaint stale words, page continuation waits a fixed 500 ms rather than the rendered page, and zoom/page changes jump.

The narration text path also sends written numbers and PDF superscript footnote markers directly to Magpie. On the reported pages this produced incorrect `2022`/`91,000` speech and 1–6 character synthesis requests (`1 2 3.`, `4.`, `5`) before the next page, which looks like a frozen page turn.

## User Scenarios & Testing

### US1 — Reliable continuous read-along (P1)

As a reader, I see exactly one active source word, the viewport follows it, and automatic page turns never silently stall.

Acceptance scenarios:

1. An active word inside the reading band does not move the viewport; one outside it moves to one clamped absolute target.
2. Rapid word/page/zoom changes cannot let an older timer or observer repaint or scroll.
3. Natural completion changes page exactly once, waits for that exact page's annotated text layer, then starts its first eligible unit.
4. Stop, manual navigation, provider switch, timeout, or a newer generation cancels pending continuation.
5. A readiness failure becomes a visible error and idle state rather than a silent freeze.
6. Isolated superscript numeric markers are not spoken; ordinary body numbers remain in the source plan.

### US2 — Correct written-number speech (P1)

As an EN or PT-BR reader, years, grouped numbers, percentages, currency, decimals, and clock times are pronounced as words while highlighting remains on the unchanged printed token.

Acceptance scenarios:

1. `2022` and `91,000` in English produce spoken words and map every spoken subrange to the exact original digit range.
2. PT-BR separators and BRL use PT-BR words; EN separators and USD/EUR use English words.
3. Invalid, version-like, ID-like, or locale-ambiguous numeric forms stay unchanged.
4. Disabling normalization sends the original source text.
5. Spoken UTF-8 length—not source length—governs provider context limits.

### US3 — A useful narration cockpit (P1)

As a reader, I can tune only real narration behavior from a docked footer drawer without losing the page.

Acceptance scenarios:

1. The compact footer has transport, a growing truthful progress/status lane, quick voice/speed, export, and a named Tune action.
2. The drawer provides `Voice & route`, `Delivery`, `Performance`, and `Selection` tabs.
3. Delivery controls speed, follow read-along, automatic page turn, number normalization/language, and Responsive/Balanced/Continuous policy.
4. Performance reports factual engine/model/backend/device/RTF data; it does not imply unsupported controls.
5. Selection reuses the real highlight default controls and explains excerpt limits.
6. Tabs support Left/Right wrapping and Home/End; Escape in the drawer closes it and returns focus without also stopping audio.

### US4 — Bounded excerpt selection (P2)

As a reader, I can select legitimate words and multi-line excerpts, but an accidental whole-page drag cannot create a page-wide highlight or narration action.

Acceptance scenarios:

1. Selection start and end must both belong to the current annotated text layer.
2. A selection covering at least 95% of normalized page text and anchored near both page edges is cleared with no toolbar.
3. A legitimate multi-line excerpt still opens Highlight/Read from here and preserves source coordinates at every zoom.

### US5 — Calm, accessible motion (P2)

As a reader, read-along scroll, page swaps, and zoom changes feel smooth without altering PDF geometry.

Acceptance scenarios:

1. Motion uses absolute scroll targets and coalesces newer targets rather than accumulating deltas.
2. Page/zoom transitions animate opacity/visual transform only after exact render readiness; stored PDF/source coordinates do not change.
3. `prefers-reduced-motion: reduce` makes scroll/page/zoom movement instant while preserving readiness and synchronization.

## Functional requirements

- **FR-001:** One state cursor MUST be authoritative for page, word range, generation, and follow preference.
- **FR-002:** The CSS highlight registry MUST contain at most one `tts-current-word` range and MUST be cleared synchronously on invalidation.
- **FR-003:** Async highlight, scroll, render, and continuation work MUST carry a generation/ticket and reject stale work.
- **FR-004:** Follow read-along, auto-page, normalization enabled, narration language, and performance profile MUST persist; secrets/runtime measurements MUST NOT.
- **FR-005:** Number normalization MUST be pure, deterministic, local, locale-aware, and represented as sparse source-aligned replacements.
- **FR-006:** Displayed PDF/source text MUST remain byte-for-byte unchanged.
- **FR-007:** Superscript marker suppression MUST use PDF geometry/style evidence, not delete ordinary one-digit body text.
- **FR-008:** Page continuation MUST await canvas + text layer + source annotation readiness and MUST NOT use a fixed delay as a correctness mechanism.
- **FR-009:** Page readiness timeout MUST fail visibly and clear queue/highlight authority.
- **FR-010:** Footer status/progress MUST distinguish loading, playing, paused, cache coverage, and error without fabricating percentages.
- **FR-011:** Drawer tabs MUST use tab/tablist/tabpanel semantics, roving focus, 44 px minimum targets, and mount only the active panel.
- **FR-012:** The open drawer MUST stay in layout flow and retain at least 60% of the previously visible page area.
- **FR-013:** Whole-page selection rejection MUST not affect ordinary copying/highlighting of excerpts.
- **FR-014:** Explicit Play remains the first point at which PDF text may reach a provider.
- **FR-015:** Existing provider switching, no-fallback, exact-source highlighting, sink-drained completion, and cache identity guarantees MUST remain intact.

## Success criteria

- **SC-001:** The reported page-19 plan contains no dispatch below 12 bytes and no superscript footnote marker, then page 20 starts after its render-ready signal.
- **SC-002:** Golden EN/PT-BR normalization fixtures and arbitrary-Unicode properties preserve a gapless source partition and provider byte bounds.
- **SC-003:** A race test advances word A→B before a delayed callback; only B is painted/scrolled.
- **SC-004:** Footer geometry passes at 1920, 1440, 767, and 640 CSS px with no horizontal overflow and ≥44 px controls.
- **SC-005:** Seeded fuzz and the packaged public-control journey pass with exact action trace and replay command.
- **SC-006:** Reduced-motion packaged assertions observe no smooth scroll or page/zoom animation.

## Out of scope

- Full MagpieTTS-LF encoder/attention state (#195).
- F16 promotion, raw sampling sliders, emotion/style prompts, or automatic provider/model fallback.
- Cloud LLM rewriting, generic SSML, or pitch-shifting DSP.
- Continuous multi-page PDF rendering; this slice synchronizes the current single-page renderer.
