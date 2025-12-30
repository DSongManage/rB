/**
 * KYC status display and action component.
 */

import React, { useState } from 'react';
import { CheckCircle, Clock, XCircle, AlertCircle, ExternalLink, RefreshCw } from 'lucide-react';
import { openKYCFlow, getKYCStatus, createBridgeCustomer } from '../../services/bridgeApi';
import type { KYCStatus } from '../../types/bridge';

interface BridgeKYCStatusProps {
  status: KYCStatus | null;
  hasCustomer: boolean;
  onStatusChange?: () => void;
}

export const BridgeKYCStatus: React.FC<BridgeKYCStatusProps> = ({
  status,
  hasCustomer,
  onStatusChange,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStartKYC = async () => {
    setLoading(true);
    setError(null);
    try {
      // Create customer if not exists
      if (!hasCustomer) {
        await createBridgeCustomer();
      }
      // Open KYC flow
      await openKYCFlow();
      onStatusChange?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start KYC');
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshStatus = async () => {
    setLoading(true);
    try {
      await getKYCStatus();
      onStatusChange?.();
    } catch (err) {
      console.error('Failed to refresh KYC status:', err);
    } finally {
      setLoading(false);
    }
  };

  const statusConfig: Record<KYCStatus, {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    description: string;
    color: string;
    bgColor: string;
  }> = {
    not_started: {
      icon: AlertCircle,
      label: 'Not Started',
      description: 'Complete identity verification to enable bank payouts.',
      color: 'text-gray-600',
      bgColor: 'bg-gray-100',
    },
    pending: {
      icon: Clock,
      label: 'Pending Review',
      description: 'Your verification is being reviewed. This usually takes a few minutes.',
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-100',
    },
    approved: {
      icon: CheckCircle,
      label: 'Verified',
      description: 'Your identity has been verified. You can now link bank accounts.',
      color: 'text-green-600',
      bgColor: 'bg-green-100',
    },
    rejected: {
      icon: XCircle,
      label: 'Verification Failed',
      description: 'Your verification was not approved. Please try again with valid documents.',
      color: 'text-red-600',
      bgColor: 'bg-red-100',
    },
    incomplete: {
      icon: AlertCircle,
      label: 'Incomplete',
      description: 'Your verification is incomplete. Please complete all required steps.',
      color: 'text-orange-600',
      bgColor: 'bg-orange-100',
    },
  };

  const currentStatus = status || 'not_started';
  const config = statusConfig[currentStatus];
  const Icon = config.icon;

  return (
    <div className="bg-white rounded-lg border p-6">
      <h3 className="text-lg font-semibold mb-4">Identity Verification</h3>

      <div className={`rounded-lg p-4 ${config.bgColor}`}>
        <div className="flex items-start gap-3">
          <Icon className={`h-6 w-6 ${config.color}`} />
          <div className="flex-1">
            <p className={`font-medium ${config.color}`}>{config.label}</p>
            <p className="text-sm text-gray-600 mt-1">{config.description}</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">
          {error}
        </div>
      )}

      <div className="mt-4 flex gap-3">
        {(currentStatus === 'not_started' || currentStatus === 'rejected' || currentStatus === 'incomplete') && (
          <button
            onClick={handleStartKYC}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ExternalLink className="h-4 w-4" />
            {hasCustomer ? 'Continue Verification' : 'Start Verification'}
          </button>
        )}

        {currentStatus === 'pending' && (
          <button
            onClick={handleRefreshStatus}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh Status
          </button>
        )}
      </div>

      <p className="mt-4 text-xs text-gray-500">
        Verification is powered by Bridge.xyz. Your data is securely handled according to their{' '}
        <a
          href="https://www.bridge.xyz/privacy"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline"
        >
          privacy policy
        </a>
        .
      </p>
    </div>
  );
};

export default BridgeKYCStatus;
