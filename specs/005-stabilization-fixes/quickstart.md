# Quickstart: Stabilization & Fixes Sprint

**Branch**: `005-stabilization-fixes` | **Date**: 2026-01-14

## Prerequisites

- Node.js 18+ and pnpm 8+
- Rust 1.75+ with cargo
- Platform build tools (see Tauri docs)

## Setup

```bash
# Clone and checkout branch
git checkout 005-stabilization-fixes

# Install dependencies
pnpm install

# Start development
pnpm tauri dev
```

## Fix Tracks Overview

| Track | Priority | Est. Time | Key Files |
|-------|----------|-----------|-----------|
| C. TTS Playback | P0 | 2h | `src-tauri/src/ai_tts/mod.rs`, `src/hooks/useAiTts.ts` |
| A. Highlights | P0 | 2h | `src/components/pdf-viewer/PdfPage.tsx`, NEW handler |
| B. Rendering | P1 | 30m | `src-tauri/src/commands/settings.rs` |
| D. Persistence | P1 | 3h | `src-tauri/src/adapters/`, NEW audio cache |
| E. UI/UX | P2 | 2h | `src/ui/tokens/z-index.css`, component CSS |

## Track C: TTS Playback (Start Here)

### Issue Summary
- Backend state not updated on pause/resume
- No events emitted for pause/resume
- No stop on page navigation

### Fix Steps

1. **Update backend state on pause/resume**
   ```bash
   # Edit: src-tauri/src/ai_tts/mod.rs
   # Find: pub fn pause(&self)
   # Add: state.is_paused = true; state.is_playing = false;
   ```

2. **Emit events from commands**
   ```bash
   # Edit: src-tauri/src/commands/ai_tts.rs
   # Find: ai_tts_pause, ai_tts_resume
   # Add: app.emit("ai-tts:paused", ()) / app.emit("ai-tts:resumed", ())
   ```

3. **Add event listeners in hook**
   ```bash
   # Edit: src/hooks/useAiTts.ts
   # Add listeners for ai-tts:paused and ai-tts:resumed
   ```

4. **Stop playback on page navigation**
   ```bash
   # Edit: src/components/PageNavigation.tsx
   # Add: if playing/paused, call stop() before setCurrentPage()
   ```

### Verify
```bash
# Run tests
cd src-tauri && cargo test --features test-mocks
pnpm test:run

# Manual test
# 1. Open PDF, play TTS
# 2. Pause → verify state updates correctly
# 3. Navigate page → verify playback stops
```

## Track A: Highlights

### Issue Summary
- HighlightToolbar exists but never shown
- Text selection not connected to highlight creation

### Fix Steps

1. **Create orchestration component**
   ```bash
   # Create: src/components/pdf-viewer/HighlightCreationHandler.tsx
   # - Accept onTextSelect callback
   # - Manage selection state
   # - Show HighlightToolbar positioned at selection
   # - On color pick: create highlight, persist, clear selection
   ```

2. **Integrate in PdfPage**
   ```bash
   # Edit: src/components/pdf-viewer/PdfPage.tsx
   # - Import HighlightCreationHandler
   # - Wire onTextSelect from TextLayer
   ```

3. **Add coordinate utilities**
   ```bash
   # Create: src/lib/coordinate-transform.ts
   # - normalizeRects(rects, scale) → scale=1.0 rects
   # - scaleRects(rects, toScale) → render-ready rects
   ```

### Verify
```bash
# Manual test
# 1. Open PDF
# 2. Select text → toolbar should appear
# 3. Click color → highlight created
# 4. Close/reopen app → highlight persists
# 5. Zoom → highlight aligns with text
```

## Track B: Rendering (Quick Fix)

### Issue Summary
- HW acceleration toggle exists in UI but backend incomplete

### Fix Steps

1. **Implement settings flag**
   ```bash
   # Edit: src-tauri/src/commands/settings.rs
   # - On hwAccelerationEnabled change, write flag file
   # - Return requiresRestart: true
   ```

### Verify
```bash
# Manual test
# 1. Toggle HW acceleration in settings
# 2. Verify restart prompt appears
# 3. Restart app, verify setting persisted
```

## Track D: Audio Persistence

### Issue Summary
- TTS audio not cached, regenerated on every play

### Fix Steps

1. **Create cache adapter**
   ```bash
   # Create: src-tauri/src/adapters/audio_cache_adapter.rs
   # - CacheKey generation (text + voice + settings hash)
   # - get(key) → Option<Vec<u8>>
   # - set(key, data)
   # - invalidate(voice_id)
   ```

2. **Add database table**
   ```bash
   # Edit: src-tauri/src/db/migrations.rs
   # Add: tts_cache_metadata table creation
   ```

3. **Integrate in ElevenLabs client**
   ```bash
   # Edit: src-tauri/src/ai_tts/elevenlabs.rs
   # - Check cache before API call
   # - Store result after successful API call
   ```

4. **Add cache commands**
   ```bash
   # Edit: src-tauri/src/commands/ai_tts.rs
   # - ai_tts_cache_info()
   # - ai_tts_cache_clear()
   ```

### Verify
```bash
# Manual test
# 1. Play TTS for a page (note latency)
# 2. Play same page again (should be instant)
# 3. Restart app, play same page (should be instant)
# 4. Change voice, play (should regenerate)
```

## Track E: UI/UX

### Issue Summary
- Z-index values scattered across CSS files
- Debug features mixed with normal settings

### Fix Steps

1. **Expand z-index tokens**
   ```bash
   # Edit: src/ui/tokens/z-index.css
   # Add comprehensive layer definitions
   ```

2. **Migrate component CSS**
   ```bash
   # Update: All CSS files with hardcoded z-index
   # Replace: z-index: 1000 → z-index: var(--z-modal)
   ```

3. **Separate developer settings**
   ```bash
   # Edit: src/components/settings/SettingsPanel.tsx
   # Add: Developer section, hidden by default
   ```

### Verify
```bash
# Manual test
# 1. Open settings panel over PDF
# 2. Verify no z-index conflicts (overlapping)
# 3. Verify debug overlay hidden by default
# 4. Verify modals close with Escape
```

## Running Tests

```bash
# All frontend tests
pnpm test:run

# Architecture tests only
pnpm test:arch

# All backend tests
cd src-tauri && cargo test --features test-mocks

# Specific track tests (if applicable)
pnpm test:run -- --grep "highlight"
cd src-tauri && cargo test highlight --features test-mocks
```

## Commit Guidelines

```bash
# Use conventional commits
git commit -m "fix(tts): sync backend state on pause/resume"
git commit -m "feat(highlights): add creation handler component"
git commit -m "fix(ui): centralize z-index tokens"

# Include spec references in PR description
# "Fixes Track C (FR-C03, FR-C04, FR-C05)"
```

## Key Documentation

- [Spec](./spec.md) - Requirements and acceptance criteria
- [Research](./research.md) - Investigation findings per track
- [Data Model](./data-model.md) - Entity definitions
- [Contracts](./contracts/tauri-commands.md) - API changes
- [Design System](/docs/ui/DESIGN_SYSTEM.md) - UI tokens reference
