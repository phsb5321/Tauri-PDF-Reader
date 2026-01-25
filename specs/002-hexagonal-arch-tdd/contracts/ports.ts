/**
 * Port Interfaces for Hexagonal Architecture
 *
 * These interfaces define the contracts between the domain/application layers
 * and the infrastructure adapters. They are owned by the core (domain/application)
 * and implemented by adapters.
 *
 * Generated for: 002-hexagonal-arch-tdd
 * Date: 2026-01-13
 */

// =============================================================================
// Domain Entities (referenced by ports)
// =============================================================================

export interface Document {
  id: string;
  filePath: string;
  title: string | null;
  pageCount: number | null;
  currentPage: number;
  scrollPosition: number;
  lastTtsChunkId: string | null;
  lastOpenedAt: string | null;
  fileHash: string | null;
  createdAt: string;
}

export interface Highlight {
  id: string;
  documentId: string;
  pageNumber: number;
  rects: Rect[];
  color: string;
  textContent: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface VoiceInfo {
  id: string;
  name: string;
  language: string | null;
}

export interface TtsState {
  initialized: boolean;
  isSpeaking: boolean;
  isPaused: boolean;
  currentChunkId: string | null;
  currentVoice: VoiceInfo | null;
  rate: number;
}

export interface TtsInitResponse {
  available: boolean;
  backend: string | null;
  defaultVoice: string | null;
  error: string | null;
}

export interface TtsCapabilities {
  supportsUtterance: boolean;
  supportsRate: boolean;
  supportsPitch: boolean;
  supportsVolume: boolean;
}

// =============================================================================
// Input/Output DTOs
// =============================================================================

export interface HighlightCreate {
  documentId: string;
  pageNumber: number;
  rects: Rect[];
  color: string;
  textContent?: string;
}

export interface HighlightUpdate {
  color?: string;
  note?: string | null;
}

export interface BatchCreateResponse {
  highlights: Highlight[];
  created: number;
}

export interface DeleteResponse {
  success: boolean;
  deleted: number | null;
}

export interface ExportResponse {
  content: string;
  filename: string;
}

export interface FileExistsResponse {
  exists: boolean;
  filePath: string;
}

export type OrderBy = 'last_opened' | 'created' | 'title';
export type ExportFormat = 'markdown' | 'json' | 'text';

// =============================================================================
// Port Interfaces
// =============================================================================

/**
 * DocumentRepositoryPort
 *
 * Manages document persistence operations.
 * Implemented by: TauriDocumentRepository, MockDocumentRepository
 */
export interface DocumentRepositoryPort {
  /**
   * Add a new document to the library
   */
  add(filePath: string, title?: string, pageCount?: number): Promise<Document>;

  /**
   * Get a document by its content-hash ID
   */
  getById(id: string): Promise<Document | null>;

  /**
   * Get a document by its file path
   */
  getByPath(filePath: string): Promise<Document | null>;

  /**
   * List all documents with optional ordering and pagination
   */
  list(orderBy?: OrderBy, limit?: number, offset?: number): Promise<Document[]>;

  /**
   * Update reading progress for a document
   */
  updateProgress(
    id: string,
    page: number,
    scroll?: number,
    ttsChunkId?: string
  ): Promise<Document>;

  /**
   * Update document title
   */
  updateTitle(id: string, title: string): Promise<Document>;

  /**
   * Relocate a document to a new file path
   */
  relocate(id: string, newPath: string): Promise<Document>;

  /**
   * Remove a document from the library
   */
  remove(id: string): Promise<void>;

  /**
   * Check if a file exists at the given path
   */
  checkFileExists(filePath: string): Promise<FileExistsResponse>;
}

/**
 * HighlightRepositoryPort
 *
 * Manages highlight persistence operations.
 * Implemented by: TauriHighlightRepository, MockHighlightRepository
 */
export interface HighlightRepositoryPort {
  /**
   * Create a new highlight
   */
  create(input: HighlightCreate): Promise<Highlight>;

  /**
   * Create multiple highlights in a batch
   */
  batchCreate(inputs: HighlightCreate[]): Promise<BatchCreateResponse>;

  /**
   * Get a highlight by ID
   */
  getById(id: string): Promise<Highlight | null>;

  /**
   * List all highlights for a specific page
   */
  listForPage(documentId: string, pageNumber: number): Promise<Highlight[]>;

  /**
   * List all highlights for a document
   */
  listForDocument(documentId: string): Promise<Highlight[]>;

  /**
   * Update a highlight's color or note
   */
  update(id: string, input: HighlightUpdate): Promise<Highlight>;

  /**
   * Delete a highlight
   */
  delete(id: string): Promise<void>;

  /**
   * Delete all highlights for a document
   */
  deleteForDocument(documentId: string): Promise<DeleteResponse>;

  /**
   * Export highlights in various formats
   */
  export(documentId: string, format: ExportFormat): Promise<ExportResponse>;
}

/**
 * TtsPort
 *
 * Text-to-speech engine operations.
 * Implemented by: TauriNativeTtsAdapter, TauriAiTtsAdapter, MockTtsAdapter
 */
export interface TtsPort {
  /**
   * Initialize the TTS engine
   */
  init(): Promise<TtsInitResponse>;

  /**
   * List available voices
   */
  listVoices(): Promise<VoiceInfo[]>;

  /**
   * Speak a single text chunk
   */
  speak(text: string, chunkId?: string): Promise<void>;

  /**
   * Speak multiple chunks sequentially (for long content)
   */
  speakLong(chunks: Array<{ id: string; text: string }>): Promise<void>;

  /**
   * Stop all speech
   */
  stop(): Promise<void>;

  /**
   * Pause current speech
   */
  pause(): Promise<void>;

  /**
   * Resume paused speech
   */
  resume(): Promise<void>;

  /**
   * Set the active voice
   */
  setVoice(voiceId: string): Promise<void>;

  /**
   * Set playback rate (0.5 - 3.0)
   */
  setRate(rate: number): Promise<void>;

  /**
   * Get current TTS state
   */
  getState(): Promise<TtsState>;

  /**
   * Check engine capabilities
   */
  checkCapabilities(): Promise<TtsCapabilities>;
}

/**
 * SettingsPort
 *
 * User settings persistence.
 * Implemented by: TauriSettingsAdapter, MockSettingsAdapter
 */
export interface SettingsPort {
  /**
   * Get a setting value by key
   */
  get<T>(key: string): Promise<T | null>;

  /**
   * Set a setting value
   */
  set<T>(key: string, value: T): Promise<void>;

  /**
   * Get all settings
   */
  getAll(): Promise<Record<string, unknown>>;

  /**
   * Delete a setting
   */
  delete(key: string): Promise<void>;

  /**
   * Set multiple settings at once
   */
  setBatch(settings: Record<string, unknown>): Promise<void>;
}

/**
 * FileSystemPort
 *
 * File system operations (restricted by Tauri security model).
 * Implemented by: TauriFileSystemAdapter, MockFileSystemAdapter
 */
export interface FileSystemPort {
  /**
   * Read file contents
   */
  readFile(path: string): Promise<Uint8Array>;

  /**
   * Write file contents
   */
  writeFile(path: string, data: Uint8Array): Promise<void>;

  /**
   * Check if file exists
   */
  exists(path: string): Promise<boolean>;

  /**
   * Open file selection dialog
   */
  openDialog(options: DialogOptions): Promise<string | null>;

  /**
   * Open save file dialog
   */
  saveDialog(options: SaveDialogOptions): Promise<string | null>;
}

export interface DialogOptions {
  title?: string;
  filters?: Array<{ name: string; extensions: string[] }>;
  defaultPath?: string;
  multiple?: boolean;
}

export interface SaveDialogOptions {
  title?: string;
  filters?: Array<{ name: string; extensions: string[] }>;
  defaultPath?: string;
}

// =============================================================================
// Application Service Interfaces (Use Cases)
// =============================================================================

/**
 * LibraryService
 *
 * Use cases for document library management.
 */
export interface LibraryServicePort {
  openDocument(filePath: string): Promise<Document>;
  closeDocument(id: string): Promise<void>;
  getRecentDocuments(limit?: number): Promise<Document[]>;
  searchDocuments(query: string): Promise<Document[]>;
  removeDocument(id: string): Promise<void>;
}

/**
 * ReadingService
 *
 * Use cases for document reading and navigation.
 */
export interface ReadingServicePort {
  goToPage(documentId: string, page: number): Promise<void>;
  updateScroll(documentId: string, scroll: number): Promise<void>;
  bookmarkPosition(documentId: string): Promise<void>;
}

/**
 * TtsService
 *
 * Use cases for text-to-speech playback.
 */
export interface TtsServicePort {
  startReading(documentId: string, fromChunk?: string): Promise<void>;
  stopReading(): Promise<void>;
  togglePause(): Promise<void>;
  skipToChunk(chunkId: string): Promise<void>;
}
