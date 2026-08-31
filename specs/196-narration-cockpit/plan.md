# Implementation Plan: Narration cockpit and synchronized reader motion

## Technical Context

- Frontend: React/TypeScript, Zustand, PDF.js text layer, CSS Custom Highlight, Web Animations API.
- Existing authority: native sink-drained events complete audio; source/spoken sparse alignment maps TTS timing to normalized PDF UTF-16 offsets.
- Existing engine controls: provider/voice/speed, auto-page, Responsive/Balanced/Continuous context policy, factual performance snapshot, highlight default colour.
- No Rust/Tauri command or dependency change is required.
- Verification: targeted Vitest/property tests, seeded command fuzz, packaged Tauri/WebdriverIO public-control journey, visual/geometry assertions, different-family exact-head review.

## Root-cause findings

1. `AiPlaybackBar.scrollToWord()` queries `.tts-word-highlight`, but CSS Custom Highlight paints a `Range` without creating that element; auto-scroll is necessarily a no-op.
2. `TtsWordHighlight` rewires its text-layer observer on every word and leaves delayed observer callbacks untracked; stale callbacks can repaint prior ranges. Explicit delete-before-set is also absent.
3. Page continuation uses a fixed 500 ms timeout, not a rendered/annotated-page contract.
4. Real page 19 yields terminal runs `1 2 3.`, `4.`, `5` from isolated 11.25 pt superscript markers versus 15 pt body text. Those requests consume roughly ten seconds and mimic a frozen transition.
5. `prosody-plan` does not normalize body numbers, so `2022` and `91,000` reach Magpie as raw symbols.
6. The footer's `1fr / fixed center / 1fr` grid creates the reported empty center and its settings control opens only `AiTtsSettings`.
7. `ZoomControls` selects the nearest fixed preset while printing exact state in a sibling label, so continuous 2.80× state becomes the contradictory `300% 280%` shown in user evidence.
8. The frontend renders with `ultra` + unlimited megapixels until the user opens Settings → Rendering; persisted backend defaults are `balanced` + 24 MP. At 280% the first path requests 6854×8870, beyond the project's documented 8192 px WebKit side limit.
9. Packaged zoom checks assert only that percentage text changes. They do not observe committed page/canvas/text/highlight geometry, readiness, scroll extent, preview cleanup, or source-point anchoring.
10. Paragraph actions use unrelated `min(left)`/`min(top)` rects, a fixed four-pixel text gap, page-wide reveal, low-opacity compositing, and button-relative vertical translation; each defect changes perceived placement or contrast across zoom.

## Architecture

### 1. Pure speech normalization

Add `src/lib/speech-normalization.ts`:

- `normalizeSpeechNumbers(source, locale)` returns ordered, non-overlapping replacements with exact UTF-16 source `[start,end)` and spoken words.
- First production grammar: EN/PT-BR integers and canonical grouping, decimals, percentages, USD/BRL/EUR, and `HH:MM`; invalid grouping, version/IP chains, long IDs, leading-zero IDs, and ambiguous locale forms remain unchanged.
- Number-to-words helpers are deterministic tables/recursion with no `Intl`, date, network, or dependency.
- The planner combines replacements with punctuation insertions and geometry-backed delete edits, preserving `copy|replace|insert|delete` alignment.
- `PROSODY_PLAN_REVISION` advances and the resulting spoken text naturally changes cache coordinates.

The user's narration-language preference is `auto|en|pt-BR`. Auto resolves from the selected voice's declared language; unresolved auto performs no numeric rewrite rather than guessing.

### 2. Geometry-backed artifact suppression

Extend `ProsodySource` with optional `PdfTextSegment[]`. Compute median nontrivial text height and create delete edits only for isolated one/two-digit segments whose height is at most 80% of the page body median and whose width/style is marker-like. The page-19 fixture proves those five markers are deleted while body `2022` and `91,000` remain replaceable.

### 3. Read-along projection and motion

Add `src/lib/read-along-motion.ts` with pure helpers:

- `readingBandScrollTarget(rangeRect, viewportRect, scrollTop, scrollHeight, clientHeight)` returns `null` in-band or one clamped absolute top outside it.
- `isWholePageSelection(selected, total)` applies the 95% + edge-anchor policy.
- page-ready polling/observer helper accepts an `isCurrent()` cancellation predicate and fails closed on timeout.

Refactor `TtsWordHighlight`:

- one setup effect per active page/scale, never per word;
- all observer timers/animation frames tracked and cancelled;
- one word effect resolves current range, deletes old registry entry, sets one range, and coalesces scroll in one rAF when follow is enabled;
- no query for a fabricated overlay node.

`PdfViewer` exposes `data-render-state=loading|ready` and rendered page/zoom after canvas, PDF.js text layer, and `annotatePdfTextLayer` complete. It resets scroll authority on page change and performs reduced-motion-safe page/zoom visual transitions only after render commit.

`AiPlaybackBar` replaces the 500 ms continuation timeout with the exact ready handshake. Failure clears playing/queue state and exposes `TTS_PAGE_NOT_READY`.

### 4. Selection and paragraph-action policy

Extend `selection-narration.ts` with source-layer selection analysis. `PdfViewer.handleTextSelection` requires both endpoints inside the current annotated layer, computes normalized selected/page coverage, and rejects effective whole-page selection. Rejection clears browser selection and shows a warning toast. Existing excerpt coordinates, highlight creation, and Read from here remain unchanged.

Project structural paragraph starts into a pure, tested margin-layout function using the first line rect in document order. A transparent 44 px target sits wholly before the first glyph or fails closed when page/viewer gutter is insufficient. Its rest state is a paper-safe semantic tick; only that paragraph's hover/focus state becomes a small voice-colour action with a real focus outline. No page-wide reveal, opacity-composited text, scale motion, shadowed 44 px disc, or text-layer mutation remains.

### 5. Persisted real preferences

Extend `ai-tts-store` persistence to version 4 with:

- `followAlongEnabled: true`;
- `numberNormalizationEnabled: true`;
- `narrationLanguage: auto`.

Migration sanitizes each value and retains the existing credential exclusion. `AiPlaybackBar` passes resolved language, numeric normalization choice, and follow state into planner/projection.

### 6. Narration cockpit UI

Add `NarrationCockpit.tsx/.css` and `NarrationDeliverySettings.tsx`:

- normal-flow drawer with tabs `Voice & route`, `Delivery`, `Performance`, `Selection`;
- roving tab focus (Left/Right wrapping, Home/End), tab semantics, Close/Escape focus return;
- active panel only is mounted;
- Voice reuses `AiTtsSettings` and `AiVoiceSelector` in embedded mode;
- Delivery owns speed, follow, auto-page, normalization/language, and the three context policies;
- Performance reuses telemetry after profile controls move to Delivery;
- Selection reuses `HighlightSettings` plus excerpt-limit explanation.

Refactor the compact footer to `auto minmax(16rem,1fr) auto`, a full status/progress lane, quick voice/speed, export, and labeled Tune. Remove the ambiguous auto-page icon, special modal overlay, nonexistent scroll callback, and duplicate CSS declarations. Narrow layout becomes two compact rows; the drawer becomes one column with horizontal-scroll-safe tabs.

### 7. Real PDF zoom

Keep the custom single-page renderer because TTS/highlight/source-offset overlays depend on it, but reuse pdf.js's proven two-phase and anchor semantics rather than replacing it with a second viewer.

- `ZoomControls` owns one exact selected label. It injects a dynamic option for continuous values and includes the measured percentage in the selected fit label; the duplicate percentage node is deleted.
- `RenderPolicy` always applies WebKit's 8192 px backing-side ceiling, even when the configurable megapixel cap is zero. Synchronous frontend defaults match backend defaults, and persisted settings load once at app startup rather than only when Rendering is opened.
- Before zoom, `PdfViewer` captures a normalized source point under the wheel pointer or viewport centre. The real canvas/text commit restores that point against current page/viewer rects and clamps to measured scroll bounds.
- Safe centring uses auto margins with start alignment, so a narrow page centres and an oversized page starts at a reachable left edge.
- Readiness records exact `data-render-page` and `data-render-zoom`; a failed target render cannot leave requested controls over stale geometry.
- The existing preview remains transient only. Paragraph actions clear until exact text geometry returns; saved highlight layers follow the same preview or remain hidden rather than painting stale coordinates.

### 8. Verification

Red-first targeted tests:

- number grammar, source partitions, mapping, locale/rejection, spoken-byte cap;
- page-19 superscript suppression and no micro-dispatch;
- one CSS highlight under delayed observer race;
- reading-band target/clamp/reduced-motion behavior;
- render-ready continuation success/timeout/cancel;
- store v4 migration/persistence and credential absence;
- whole-page/outside selection rejection and multi-line excerpt pass;
- cockpit tab semantics/keyboard/focus and real control changes;
- footer geometry source contract;
- exact zoom-label, hard canvas-side, source-anchor, safe-overflow centring, and paragraph-action layout/style contracts.

Packaged journey `e2e/narration-cockpit.e2e.mjs` via `scripts/e2e-narration-cockpit.sh`:

1. open a two-page fixture containing `2022`, `91,000`, long content, and a selectable full page;
2. open Tune and drive all four tabs by keyboard;
3. enable normalization/follow/auto-page and Continuous policy;
4. Play; observer asserts original digit source ranges while fixture captures expanded outbound text;
5. assert exactly one current range and a changed scrollTop after the cursor leaves the band;
6. wait for natural page 1→2; assert page-two synthesis follows page-two render-ready and occurs once;
7. zoom through public controls at preset and continuous high values; bind the one selected label to exact ready page/canvas/text geometry, enforce the 8192 backing-side ceiling, preserve pointer/centre anchors, and prove every page edge remains reachable;
8. assert professional paragraph margin geometry/contrast/focus at 100–400%, reject whole-page selection, accept excerpt, and invoke Read from here at the exact source offset;
9. Stop and assert idle/no highlight/no stale request.

## Rollback

One revert removes the frontend feature. Persisted v4 fields are non-secret preferences ignored by older code. Generated audio remains revision-scoped derived data. No reader data or native configuration migration occurs.
