import React, { useState } from 'react';
import { X, AlignLeft, AlignJustify } from 'lucide-react';
import { ReaderSettings as ReaderSettingsType, FONT_FAMILY_MAP, THEME_COLORS } from '../../types/reader';

type SettingsTab = 'font' | 'layout' | 'themes' | 'more';

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
  const [activeTab, setActiveTab] = useState<SettingsTab>('font');

  if (!visible) return null;

  const tabs: { id: SettingsTab; label: string }[] = [
    { id: 'font', label: 'Font' },
    { id: 'layout', label: 'Layout' },
    { id: 'themes', label: 'Themes' },
    { id: 'more', label: 'More' },
  ];

  const fontSizes: ReaderSettingsType['fontSize'][] = ['xsmall', 'small', 'medium', 'large', 'xlarge'];
  const currentSizeIndex = fontSizes.indexOf(settings.fontSize);

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

      {/* Settings Panel - Slides from right like Kindle */}
      <div
        className="reader-settings-panel"
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: '320px',
          maxWidth: '90vw',
          background: 'var(--reader-bg)',
          borderLeft: '1px solid var(--reader-border)',
          zIndex: 201,
          display: 'flex',
          flexDirection: 'column',
          animation: 'slideFromRight 0.3s ease',
        }}
      >
        {/* Tab Navigation */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid var(--reader-border)',
            padding: '0 8px',
          }}
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                flex: 1,
                padding: '16px 8px',
                background: 'none',
                border: 'none',
                borderBottom: activeTab === tab.id ? '2px solid var(--reader-accent, #58a6ff)' : '2px solid transparent',
                color: activeTab === tab.id ? 'var(--reader-accent, #58a6ff)' : 'var(--reader-secondary)',
                fontSize: '14px',
                fontWeight: activeTab === tab.id ? 600 : 400,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              {tab.label}
            </button>
          ))}
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--reader-secondary)',
              cursor: 'pointer',
              padding: '16px 12px',
            }}
            aria-label="Close settings"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab Content */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '20px',
          }}
        >
          {/* Font Tab */}
          {activeTab === 'font' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Font Family Selection */}
              <div>
                <div
                  style={{
                    display: 'flex',
                    gap: '8px',
                    flexWrap: 'wrap',
                  }}
                >
                  {(Object.keys(FONT_FAMILY_MAP) as ReaderSettingsType['fontFamily'][]).map((fontKey) => (
                    <button
                      key={fontKey}
                      onClick={() => updateSetting('fontFamily', fontKey)}
                      style={{
                        padding: '12px 16px',
                        border: settings.fontFamily === fontKey
                          ? '2px solid var(--reader-accent, #58a6ff)'
                          : '1px solid var(--reader-border)',
                        borderRadius: '8px',
                        background: settings.fontFamily === fontKey
                          ? 'rgba(88, 166, 255, 0.1)'
                          : 'transparent',
                        color: settings.fontFamily === fontKey
                          ? 'var(--reader-accent, #58a6ff)'
                          : 'var(--reader-text)',
                        cursor: 'pointer',
                        fontFamily: FONT_FAMILY_MAP[fontKey].css,
                        fontSize: '18px',
                        minWidth: '70px',
                      }}
                    >
                      Aa
                      <div style={{ fontSize: '10px', marginTop: '4px', fontFamily: 'system-ui' }}>
                        {FONT_FAMILY_MAP[fontKey].name}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Font Size Slider */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: 500,
                    color: 'var(--reader-secondary)',
                    marginBottom: '12px',
                  }}
                >
                  Size
                </label>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                  }}
                >
                  <span style={{ fontSize: '14px', color: 'var(--reader-text)' }}>A</span>
                  <div style={{ flex: 1, position: 'relative' }}>
                    <input
                      type="range"
                      min={0}
                      max={fontSizes.length - 1}
                      value={currentSizeIndex}
                      onChange={(e) => updateSetting('fontSize', fontSizes[parseInt(e.target.value)])}
                      style={{
                        width: '100%',
                        height: '4px',
                        appearance: 'none',
                        background: 'var(--reader-border)',
                        borderRadius: '2px',
                        cursor: 'pointer',
                      }}
                    />
                    {/* Tick marks */}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginTop: '8px',
                      }}
                    >
                      {fontSizes.map((_, i) => (
                        <div
                          key={i}
                          style={{
                            width: '2px',
                            height: '6px',
                            background: i <= currentSizeIndex ? 'var(--reader-accent, #58a6ff)' : 'var(--reader-border)',
                            borderRadius: '1px',
                          }}
                        />
                      ))}
                    </div>
                  </div>
                  <span style={{ fontSize: '22px', color: 'var(--reader-text)' }}>A</span>
                </div>
              </div>

              {/* Spacing */}
              <div>
                <label
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '13px',
                    fontWeight: 500,
                    color: 'var(--reader-secondary)',
                    marginBottom: '12px',
                  }}
                >
                  Spacing
                  <span style={{ fontSize: '12px', color: 'var(--reader-secondary)' }}>
                    Adjust text spacing of the page.
                  </span>
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {(['compact', 'normal', 'relaxed'] as const).map((spacing) => (
                    <button
                      key={spacing}
                      onClick={() => updateSetting('lineHeight', spacing)}
                      style={{
                        flex: 1,
                        padding: '10px 8px',
                        border: settings.lineHeight === spacing
                          ? '2px solid var(--reader-accent, #58a6ff)'
                          : '1px solid var(--reader-border)',
                        borderRadius: '8px',
                        background: settings.lineHeight === spacing
                          ? 'rgba(88, 166, 255, 0.1)'
                          : 'transparent',
                        color: settings.lineHeight === spacing
                          ? 'var(--reader-accent, #58a6ff)'
                          : 'var(--reader-text)',
                        cursor: 'pointer',
                        fontSize: '12px',
                        textTransform: 'capitalize',
                      }}
                    >
                      {spacing}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Layout Tab */}
          {activeTab === 'layout' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Page Color */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: 500,
                    color: 'var(--reader-secondary)',
                    marginBottom: '12px',
                  }}
                >
                  Page Color
                </label>
                <div style={{ display: 'flex', gap: '12px' }}>
                  {(Object.keys(THEME_COLORS) as ReaderSettingsType['theme'][]).map((themeKey) => (
                    <button
                      key={themeKey}
                      onClick={() => updateSetting('theme', themeKey)}
                      style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '50%',
                        background: THEME_COLORS[themeKey].background,
                        border: settings.theme === themeKey
                          ? '3px solid var(--reader-accent, #58a6ff)'
                          : '2px solid var(--reader-border)',
                        cursor: 'pointer',
                        transition: 'transform 0.2s ease',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                      }}
                      title={themeKey.charAt(0).toUpperCase() + themeKey.slice(1)}
                    />
                  ))}
                </div>
              </div>

              {/* Continuous Scrolling Toggle */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <label
                  style={{
                    fontSize: '14px',
                    color: 'var(--reader-text)',
                  }}
                >
                  Continuous Scrolling
                </label>
                <button
                  onClick={() => updateSetting('continuousScroll', !settings.continuousScroll)}
                  style={{
                    width: '48px',
                    height: '28px',
                    borderRadius: '14px',
                    border: 'none',
                    background: settings.continuousScroll ? 'var(--reader-accent, #58a6ff)' : 'var(--reader-border)',
                    cursor: 'pointer',
                    position: 'relative',
                    transition: 'background 0.2s ease',
                  }}
                >
                  <div
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      background: '#fff',
                      position: 'absolute',
                      top: '2px',
                      left: settings.continuousScroll ? '22px' : '2px',
                      transition: 'left 0.2s ease',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                    }}
                  />
                </button>
              </div>

              {/* Alignment */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: 500,
                    color: 'var(--reader-secondary)',
                    marginBottom: '12px',
                  }}
                >
                  Alignment
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => updateSetting('textAlign', 'left')}
                    style={{
                      flex: 1,
                      padding: '12px',
                      border: settings.textAlign === 'left'
                        ? '2px solid var(--reader-accent, #58a6ff)'
                        : '1px solid var(--reader-border)',
                      borderRadius: '8px',
                      background: settings.textAlign === 'left'
                        ? 'rgba(88, 166, 255, 0.1)'
                        : 'transparent',
                      color: settings.textAlign === 'left'
                        ? 'var(--reader-accent, #58a6ff)'
                        : 'var(--reader-text)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <AlignLeft size={20} />
                  </button>
                  <button
                    onClick={() => updateSetting('textAlign', 'justify')}
                    style={{
                      flex: 1,
                      padding: '12px',
                      border: settings.textAlign === 'justify'
                        ? '2px solid var(--reader-accent, #58a6ff)'
                        : '1px solid var(--reader-border)',
                      borderRadius: '8px',
                      background: settings.textAlign === 'justify'
                        ? 'rgba(88, 166, 255, 0.1)'
                        : 'transparent',
                      color: settings.textAlign === 'justify'
                        ? 'var(--reader-accent, #58a6ff)'
                        : 'var(--reader-text)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <AlignJustify size={20} />
                  </button>
                </div>
              </div>

              {/* Margins */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: 500,
                    color: 'var(--reader-secondary)',
                    marginBottom: '12px',
                  }}
                >
                  Margins
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {(['narrow', 'medium', 'wide'] as const).map((margin) => (
                    <button
                      key={margin}
                      onClick={() => updateSetting('margins', margin)}
                      style={{
                        flex: 1,
                        padding: '12px 8px',
                        border: settings.margins === margin
                          ? '2px solid var(--reader-accent, #58a6ff)'
                          : '1px solid var(--reader-border)',
                        borderRadius: '8px',
                        background: settings.margins === margin
                          ? 'rgba(88, 166, 255, 0.1)'
                          : 'transparent',
                        color: settings.margins === margin
                          ? 'var(--reader-accent, #58a6ff)'
                          : 'var(--reader-text)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {/* Visual margin representation */}
                      <div
                        style={{
                          width: margin === 'narrow' ? '28px' : margin === 'medium' ? '20px' : '12px',
                          height: '20px',
                          background: 'currentColor',
                          opacity: 0.3,
                          borderRadius: '2px',
                        }}
                      />
                    </button>
                  ))}
                </div>
              </div>

              {/* Columns */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: 500,
                    color: 'var(--reader-secondary)',
                    marginBottom: '12px',
                  }}
                >
                  Layout
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => updateSetting('columns', 'single')}
                    style={{
                      flex: 1,
                      padding: '12px 8px',
                      border: settings.columns === 'single'
                        ? '2px solid var(--reader-accent, #58a6ff)'
                        : '1px solid var(--reader-border)',
                      borderRadius: '8px',
                      background: settings.columns === 'single'
                        ? 'rgba(88, 166, 255, 0.1)'
                        : 'transparent',
                      color: settings.columns === 'single'
                        ? 'var(--reader-accent, #58a6ff)'
                        : 'var(--reader-text)',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                    }}
                  >
                    {/* Single page icon - one rectangle */}
                    <div
                      style={{
                        width: '24px',
                        height: '32px',
                        border: '2px solid currentColor',
                        borderRadius: '3px',
                      }}
                    />
                    <span style={{ fontSize: '11px' }}>Single</span>
                  </button>
                  <button
                    onClick={() => updateSetting('columns', 'two')}
                    style={{
                      flex: 1,
                      padding: '12px 8px',
                      border: settings.columns === 'two'
                        ? '2px solid var(--reader-accent, #58a6ff)'
                        : '1px solid var(--reader-border)',
                      borderRadius: '8px',
                      background: settings.columns === 'two'
                        ? 'rgba(88, 166, 255, 0.1)'
                        : 'transparent',
                      color: settings.columns === 'two'
                        ? 'var(--reader-accent, #58a6ff)'
                        : 'var(--reader-text)',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                    }}
                  >
                    {/* Two column icon - two rectangles side by side */}
                    <div style={{ display: 'flex', gap: '3px' }}>
                      <div
                        style={{
                          width: '16px',
                          height: '32px',
                          border: '2px solid currentColor',
                          borderRadius: '3px',
                        }}
                      />
                      <div
                        style={{
                          width: '16px',
                          height: '32px',
                          border: '2px solid currentColor',
                          borderRadius: '3px',
                        }}
                      />
                    </div>
                    <span style={{ fontSize: '11px' }}>Two Column</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Themes Tab */}
          {activeTab === 'themes' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {(Object.keys(THEME_COLORS) as ReaderSettingsType['theme'][]).map((themeKey) => (
                <button
                  key={themeKey}
                  onClick={() => updateSetting('theme', themeKey)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    padding: '16px',
                    border: settings.theme === themeKey
                      ? '2px solid var(--reader-accent, #58a6ff)'
                      : '1px solid var(--reader-border)',
                    borderRadius: '12px',
                    background: 'transparent',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <div
                    style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '8px',
                      background: THEME_COLORS[themeKey].background,
                      border: '1px solid var(--reader-border)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: THEME_COLORS[themeKey].text,
                      fontSize: '16px',
                      fontFamily: 'Georgia, serif',
                    }}
                  >
                    Aa
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: '15px',
                        fontWeight: 500,
                        color: 'var(--reader-text)',
                        textTransform: 'capitalize',
                      }}
                    >
                      {themeKey}
                    </div>
                    <div
                      style={{
                        fontSize: '12px',
                        color: 'var(--reader-secondary)',
                        marginTop: '2px',
                      }}
                    >
                      {themeKey === 'light' && 'Classic white background'}
                      {themeKey === 'sepia' && 'Warm, paper-like tone'}
                      {themeKey === 'green' && 'Easy on the eyes'}
                      {themeKey === 'dark' && 'Perfect for night reading'}
                    </div>
                  </div>
                  {settings.theme === themeKey && (
                    <div
                      style={{
                        marginLeft: 'auto',
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        background: 'var(--reader-accent, #58a6ff)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path
                          d="M2 6L5 9L10 3"
                          stroke="white"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* More Tab */}
          {activeTab === 'more' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Reset Button */}
              <button
                onClick={resetSettings}
                style={{
                  width: '100%',
                  padding: '14px',
                  border: '1px solid var(--reader-border)',
                  borderRadius: '8px',
                  background: 'transparent',
                  color: 'var(--reader-text)',
                  cursor: 'pointer',
                  fontSize: '14px',
                }}
              >
                Reset to Defaults
              </button>

              {/* Keyboard Shortcuts Info */}
              <div
                style={{
                  padding: '16px',
                  background: 'rgba(255,255,255,0.02)',
                  borderRadius: '8px',
                  border: '1px solid var(--reader-border)',
                }}
              >
                <div
                  style={{
                    fontSize: '13px',
                    fontWeight: 500,
                    color: 'var(--reader-text)',
                    marginBottom: '12px',
                  }}
                >
                  Keyboard Shortcuts
                </div>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    fontSize: '12px',
                    color: 'var(--reader-secondary)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Next page</span>
                    <kbd style={{ background: 'var(--reader-border)', padding: '2px 8px', borderRadius: '4px' }}>
                      Arrow Right
                    </kbd>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Previous page</span>
                    <kbd style={{ background: 'var(--reader-border)', padding: '2px 8px', borderRadius: '4px' }}>
                      Arrow Left
                    </kbd>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Toggle settings</span>
                    <kbd style={{ background: 'var(--reader-border)', padding: '2px 8px', borderRadius: '4px' }}>S</kbd>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Table of contents</span>
                    <kbd style={{ background: 'var(--reader-border)', padding: '2px 8px', borderRadius: '4px' }}>T</kbd>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Brightness Slider at Bottom (like Kindle) */}
        <div
          style={{
            padding: '16px 20px',
            borderTop: '1px solid var(--reader-border)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--reader-secondary)" strokeWidth="2">
            <circle cx="12" cy="12" r="5" />
            <line x1="12" y1="1" x2="12" y2="3" />
            <line x1="12" y1="21" x2="12" y2="23" />
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
            <line x1="1" y1="12" x2="3" y2="12" />
            <line x1="21" y1="12" x2="23" y2="12" />
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
          </svg>
          <input
            type="range"
            min={0}
            max={100}
            defaultValue={100}
            style={{
              flex: 1,
              height: '4px',
              appearance: 'none',
              background: 'linear-gradient(to right, var(--reader-border) 0%, var(--reader-text) 100%)',
              borderRadius: '2px',
              cursor: 'pointer',
            }}
            title="Brightness (system controlled)"
            disabled
          />
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--reader-text)" strokeWidth="2">
            <circle cx="12" cy="12" r="5" />
            <line x1="12" y1="1" x2="12" y2="3" />
            <line x1="12" y1="21" x2="12" y2="23" />
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
            <line x1="1" y1="12" x2="3" y2="12" />
            <line x1="21" y1="12" x2="23" y2="12" />
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
          </svg>
        </div>
      </div>

      {/* Animation styles */}
      <style>{`
        @keyframes slideFromRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }

        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: var(--reader-accent, #58a6ff);
          cursor: pointer;
          border: 2px solid white;
          box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        }

        input[type="range"]::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: var(--reader-accent, #58a6ff);
          cursor: pointer;
          border: 2px solid white;
          box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        }
      `}</style>
    </>
  );
}

export default ReaderSettingsPanel;
