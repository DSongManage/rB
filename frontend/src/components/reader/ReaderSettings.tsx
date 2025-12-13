import React from 'react';
import { X, Sun, Moon, BookOpen } from 'lucide-react';
import { ReaderSettings as ReaderSettingsType } from '../../types/reader';

interface ReaderSettingsPanelProps {
  settings: ReaderSettingsType;
  updateSetting: <K extends keyof ReaderSettingsType>(
    key: K,
    value: ReaderSettingsType[K]
  ) => void;
  resetSettings: () => void;
  onClose: () => void;
  visible: boolean;
}

export function ReaderSettingsPanel({
  settings,
  updateSetting,
  resetSettings,
  onClose,
  visible,
}: ReaderSettingsPanelProps) {
  if (!visible) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="reader-settings-backdrop"
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          zIndex: 200,
          animation: 'fadeIn 0.2s ease',
        }}
      />

      {/* Settings Panel */}
      <div
        className="reader-settings-panel"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: 'var(--reader-bg)',
          borderTop: '1px solid var(--reader-border)',
          borderRadius: '16px 16px 0 0',
          padding: '20px',
          zIndex: 201,
          maxHeight: '70vh',
          overflowY: 'auto',
          animation: 'slideUp 0.3s ease',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '24px',
          }}
        >
          <h2
            style={{
              fontSize: '18px',
              fontWeight: 600,
              color: 'var(--reader-text)',
              margin: 0,
            }}
          >
            Reading Settings
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--reader-text)',
              cursor: 'pointer',
              padding: '8px',
            }}
            aria-label="Close settings"
          >
            <X size={24} />
          </button>
        </div>

        {/* Font Size */}
        <div style={{ marginBottom: '24px' }}>
          <label
            style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: 500,
              color: 'var(--reader-secondary)',
              marginBottom: '12px',
            }}
          >
            Font Size
          </label>
          <div
            style={{
              display: 'flex',
              gap: '8px',
            }}
          >
            {(['small', 'medium', 'large', 'xlarge'] as const).map((size) => (
              <button
                key={size}
                onClick={() => updateSetting('fontSize', size)}
                style={{
                  flex: 1,
                  padding: '12px 8px',
                  border: `2px solid ${
                    settings.fontSize === size
                      ? 'var(--reader-text)'
                      : 'var(--reader-border)'
                  }`,
                  borderRadius: '8px',
                  background:
                    settings.fontSize === size
                      ? 'var(--reader-border)'
                      : 'transparent',
                  color: 'var(--reader-text)',
                  cursor: 'pointer',
                  fontSize:
                    size === 'small'
                      ? '12px'
                      : size === 'medium'
                      ? '14px'
                      : size === 'large'
                      ? '16px'
                      : '18px',
                  fontWeight: settings.fontSize === size ? 600 : 400,
                }}
              >
                Aa
              </button>
            ))}
          </div>
        </div>

        {/* Line Height */}
        <div style={{ marginBottom: '24px' }}>
          <label
            style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: 500,
              color: 'var(--reader-secondary)',
              marginBottom: '12px',
            }}
          >
            Line Spacing
          </label>
          <div
            style={{
              display: 'flex',
              gap: '8px',
            }}
          >
            {(['compact', 'normal', 'relaxed'] as const).map((height) => (
              <button
                key={height}
                onClick={() => updateSetting('lineHeight', height)}
                style={{
                  flex: 1,
                  padding: '12px 8px',
                  border: `2px solid ${
                    settings.lineHeight === height
                      ? 'var(--reader-text)'
                      : 'var(--reader-border)'
                  }`,
                  borderRadius: '8px',
                  background:
                    settings.lineHeight === height
                      ? 'var(--reader-border)'
                      : 'transparent',
                  color: 'var(--reader-text)',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: settings.lineHeight === height ? 600 : 400,
                  textTransform: 'capitalize',
                }}
              >
                {height}
              </button>
            ))}
          </div>
        </div>

        {/* Theme */}
        <div style={{ marginBottom: '24px' }}>
          <label
            style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: 500,
              color: 'var(--reader-secondary)',
              marginBottom: '12px',
            }}
          >
            Theme
          </label>
          <div
            style={{
              display: 'flex',
              gap: '8px',
            }}
          >
            <button
              onClick={() => updateSetting('theme', 'light')}
              style={{
                flex: 1,
                padding: '12px 8px',
                border: `2px solid ${
                  settings.theme === 'light'
                    ? '#1a1a1a'
                    : 'var(--reader-border)'
                }`,
                borderRadius: '8px',
                background: '#ffffff',
                color: '#1a1a1a',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                fontSize: '13px',
                fontWeight: settings.theme === 'light' ? 600 : 400,
              }}
            >
              <Sun size={18} />
              Light
            </button>

            <button
              onClick={() => updateSetting('theme', 'dark')}
              style={{
                flex: 1,
                padding: '12px 8px',
                border: `2px solid ${
                  settings.theme === 'dark'
                    ? '#d1d5db'
                    : 'var(--reader-border)'
                }`,
                borderRadius: '8px',
                background: '#0a0f1a',
                color: '#d1d5db',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                fontSize: '13px',
                fontWeight: settings.theme === 'dark' ? 600 : 400,
              }}
            >
              <Moon size={18} />
              Dark
            </button>

            <button
              onClick={() => updateSetting('theme', 'sepia')}
              style={{
                flex: 1,
                padding: '12px 8px',
                border: `2px solid ${
                  settings.theme === 'sepia'
                    ? '#5b4636'
                    : 'var(--reader-border)'
                }`,
                borderRadius: '8px',
                background: '#f4ecd8',
                color: '#5b4636',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                fontSize: '13px',
                fontWeight: settings.theme === 'sepia' ? 600 : 400,
              }}
            >
              <BookOpen size={18} />
              Sepia
            </button>
          </div>
        </div>

        {/* Font Family */}
        <div style={{ marginBottom: '24px' }}>
          <label
            style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: 500,
              color: 'var(--reader-secondary)',
              marginBottom: '12px',
            }}
          >
            Font
          </label>
          <div
            style={{
              display: 'flex',
              gap: '8px',
            }}
          >
            <button
              onClick={() => updateSetting('fontFamily', 'serif')}
              style={{
                flex: 1,
                padding: '12px 8px',
                border: `2px solid ${
                  settings.fontFamily === 'serif'
                    ? 'var(--reader-text)'
                    : 'var(--reader-border)'
                }`,
                borderRadius: '8px',
                background:
                  settings.fontFamily === 'serif'
                    ? 'var(--reader-border)'
                    : 'transparent',
                color: 'var(--reader-text)',
                cursor: 'pointer',
                fontFamily: "Georgia, 'Times New Roman', serif",
                fontSize: '16px',
                fontWeight: settings.fontFamily === 'serif' ? 600 : 400,
              }}
            >
              Serif
            </button>

            <button
              onClick={() => updateSetting('fontFamily', 'sans-serif')}
              style={{
                flex: 1,
                padding: '12px 8px',
                border: `2px solid ${
                  settings.fontFamily === 'sans-serif'
                    ? 'var(--reader-text)'
                    : 'var(--reader-border)'
                }`,
                borderRadius: '8px',
                background:
                  settings.fontFamily === 'sans-serif'
                    ? 'var(--reader-border)'
                    : 'transparent',
                color: 'var(--reader-text)',
                cursor: 'pointer',
                fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                fontSize: '16px',
                fontWeight: settings.fontFamily === 'sans-serif' ? 600 : 400,
              }}
            >
              Sans
            </button>
          </div>
        </div>

        {/* Reset Button */}
        <button
          onClick={resetSettings}
          style={{
            width: '100%',
            padding: '12px',
            border: '1px solid var(--reader-border)',
            borderRadius: '8px',
            background: 'transparent',
            color: 'var(--reader-secondary)',
            cursor: 'pointer',
            fontSize: '14px',
          }}
        >
          Reset to Defaults
        </button>
      </div>
    </>
  );
}

export default ReaderSettingsPanel;
