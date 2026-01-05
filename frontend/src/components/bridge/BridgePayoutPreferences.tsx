/**
 * Payout preferences form component.
 * Updated with dark theme styling.
 */

import React, { useState, useEffect } from 'react';
import { Wallet, Building2, GitBranch, Check, type LucideIcon } from 'lucide-react';
import { updatePayoutPreferences } from '../../services/bridgeApi';
import type { PayoutDestination, PayoutPreferences } from '../../types/bridge';

// Dark theme colors
const colors = {
  bg: '#0f172a',
  bgCard: '#1e293b',
  bgHover: '#334155',
  border: '#334155',
  borderLight: '#475569',
  text: '#f8fafc',
  textSecondary: '#cbd5e1',
  textMuted: '#94a3b8',
  accent: '#f59e0b',
  accentHover: '#fbbf24',
  success: '#10b981',
  successBg: 'rgba(16,185,129,0.15)',
  error: '#ef4444',
  errorBg: 'rgba(239,68,68,0.15)',
  warning: '#f59e0b',
  warningBg: 'rgba(245,158,11,0.15)',
  info: '#3b82f6',
  infoBg: 'rgba(59,130,246,0.15)',
};

interface BridgePayoutPreferencesProps {
  currentPreferences: PayoutPreferences;
  isFullySetup: boolean;
  onUpdate?: () => void;
}

export const BridgePayoutPreferences: React.FC<BridgePayoutPreferencesProps> = ({
  currentPreferences,
  isFullySetup,
  onUpdate,
}) => {
  const [destination, setDestination] = useState<PayoutDestination>(
    currentPreferences.payout_destination
  );
  const [percentage, setPercentage] = useState(
    currentPreferences.bridge_payout_percentage
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSaved(false);
  }, [destination, percentage]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await updatePayoutPreferences(destination, percentage);
      setSaved(true);
      onUpdate?.();
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  const hasChanges =
    destination !== currentPreferences.payout_destination ||
    percentage !== currentPreferences.bridge_payout_percentage;

  const options: Array<{
    value: PayoutDestination;
    label: string;
    description: string;
    icon: LucideIcon;
    disabled?: boolean;
  }> = [
    {
      value: 'wallet',
      label: 'Web3 Wallet Only',
      description: 'All earnings go to your Web3Auth wallet as USDC.',
      icon: Wallet,
    },
    {
      value: 'bridge',
      label: 'Bank Account Only',
      description: 'All earnings automatically convert to USD and deposit to your bank.',
      icon: Building2,
      disabled: !isFullySetup,
    },
    {
      value: 'split',
      label: 'Split Between Both',
      description: 'Choose a percentage for each destination.',
      icon: GitBranch,
      disabled: !isFullySetup,
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {options.map((option) => {
          const Icon = option.icon;
          const isSelected = destination === option.value;
          const isDisabled = option.disabled;

          return (
            <button
              key={option.value}
              onClick={() => !isDisabled && setDestination(option.value)}
              disabled={isDisabled}
              style={{
                width: '100%',
                textAlign: 'left',
                padding: 16,
                borderRadius: 12,
                border: `2px solid ${isSelected ? colors.accent : colors.border}`,
                background: isSelected ? `${colors.accent}15` : colors.bg,
                cursor: isDisabled ? 'not-allowed' : 'pointer',
                opacity: isDisabled ? 0.5 : 1,
                transition: 'all 0.2s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{
                  padding: 10,
                  borderRadius: 10,
                  background: isSelected ? `${colors.accent}20` : colors.bgHover,
                }}>
                  <Icon
                    size={20}
                    style={{ color: isSelected ? colors.accent : colors.textMuted }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}>
                    <span style={{
                      fontWeight: 600,
                      fontSize: 15,
                      color: isSelected ? colors.accent : colors.text,
                    }}>
                      {option.label}
                    </span>
                    {isSelected && (
                      <div style={{
                        width: 20,
                        height: 20,
                        borderRadius: '50%',
                        background: colors.accent,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                        <Check size={12} style={{ color: '#000' }} />
                      </div>
                    )}
                  </div>
                  <p style={{
                    fontSize: 13,
                    marginTop: 4,
                    color: isSelected ? colors.textSecondary : colors.textMuted,
                    lineHeight: 1.4,
                  }}>
                    {option.description}
                  </p>
                  {isDisabled && (
                    <p style={{
                      fontSize: 12,
                      marginTop: 6,
                      color: colors.warning,
                    }}>
                      Complete Bridge setup to enable this option
                    </p>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Split percentage slider */}
      {destination === 'split' && (
        <div style={{
          marginTop: 20,
          padding: 16,
          background: colors.bgHover,
          borderRadius: 12,
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 12,
          }}>
            <span style={{ fontSize: 14, fontWeight: 500, color: colors.textSecondary }}>
              Split Ratio
            </span>
            <span style={{ fontSize: 13, color: colors.textMuted }}>
              {percentage}% to Bank / {100 - percentage}% to Wallet
            </span>
          </div>
          <input
            type="range"
            min="10"
            max="100"
            step="10"
            value={percentage}
            onChange={(e) => setPercentage(Number(e.target.value))}
            style={{
              width: '100%',
              height: 6,
              borderRadius: 3,
              background: colors.bg,
              cursor: 'pointer',
              accentColor: colors.accent,
            }}
          />
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 11,
            color: colors.textMuted,
            marginTop: 6,
          }}>
            <span>10% Bank</span>
            <span>100% Bank</span>
          </div>
        </div>
      )}

      {/* Pending amount notice */}
      {Number(currentPreferences.pending_bridge_amount) > 0 && (
        <div style={{
          marginTop: 20,
          padding: 16,
          background: colors.warningBg,
          border: `1px solid ${colors.warning}40`,
          borderRadius: 12,
        }}>
          <span style={{ fontWeight: 600, color: colors.warning, fontSize: 14 }}>
            ${Number(currentPreferences.pending_bridge_amount).toFixed(2)} USDC pending
          </span>
          <p style={{ color: colors.textSecondary, marginTop: 6, fontSize: 13 }}>
            This amount is accumulating until it reaches the $10 minimum for bank deposit.
          </p>
        </div>
      )}

      {error && (
        <div style={{
          marginTop: 20,
          padding: 12,
          background: colors.errorBg,
          border: `1px solid ${colors.error}40`,
          borderRadius: 8,
          color: colors.error,
          fontSize: 13,
        }}>
          {error}
        </div>
      )}

      <div style={{ marginTop: 20 }}>
        <button
          onClick={handleSave}
          disabled={saving || !hasChanges}
          style={{
            padding: '10px 20px',
            borderRadius: 8,
            border: 'none',
            fontWeight: 600,
            fontSize: 14,
            cursor: saving || !hasChanges ? 'not-allowed' : 'pointer',
            background: saved
              ? colors.success
              : hasChanges
              ? colors.accent
              : colors.bgHover,
            color: saved || hasChanges ? '#000' : colors.textMuted,
            opacity: saving ? 0.6 : 1,
            transition: 'all 0.2s',
          }}
        >
          {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
};

export default BridgePayoutPreferences;
