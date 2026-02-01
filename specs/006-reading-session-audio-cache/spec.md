# Feature Specification: Reading Session Manager with Audio Cache & Progress Persistence

**Feature Branch**: `006-reading-session-audio-cache`
**Created**: 2026-01-25
**Status**: Draft
**Input**: User description: "Reading Session Manager with Audio Cache & Progress Persistence - Users need a way to persist reading sessions into a navigable menu, cache TTS audio per chunk, compose complete audiobooks, and eliminate API costs for fully converted content."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Resume Reading with Cached Audio (Priority: P1)

As a reader, I want all generated TTS audio cached locally so I never pay for the same text twice when resuming a book.

**Why this priority**: This is the core value proposition - eliminating redundant API costs. Without caching, every TTS playback costs money, making the feature impractical for long-form content.

**Independent Test**: Can be fully tested by playing TTS audio for a text chunk, closing the app, reopening, and playing the same chunk again. Delivers value by confirming audio plays from cache without API call.

**Acceptance Scenarios**:

1. **Given** a user has played TTS for chapter 3 of a book, **When** they play TTS for chapter 3 again (same voice settings), **Then** the audio plays instantly from cache with no API call made
2. **Given** a user changes the TTS voice setting, **When** they play TTS for previously cached content, **Then** a new API call is made since the voice differs from the cached version
3. **Given** cached audio exists for a text chunk, **When** the user restarts the application, **Then** the cache persists and audio plays from cache

---

### User Story 2 - View Audio Cache Progress (Priority: P2)

As a reader, I want to see a progress indicator showing what percentage of the book has cached audio, so I know how much content is ready for offline listening.

**Why this priority**: Provides essential user feedback about cache status. Without visibility, users cannot plan offline reading or understand why some sections play instantly vs require loading.

**Independent Test**: Can be fully tested by caching audio for specific pages, then verifying the progress indicator reflects the correct percentage. Delivers value by giving users clear insight into their cache state.

**Acceptance Scenarios**:

1. **Given** a 100-page document with 10 pages of cached audio, **When** the user views the document, **Then** the progress indicator shows 10% cache coverage
2. **Given** no cached audio exists for a document, **When** the user views the document, **Then** the progress indicator shows 0% coverage
3. **Given** TTS is playing and generating new cache entries, **When** each chunk finishes playing, **Then** the progress indicator updates in real-time

---

### User Story 3 - Create and Manage Reading Sessions (Priority: P3)

As a reader, I want to save my current document selection into a "Reading Session" so I can resume my place and settings later.

**Why this priority**: Enables organized multi-book reading. While individual document progress already exists, explicit sessions allow users to group related documents (e.g., a course reading list, a book series).

**Independent Test**: Can be fully tested by creating a session with 2+ documents, closing the app, reopening, and restoring the session. Delivers value by returning user to exact reading state.

**Acceptance Scenarios**:

1. **Given** a user has 3 books open with various reading positions, **When** they create a reading session named "My Series", **Then** all document references and positions are saved
2. **Given** a saved session exists, **When** the user selects "Restore Session", **Then** all associated documents open at their saved positions
3. **Given** multiple sessions exist, **When** the user views the session menu, **Then** all sessions display with name, document count, and last accessed date

---

### User Story 4 - Export Complete Audiobook (Priority: P4)

As a reader, I want to export a complete audiobook file once all chunks are cached, so I can listen on external devices without the app.

**Why this priority**: High-value feature but dependent on P1 (caching) being complete first. Export is a bonus for power users who want portable audiobooks.

**Independent Test**: Can be fully tested by fully caching a short document, initiating export, and playing the resulting file in an external audio player. Delivers value by creating a standalone audiobook file.

**Acceptance Scenarios**:

1. **Given** a document with 100% cached audio, **When** the user initiates export, **Then** a single audio file is created containing all chapters in order
2. **Given** exported audio with chapter markers, **When** the user plays the file in a compatible player, **Then** chapter navigation is available
3. **Given** a document with only 50% cached audio, **When** the user attempts export, **Then** the system displays which sections are missing and offers to cache remaining content first

---

### Edge Cases

- What happens when a user deletes cached audio while playback is in progress? System should gracefully handle by re-fetching from API or pausing with notification.
- How does the system handle corrupt cache files? Validation on load with automatic re-fetch if integrity check fails.
- What happens when disk space runs low during caching? System should notify user before cache storage fails and offer to clear old cache entries.
- How are cache conflicts resolved when the same text chunk exists in multiple documents? Content-addressable storage via hash means identical text shares the same cache entry.
- What happens if a session references a document that was deleted? Session restore shows warning and skips missing documents.

## Requirements _(mandatory)_

### Functional Requirements

**Audio Cache**

- **FR-001**: System MUST cache generated TTS audio locally using content-addressable storage (SHA-256 hash of text + voice + model)
- **FR-002**: System MUST check cache before making TTS API calls and return cached audio when available
- **FR-003**: System MUST store audio duration metadata to enable timestamp calculations for export
- **FR-004**: System MUST persist cache across application restarts
- **FR-005**: System MUST invalidate cache entries when source text content changes (detected via hash mismatch)
- **FR-006**: System MUST support configurable cache size limits with LRU (Least Recently Used) eviction policy

**Cache Progress Tracking**

- **FR-007**: System MUST calculate and display cache coverage percentage per document
- **FR-008**: System MUST update cache coverage in real-time as new audio is generated
- **FR-009**: System MUST display visual progress indicator showing cached vs uncached portions

**Reading Sessions**

- **FR-010**: Users MUST be able to create named reading sessions containing one or more documents
- **FR-011**: Users MUST be able to list, restore, and delete reading sessions
- **FR-012**: System MUST persist session data including document references and reading positions
- **FR-013**: System MUST track session metadata (created date, last accessed date, document count)

**Audio Export**

- **FR-014**: System MUST concatenate cached audio chunks into a single output file in order
- **FR-015**: System MUST embed chapter markers in exported audio for navigation
- **FR-016**: System MUST support export only when 100% of content is cached (or allow partial export with user confirmation)
- **FR-017**: Users MUST be able to select export format and output location

### Key Entities

- **AudioCacheEntry**: Represents a single cached audio chunk. Contains document reference, chunk identifier, content hash for deduplication, file path to cached audio, duration in milliseconds, voice/model settings used for generation, and creation timestamp.

- **ReadingSession**: Represents a user-created collection of documents for organized reading. Contains session name, ordered list of document references, creation and last-updated timestamps.

- **SessionDocument**: Junction entity linking sessions to documents with position ordering. Tracks the order of documents within a session.

- **CoverageStats**: Calculated entity representing cache completeness for a document. Contains total chunks, cached chunks, percentage complete, and total cached duration.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Repeat TTS playback for cached content completes in under 500ms with zero API calls (vs 2-5 seconds for uncached)
- **SC-002**: Cache coverage percentage displays within 100ms of document load
- **SC-003**: Session restore returns user to saved state in under 1 second
- **SC-004**: Audio export for a 100-chunk document completes in under 10 seconds
- **SC-005**: Users can identify cache status (complete/partial/none) at a glance via visual indicator
- **SC-006**: 95% of cache lookups complete in under 10ms
- **SC-007**: Exported audiobooks play continuously with functional chapter navigation in standard audio players

## Assumptions

- **A-001**: The existing TTS infrastructure (ElevenLabs integration) is functional and will remain the primary audio source
- **A-002**: Cache storage will use the filesystem (not SQLite BLOBs) for audio data, with SQLite metadata for indexing
- **A-003**: Export format will default to MP3 with M4B (audiobook format) as a future enhancement option
- **A-004**: Default cache size limit will be 5GB with user-configurable settings
- **A-005**: Reading session names must be unique per user but can be renamed
- **A-006**: Chapter markers in export will align with PDF page boundaries (one chapter per page) as the default strategy

## Out of Scope (v1)

- Cloud sync of audio cache
- Streaming audio composition (real-time export during playback)
- Multiple voice mixing per document (different voices for different sections)
- Real-time transcription alignment
- Background pre-caching of uncached content (explicit user action required)
- Audio compression/quality settings for cache storage
