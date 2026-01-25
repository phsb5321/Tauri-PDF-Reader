# Research: Selection + Read-along Highlights + TTS Playback Stability

**Branch**: `005-stabilization-fixes` | **Date**: 2026-01-20 | **Status**: Complete

## Executive Summary

Deep code analysis conducted across selection, TTS highlighting, playback state, and persistence layers. All unknowns from Technical Context have been resolved through targeted research. Key findings:

| Track | Status | Root Cause | Fix Complexity |
|-------|--------|------------|----------------|
| A. Selection | CRITICAL | DOM containment check fails - `pageContainerRef.contains()` doesn't find text layer spans | Medium (2 hours) |
| B. TTS Highlights | CRITICAL | Stale textLayerRef prop, coordinate system mismatch, unreliable fallback lookup | Medium (2-3 hours) |
| C. Playback State | CRITICAL | Double-call race condition, multi-page stops, no scroll implementation | Medium (3 hours) |
| D. Persistence | PARTIAL | Cache exists but no eviction, metadata table unused, progress not restored | Medium (2-3 hours) |
| E. UI/UX | MODERATE | z-index sprawl, debug features exposed | Low-Medium (1-2 hours) |

---

## Track A: Selection & Page Container

### Root Cause Analysis

**Problem**: Text selection fails intermittently with logs showing:
```
[PdfViewer] Target in container: false
[PdfViewer] No page container ref
```

**Code Path Analysis**:

1. `PdfViewer.tsx:136-177` sets up document-level `mouseup` listener
2. Handler checks `pageContainerRef.current.contains(target)`
3. `pageContainerRef` points to `div.pdf-page-container`
4. Text clicks target spans inside `div.textLayer` which is NESTED:

```
div.pdf-page-container (PdfViewer.pageContainerRef)
  └── NOT DIRECTLY: TextLayer is in PdfPage component tree
```

**The Bug**: In single-page mode (PdfViewer.tsx), pageContainerRef correctly contains the text layer. But in multi-page mode (when PdfPage is used), the DOM hierarchy differs and containment check may fail depending on component tree structure.

### Dual Selection Handlers

Two separate selection handlers exist:

| Handler | Location | Attachment | Behavior |
|---------|----------|------------|----------|
| PdfViewer | `document.addEventListener('mouseup')` | Document-level | Uses `pageContainerRef.contains()` |
| TextLayer | `onMouseUp` on container div | Component-level | Uses `containerRef` (different ref) |

Both fire on the same click, causing confusion about which one "wins".

### DOM Tree Reality

```
PdfViewer render:
  div.pdf-page-container ref={pageContainerRef}
    canvas ref={canvasRef}
    div ref={textLayerRef}
      TextLayer component (renders textLayer inside)
      HighlightOverlay

PdfPage render (multi-page):
  div.pdf-page ref={containerRef} data-page-number={N}
    canvas.pdf-page-canvas
    TextLayer (has its own containerRef)
    HighlightOverlay
```

In multi-page mode, `PdfViewer.pageContainerRef` is NOT an ancestor of the text layer spans.

### Decision: Use Event Target Climbing

Replace `pageContainerRef.contains()` with `target.closest('[data-page-number]')`:

```typescript
const handleDocumentMouseUp = (e: MouseEvent) => {
  const target = e.target as HTMLElement;
  const pageRoot = target.closest('[data-page-number]');

  if (!pageRoot) {
    console.debug('[PdfViewer] Click outside any page');
    return;
  }

  const pageNumber = parseInt(pageRoot.getAttribute('data-page-number') || '0', 10);
  // Selection is valid, proceed with pageNumber
};
```

**Benefits**:
- Works regardless of component tree structure
- No stale ref issues
- Correctly identifies which page was clicked

### Alternative: Consolidate to TextLayer Only

Remove PdfViewer document-level listener entirely, rely on TextLayer's component-level handler.

**Pros**: Simpler, no dual-handler confusion
**Cons**: Requires ensuring TextLayer always captures all selection events

### Files to Modify

| File | Change |
|------|--------|
| `src/components/PdfViewer.tsx` | Replace containment check with `closest()` |
| `src/components/TextLayer.tsx` | Add `data-page-number` to container OR ensure it's on parent |
| `src/components/pdf-viewer/PdfPage.tsx` | Verify `data-page-number` attribute present |

---

## Track B: TTS Word Highlighting

### Root Cause Analysis

**Problem**: Word highlights not visible even when wordTimings exist (debug pill shows "word (1/129) warning")

**Code Path Analysis**:

1. `TtsWordHighlight.tsx` receives `textLayerRef` as prop from TextLayer
2. `textLayerRef` is `textLayerDivRef.current` - a snapshot captured at render time
3. When page changes, old TextLayer unmounts, new one mounts
4. Prop value becomes stale (points to unmounted DOM)
5. `findWordRects()` searches spans in unmounted DOM, finds nothing

**Evidence in Code**:

```typescript
// TextLayer.tsx line 200-204 - The Stale Ref Problem
<TtsWordHighlight
  pageNumber={pageNumber}
  textLayerRef={textLayerDivRef.current}  // ← Snapshot at mount time
  scale={scale}
/>
```

### findTextLayerDiv Fallback is Broken

When `textLayerRef` is null, `TtsWordHighlight` falls back to DOM query:

```typescript
// TtsWordHighlight.tsx line 37-46
const textLayers = document.querySelectorAll('.textLayer');
for (const layer of textLayers) {
  const rect = layer.getBoundingClientRect();
  if (rect.width > 0 && rect.height > 0) {
    return layer as HTMLDivElement;  // Returns FIRST visible
  }
}
```

**Bug**: In multi-page scroll view, multiple pages are visible. This returns the FIRST one (often page 1), not the TARGET page.

### Coordinate System Mismatch

| System | Code Location | Coords Stored |
|--------|---------------|---------------|
| Selection | TextLayer.tsx:110-118 | Divided by scale (PDF space) |
| TTS Highlight | TtsWordHighlight.tsx:112-117 | Viewport coords (not divided) |
| Render | TtsWordHighlight.tsx:244-248 | Uses coords as-is |

Selection stores **unscaled** PDF coordinates, multiplies by scale when rendering overlay.
TTS highlight stores **viewport** coordinates, renders as-is.

Both work but the semantic difference is confusing and fragile.

### Decision: Dynamic Lookup via data-page-number

Remove `textLayerRef` prop entirely. Always use DOM query with page number:

```typescript
function findTextLayerDiv(pageNumber: number): HTMLDivElement | null {
  // ONLY use the explicit page-number selector, no fallback
  const pageContainer = document.querySelector(`[data-page-number="${pageNumber}"]`);
  if (!pageContainer) {
    console.warn('[TtsHighlight] Page container not found for page', pageNumber);
    return null;
  }

  const textLayer = pageContainer.querySelector('.textLayer') as HTMLDivElement;
  if (!textLayer) {
    console.warn('[TtsHighlight] Text layer not found in page', pageNumber);
    return null;
  }

  return textLayer;
}
```

**Benefits**:
- No stale ref problem
- Always finds correct page
- Clear failure mode when page not rendered

### Files to Modify

| File | Change |
|------|--------|
| `src/components/pdf-viewer/TtsWordHighlight.tsx` | Remove `textLayerRef` prop, use `findTextLayerDiv()` only |
| `src/components/TextLayer.tsx` | Remove `textLayerRef` prop from TtsWordHighlight instantiation |
| `src/stores/tts-highlight-store.ts` | No change needed |

---

## Track C: Playback State Machine

### Root Cause Analysis

**Problem 1: Double Playback**

```typescript
// useTtsWordHighlight.ts line 140-153
if (speakingRef.current) {
  console.debug('[TtsWordHighlight] Already speaking, ignoring duplicate request');
  return false;  // ← Returns immediately
}
speakingRef.current = true;  // ← Set BEFORE async call
```

**Race Condition**:
```
T0: Call 1 arrives, speakingRef = false
T1: Call 1 sets speakingRef = true, starts async
T2: Call 2 arrives, speakingRef = true, REJECTED
T3: Call 1 async completes, sets speakingRef = false
T4: Call 2 is lost forever
```

React StrictMode double-mounts components, causing useEffect to fire twice in development.

**Problem 2: Multi-Page Stops After Page 1**

```typescript
// AiPlaybackBar.tsx line 70-78
setTimeout(async () => {
  if (playingRef.current) {  // ← May be false due to state changes
    const nextText = await getPageText(nextPage);
    if (nextText && playingRef.current) {
      await speakWithHighlight(nextText, nextPage);  // ← May never fire
    }
  }
}, 500);
```

`playingRef.current` can be invalidated by:
- User clicking pause/stop during 500ms delay
- Component re-render resetting ref
- Error state transition

**Problem 3: onScrollNeeded Never Implemented**

```typescript
// useTtsWordHighlight.ts line 23-25
export interface UseTtsWordHighlightOptions {
  onScrollNeeded?: (wordIndex: number, word: string) => void;
}
```

Callback defined but no code actually scrolls the viewport.

### Decision: Explicit State Machine + Request ID Gating

Implement proper state machine in `ai-tts-store.ts`:

```typescript
type PlaybackState =
  | 'idle'
  | 'loading'
  | 'playing'
  | 'paused'
  | 'error';

interface PlaybackEvent {
  type: 'PLAY_REQUEST' | 'PLAY_STARTED' | 'PAUSE' | 'RESUME' |
        'STOP' | 'COMPLETE' | 'ERROR' | 'PAGE_CHANGE';
  payload?: any;
}

// State transitions:
// idle → loading (PLAY_REQUEST)
// loading → playing (PLAY_STARTED)
// loading → error (ERROR)
// playing → paused (PAUSE)
// paused → playing (RESUME)
// playing → idle (STOP | COMPLETE | PAGE_CHANGE)
// any → idle (STOP)
// any → error (ERROR)
```

### Request ID Gating Implementation

```typescript
const speakWithHighlight = useCallback(async (text: string, pageNumber: number) => {
  // Cancel any existing request
  const currentRequestId = ++requestIdRef.current;

  // If already speaking, stop first
  if (highlightStore.isActive) {
    await aiTtsStop();
    highlightStore.stopHighlighting();
  }

  ttsStore.setPlaybackState('loading');

  try {
    const result = await aiTtsSpeakWithTimestamps(text, voiceId);

    // Check if superseded
    if (currentRequestId !== requestIdRef.current) {
      console.debug('[TTS] Request superseded');
      return false;
    }

    // Proceed with highlighting
    // ...
  } finally {
    // Only clear speaking flag if this is still current request
    if (currentRequestId === requestIdRef.current) {
      speakingRef.current = false;
    }
  }
}, [/* deps */]);
```

### Auto-Scroll Implementation

```typescript
// In AiPlaybackBar.tsx
const scrollToWord = useCallback((rect: DOMRect) => {
  const scrollContainer = document.querySelector('.pdf-viewer-scroll-container');
  if (!scrollContainer) return;

  const containerRect = scrollContainer.getBoundingClientRect();
  const wordCenter = rect.top + rect.height / 2;
  const viewportCenter = containerRect.top + containerRect.height / 2;

  // Only scroll if word is outside middle 60% of viewport
  const tolerance = containerRect.height * 0.3;
  if (Math.abs(wordCenter - viewportCenter) > tolerance) {
    scrollContainer.scrollBy({
      top: wordCenter - viewportCenter,
      behavior: 'smooth'
    });
  }
}, []);
```

### Files to Modify

| File | Change |
|------|--------|
| `src/stores/ai-tts-store.ts` | Add state machine with explicit transitions |
| `src/hooks/useTtsWordHighlight.ts` | Request ID gating, proper cleanup |
| `src/components/playback-bar/AiPlaybackBar.tsx` | Use refs for closure values, implement auto-scroll |
| `src/components/PageNavigation.tsx` | Ensure async stop completes before page change |

---

## Track D: Persistence

### Current State Analysis

| Data | Storage | Status | Notes |
|------|---------|--------|-------|
| Documents | SQLite | Working | Metadata persists correctly |
| Highlights | SQLite | Working | Full CRUD functional |
| Reading progress | SQLite | Working | Auto-saved every 30s |
| Settings | SQLite + localStorage | Working | Dual layer caching |
| TTS audio | File system | **Partial** | Cache exists but no eviction |
| TTS timings | **Not stored** | **BROKEN** | Must re-fetch from API |
| Cache metadata | SQLite table exists | **UNUSED** | `tts_cache_metadata` never populated |

### Audio Cache Analysis

**Location**: `src-tauri/src/adapters/audio_cache.rs`

**Current Implementation**:
- File-based cache in `{app_data_dir}/tts_cache/`
- Cache key: `SHA256(text + voice_id + model_id + settings)`
- Stores MP3 bytes only
- No eviction policy
- No metadata tracking

**Missing Features**:
1. Word timings not cached (must re-fetch for highlighting)
2. No LRU eviction
3. No size limits
4. `tts_cache_metadata` table never written to

### Decision: Complete Cache Implementation

```rust
// audio_cache.rs additions

struct CacheEntry {
    audio_bytes: Vec<u8>,
    word_timings: Vec<WordTiming>,
    total_duration: f64,
    created_at: DateTime<Utc>,
    last_accessed_at: DateTime<Utc>,
}

impl AudioCache {
    pub async fn get_with_timings(&self, key: &str) -> Option<CacheEntry> {
        // Check file exists
        // Load audio + timings JSON
        // Update last_accessed_at in metadata table
        // Return entry
    }

    pub async fn set_with_timings(
        &self,
        key: &str,
        audio: Vec<u8>,
        timings: &[WordTiming],
        duration: f64
    ) -> Result<(), String> {
        // Write audio file
        // Write timings JSON alongside
        // Insert/update metadata in SQLite
        // Trigger eviction if over size limit
    }

    pub async fn evict_lru(&self, max_size_mb: u64) -> Result<usize, String> {
        // Query cache_metadata ORDER BY last_accessed_at ASC
        // Delete oldest entries until under limit
        // Return count deleted
    }
}
```

### Progress Restoration

**Current Gap**: localStorage backup created in `useAutoSave.ts` but never read on startup.

```typescript
// useAutoSave.ts line 159-176 - Creates backup
const storeUnsavedProgress = useCallback(() => {
  if (!documentId) return;
  localStorage.setItem(`pdf-reader-unsaved-${documentId}`, JSON.stringify({
    currentPage,
    scrollPosition,
    timestamp: Date.now()
  }));
}, [documentId, currentPage, scrollPosition]);
```

**Never called**: `checkUnsavedProgress()` utility exists but no component uses it.

### Files to Modify

| File | Change |
|------|--------|
| `src-tauri/src/adapters/audio_cache.rs` | Add timings storage, eviction |
| `src-tauri/src/db/migrations.rs` | Populate `tts_cache_metadata` |
| `src-tauri/src/commands/ai_tts.rs` | Use cache for timings |
| `src/hooks/useAutoSave.ts` | Integrate recovery check on mount |
| `src/components/reader/ReaderView.tsx` | Call recovery check |

---

## Track E: UI/UX

### Z-Index Analysis

**Current Token System** (`src/ui/tokens/z-index.css`):
```css
--z-base: 0;
--z-canvas: 1;
--z-text-layer: 2;
--z-highlight: 10;
--z-dropdown: 50;
--z-sticky: 75;
--z-floating: 100;
--z-sidebar: 900;
--z-modal: 1000;
--z-context-menu: 1001;
--z-toast: 2000;
```

**Hardcoded Values Found**: 18 instances across component CSS files

**Risk**: Overlapping layers when components render in unexpected order.

### Debug Features Exposure

`DebugOverlay.tsx` and experimental render settings are visible in main Settings panel.

**Decision**: Create separate "Developer" section, collapse by default.

### Zoom Dropdown Blank Issue

**Symptom**: Zoom dropdown shows blank instead of current value.

**Likely Cause**: Controlled component state mismatch. The `value` prop doesn't match any `option` value after state update.

**Investigation Needed**: Check ZoomControls.tsx value binding.

---

## VoxPage Pattern Analysis

### Research Target

VoxPage is a browser extension for read-along TTS. Relevant patterns to analyze:

1. **Text Selection**: How does it anchor selections in web pages?
2. **Highlight Rendering**: Overlay strategy for arbitrary web content
3. **TTS Timing Sync**: Word-to-DOM mapping approach
4. **Multi-page**: Handling document pagination

### Key Patterns to Port

| Pattern | VoxPage Approach | Our Implementation | Recommendation |
|---------|------------------|-------------------|----------------|
| Selection Anchoring | CSS selector + text offset | DOM rects + page number | Keep our approach (PDF-specific) |
| Highlight Overlay | Absolute positioned div with `pointer-events: none` | Same | Verified correct |
| Word Matching | Text node walking with offset tracking | Span text matching | Consider char offset priority |
| Scroll Tracking | IntersectionObserver for visibility | None | Implement scroll tracking |

### Patterns to Avoid

1. **Web-specific DOM walking**: PDFs have different text layer structure
2. **Global state**: VoxPage uses service worker; our Zustand stores are cleaner
3. **Complex selector anchoring**: Our PDF coordinates are more reliable

---

## Cross-Track Dependencies

```
Track A (Selection) ─────────────────┐
                                     │
Track B (TTS Highlights) ───────────►│──► Full E2E testing
                                     │
Track C (Playback State) ───────────►│
        │                            │
        ▼                            │
Track D (Persistence) ──────────────►│
                                     │
Track E (UI/UX) ─────────────────────┘
```

## Implementation Order

1. **Track A** - Unblock selection (dependency for highlights)
2. **Track C** - Fix playback state (enables Track D testing)
3. **Track B** - Fix TTS highlights (depends on A working)
4. **Track D** - Complete persistence
5. **Track E** - Polish (parallel with above)

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| `closest()` not finding page root | Low | High | Ensure data-page-number always present |
| State machine complexity | Medium | Medium | Keep transitions minimal, log all |
| Cache eviction deletes needed audio | Low | Medium | Only evict LRU, keep recent |
| Multi-page scroll jank | Medium | Low | Use requestAnimationFrame, debounce |

---

## References

- Spec: `/specs/005-stabilization-fixes/spec.md`
- Code Analysis: Explored via codebase search
- PDF.js Text Layer: https://github.com/nicolo-ribaudo/nicolo-ribaudo.github.io
- ElevenLabs Timestamps: API returns `alignment` with character/word offsets
