/**
 * KeyboardShortcutsHelp Component
 *
 * A modal that displays all available keyboard shortcuts for the preview reader.
 * Triggered by pressing '?' while in the preview.
 */

import React from 'react';
import { X, Keyboard } from 'lucide-react';

interface KeyboardShortcutsHelpProps {
  onClose: () => void;
  isRTL?: boolean;
}

interface ShortcutGroup {
  title: string;
  shortcuts: { keys: string[]; description: string }[];
}

export function KeyboardShortcutsHelp({ onClose, isRTL = false }: KeyboardShortcutsHelpProps) {
  const shortcutGroups: ShortcutGroup[] = [
    {
      title: 'Navigation',
      shortcuts: [
        {
          keys: ['→', 'Space', 'PageDown'],
          description: isRTL ? 'Previous page' : 'Next page',
        },
        {
          keys: ['←', 'PageUp'],
          description: isRTL ? 'Next page' : 'Previous page',
        },
        { keys: ['Home'], description: 'First page' },
        { keys: ['End'], description: 'Last page' },
      ],
    },
    {
      title: 'Zoom',
      shortcuts: [
        { keys: ['+', '='], description: 'Zoom in' },
        { keys: ['-'], description: 'Zoom out' },
        { keys: ['0'], description: 'Reset zoom (100%)' },
      ],
    },
    {
      title: 'View',
      shortcuts: [
        { keys: ['F'], description: 'Toggle fullscreen' },
        { keys: ['T'], description: 'Toggle thumbnail sidebar' },
        { keys: ['?'], description: 'Show this help' },
      ],
    },
    {
      title: 'Exit',
      shortcuts: [
        { keys: ['Escape'], description: 'Close preview / Exit fullscreen' },
      ],
    },
  ];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#1e293b',
          borderRadius: 12,
          padding: 24,
          maxWidth: 480,
          width: '90%',
          maxHeight: '80vh',
          overflow: 'auto',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 20,
            paddingBottom: 16,
            borderBottom: '1px solid #334155',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Keyboard size={24} style={{ color: '#f59e0b' }} />
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: '#f8fafc' }}>
              Keyboard Shortcuts
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: 4,
              borderRadius: 4,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* RTL indicator */}
        {isRTL && (
          <div
            style={{
              background: '#312e81',
              color: '#a5b4fc',
              padding: '8px 12px',
              borderRadius: 6,
              fontSize: 12,
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span style={{ fontSize: 16 }}>←</span>
            <span>
              <strong>Manga Mode:</strong> Arrow keys are reversed for right-to-left reading
            </span>
          </div>
        )}

        {/* Shortcut groups */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {shortcutGroups.map((group) => (
            <div key={group.title}>
              <h3
                style={{
                  margin: '0 0 10px 0',
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#94a3b8',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                {group.title}
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {group.shortcuts.map((shortcut, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '6px 0',
                    }}
                  >
                    <span style={{ color: '#e2e8f0', fontSize: 14 }}>
                      {shortcut.description}
                    </span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {shortcut.keys.map((key, keyIdx) => (
                        <React.Fragment key={keyIdx}>
                          {keyIdx > 0 && (
                            <span style={{ color: '#64748b', fontSize: 12 }}>or</span>
                          )}
                          <kbd
                            style={{
                              background: '#0f172a',
                              padding: '4px 8px',
                              borderRadius: 4,
                              fontSize: 12,
                              fontFamily: 'monospace',
                              color: '#f8fafc',
                              border: '1px solid #334155',
                              minWidth: 28,
                              textAlign: 'center',
                            }}
                          >
                            {key}
                          </kbd>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer hint */}
        <div
          style={{
            marginTop: 20,
            paddingTop: 16,
            borderTop: '1px solid #334155',
            fontSize: 12,
            color: '#64748b',
            textAlign: 'center',
          }}
        >
          Press <kbd style={{ background: '#0f172a', padding: '2px 6px', borderRadius: 4 }}>?</kbd>{' '}
          anytime to show this help
        </div>
      </div>
    </div>
  );
}

export default KeyboardShortcutsHelp;
