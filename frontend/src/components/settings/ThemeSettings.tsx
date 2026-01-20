/**
 * ThemeSettings Component
 *
 * Theme settings panel with Light/Dark/System options.
 * Shows current resolved theme as preview indicator.
 */

import React from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { AppTheme } from '../../types/theme';

const themeOptions: { value: AppTheme; label: string; icon: React.ReactNode }[] = [
  { value: 'light', label: 'Light', icon: <Sun size={18} /> },
  { value: 'dark', label: 'Dark', icon: <Moon size={18} /> },
  { value: 'system', label: 'System', icon: <Monitor size={18} /> },
];

export function ThemeSettings() {
  const { theme, resolvedTheme, setTheme } = useTheme();

  return (
    <div>
      <h3 style={{
        color: 'var(--text)',
        fontSize: 16,
        fontWeight: 600,
        marginBottom: 16,
      }}>
        Appearance
      </h3>

      {/* Theme buttons */}
      <div style={{
        display: 'flex',
        gap: 12,
        marginBottom: 16,
      }}>
        {themeOptions.map((option) => (
          <button
            key={option.value}
            onClick={() => setTheme(option.value)}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
              padding: '16px 12px',
              borderRadius: 12,
              border: theme === option.value
                ? '2px solid var(--accent)'
                : '2px solid var(--panel-border)',
              background: theme === option.value
                ? 'rgba(245, 158, 11, 0.1)'
                : 'transparent',
              color: theme === option.value ? 'var(--accent)' : 'var(--text-dim)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            {option.icon}
            <span style={{ fontSize: 13, fontWeight: 500 }}>{option.label}</span>
          </button>
        ))}
      </div>

      {/* Current theme indicator */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '12px 16px',
        background: 'var(--panel)',
        borderRadius: 8,
        border: '1px solid var(--panel-border)',
      }}>
        <span style={{ color: 'var(--subtle)', fontSize: 13 }}>
          Current theme:
        </span>
        <span style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          color: 'var(--text)',
          fontSize: 13,
          fontWeight: 600,
        }}>
          {resolvedTheme === 'dark' ? <Moon size={14} /> : <Sun size={14} />}
          {resolvedTheme === 'dark' ? 'Dark' : 'Light'}
        </span>
        {theme === 'system' && (
          <span style={{
            fontSize: 11,
            color: 'var(--subtle)',
            padding: '2px 6px',
            background: 'var(--panel-border)',
            borderRadius: 4,
          }}>
            Following system
          </span>
        )}
      </div>
    </div>
  );
}

export default ThemeSettings;
