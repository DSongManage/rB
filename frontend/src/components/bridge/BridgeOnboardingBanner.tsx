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
      // Step 1: Not started
      return {
        title: 'Get paid directly to your bank account',
        description: 'Set up automatic USDC to USD conversion and receive your earnings as direct deposits.',
        actionText: 'Set Up Payouts',
        icon: Building2,
        variant: 'primary' as const,
      };
    }

    if (status.kyc_status === 'pending') {
      // Step 2: KYC pending
      return {
        title: 'Verification in progress',
        description: 'Your identity verification is being reviewed. This usually takes a few minutes.',
        actionText: 'Check Status',
        icon: AlertCircle,
        variant: 'warning' as const,
      };
    }

    if (status.kyc_status === 'approved' && !status.has_bank_account) {
      // Step 3: Need bank account
      return {
        title: 'Almost there! Link your bank account',
        description: 'Your identity is verified. Now link a bank account to receive payouts.',
        actionText: 'Link Bank Account',
        icon: Building2,
        variant: 'success' as const,
      };
    }

    if (status.has_bank_account && !status.has_liquidation_address) {
      // Step 4: Need liquidation address
      return {
        title: 'Final step: Create payout address',
        description: 'Create a payment address to start receiving automatic bank deposits.',
        actionText: 'Complete Setup',
        icon: CheckCircle,
        variant: 'success' as const,
      };
    }

    // Default: not started
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

  const variantStyles = {
    primary: 'bg-blue-50 border-blue-200 text-blue-900',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-900',
    success: 'bg-green-50 border-green-200 text-green-900',
  };

  const buttonStyles = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white',
    warning: 'bg-yellow-600 hover:bg-yellow-700 text-white',
    success: 'bg-green-600 hover:bg-green-700 text-white',
  };

  return (
    <div
      className={`rounded-lg border p-4 ${variantStyles[content.variant]} ${className}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <Icon className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-semibold">{content.title}</h3>
            <p className="mt-1 text-sm opacity-80">{content.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 ml-4">
          <Link
            to="/payout-settings"
            className={`inline-flex items-center gap-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${buttonStyles[content.variant]}`}
          >
            {content.actionText}
            <ArrowRight className="h-4 w-4" />
          </Link>
          <button
            onClick={() => setDismissed(true)}
            className="text-sm opacity-60 hover:opacity-100 px-2"
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
