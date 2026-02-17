/**
 * KYC status display and action component.
 * Updated with dark theme styling.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CheckCircle, Clock, XCircle, AlertCircle, ExternalLink, RefreshCw, type LucideIcon } from 'lucide-react';
import { openKYCFlow, getKYCStatus, createBridgeCustomer } from '../../services/bridgeApi';
import type { KYCStatus } from '../../types/bridge';

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
  warning: '#f59e0b',
  warningBg: 'rgba(245,158,11,0.15)',
  info: '#3b82f6',
  infoBg: 'rgba(59,130,246,0.15)',
};

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
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const kycWindowRef = useRef<Window | null>(null);

  // Use ref for callback to prevent effect dependency changes from killing polling
  const onStatusChangeRef = useRef(onStatusChange);
  useEffect(() => {
    onStatusChangeRef.current = onStatusChange;
  });

  const isTerminalStatus = status === 'approved' || status === 'rejected';

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const checkStatus = useCallback(async () => {
    try {
      const result = await getKYCStatus();
      if (result.kyc_status === 'approved' || result.kyc_status === 'rejected') {
        stopPolling();
      }
      onStatusChangeRef.current?.();
    } catch (err) {
      console.error('Failed to check KYC status:', err);
    }
  }, [stopPolling]);

  // Start polling and monitor popup window close
  const startPolling = useCallback(() => {
    if (pollingRef.current) return;

    pollingRef.current = setInterval(() => {
      // Detect popup window close for immediate check
      if (kycWindowRef.current && kycWindowRef.current.closed) {
        kycWindowRef.current = null;
        // Do an immediate check, then let normal polling continue
        checkStatus();
        return;
      }
      checkStatus();
    }, 3000);
  }, [checkStatus]);

  // Listen for tab visibility changes — immediate check when user returns
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && pollingRef.current && !isTerminalStatus) {
        checkStatus();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [checkStatus, isTerminalStatus]);

  // Cleanup polling on unmount only
  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  // Stop polling if status becomes terminal
  useEffect(() => {
    if (isTerminalStatus) {
      stopPolling();
    }
  }, [isTerminalStatus, stopPolling]);

  const handleStartKYC = async () => {
    setLoading(true);
    setError(null);
    try {
      if (!hasCustomer) {
        await createBridgeCustomer();
      }
      const win = await openKYCFlow();
      kycWindowRef.current = win;
      startPolling();
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
      onStatusChangeRef.current?.();
    } catch (err) {
      console.error('Failed to refresh KYC status:', err);
    } finally {
      setLoading(false);
    }
  };

  const statusConfig: Record<KYCStatus, {
    icon: LucideIcon;
    label: string;
    description: string;
    color: string;
    bgColor: string;
  }> = {
    not_started: {
      icon: AlertCircle,
      label: 'Not Started',
      description: 'Complete identity verification to enable bank payouts.',
      color: colors.textMuted,
      bgColor: colors.bgHover,
    },
    pending: {
      icon: Clock,
      label: 'Pending Review',
      description: 'Your verification is being reviewed. This usually takes a few minutes.',
      color: colors.warning,
      bgColor: colors.warningBg,
    },
    approved: {
      icon: CheckCircle,
      label: 'Verified',
      description: 'Your identity has been verified. You can now link bank accounts.',
      color: colors.success,
      bgColor: colors.successBg,
    },
    rejected: {
      icon: XCircle,
      label: 'Verification Failed',
      description: 'Your verification was not approved. Please try again with valid documents.',
      color: colors.error,
      bgColor: colors.errorBg,
    },
    incomplete: {
      icon: AlertCircle,
      label: 'Incomplete',
      description: 'Your identity is verified. Please accept the Terms of Service to continue.',
      color: colors.warning,
      bgColor: colors.warningBg,
    },
  };

  const currentStatus = status || 'not_started';
  const config = statusConfig[currentStatus];
  const Icon = config.icon;

  return (
    <div>
      <div style={{
        background: config.bgColor,
        borderRadius: 12,
        padding: 16,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
      }}>
        <Icon size={24} style={{ color: config.color, flexShrink: 0, marginTop: 2 }} />
        <div style={{ flex: 1 }}>
          <div style={{ color: config.color, fontWeight: 600, fontSize: 15 }}>
            {config.label}
          </div>
          <p style={{ color: colors.textSecondary, fontSize: 13, margin: '4px 0 0', lineHeight: 1.5 }}>
            {config.description}
          </p>
        </div>
      </div>

      {error && (
        <div style={{
          marginTop: 16,
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

      <div style={{ marginTop: 16, display: 'flex', gap: 12 }}>
        {(currentStatus === 'not_started' || currentStatus === 'rejected' || currentStatus === 'incomplete') && (
          <button
            onClick={handleStartKYC}
            disabled={loading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 20px',
              background: colors.accent,
              color: '#000',
              border: 'none',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
            }}
          >
            <ExternalLink size={16} />
            {!hasCustomer ? 'Start Verification' : currentStatus === 'incomplete' ? 'Accept Terms of Service' : 'Continue Verification'}
          </button>
        )}

        {hasCustomer && currentStatus !== 'approved' && (
          <button
            onClick={handleRefreshStatus}
            disabled={loading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 20px',
              background: colors.bgHover,
              color: colors.textSecondary,
              border: `1px solid ${colors.border}`,
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 500,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
            }}
          >
            <RefreshCw size={16} style={loading ? { animation: 'spin 1s linear infinite' } : {}} />
            {currentStatus === 'not_started' ? 'Check Status' : 'Refresh Status'}
          </button>
        )}
      </div>

      <p style={{
        marginTop: 16,
        fontSize: 12,
        color: colors.textMuted,
        lineHeight: 1.5,
      }}>
        Verification is powered by Bridge.xyz. Your data is securely handled according to their{' '}
        <a
          href="https://www.bridge.xyz/privacy"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: colors.info, textDecoration: 'none' }}
          onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
          onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
        >
          privacy policy
        </a>
        .
      </p>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default BridgeKYCStatus;
