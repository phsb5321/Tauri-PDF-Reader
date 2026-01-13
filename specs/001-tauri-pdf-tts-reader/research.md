# Research: Tauri PDF Reader with TTS and Highlights

**Feature Branch**: `001-tauri-pdf-tts-reader`
**Date**: 2026-01-11

## Research Summary

This document consolidates research findings for implementing the Tauri PDF Reader with TTS and Highlights. All technical unknowns from the specification have been resolved.

---

## 1. PDF.js Text Selection and Highlight Implementation

### Decision
Use a hybrid approach combining PDF.js text layer positioning with viewport-scaled coordinate mapping, rendering highlights on a dedicated overlay canvas layer.

### Rationale
- PDF.js provides `getTextContent()` with item-level positioning via transform matrices
- Text coordinates are in unscaled page space; must transform by viewport scale
- A dedicated overlay canvas ensures highlights survive page re-renders (zoom, navigation)
- Storing both text content AND scaled rects provides robust anchoring

### Implementation Approach

**Text Selection Capture**:
1. Listen for selection events on canvas container
2. On mouse up, use `window.getSelection()` to get selected text
3. Cross-reference selected text with PDF.js text items
4. Convert text item transforms to bounding boxes using `transform[4,5]` for position
5. Apply viewport scale for canvas coordinates
6. Store rects in page-relative coordinates (scale-independent)

**Highlight Rendering**:
```typescript
// Two-layer rendering approach
<div className="pdf-page-container">
  <canvas ref={canvasRef} className="pdf-canvas" />
  <canvas ref={overlayRef} className="highlight-overlay" style={{
    position: 'absolute',
    top: 0,
    left: 0,
    pointerEvents: 'none'  // Allow selection through overlay
  }} />
</div>
```

**Robust Anchoring Strategy**:
- Store `textContent` (semantic anchor) + `rects` (visual position)
- On zoom change: scale existing rects proportionally
- If text content exists: re-locate text on page as fallback
- Store original zoom level for re-anchoring calculations

### Alternatives Considered
- **CSS overlays on canvas**: Don't survive re-renders
- **SVG overlay**: Heavier, complex transforms
- **Single canvas merged PDF+highlights**: Complicates updates
- **Text-only anchoring**: Can't handle multi-line or identical text

---

## 2. Native Text-to-Speech Implementation

### Decision
Use the Rust `tts` crate (v0.26) for cross-platform native TTS with sentence-based chunking and client-side word-boundary estimation.

### Rationale
- **Cross-platform**: Windows (WinRT/SAPI), macOS (AVFoundation), Linux (speech-dispatcher)
- **Full API**: Voice enumeration, play/pause/stop, rate adjustment (0.5x-3x)
- **Mature**: 2.7K+ GitHub stars, active maintenance, widely used in Rust apps
- **Tauri compatible**: Pure Rust FFI, clean command-based integration

### Platform-Specific Support

| Feature | Windows | macOS | Linux |
|---------|---------|-------|-------|
| Play/Stop | ✓ | ✓ | ✓ |
| Pause/Resume | ✓ | ✓ | Limited |
| Rate Control | ✓ | ✓ | ✓ |
| Voice Selection | ✓ | ✓ | ✓ |
| Voice Enumeration | ✓ | ✓ | ✓ |

### Chunking Strategy
- Sentence-based chunking with 5,000 character max per chunk
- Split by sentence boundaries (`.`, `!`, `?`)
- Fallback to word-based splitting for very long sentences
- Emit chunk progress events for frontend synchronization

### Word-Boundary Highlighting
Since the `tts` crate doesn't provide word-boundary callbacks:
- Parse text into words with estimated durations
- Use elapsed time to calculate current word position
- Cross-reference with PDF.js text layer positions for visual highlighting
- Update highlight every 50ms for smooth follow-along

### Alternatives Considered
- **Web Speech API**: Unreliable in Tauri webview on Linux
- **Cloud TTS (Azure, Google)**: Network latency, cost, privacy concerns
- **Local engines (eSpeak)**: Lower quality, larger app size

---

## 3. SQLite Database Patterns

### Decision
Use tauri-plugin-sql with WAL mode, debounced auto-save, and strategic indexing for highlight/document persistence.

### Rationale
- WAL mode provides crash recovery and 2-10x performance improvement
- Debounced saves (500-1000ms) reduce database writes during rapid editing
- Batch transactions wrap multiple operations for consistency
- Composite indexes on `(document_id, page_number)` optimize common queries

### Recommended PRAGMA Configuration

```sql
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA temp_store = MEMORY;
PRAGMA cache_size = -64000;  -- 64MB
PRAGMA busy_timeout = 5000;
PRAGMA wal_autocheckpoint = 1000;
```

### Migration Strategy
- Versioned migrations with `_migrations` tracking table
- Idempotent SQL using `CREATE TABLE IF NOT EXISTS`
- Run migrations during Tauri `setup()` hook
- Add graceful shutdown handler for WAL checkpoint

### Auto-Save Pattern

**Frontend**: Debounce highlight saves
```typescript
const debouncedSave = useMemo(
  () => debounce((hl: Highlight) => highlightsCreate(hl), 750),
  []
);
```

**Backend**: Batch transaction for multiple saves
```rust
pub async fn highlights_batch_save(highlights: Vec<CreateHighlightInput>) {
    let mut tx = pool.begin().await?;
    for input in highlights {
        sqlx::query("INSERT INTO highlights ...").execute(&mut *tx).await?;
    }
    tx.commit().await?;
}
```

### Crash Recovery
- WAL auto-replays uncommitted transactions on next startup
- Shutdown handler performs `PRAGMA wal_checkpoint(FINISH)`
- Detect unclean shutdown via flag file or WAL presence

### Alternatives Considered
- **Rusqlite**: Synchronous API, no connection pooling
- **LocalStorage**: Not suitable for structured highlight data
- **No WAL (DELETE mode)**: Slower, blocking readers

---

## 4. Opt-In Telemetry Implementation

### Decision
Implement privacy-first opt-in telemetry with local buffering, clear consent UI, and flexible backend options (self-hosted or SaaS).

### Rationale
- User trust requires transparent, opt-in data collection
- Local buffering handles offline scenarios gracefully
- Structured logs serve both debugging and analytics needs
- GDPR compliance requires explicit consent and data minimization

### Data Categories

**Error Telemetry** (opt-in):
- Exception type and message (no PII)
- Stack trace (anonymized file paths)
- App version, OS platform
- Feature context (which screen/action)

**Usage Analytics** (opt-in):
- Feature usage counts (aggregated)
- Session duration
- Performance metrics (load times)
- No document content or file paths

### Consent UI Pattern
- First-run onboarding with clear explanation
- Separate toggles for error reporting vs. analytics
- "What we collect" expandable detail section
- Settings accessible anytime to change preference

### Local Buffering Strategy
```typescript
interface TelemetryBuffer {
  events: TelemetryEvent[];
  maxSize: number;        // 100 events
  flushIntervalMs: number; // 60000 (1 minute)
  retryCount: number;
}

// Flush when online and buffer has items
if (navigator.onLine && buffer.events.length > 0) {
  await sendBatch(buffer.events);
  buffer.events = [];
}
```

### Backend Options

| Option | Pros | Cons | Use Case |
|--------|------|------|----------|
| **PostHog** | Open-source, self-hostable, product analytics | Setup complexity | Full analytics needs |
| **Sentry** | Excellent error tracking, sourcemaps | Focused on errors | Error reporting primary |
| **Self-hosted** | Full control, privacy | Maintenance burden | Maximum privacy control |
| **None** | Simplest | No insights | Local logs only |

### Recommended Approach
- Start with structured local logs (FR-033, FR-034)
- Add Sentry for error reporting (opt-in)
- Consider PostHog for usage analytics if needed later
- Always provide "Copy debug logs" for manual troubleshooting

### Alternatives Considered
- **Always-on telemetry**: Privacy concerns, user trust erosion
- **No telemetry**: No insight into issues or usage
- **Client-side only**: No server means no aggregate analysis

---

## 5. Document Identity Strategy (from Clarifications)

### Decision
Use SHA-256 content hash as document unique identifier.

### Rationale
- Same file = same ID regardless of file path
- Enables duplicate detection when same file opened from different locations
- Survives file relocation (user moves file, library can relocate)
- Hash computed once on first open, stored in database

### Implementation
```rust
use sha2::{Sha256, Digest};

fn compute_document_id(file_path: &Path) -> Result<String> {
    let mut hasher = Sha256::new();
    let mut file = File::open(file_path)?;
    std::io::copy(&mut file, &mut hasher)?;
    Ok(format!("{:x}", hasher.finalize()))
}
```

---

## 6. Auto-Save and Crash Recovery (from Clarifications)

### Decision
Auto-save with periodic persistence (30 seconds or on significant actions) plus crash detection and restore prompt.

### Rationale
- Periodic auto-save minimizes data loss window
- Debounced saves prevent excessive I/O during rapid editing
- Crash detection via shutdown flag or WAL file presence
- Restore prompt gives user control over recovery

### Implementation Pattern
```typescript
// Frontend auto-save hook
useEffect(() => {
  const interval = setInterval(() => {
    if (hasUnsavedChanges) {
      saveProgress();
      setLastSaved(Date.now());
    }
  }, 30000);
  return () => clearInterval(interval);
}, [hasUnsavedChanges]);

// Crash detection on startup
const wasCleanShutdown = await checkShutdownFlag();
if (!wasCleanShutdown) {
  const shouldRestore = await showRestorePrompt();
  if (shouldRestore) {
    await restoreLastSession();
  }
}
```

---

## Research Gaps Resolved

| Topic | Status | Resolution |
|-------|--------|------------|
| PDF.js text selection | ✅ Resolved | Hybrid canvas overlay approach |
| Highlight anchoring | ✅ Resolved | Text content + bounding rects |
| Native TTS crate | ✅ Resolved | tts v0.26 with chunking |
| Word-boundary events | ✅ Resolved | Client-side estimation |
| SQLite configuration | ✅ Resolved | WAL mode + PRAGMAs |
| Auto-save pattern | ✅ Resolved | Debounced + periodic |
| Crash recovery | ✅ Resolved | WAL + shutdown flag |
| Telemetry design | ✅ Resolved | Opt-in with local buffer |
| Document identity | ✅ Resolved | SHA-256 content hash |

---

## References

- [PDF.js Text Layer Documentation](https://mozilla.github.io/pdf.js/)
- [Rust TTS Crate](https://crates.io/crates/tts)
- [SQLite WAL Mode](https://sqlite.org/wal.html)
- [SQLite Performance Tuning](https://phiresky.github.io/blog/2020/sqlite-performance-tuning/)
- [Tauri 2.x SQL Plugin](https://v2.tauri.app/plugin/sql/)
- [PostHog Self-Hosted](https://posthog.com/docs/self-host)
- [Sentry for Desktop Apps](https://docs.sentry.io/platforms/rust/)
