/**
 * Bank account card component for displaying linked accounts.
 * Updated with dark theme styling.
 */

import React, { useState } from 'react';
import { Building, Star, Trash2, MoreVertical } from 'lucide-react';
import { deleteBankAccount, setDefaultBankAccount } from '../../services/bridgeApi';
import type { BridgeExternalAccount } from '../../types/bridge';

// Dark theme colors
const colors = {
  bg: '#0f172a',
  bgCard: '#1e293b',
  bgHover: '#334155',
  border: '#334155',
  text: '#f8fafc',
  textSecondary: '#cbd5e1',
  textMuted: '#94a3b8',
  accent: '#f59e0b',
  success: '#10b981',
  successBg: 'rgba(16,185,129,0.15)',
  error: '#ef4444',
  errorBg: 'rgba(239,68,68,0.15)',
  info: '#3b82f6',
  infoBg: 'rgba(59,130,246,0.15)',
};

interface BridgeBankAccountCardProps {
  account: BridgeExternalAccount;
  onUpdate?: () => void;
}

export const BridgeBankAccountCard: React.FC<BridgeBankAccountCardProps> = ({
  account,
  onUpdate,
}) => {
  const [loading, setLoading] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSetDefault = async () => {
    setLoading(true);
    setError(null);
    try {
      await setDefaultBankAccount(account.id);
      onUpdate?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set default');
    } finally {
      setLoading(false);
      setShowMenu(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to remove this bank account?')) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await deleteBankAccount(account.id);
      onUpdate?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete account');
    } finally {
      setLoading(false);
      setShowMenu(false);
    }
  };

  return (
    <div style={{
      background: colors.bg,
      border: `1px solid ${colors.border}`,
      borderRadius: 12,
      padding: 16,
      position: 'relative',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{
            padding: 10,
            background: colors.bgHover,
            borderRadius: 10,
          }}>
            <Building size={20} style={{ color: colors.textMuted }} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontWeight: 600, color: colors.text, fontSize: 15 }}>
                {account.account_name}
              </span>
              {account.is_default && (
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '2px 8px',
                  background: colors.infoBg,
                  color: colors.info,
                  fontSize: 11,
                  fontWeight: 600,
                  borderRadius: 20,
                }}>
                  <Star size={10} />
                  Default
                </span>
              )}
            </div>
            <p style={{ fontSize: 13, color: colors.textMuted, marginTop: 4 }}>
              {account.bank_name || 'Bank Account'} &bull; {account.account_type}
            </p>
            {account.last_four && (
              <p style={{ fontSize: 12, color: colors.textMuted, marginTop: 4 }}>
                ****{account.last_four}
              </p>
            )}
          </div>
        </div>

        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowMenu(!showMenu)}
            disabled={loading}
            style={{
              padding: 6,
              background: 'transparent',
              border: 'none',
              borderRadius: 6,
              cursor: loading ? 'not-allowed' : 'pointer',
              color: colors.textMuted,
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = colors.bgHover}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            <MoreVertical size={18} />
          </button>

          {showMenu && (
            <div style={{
              position: 'absolute',
              right: 0,
              top: '100%',
              marginTop: 4,
              width: 180,
              background: colors.bgCard,
              border: `1px solid ${colors.border}`,
              borderRadius: 10,
              boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
              zIndex: 10,
              overflow: 'hidden',
            }}>
              {!account.is_default && (
                <button
                  onClick={handleSetDefault}
                  disabled={loading}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '10px 14px',
                    background: 'transparent',
                    border: 'none',
                    color: colors.textSecondary,
                    fontSize: 13,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = colors.bgHover}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <Star size={14} />
                  Set as Default
                </button>
              )}
              <button
                onClick={handleDelete}
                disabled={loading}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '10px 14px',
                  background: 'transparent',
                  border: 'none',
                  color: colors.error,
                  fontSize: 13,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = colors.errorBg}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <Trash2 size={14} />
                Remove Account
              </button>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div style={{
          marginTop: 12,
          padding: 10,
          background: colors.errorBg,
          border: `1px solid ${colors.error}40`,
          borderRadius: 8,
          color: colors.error,
          fontSize: 13,
        }}>
          {error}
        </div>
      )}

      {/* Click outside to close menu */}
      {showMenu && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 5,
          }}
          onClick={() => setShowMenu(false)}
        />
      )}
    </div>
  );
};

export default BridgeBankAccountCard;
