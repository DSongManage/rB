/**
 * ProfileDropdown Component
 * YouTube-style profile dropdown menu
 */

import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User,
  PenTool,
  Wallet,
  Settings,
  HelpCircle,
  LogOut,
} from 'lucide-react';

interface ProfileDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  anchorEl?: HTMLElement | null;
  username: string;
  avatarUrl: string | null;
  balance?: string;
  onLogout: () => void;
  onOpenSettings?: () => void;
}

export function ProfileDropdown({
  isOpen,
  onClose,
  anchorEl,
  username,
  avatarUrl,
  balance,
  onLogout,
  onOpenSettings,
}: ProfileDropdownProps) {
  const navigate = useNavigate();
  const panelRef = useRef<HTMLDivElement>(null);

  // Close panel when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(event.target as Node) &&
        anchorEl &&
        !anchorEl.contains(event.target as Node)
      ) {
        onClose();
      }
    };

    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose, anchorEl]);

  // Close on escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const handleNavigate = (path: string) => {
    navigate(path);
    onClose();
  };

  if (!isOpen) return null;

  const menuItemStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '10px 16px',
    background: 'transparent',
    border: 'none',
    color: 'var(--text)',
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
    width: '100%',
    textAlign: 'left',
    transition: 'background 0.15s ease',
    borderRadius: 0,
  };

  return (
    <div
      ref={panelRef}
      role="menu"
      aria-label="Profile menu"
      style={{
        position: 'absolute',
        top: '100%',
        right: 0,
        marginTop: 8,
        width: 'min(300px, calc(100vw - 32px))',
        background: 'var(--dropdown-bg)',
        border: '1px solid var(--dropdown-border)',
        borderRadius: 12,
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)',
        zIndex: 3000,
        overflow: 'hidden',
      }}
    >
      <>
          {/* User Header */}
          <div
            style={{
              padding: 16,
              borderBottom: '1px solid var(--dropdown-border)',
            }}
          >
            <button
              onClick={() => handleNavigate('/profile')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                width: '100%',
                padding: 8,
                borderRadius: 8,
                transition: 'background 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--dropdown-hover)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={username}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    objectFit: 'cover',
                    border: '2px solid var(--accent)',
                  }}
                />
              ) : (
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    background: 'var(--chip-bg)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '2px solid var(--accent)',
                  }}
                >
                  <User size={20} color="var(--text-muted)" />
                </div>
              )}
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: 14 }}>
                  @{username || 'User'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  View your profile
                </div>
              </div>
            </button>
          </div>

          {/* Menu Section 1 */}
          <div style={{ padding: '8px 0', borderBottom: '1px solid var(--dropdown-border)' }}>
            <button
              onClick={() => handleNavigate('/profile')}
              style={menuItemStyle}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--dropdown-hover)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <User size={20} color="var(--text-muted)" />
              <span>Your Profile</span>
            </button>
            <button
              onClick={() => handleNavigate('/studio')}
              style={menuItemStyle}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--dropdown-hover)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <PenTool size={20} color="var(--text-muted)" />
              <span>Studio</span>
            </button>
            <button
              onClick={() => handleNavigate('/wallet-info')}
              style={{
                ...menuItemStyle,
                justifyContent: 'space-between',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--dropdown-hover)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Wallet size={20} color="var(--text-muted)" />
                <span>Wallet</span>
              </div>
              {balance && (
                <span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>
                  {balance}
                </span>
              )}
            </button>
          </div>

          {/* Menu Section 2 */}
          <div style={{ padding: '8px 0', borderBottom: '1px solid var(--dropdown-border)' }}>
            <button
              onClick={() => {
                onClose();
                onOpenSettings?.();
              }}
              style={menuItemStyle}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--dropdown-hover)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <Settings size={20} color="var(--text-muted)" />
              <span>Settings</span>
            </button>
            <a
              href="mailto:support@renaissblock.com"
              style={{
                ...menuItemStyle,
                textDecoration: 'none',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--dropdown-hover)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <HelpCircle size={20} color="var(--text-muted)" />
              <span>Help</span>
            </a>
          </div>

          {/* Menu Section 3 - Sign Out */}
          <div style={{ padding: '8px 0' }}>
            <button
              onClick={() => {
                onLogout();
                onClose();
              }}
              style={menuItemStyle}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--dropdown-hover)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <LogOut size={20} color="var(--text-muted)" />
              <span>Sign out</span>
            </button>
          </div>
        </>
    </div>
  );
}

export default ProfileDropdown;
