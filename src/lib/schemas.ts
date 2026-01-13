import { z } from 'zod';

// Rect schema for highlight positioning (page coordinates)
export const RectSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number().positive(),
  height: z.number().positive(),
});

export type Rect = z.infer<typeof RectSchema>;

// Document schema - represents a PDF in the library
export const DocumentSchema = z.object({
  id: z.string(), // SHA-256 content hash
  filePath: z.string().min(1),
  title: z.string().nullable(),
  pageCount: z.number().int().positive().nullable(),
  currentPage: z.number().int().min(1),
  scrollPosition: z.number().min(0).max(1),
  lastTtsChunkId: z.string().nullable(),
  lastOpenedAt: z.string().nullable(),
  fileHash: z.string().nullable(),
  createdAt: z.string(),
});

export type Document = z.infer<typeof DocumentSchema>;

// Document creation input
export const DocumentCreateSchema = z.object({
  filePath: z.string().min(1),
  title: z.string().optional(),
  pageCount: z.number().int().positive().optional(),
});

export type DocumentCreate = z.infer<typeof DocumentCreateSchema>;

// Highlight schema - a text highlight within a document
export const HighlightSchema = z.object({
  id: z.string().uuid(),
  documentId: z.string(),
  pageNumber: z.number().int().min(1),
  rects: z.array(RectSchema).min(1),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  textContent: z.string().nullable(),
  note: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string().nullable(),
});

export type Highlight = z.infer<typeof HighlightSchema>;

// Highlight creation input
export const HighlightCreateSchema = z.object({
  documentId: z.string(),
  pageNumber: z.number().int().min(1),
  rects: z.array(RectSchema).min(1),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  textContent: z.string().optional(),
});

export type HighlightCreate = z.infer<typeof HighlightCreateSchema>;

// Highlight update input
export const HighlightUpdateSchema = z.object({
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  note: z.string().nullable().optional(),
});

export type HighlightUpdate = z.infer<typeof HighlightUpdateSchema>;

// Settings schema
export const SettingsSchema = z.object({
  ttsVoice: z.string().nullable(),
  ttsRate: z.number().min(0.5).max(3.0),
  ttsFollowAlong: z.boolean(),
  highlightColors: z.array(z.string().regex(/^#[0-9a-fA-F]{6}$/)),
  highlightDefaultColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  theme: z.enum(['light', 'dark', 'system']),
  telemetryAnalytics: z.boolean(),
  telemetryErrors: z.boolean(),
});

export type Settings = z.infer<typeof SettingsSchema>;

// TTS Voice info
export const VoiceInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
  language: z.string().nullable(),
});

export type VoiceInfo = z.infer<typeof VoiceInfoSchema>;

// TTS State
export const TtsStateSchema = z.object({
  initialized: z.boolean(),
  isSpeaking: z.boolean(),
  isPaused: z.boolean(),
  currentChunkId: z.string().nullable(),
  currentVoice: VoiceInfoSchema.nullable(),
  rate: z.number(),
});

export type TtsState = z.infer<typeof TtsStateSchema>;

// TTS Init Response
export const TtsInitResponseSchema = z.object({
  available: z.boolean(),
  backend: z.string().nullable(),
  defaultVoice: z.string().nullable(),
  error: z.string().nullable(),
});

export type TtsInitResponse = z.infer<typeof TtsInitResponseSchema>;

// Response types
export const ListHighlightsResponseSchema = z.object({
  highlights: z.array(HighlightSchema),
});

export type ListHighlightsResponse = z.infer<typeof ListHighlightsResponseSchema>;

export const DeleteResponseSchema = z.object({
  success: z.boolean(),
  deleted: z.number().nullable(),
});

export type DeleteResponse = z.infer<typeof DeleteResponseSchema>;

export const ExportResponseSchema = z.object({
  content: z.string(),
  filename: z.string(),
});

export type ExportResponse = z.infer<typeof ExportResponseSchema>;

export const FileExistsResponseSchema = z.object({
  exists: z.boolean(),
  filePath: z.string(),
});

export type FileExistsResponse = z.infer<typeof FileExistsResponseSchema>;
