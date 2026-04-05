/**
 * SettingsModal Component
 *
 * Modal container for user settings with tabbed interface.
 * Currently includes: Appearance (theme settings)
 * Designed to be extended with additional tabs in the future.
 */

import React, { useState } from 'react';
import { X, Palette, Bell } from 'lucide-react';
import { useMobile } from '../../hooks/useMobile';
import ThemeSettings from './ThemeSettings';
import NotificationSettings from './NotificationSettings';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

type SettingsTab = 'appearance' | 'notifications';

const tabs: { key: SettingsTab; label: string; icon: React.ReactNode }[] = [
  { key: 'appearance', label: 'Appearance', icon: <Palette size={18} /> },
  { key: 'notifications', label: 'Notifications', icon: <Bell size={18} /> },
];

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('appearance');
  const { isMobile } = useMobile();

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: isMobile ? 16 : 0,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--panel)',
          borderRadius: 16,
          width: '100%',
          maxWidth: isMobile ? '100%' : 640,
          maxHeight: '90vh',
          overflow: 'hidden',
          border: '1px solid var(--panel-border)',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '20px 24px',
          borderBottom: '1px solid var(--panel-border)',
        }}>
          <h2 style={{
            margin: 0,
            fontSize: 20,
            fontWeight: 700,
            color: 'var(--text)',
          }}>
            Settings
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--subtle)',
              cursor: 'pointer',
              padding: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 8,
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Mobile: horizontal tabs on top */}
        {isMobile && (
          <div style={{
            display: 'flex',
            gap: 4,
            padding: '8px 16px',
            borderBottom: '1px solid var(--panel-border)',
          }}>
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 16px',
                  borderRadius: 8,
                  border: 'none',
                  background: activeTab === tab.key
                    ? 'rgba(245, 158, 11, 0.15)'
                    : 'transparent',
                  color: activeTab === tab.key ? 'var(--accent)' : 'var(--text-dim)',
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: 500,
                  flex: 1,
                  justifyContent: 'center',
                  transition: 'all 0.2s ease',
                }}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* Content */}
        <div style={{
          display: 'flex',
          flex: 1,
          minHeight: 0,
        }}>
          {/* Tab sidebar — desktop only */}
          {!isMobile && (
            <div style={{
              width: 160,
              padding: '16px 12px',
              borderRight: '1px solid var(--panel-border)',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}>
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: 'none',
                    background: activeTab === tab.key
                      ? 'rgba(245, 158, 11, 0.15)'
                      : 'transparent',
                    color: activeTab === tab.key ? 'var(--accent)' : 'var(--text-dim)',
                    cursor: 'pointer',
                    fontSize: 14,
                    fontWeight: 500,
                    textAlign: 'left',
                    width: '100%',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>
          )}

          {/* Tab content */}
          <div style={{
            flex: 1,
            padding: isMobile ? 16 : 24,
            overflow: 'auto',
          }}>
            {activeTab === 'appearance' && <ThemeSettings />}
            {activeTab === 'notifications' && <NotificationSettings />}
          </div>
        </div>
      </div>
    </div>
  );
}

export default SettingsModal;
