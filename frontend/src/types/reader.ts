/**
 * Kindle-style Reader Type Definitions
 */

// Reader settings that persist to localStorage
export interface ReaderSettings {
  fontSize: 'small' | 'medium' | 'large' | 'xlarge';
  lineHeight: 'compact' | 'normal' | 'relaxed';
  theme: 'light' | 'dark' | 'sepia';
  fontFamily: 'serif' | 'sans-serif';
}

export const DEFAULT_READER_SETTINGS: ReaderSettings = {
  fontSize: 'medium',
  lineHeight: 'normal',
  theme: 'dark',
  fontFamily: 'serif',
};

// Font size mappings in pixels
export const FONT_SIZE_MAP: Record<ReaderSettings['fontSize'], string> = {
  small: '14px',
  medium: '18px',
  large: '22px',
  xlarge: '26px',
};

// Line height mappings
export const LINE_HEIGHT_MAP: Record<ReaderSettings['lineHeight'], string> = {
  compact: '1.4',
  normal: '1.8',
  relaxed: '2.2',
};

// Theme color mappings
export const THEME_COLORS: Record<ReaderSettings['theme'], {
  background: string;
  text: string;
  secondary: string;
  border: string;
}> = {
  light: {
    background: '#ffffff',
    text: '#1a1a1a',
    secondary: '#6b7280',
    border: '#e5e7eb',
  },
  dark: {
    background: '#0a0f1a',
    text: '#d1d5db',
    secondary: '#94a3b8',
    border: '#1f2937',
  },
  sepia: {
    background: '#f4ecd8',
    text: '#5b4636',
    secondary: '#8b7355',
    border: '#d4c4a8',
  },
};

// Font family mappings
export const FONT_FAMILY_MAP: Record<ReaderSettings['fontFamily'], string> = {
  serif: "Georgia, 'Times New Roman', serif",
  'sans-serif': "Inter, system-ui, -apple-system, sans-serif",
};

// Chapter detected from HTML headings
export interface Chapter {
  id: string;
  title: string;
  level: number; // 1, 2, or 3 (h1, h2, h3)
  pageIndex: number; // Which page this chapter starts on
  elementId?: string; // ID attribute if present in HTML
}

// Position saved for progress tracking
export interface PagePosition {
  page: number;
  totalPages: number;
  chapterId?: string;
  fontSize: ReaderSettings['fontSize'];
  lineHeight: ReaderSettings['lineHeight'];
}

// Legacy position format (for backward compatibility)
export interface ScrollPosition {
  scroll: number;
}

// Combined position type
export type SavedPosition = PagePosition | ScrollPosition;

// Check if position is page-based
export function isPagePosition(pos: SavedPosition): pos is PagePosition {
  return 'page' in pos && 'totalPages' in pos;
}
