import React from 'react';
import { Minus, Plus, Sun, Moon, Type, Columns, AlignLeft, AlignJustify } from 'lucide-react';
import {
  ReaderSettings,
  THEME_COLORS,
  FONT_FAMILY_MAP,
} from '../../types/reader';

interface MobileReaderSettingsProps {
  settings: ReaderSettings;
  updateSetting: <K extends keyof ReaderSettings>(key: K, value: ReaderSettings[K]) => void;
  onClose: () => void;
  visible: boolean;
}

export function MobileReaderSettings({
  settings,
  updateSetting,
  onClose,
  visible,
}: MobileReaderSettingsProps) {
  if (!visible) return null;

  const fontSizes: ReaderSettings['fontSize'][] = ['xsmall', 'small', 'medium', 'large', 'xlarge'];
  const currentSizeIndex = fontSizes.indexOf(settings.fontSize);

  const fontSizeLabels: Record<ReaderSettings['fontSize'], string> = {
    xsmall: 'XS',
    small: 'S',
    medium: 'M',
    large: 'L',
    xlarge: 'XL',
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.6)',
          zIndex: 200,
        }}
      />

      {/* Bottom drawer */}
      <div
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          background: 'var(--reader-bg, #0a1628)',
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          padding: 16,
          paddingBottom: 'max(24px, env(safe-area-inset-bottom))',
          zIndex: 201,
          animation: 'slideUp 0.3s ease',
          maxHeight: '70vh',
          overflowY: 'auto',
        }}
      >
        {/* Drag handle */}
        <div
          style={{
            width: 40,
            height: 4,
            background: 'var(--reader-border, #21262d)',
            borderRadius: 2,
            margin: '0 auto 20px',
          }}
        />

        {/* Font size controls */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 0',
            borderBottom: '1px solid var(--reader-border, #21262d)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Type size={18} style={{ color: 'var(--reader-secondary, #8b949e)' }} />
            <span style={{ fontSize: 14, color: 'var(--reader-text, #c9d1d9)' }}>
              Text Size
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={() =>
                currentSizeIndex > 0 &&
                updateSetting('fontSize', fontSizes[currentSizeIndex - 1])
              }
              disabled={currentSizeIndex === 0}
              style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                border: '1px solid var(--reader-border, #21262d)',
                background: 'transparent',
                color: currentSizeIndex === 0 ? 'var(--reader-border, #21262d)' : 'var(--reader-text, #c9d1d9)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: currentSizeIndex === 0 ? 'not-allowed' : 'pointer',
              }}
              aria-label="Decrease font size"
            >
              <Minus size={20} />
            </button>
            <span
              style={{
                minWidth: 32,
                textAlign: 'center',
                fontSize: 14,
                fontWeight: 600,
                color: 'var(--reader-text, #c9d1d9)',
              }}
            >
              {fontSizeLabels[settings.fontSize]}
            </span>
            <button
              onClick={() =>
                currentSizeIndex < fontSizes.length - 1 &&
                updateSetting('fontSize', fontSizes[currentSizeIndex + 1])
              }
              disabled={currentSizeIndex === fontSizes.length - 1}
              style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                border: '1px solid var(--reader-border, #21262d)',
                background: 'transparent',
                color: currentSizeIndex === fontSizes.length - 1 ? 'var(--reader-border, #21262d)' : 'var(--reader-text, #c9d1d9)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: currentSizeIndex === fontSizes.length - 1 ? 'not-allowed' : 'pointer',
              }}
              aria-label="Increase font size"
            >
              <Plus size={20} />
            </button>
          </div>
        </div>

        {/* Theme switcher */}
        <div style={{ padding: '16px 0', borderBottom: '1px solid var(--reader-border, #21262d)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            {settings.theme === 'dark' ? (
              <Moon size={18} style={{ color: 'var(--reader-secondary, #8b949e)' }} />
            ) : (
              <Sun size={18} style={{ color: 'var(--reader-secondary, #8b949e)' }} />
            )}
            <span style={{ fontSize: 14, color: 'var(--reader-text, #c9d1d9)' }}>
              Theme
            </span>
          </div>
          <div
            style={{
              display: 'flex',
              gap: 12,
              overflowX: 'auto',
              WebkitOverflowScrolling: 'touch',
              paddingBottom: 4,
            }}
          >
            {(Object.keys(THEME_COLORS) as ReaderSettings['theme'][]).map((theme) => (
              <button
                key={theme}
                onClick={() => updateSetting('theme', theme)}
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 12,
                  background: THEME_COLORS[theme].background,
                  border:
                    settings.theme === theme
                      ? '3px solid var(--reader-accent, #58a6ff)'
                      : '2px solid var(--reader-border, #21262d)',
                  flexShrink: 0,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                aria-label={`${theme} theme`}
              >
                <span
                  style={{
                    fontSize: 16,
                    fontWeight: 700,
                    color: THEME_COLORS[theme].text,
                  }}
                >
                  Aa
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Font family selector */}
        <div style={{ padding: '16px 0', borderBottom: '1px solid var(--reader-border, #21262d)' }}>
          <div
            style={{
              display: 'flex',
              gap: 8,
              overflowX: 'auto',
              WebkitOverflowScrolling: 'touch',
              paddingBottom: 4,
            }}
          >
            {(Object.keys(FONT_FAMILY_MAP) as ReaderSettings['fontFamily'][]).map((fontKey) => (
              <button
                key={fontKey}
                onClick={() => updateSetting('fontFamily', fontKey)}
                style={{
                  padding: '10px 14px',
                  borderRadius: 8,
                  border:
                    settings.fontFamily === fontKey
                      ? '2px solid var(--reader-accent, #58a6ff)'
                      : '1px solid var(--reader-border, #21262d)',
                  background:
                    settings.fontFamily === fontKey
                      ? 'rgba(88, 166, 255, 0.1)'
                      : 'transparent',
                  color:
                    settings.fontFamily === fontKey
                      ? 'var(--reader-accent, #58a6ff)'
                      : 'var(--reader-text, #c9d1d9)',
                  fontFamily: FONT_FAMILY_MAP[fontKey].css,
                  fontSize: 13,
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  cursor: 'pointer',
                }}
              >
                {FONT_FAMILY_MAP[fontKey].name}
              </button>
            ))}
          </div>
        </div>

        {/* Layout options row */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-around',
            padding: '16px 0',
          }}
        >
          {/* Text alignment */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: 'var(--reader-secondary, #8b949e)' }}>Align</span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                onClick={() => updateSetting('textAlign', 'left')}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 8,
                  border:
                    settings.textAlign === 'left'
                      ? '2px solid var(--reader-accent, #58a6ff)'
                      : '1px solid var(--reader-border, #21262d)',
                  background:
                    settings.textAlign === 'left'
                      ? 'rgba(88, 166, 255, 0.1)'
                      : 'transparent',
                  color:
                    settings.textAlign === 'left'
                      ? 'var(--reader-accent, #58a6ff)'
                      : 'var(--reader-secondary, #8b949e)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
                aria-label="Align left"
              >
                <AlignLeft size={18} />
              </button>
              <button
                onClick={() => updateSetting('textAlign', 'justify')}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 8,
                  border:
                    settings.textAlign === 'justify'
                      ? '2px solid var(--reader-accent, #58a6ff)'
                      : '1px solid var(--reader-border, #21262d)',
                  background:
                    settings.textAlign === 'justify'
                      ? 'rgba(88, 166, 255, 0.1)'
                      : 'transparent',
                  color:
                    settings.textAlign === 'justify'
                      ? 'var(--reader-accent, #58a6ff)'
                      : 'var(--reader-secondary, #8b949e)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
                aria-label="Justify"
              >
                <AlignJustify size={18} />
              </button>
            </div>
          </div>

          {/* Line height */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: 'var(--reader-secondary, #8b949e)' }}>Spacing</span>
            <div style={{ display: 'flex', gap: 4 }}>
              {(['compact', 'normal', 'relaxed'] as const).map((lh) => (
                <button
                  key={lh}
                  onClick={() => updateSetting('lineHeight', lh)}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 8,
                    border:
                      settings.lineHeight === lh
                        ? '2px solid var(--reader-accent, #58a6ff)'
                        : '1px solid var(--reader-border, #21262d)',
                    background:
                      settings.lineHeight === lh
                        ? 'rgba(88, 166, 255, 0.1)'
                        : 'transparent',
                    color:
                      settings.lineHeight === lh
                        ? 'var(--reader-accent, #58a6ff)'
                        : 'var(--reader-secondary, #8b949e)',
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                  aria-label={`${lh} line height`}
                >
                  {lh[0].toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Continuous scroll toggle */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: 'var(--reader-secondary, #8b949e)' }}>Scroll</span>
            <button
              onClick={() => updateSetting('continuousScroll', !settings.continuousScroll)}
              style={{
                width: 56,
                height: 40,
                borderRadius: 20,
                border: 'none',
                background: settings.continuousScroll
                  ? 'var(--reader-accent, #58a6ff)'
                  : 'var(--reader-border, #21262d)',
                position: 'relative',
                cursor: 'pointer',
                transition: 'background 0.2s ease',
              }}
              aria-label="Toggle continuous scroll"
            >
              <div
                style={{
                  position: 'absolute',
                  top: 4,
                  left: settings.continuousScroll ? 20 : 4,
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: 'var(--reader-bg, #0a1628)',
                  transition: 'left 0.2s ease',
                }}
              />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
