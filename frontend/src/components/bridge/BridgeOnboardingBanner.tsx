/**
 * Banner component shown on earnings dashboard to prompt Bridge setup.
 * Shows different states based on onboarding progress.
 */

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, CheckCircle, ArrowRight, AlertCircle } from 'lucide-react';
import { getBridgeOnboardingStatus } from '../../services/bridgeApi';
import type { BridgeOnboardingStatus } from '../../types/bridge';

interface BridgeOnboardingBannerProps {
  className?: string;
}

export const BridgeOnboardingBanner: React.FC<BridgeOnboardingBannerProps> = ({
  className = '',
}) => {
  const [status, setStatus] = useState<BridgeOnboardingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const data = await getBridgeOnboardingStatus();
        setStatus(data);
      } catch (error) {
        console.error('Failed to fetch Bridge status:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
  }, []);

  // Don't show if loading, dismissed, or already fully set up
  if (loading || dismissed || status?.is_fully_setup) {
    return null;
  }

  // Don't show if user has already chosen wallet-only payouts
  if (status?.payout_destination === 'wallet' && status?.has_bridge_customer) {
    return null;
  }

  // Determine banner content based on status
  const getBannerContent = () => {
    if (!status?.has_bridge_customer) {
      return {
        title: 'Get paid directly to your bank account',
        description: 'Set up automatic USDC to USD conversion and receive your earnings as direct deposits.',
        actionText: 'Set Up Payouts',
        icon: Building2,
        variant: 'primary' as const,
      };
    }

    if (status.kyc_status === 'pending') {
      return {
        title: 'Verification in progress',
        description: 'Your identity verification is being reviewed. This usually takes a few minutes.',
        actionText: 'Check Status',
        icon: AlertCircle,
        variant: 'warning' as const,
      };
    }

    if (status.kyc_status === 'approved' && !status.has_bank_account) {
      return {
        title: 'Almost there! Link your bank account',
        description: 'Your identity is verified. Now link a bank account to receive payouts.',
        actionText: 'Link Bank Account',
        icon: Building2,
        variant: 'success' as const,
      };
    }

    if (status.has_bank_account && !status.has_liquidation_address) {
      return {
        title: 'Final step: Create payout address',
        description: 'Create a payment address to start receiving automatic bank deposits.',
        actionText: 'Complete Setup',
        icon: CheckCircle,
        variant: 'success' as const,
      };
    }

    return {
      title: 'Enable direct bank deposits',
      description: 'Convert your USDC earnings to USD automatically.',
      actionText: 'Get Started',
      icon: Building2,
      variant: 'primary' as const,
    };
  };

  const content = getBannerContent();
  const Icon = content.icon;

  const accentColors = {
    primary: '#3b82f6',
    warning: '#f59e0b',
    success: '#10b981',
  };

  const accent = accentColors[content.variant];

  return (
    <div
      className={className}
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--panel-border-strong)',
        borderRadius: 12,
        padding: '16px 20px',
        borderLeft: `3px solid ${accent}`,
      }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
          <div style={{
            flexShrink: 0,
            width: 36,
            height: 36,
            borderRadius: 8,
            background: `${accent}20`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Icon size={18} style={{ color: accent }} />
          </div>
          <div style={{ minWidth: 0 }}>
            <h3 style={{
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--text)',
              margin: 0,
            }}>
              {content.title}
            </h3>
            <p style={{
              fontSize: 12,
              color: 'var(--text-muted)',
              margin: '2px 0 0 0',
            }}>
              {content.description}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <Link
            to="/payout-settings"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 16px',
              background: accent,
              borderRadius: 8,
              color: '#fff',
              fontSize: 13,
              fontWeight: 600,
              textDecoration: 'none',
              transition: 'opacity 0.2s',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.85'; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
          >
            {content.actionText}
            <ArrowRight size={14} />
          </Link>
          <button
            onClick={() => setDismissed(true)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: 12,
              cursor: 'pointer',
              padding: '6px 8px',
              borderRadius: 6,
              transition: 'color 0.2s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
            aria-label="Dismiss"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
};

export default BridgeOnboardingBanner;
