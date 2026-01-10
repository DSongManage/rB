/**
 * BalanceDisplay Component
 *
 * Shows user's renaissBlock Balance in a user-friendly format.
 * Never shows "USDC" - always shows as regular dollars.
 */

import React from 'react';
import { RefreshCw, Wallet, AlertCircle } from 'lucide-react';
import { useBalance } from '../../contexts/BalanceContext';

interface BalanceDisplayProps {
  size?: 'small' | 'medium' | 'large';
  showRefresh?: boolean;
  showLabel?: boolean;
  compact?: boolean;
  className?: string;
}

export function BalanceDisplay({
  size = 'medium',
  showRefresh = true,
  showLabel = true,
  compact = false,
  className = '',
}: BalanceDisplayProps) {
  const {
    displayBalance,
    loading,
    error,
    syncStatus,
    forceSync,
  } = useBalance();

  // Size-based styling
  const sizeStyles = {
    small: {
      container: { fontSize: '14px', padding: compact ? '4px 8px' : '6px 12px' },
      icon: 14,
      balance: { fontSize: '14px', fontWeight: 600 },
    },
    medium: {
      container: { fontSize: '16px', padding: compact ? '6px 12px' : '10px 16px' },
      icon: 18,
      balance: { fontSize: '18px', fontWeight: 700 },
    },
    large: {
      container: { fontSize: '20px', padding: compact ? '8px 16px' : '14px 24px' },
      icon: 24,
      balance: { fontSize: '24px', fontWeight: 700 },
    },
  };

  const styles = sizeStyles[size];

  // Loading state
  if (loading) {
    return (
      <div
        className={`rb-balance-display rb-balance-display--loading ${className}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          ...styles.container,
          backgroundColor: 'var(--bg-secondary, #1e293b)',
          borderRadius: '8px',
          color: 'var(--text-muted, #94a3b8)',
        }}
      >
        <RefreshCw
          size={styles.icon}
          style={{ animation: 'spin 1s linear infinite' }}
        />
        <span>Loading...</span>
      </div>
    );
  }

  // No wallet connected
  if (syncStatus === 'no_wallet') {
    return (
      <div
        className={`rb-balance-display rb-balance-display--no-wallet ${className}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          ...styles.container,
          backgroundColor: 'var(--bg-secondary, #1e293b)',
          borderRadius: '8px',
          color: 'var(--text-muted, #94a3b8)',
        }}
      >
        <Wallet size={styles.icon} />
        <span>No wallet connected</span>
      </div>
    );
  }

  // Error state
  if (error && !displayBalance) {
    return (
      <div
        className={`rb-balance-display rb-balance-display--error ${className}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          ...styles.container,
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          borderRadius: '8px',
          color: 'var(--error, #ef4444)',
        }}
      >
        <AlertCircle size={styles.icon} />
        <span>Balance unavailable</span>
      </div>
    );
  }

  return (
    <div
      className={`rb-balance-display ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: compact ? '6px' : '10px',
        ...styles.container,
        backgroundColor: 'var(--bg-secondary, #1e293b)',
        borderRadius: '8px',
        border: '1px solid var(--border, #334155)',
      }}
    >
      <Wallet
        size={styles.icon}
        style={{ color: 'var(--accent, #3b82f6)' }}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {showLabel && !compact && (
          <span
            style={{
              fontSize: '12px',
              color: 'var(--text-muted, #94a3b8)',
              lineHeight: 1,
            }}
          >
            renaissBlock Balance
          </span>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ ...styles.balance, color: 'var(--text-primary, #f1f5f9)' }}>
            {displayBalance || '$0.00'}
          </span>
          {syncStatus === 'syncing' && (
            <span
              style={{
                fontSize: '11px',
                color: 'var(--accent, #3b82f6)',
                fontWeight: 500,
                animation: 'pulse 1.5s ease-in-out infinite',
              }}
            >
              Syncing...
            </span>
          )}
          {syncStatus === 'stale' && (
            <span
              style={{
                fontSize: '11px',
                color: 'var(--text-muted, #64748b)',
                fontWeight: 500,
              }}
            >
              (updating)
            </span>
          )}
        </div>
      </div>

      {showRefresh && (
        <button
          onClick={forceSync}
          disabled={syncStatus === 'syncing'}
          title="Refresh balance"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '4px',
            backgroundColor: 'transparent',
            border: 'none',
            borderRadius: '4px',
            cursor: syncStatus === 'syncing' ? 'not-allowed' : 'pointer',
            color: 'var(--text-muted, #94a3b8)',
            opacity: syncStatus === 'syncing' ? 0.5 : 1,
            transition: 'color 0.2s',
          }}
          onMouseEnter={(e) => {
            if (syncStatus !== 'syncing') {
              e.currentTarget.style.color = 'var(--accent, #3b82f6)';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--text-muted, #94a3b8)';
          }}
        >
          <RefreshCw
            size={styles.icon - 2}
            style={{
              animation: syncStatus === 'syncing' ? 'spin 1s linear infinite' : 'none',
            }}
          />
        </button>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}

export default BalanceDisplay;
