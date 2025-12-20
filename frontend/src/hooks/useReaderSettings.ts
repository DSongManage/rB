import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ReaderSettings,
  DEFAULT_READER_SETTINGS,
  FONT_SIZE_MAP,
  LINE_HEIGHT_MAP,
  THEME_COLORS,
  FONT_FAMILY_MAP,
  MARGIN_MAP,
} from '../types/reader';

const STORAGE_KEY = 'rb_reader_settings';

export function useReaderSettings() {
  const [settings, setSettings] = useState<ReaderSettings>(() => {
    // Load from localStorage on init
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Migrate old settings format
        const migrated = migrateSettings(parsed);
        return { ...DEFAULT_READER_SETTINGS, ...migrated };
      }
    } catch (e) {
      console.error('Failed to load reader settings:', e);
    }
    return DEFAULT_READER_SETTINGS;
  });

  // Persist to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (e) {
      console.error('Failed to save reader settings:', e);
    }
  }, [settings]);

  const updateSetting = useCallback(
    <K extends keyof ReaderSettings>(key: K, value: ReaderSettings[K]) => {
      setSettings((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_READER_SETTINGS);
  }, []);

  // Computed CSS variables for easy application
  const cssVars = useMemo(
    () => ({
      '--reader-font-size': FONT_SIZE_MAP[settings.fontSize],
      '--reader-line-height': LINE_HEIGHT_MAP[settings.lineHeight],
      '--reader-bg': THEME_COLORS[settings.theme].background,
      '--reader-text': THEME_COLORS[settings.theme].text,
      '--reader-secondary': THEME_COLORS[settings.theme].secondary,
      '--reader-border': THEME_COLORS[settings.theme].border,
      '--reader-accent': THEME_COLORS[settings.theme].accent,
      '--reader-font-family': FONT_FAMILY_MAP[settings.fontFamily].css,
      '--reader-margin': MARGIN_MAP[settings.margins],
      '--reader-text-align': settings.textAlign,
    }),
    [settings]
  );

  // Theme class name for CSS
  const themeClass = `reader-theme-${settings.theme}`;

  return {
    settings,
    updateSetting,
    resetSettings,
    cssVars,
    themeClass,
  };
}

// Migrate old settings format to new format
function migrateSettings(oldSettings: Record<string, unknown>): Partial<ReaderSettings> {
  const migrated: Partial<ReaderSettings> = { ...oldSettings } as Partial<ReaderSettings>;

  // Migrate old fontFamily values
  if (oldSettings.fontFamily === 'serif') {
    migrated.fontFamily = 'georgia';
  } else if (oldSettings.fontFamily === 'sans-serif') {
    migrated.fontFamily = 'amazon-ember';
  }

  // Ensure new fields have defaults if missing
  if (!migrated.margins) migrated.margins = DEFAULT_READER_SETTINGS.margins;
  if (!migrated.textAlign) migrated.textAlign = DEFAULT_READER_SETTINGS.textAlign;
  if (!migrated.columns) migrated.columns = DEFAULT_READER_SETTINGS.columns;
  if (migrated.continuousScroll === undefined) migrated.continuousScroll = DEFAULT_READER_SETTINGS.continuousScroll;

  return migrated;
}

export default useReaderSettings;
