// Highlight colors
export const HIGHLIGHT_COLORS = [
  { id: 'yellow', hex: '#ffff00', name: 'Yellow' },
  { id: 'green', hex: '#00ff00', name: 'Green' },
  { id: 'blue', hex: '#00bfff', name: 'Blue' },
  { id: 'pink', hex: '#ff69b4', name: 'Pink' },
  { id: 'orange', hex: '#ffa500', name: 'Orange' },
] as const;

export const DEFAULT_HIGHLIGHT_COLORS = HIGHLIGHT_COLORS.map((c) => c.hex);
export const DEFAULT_HIGHLIGHT_COLOR = HIGHLIGHT_COLORS[0].hex;

// Zoom levels
export const ZOOM_LEVELS = [
  { value: 0.5, label: '50%' },
  { value: 0.75, label: '75%' },
  { value: 1.0, label: '100%' },
  { value: 1.25, label: '125%' },
  { value: 1.5, label: '150%' },
  { value: 2.0, label: '200%' },
] as const;

export const DEFAULT_ZOOM_LEVEL = 1.0;
export const ZOOM_MIN = 0.25;
export const ZOOM_MAX = 4.0;
export const ZOOM_STEP = 0.25;

// TTS settings
export const DEFAULT_TTS_RATE = 1.0;
export const MIN_TTS_RATE = 0.5;
export const MAX_TTS_RATE = 2.0;

// UI constants
export const PAGE_PADDING = 20;
export const TOOLBAR_HEIGHT = 48;

// Storage keys
export const STORAGE_KEYS = {
  THEME: 'theme',
  ZOOM_LEVEL: 'zoom_level',
  TTS_RATE: 'tts_rate',
  TTS_VOICE: 'tts_voice',
  DEFAULT_HIGHLIGHT_COLOR: 'default_highlight_color',
} as const;
