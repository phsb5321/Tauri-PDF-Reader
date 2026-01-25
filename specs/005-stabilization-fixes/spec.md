# Feature Specification: Selection + Read-along Highlights + TTS Playback Stability

**Feature Branch**: `005-stabilization-fixes`
**Created**: 2026-01-14
**Updated**: 2026-01-20
**Status**: In Progress
**Type**: Fix & Recovery (not new features)

## Context

Despite previous specifications being marked complete, the product is **not functional from a user perspective**. Core features are broken or missing.

### Current State (Observed Issues)

From logs and code analysis:

1. **Text selection is unreliable** - mouseup handler fires but selection logic can't resolve page container ("No page container ref" and "Target in container: false" even when clicking inside page)
2. **Read-along (word) highlights not visible** - Word timing exists (counter shows "1 / 129") but highlight overlay missing or mispositioned
3. **TTS playback starts twice sometimes** - Double-call bug; play/pause UI state is wrong
4. **Audio stops after first page** - No continuous multi-page playback
5. **No auto-scroll / follow-along** - Current word not kept visible while reading
6. **Zoom dropdown shows blank** - UI state inconsistent
7. **No persistence** - Audio + timestamps not saved/cached → wastes tokens; file state/progress not saved
8. **TAURI warnings** - "Couldn't find callback id…" (HMR/reload + async in flight)

### Guiding Principles

- Fix behavior first, polish second
- Browser PDF viewer is the gold standard
- Every fix must be verifiable manually
- No new abstractions unless strictly necessary
- Never "fix" highlights by breaking PDF.js text layer layout
- Avoid hacks that only work in dev (React StrictMode/HMR differences must be handled)
- Any CSS overlay must be `pointer-events: none` and must not interfere with selection

---

## Goals (Must Ship)

| ID | Goal | Success Criteria |
|----|------|------------------|
| G1 | Text selection works reliably | Selection works on any page, any zoom level, always resolves page container |
| G2 | Read-along highlights visible | Word highlights track spoken word with correct positioning (no clipping, no layout breakage) |
| G3 | Playback state correct | Single start, correct play/pause button, no duplicate events |
| G4 | Multi-page playback works | Continues to next page automatically (optional toggle), keeps current word visible (auto-scroll) |
| G5 | Persistence complete | Cache audio + timestamps; restore reading progress (page + position) |
| G6 | Regression safety | Automated tests + traces + reproducible debug harness |

## Non-Goals (Explicitly Out of Scope)

- Rebuilding the whole UI redesign
- Perfect OCR/scan-PDF support (only text-layer PDFs first)
- Full cross-app sync
- Storage quota monitoring and warnings

---

## Root-Cause Analysis

### Confirmed Issues from Code Analysis

#### ISSUE #1: Selection Fails Due to DOM Mismatch

**Location**: `src/components/PdfViewer.tsx:136-177`

**Problem**: The document-level mouseup listener validates selection against `pageContainerRef`, but:
- In PdfViewer.tsx, `pageContainerRef` points to `div.pdf-page-container`
- The TextLayer component lives inside a separate component tree (PdfPage)
- When clicking on text in TextLayer, `pageContainer.contains(target)` returns false because the click is on spans inside `.textLayer` which may not be direct descendants of `pageContainerRef`

**Evidence**:
```
[PdfViewer] Target in container: false
[PdfViewer] No page container ref
```

**Root Cause**: `PdfViewer.tsx` uses `pageContainerRef` for single-page mode, but TextLayer is rendered inside PdfPage component which has its own container hierarchy.

#### ISSUE #2: TtsWordHighlight Gets Stale textLayerRef

**Location**: `src/components/TextLayer.tsx:199-206`, `src/components/pdf-viewer/TtsWordHighlight.tsx:171-260`

**Problem**: TtsWordHighlight receives `textLayerDivRef.current` as a prop snapshot at render time. When page changes:
1. Old TextLayer unmounts, new one mounts
2. TtsWordHighlight still holds reference to unmounted DOM
3. `findWordRects()` searches non-existent spans, finds no matches

**Code Path**:
```typescript
// TextLayer.tsx line 200-204
<TtsWordHighlight
  pageNumber={pageNumber}
  textLayerRef={textLayerDivRef.current}  // ← Captured at mount, becomes stale
  scale={scale}
/>
```

**Evidence**: Highlight shows in debug pill ("⚠️") but no visual highlight appears on page changes.

#### ISSUE #3: Double Playback Due to React StrictMode + Missing Guard

**Location**: `src/hooks/useTtsWordHighlight.ts:132-204`

**Problem**: `speakWithHighlight` has a guard (`speakingRef.current`), but:
1. Guard is set BEFORE async call completes
2. If two calls happen rapidly, second call is blocked but first completes and resets guard
3. The first call may trigger backend twice if StrictMode double-mounts

**Race Condition**:
```
Call 1: speakingRef = true, requestId = 1
Call 2: sees speakingRef = true, returns false immediately
Call 1 completes: speakingRef = false
(Call 2 is lost entirely)
```

#### ISSUE #4: Multi-Page Playback Stops After Page 1

**Location**: `src/components/playback-bar/AiPlaybackBar.tsx:52-84`

**Problem**: `handlePlaybackComplete` is called when TTS completes, but:
1. The callback relies on `currentPage` from render closure
2. By the time callback fires, state may have changed
3. The 500ms setTimeout for page render can race with other state updates
4. `playingRef.current` check may fail if user interaction occurred

**Code Path**:
```typescript
// AiPlaybackBar.tsx line 70-78
setTimeout(async () => {
  if (playingRef.current) {  // ← May be false if state changed
    const nextText = await getPageText(nextPage);
    if (nextText && playingRef.current) {
      await speakWithHighlight(nextText, nextPage);  // ← May not fire
    }
  }
}, 500);
```

#### ISSUE #5: No Auto-Scroll Implementation

**Location**: `src/hooks/useTtsWordHighlight.ts:23-25`

**Problem**: `onScrollNeeded` callback is defined in options but never actually scrolls:
```typescript
export interface UseTtsWordHighlightOptions {
  onScrollNeeded?: (wordIndex: number, word: string) => void;  // Defined but no-op
}
```

No implementation maps word rects to scroll container or performs scroll.

#### ISSUE #6: findTextLayerDiv Fallback is Unreliable

**Location**: `src/components/pdf-viewer/TtsWordHighlight.tsx:37-46`

**Problem**: Fallback returns first visible textLayer, not correct page:
```typescript
// Fallback: find any textLayer that's visible
const textLayers = document.querySelectorAll('.textLayer');
for (const layer of textLayers) {
  const rect = layer.getBoundingClientRect();
  if (rect.width > 0 && rect.height > 0) {
    return layer as HTMLDivElement;  // ← Returns FIRST visible, not correct page
  }
}
```

In multi-page scroll view, multiple pages could be visible.

#### ISSUE #7: Cache Key Missing Critical Components

**Location**: `src-tauri/src/adapters/audio_cache.rs`

**Current Implementation**: Cache key is SHA256 of `text + voice_id + model_id + settings`

**Missing**:
- No cache eviction policy (unbounded disk growth)
- `tts_cache_metadata` table created but never populated
- No ability to selectively invalidate by voice or document

#### ISSUE #8: Coordinate System Inconsistency

**Location**: `src/components/TextLayer.tsx:110-118` vs `src/components/pdf-viewer/TtsWordHighlight.tsx:112-117`

**Problem**: Different coordinate systems used:
- TextLayer selection: divides by scale → stores PDF space coords
- TtsWordHighlight: uses viewport coords as-is (no division)

```typescript
// TextLayer.tsx - Selection coords
rects.push({
  x: (rect.left - containerRect.left) / scale,  // ← Unscaled
  y: (rect.top - containerRect.top) / scale,
});

// TtsWordHighlight.tsx - Word rects
rects.push({
  x: rect.left - parentRect.left,  // ← Viewport coords, NOT unscaled
  y: rect.top - parentRect.top,
});
```

#### ISSUE #9: Animation Loop Timing with Page Navigation

**Location**: `src/hooks/useTtsWordHighlight.ts:108-130`

**Problem**: Animation loop continues when page changes:
1. User navigates to new page
2. `aiTtsStop()` called but async
3. Animation loop still running, updating store
4. New page mounts with stale store state briefly

---

## Technical Design

### Design Principle: Single Authoritative State Machine (Playback)

Implement a deterministic state machine:

```
States: IDLE → LOADING → PLAYING → PAUSED → ENDED → ERROR
Events: PLAY_REQUEST, PLAY_STARTED, PAUSE, RESUME, ENDED, SEEK, PAGE_DONE, NEXT_PAGE, CANCEL
```

**Rules**:
- Only one in-flight "play" request at a time (requestId gate)
- All UI derives from this state (no "double truth")
- StrictMode-safe: effects must be idempotent; subscriptions cleaned up; no implicit auto-start without guard

### Design Principle: Highlights as Overlay That Never Touches Selection

**Overlay Requirements**:
- Positioned inside the same coordinate system as the text layer (same container)
- Use computed rects relative to the text layer bounding rect
- Use `pointer-events: none`
- Respect clipping without changing text layer overflow rules

**Matching Strategy**:
- Prefer char offsets if available (charStart/charEnd) with robust mapping
- Fallback: normalized token matching, but avoid "contains" heuristics for common words

### Design Principle: Selection Uses Event Target Climbing + Stable Page Root

Replace `pageContainerRef` reliance with:
- `closest('[data-page-number="X"]')` or stable per-page root node
- Always verify event target belongs to text layer of that page
- Selection extraction reads from PDF.js text layer spans, not random DOM text nodes

### Design Principle: Persistence with Cache Keys + Disk Strategy

**Cache Key Components**:
- docId + page + voice + speed + model + textHash + settingsHash

**Storage**:
- audio bytes + timings JSON
- metadata: createdAt, duration, wordCount

**Eviction Policy**:
- max size (MB) + LRU

**Transparency**:
- cache hit → no API call
- cache miss → fetch → store → return

**Progress**:
- persist last page read + last wordIndex/time

---

## Workstream Architecture

### Agent A: Selection & Page Container Fix

**Objective**: Make text selection work reliably on any page, any zoom level.

**Key Changes**:
1. Use `closest('[data-page-number]')` instead of `pageContainerRef.contains()`
2. Add stable `data-page-number` attribute to TextLayer container
3. Consolidate selection handling in TextLayer (remove PdfViewer document listener or unify)
4. Add unit tests for selection coordinate transformation

**Files**:
- `src/components/PdfViewer.tsx`
- `src/components/TextLayer.tsx`
- `src/components/pdf-viewer/PdfPage.tsx`

**Tests**:
- Unit: selection coordinate transform at various scales
- Integration: selection across page boundaries
- E2E: drag select → highlight appears

### Agent B: Read-along Highlight Rendering Fix

**Objective**: Make word highlights visible and correctly positioned.

**Key Changes**:
1. Remove textLayerRef prop in favor of dynamic lookup via `data-page-number`
2. Ensure overlay mounts inside correct coordinate container
3. Fix `findWordRects` to handle scale correctly
4. Add visual regression tests

**Files**:
- `src/components/pdf-viewer/TtsWordHighlight.tsx`
- `src/components/pdf-viewer/TtsWordHighlight.css`
- `src/stores/tts-highlight-store.ts`

**Tests**:
- Unit: rect calculation at various scales
- Integration: fake text layer fixture → verify overlay renders
- Visual: screenshot comparison

### Agent C: Playback State Machine + Multi-page

**Objective**: Fix playback state to be single-source-of-truth, enable multi-page.

**Key Changes**:
1. Implement explicit state machine in `ai-tts-store.ts`
2. Add request ID gating to prevent double-play
3. Fix `handlePlaybackComplete` to use refs for current page
4. Implement proper cleanup on page navigation
5. Add auto-scroll callback implementation

**Files**:
- `src/stores/ai-tts-store.ts`
- `src/hooks/useTtsWordHighlight.ts`
- `src/hooks/useAiTts.ts`
- `src/components/playback-bar/AiPlaybackBar.tsx`
- `src/components/PageNavigation.tsx`

**Tests**:
- Unit: state machine transitions (pure tests)
- Integration: play → pause → resume cycle
- E2E: multi-page playback continuation

### Agent D: Persistence (Audio + Timings + Progress)

**Objective**: Cache audio/timestamps, restore reading progress.

**Key Changes**:
1. Populate `tts_cache_metadata` table with voice/doc/page info
2. Add cache size limit + LRU eviction
3. Save word timings alongside audio
4. Implement progress restoration on app restart
5. Integrate localStorage backup recovery

**Files**:
- `src-tauri/src/adapters/audio_cache.rs`
- `src-tauri/src/db/migrations.rs`
- `src/hooks/useAutoSave.ts`
- `src/stores/document-store.ts`
- `src/lib/db-init.ts`

**Tests**:
- Unit: cache key generation
- Integration: cache hit/miss behavior
- E2E: close app → reopen → cached audio plays immediately

### Agent E: E2E/Regression Tests + Observability

**Objective**: Automated test coverage for all fixed scenarios.

**Deliverables**:
1. Playwright test suite for critical paths
2. Trace capture on failure
3. Console log capture
4. Screenshot on failure
5. CI-friendly test runner

**Test Scenarios**:
1. Selection: open PDF → drag select → verify selection tooltip appears + stored highlight created
2. Read-along: press play → verify highlight overlay element exists and moves across words
3. Playback UI: play toggles to pause, pause toggles to play, repeated play doesn't create 2 audio streams
4. Multi-page: finish page 1 → auto-advance to page 2 (if enabled)
5. Cache: play page 1 twice → second time must not call remote (assert via mocked API)

---

## Task List (Definition of Done)

| ID | Task | Agent | Priority |
|----|------|-------|----------|
| T001 | Create repro harness + baseline artifacts | E | P0 |
| T002 | Document DOM + events map; identify container resolution issue | A | P0 |
| T003 | Fix selection: stable page root detection, robust extraction | A | P1 |
| T004 | Fix highlight rendering: correct container, char offset mapping | B | P1 |
| T005 | Fix playback state: single state machine, request ID gate | C | P1 |
| T006 | Implement multi-page + follow-along scroll | C | P1 |
| T007 | Implement caching + persistence: cache store, eviction, timestamps | D | P1 |
| T008 | Fix zoom dropdown blank + toolbar state | A | P2 |
| T009 | Add CI-friendly test runner | E | P2 |
| T010 | Final verification checklist | All | P0 |

### T010 Final Verification Checklist

- [ ] Selection works on any page, any zoom
- [ ] Highlights visible during TTS playback
- [ ] No double audio on play
- [ ] Play/pause UI correct
- [ ] TTS continues after page 1 (when auto-page enabled)
- [ ] Auto-scroll keeps current word visible
- [ ] Cache hit confirmed (no regeneration on replay)
- [ ] No TAURI callback warnings during normal flow

---

## Acceptance Criteria

### User Story 1 - Text Selection & Highlighting (P1-CRITICAL)

**Acceptance Scenarios**:

1. **Given** a PDF is open at any zoom level, **When** the user drags to select text, **Then** selection is captured and page number is correctly identified
2. **Given** text is selected, **When** the user triggers highlight creation, **Then** highlight appears immediately over selected text
3. **Given** a highlight exists, **When** the user zooms in or out, **Then** highlight rectangles scale and remain aligned (within 2 pixels)
4. **Given** highlights exist, **When** app restarts, **Then** all highlights are restored exactly

### User Story 2 - Read-along Highlights (P1-CRITICAL)

**Acceptance Scenarios**:

1. **Given** TTS is playing, **When** each word is spoken, **Then** a visual highlight moves to that word
2. **Given** TTS highlight is active, **When** user zooms, **Then** highlight repositions correctly
3. **Given** TTS highlight is active on page 1, **When** playback moves to page 2, **Then** highlight appears on page 2 (not stuck on page 1)
4. **Given** TTS is playing, **When** highlight debug shows "⚠️", **Then** this is considered a bug (word not found)

### User Story 3 - TTS Playback Controls (P1-CRITICAL)

**Acceptance Scenarios**:

1. **Given** no audio is playing, **When** user presses Play, **Then** audio begins and button shows Pause state
2. **Given** audio is playing, **When** user presses Play again quickly, **Then** only one audio stream plays (no duplicate)
3. **Given** audio is paused, **When** user presses Play, **Then** audio resumes from where it stopped
4. **Given** audio is playing, **When** user navigates to different page, **Then** playback stops deterministically

### User Story 4 - Multi-page Playback (P2)

**Acceptance Scenarios**:

1. **Given** auto-page is enabled and page 1 TTS completes, **When** page 1 ends, **Then** automatically advance to page 2 and continue TTS
2. **Given** auto-page is disabled, **When** page TTS completes, **Then** stop and do not advance
3. **Given** TTS is playing, **When** current word is near bottom of viewport, **Then** scroll to keep it visible

### User Story 5 - Audio/Timestamp Caching (P1)

**Acceptance Scenarios**:

1. **Given** TTS audio was generated for page 1, **When** user plays page 1 again (same settings), **Then** cached audio plays immediately (no loading delay)
2. **Given** cache exists, **When** voice or speed changes, **Then** new audio is generated
3. **Given** cache exceeds size limit, **When** new audio is cached, **Then** oldest entries are evicted

---

## Data Model Updates

### TTS Cache Metadata (New Usage)

```sql
-- Existing table, needs to be populated
CREATE TABLE IF NOT EXISTS tts_cache_metadata (
  id TEXT PRIMARY KEY,           -- Cache key (SHA256)
  document_id TEXT NOT NULL,
  page_number INTEGER NOT NULL,
  voice_id TEXT NOT NULL,
  speed REAL NOT NULL,
  model_id TEXT,
  text_hash TEXT NOT NULL,       -- SHA256 of text content
  duration_ms INTEGER NOT NULL,
  word_count INTEGER NOT NULL,
  file_path TEXT NOT NULL,       -- Path to MP3 file
  created_at TEXT NOT NULL,      -- ISO8601
  last_accessed_at TEXT NOT NULL -- For LRU eviction
);

CREATE INDEX idx_cache_document ON tts_cache_metadata(document_id);
CREATE INDEX idx_cache_accessed ON tts_cache_metadata(last_accessed_at);
```

### Reading Progress (Existing, Needs Restoration)

```sql
-- documents table already has these columns
ALTER TABLE documents ADD COLUMN IF NOT EXISTS last_tts_chunk_id TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS last_word_index INTEGER;
```

---

## Investigation Checklist

### Reproduce Deterministically (Baseline)

1. `pnpm i`
2. `pnpm tauri dev`
3. Open known PDF (458 pages from logs)
4. Repro scripts:
   - Selection: drag-select across spans, across lines, across page boundary
   - Highlights: press play → verify wordCount shows >0 but highlight overlay missing
   - Playback: press play twice quickly; observe double-audio bug and UI state bug
   - Multi-page: let it finish page 1 → observe stop
   - Scroll: start mid-page; ensure follow-along scroll attempts
   - Zoom dropdown: change zoom; observe blank/incorrect label

**Output Artifacts**:
- `artifacts/baseline-console.log`
- `artifacts/baseline-video.mp4` (screen recording)
- `artifacts/baseline-trace.zip` (Playwright trace)

### Map Rendering Tree + Event Boundaries

**Diagram DOM Stack Per Page**:
```
div.pdf-page-container (PdfViewer.pageContainerRef)
  └── div.pdf-page [data-page-number="N"] (PdfPage.containerRef)
        ├── canvas.pdf-page-canvas
        ├── div.text-layer-container (TextLayer.containerRef)
        │     ├── div.textLayer (TextLayer.textLayerDivRef)
        │     │     └── span, span, span... (PDF.js text spans)
        │     ├── div.highlight-layer
        │     └── TtsWordHighlight (when textLayerReady)
        ├── HighlightOverlay (when highlights exist)
        └── TtsHighlight (legacy, in PdfPage - should be removed)
```

**Event Listener Attachment**:
- PdfViewer: document-level `mouseup` → validates via `pageContainerRef.contains()`
- TextLayer: component-level `onMouseUp` on `.text-layer-container`
- Both fire on same click, but PdfViewer can't find target in its container

---

## Success Criteria Summary

| Metric | Target |
|--------|--------|
| Selection reliability | 100% on any page/zoom |
| TTS highlight visibility | 100% when wordTimings exist |
| Double-play prevention | 0 duplicate audio streams |
| Multi-page continuation | Works when enabled |
| Cache hit rate (replay) | 100% with same settings |
| Highlight alignment | Within 2px at all zoom levels |
| E2E test pass rate | 100% in CI |

---

## Definition of Done (Non-Negotiable)

- [ ] Selection: works on every page, every zoom level
- [ ] Read-along highlights: visible and tracking spoken word
- [ ] Playback: single play, correct UI state, no ghosts
- [ ] Multi-page: continues automatically when enabled
- [ ] Persistence: cached audio + progress restored
- [ ] Tests: E2E suite passes in CI

**If ANY of the above fails, the sprint is not complete.**
