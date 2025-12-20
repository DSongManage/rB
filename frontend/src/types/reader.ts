/**
 * Kindle-style Reader Type Definitions
 */

// Reader settings that persist to localStorage
export interface ReaderSettings {
  fontSize: 'xsmall' | 'small' | 'medium' | 'large' | 'xlarge';
  lineHeight: 'compact' | 'normal' | 'relaxed';
  theme: 'light' | 'sepia' | 'green' | 'dark';
  fontFamily: 'amazon-ember' | 'baskerville' | 'bookerly' | 'georgia' | 'palatino';
  margins: 'narrow' | 'medium' | 'wide';
  textAlign: 'left' | 'justify';
  columns: 'single' | 'two';
  continuousScroll: boolean;
}

export const DEFAULT_READER_SETTINGS: ReaderSettings = {
  fontSize: 'medium',
  lineHeight: 'normal',
  theme: 'dark',
  fontFamily: 'bookerly',
  margins: 'medium',
  textAlign: 'justify',
  columns: 'two',
  continuousScroll: false,
};

// Font size mappings in pixels (more granular like Kindle)
export const FONT_SIZE_MAP: Record<ReaderSettings['fontSize'], string> = {
  xsmall: '14px',
  small: '16px',
  medium: '18px',
  large: '22px',
  xlarge: '26px',
};

// Line height mappings
export const LINE_HEIGHT_MAP: Record<ReaderSettings['lineHeight'], string> = {
  compact: '1.4',
  normal: '1.7',
  relaxed: '2.0',
};

// Theme color mappings (matching Kindle's 4 page colors)
export const THEME_COLORS: Record<ReaderSettings['theme'], {
  background: string;
  text: string;
  secondary: string;
  border: string;
  accent: string;
}> = {
  light: {
    background: '#ffffff',
    text: '#1a1a1a',
    secondary: '#6b7280',
    border: '#e5e7eb',
    accent: '#0066cc',
  },
  sepia: {
    background: '#f5e6c8',
    text: '#5b4636',
    secondary: '#8b7355',
    border: '#d4c4a8',
    accent: '#8b5a2b',
  },
  green: {
    background: '#d4e8d4',
    text: '#2d4a2d',
    secondary: '#4a6b4a',
    border: '#a8c8a8',
    accent: '#2d6b2d',
  },
  dark: {
    background: '#0a1628',
    text: '#c9d1d9',
    secondary: '#8b949e',
    border: '#21262d',
    accent: '#58a6ff',
  },
};

// Font family mappings (Kindle-style fonts)
export const FONT_FAMILY_MAP: Record<ReaderSettings['fontFamily'], { name: string; css: string }> = {
  'amazon-ember': {
    name: 'Amazon Ember',
    css: "'Amazon Ember', 'Helvetica Neue', Helvetica, Arial, sans-serif",
  },
  'baskerville': {
    name: 'Baskerville',
    css: "Baskerville, 'Baskerville Old Face', 'Times New Roman', serif",
  },
  'bookerly': {
    name: 'Bookerly',
    css: "Bookerly, Georgia, 'Times New Roman', serif",
  },
  'georgia': {
    name: 'Georgia',
    css: "Georgia, 'Times New Roman', serif",
  },
  'palatino': {
    name: 'Palatino',
    css: "'Palatino Linotype', 'Book Antiqua', Palatino, serif",
  },
};

// Margin mappings
export const MARGIN_MAP: Record<ReaderSettings['margins'], string> = {
  narrow: '20px',
  medium: '48px',
  wide: '80px',
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
  margins?: ReaderSettings['margins'];
  columns?: ReaderSettings['columns'];
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
