/**
 * PurchaseStatusTracker Component
 *
 * Shows real-time status updates for purchases going through the Bridge conversion flow.
 * Displays progress: Payment -> Converting -> Minting -> Complete
 *
 * The purchase flow:
 * 1. Coinbase on-ramp converts fiat -> USDC (or user pays with existing balance)
 * 2. Smart contract mints NFT and distributes USDC
 * 3. Purchase complete!
 */

import React, { useState, useEffect, useCallback } from 'react';
import { API_URL } from '../config';

interface PurchaseStatus {
  id: number;
  status: string;
  status_display: string;
  nft_mint_address?: string;
  transaction_signature?: string;
  bridge_transfer_id?: string;
  estimated_completion?: string;
}

interface PurchaseStatusTrackerProps {
  purchaseId?: number;
  batchPurchaseId?: number;
  onComplete?: () => void;
  onError?: (error: string) => void;
}

const STATUS_CONFIG: Record<string, {
  icon: string;
  color: string;
  bgColor: string;
  message: string;
  step: number;
}> = {
  payment_pending: {
    icon: '💳',
    color: '#f59e0b',
    bgColor: '#422006',
    message: 'Processing payment...',
    step: 1,
  },
  payment_completed: {
    icon: '✓',
    color: '#10b981',
    bgColor: '#064e3b',
    message: 'Payment received!',
    step: 1,
  },
  bridge_pending: {
    icon: '🔄',
    color: '#3b82f6',
    bgColor: '#1e3a5f',
    message: 'Initiating USD to USDC conversion...',
    step: 2,
  },
  bridge_converting: {
    icon: '⏳',
    color: '#8b5cf6',
    bgColor: '#2e1065',
    message: 'Converting your payment to USDC...',
    step: 2,
  },
  usdc_received: {
    icon: '💰',
    color: '#10b981',
    bgColor: '#064e3b',
    message: 'USDC received! Starting NFT mint...',
    step: 3,
  },
  minting: {
    icon: '⚡',
    color: '#ec4899',
    bgColor: '#4a0e2c',
    message: 'Minting your NFT on Solana...',
    step: 3,
  },
  completed: {
    icon: '🎉',
    color: '#10b981',
    bgColor: '#064e3b',
    message: 'Purchase complete! NFT is yours.',
    step: 4,
  },
  failed: {
    icon: '❌',
    color: '#ef4444',
    bgColor: '#7f1d1d',
    message: 'Something went wrong. Check your email for refund details.',
    step: -1,
  },
  refunded: {
    icon: '↩️',
    color: '#f59e0b',
    bgColor: '#422006',
    message: 'Payment refunded to your card.',
    step: -1,
  },
};

const STEPS = [
  { label: 'Payment', step: 1 },
  { label: 'Converting', step: 2 },
  { label: 'Minting', step: 3 },
  { label: 'Complete', step: 4 },
];

export default function PurchaseStatusTracker({
  purchaseId,
  batchPurchaseId,
  onComplete,
  onError,
}: PurchaseStatusTrackerProps) {
  const [status, setStatus] = useState<PurchaseStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pollCount, setPollCount] = useState(0);

  const fetchStatus = useCallback(async () => {
    try {
      const endpoint = purchaseId
        ? `${API_URL}/api/purchases/${purchaseId}/status/`
        : `${API_URL}/api/batch-purchases/${batchPurchaseId}/status/`;

      const res = await fetch(endpoint, { credentials: 'include' });

      if (!res.ok) {
        throw new Error('Failed to fetch purchase status');
      }

      const data = await res.json();
      setStatus(data);
      setLoading(false);

      // Check for completion
      if (data.status === 'completed') {
        onComplete?.();
      } else if (data.status === 'failed' || data.status === 'refunded') {
        onError?.(data.status_display || 'Purchase failed');
      }

      return data;
    } catch (e) {
      console.error('Error fetching status:', e);
      setError(e instanceof Error ? e.message : 'Failed to fetch status');
      setLoading(false);
      return null;
    }
  }, [purchaseId, batchPurchaseId, onComplete, onError]);

  useEffect(() => {
    if (!purchaseId && !batchPurchaseId) return;

    // Initial fetch
    fetchStatus();

    // Poll every 5 seconds for status updates
    const pollInterval = setInterval(() => {
      setPollCount((prev) => prev + 1);
      fetchStatus().then((data) => {
        // Stop polling if complete, failed, or refunded
        if (data && ['completed', 'failed', 'refunded'].includes(data.status)) {
          clearInterval(pollInterval);
        }
      });
    }, 5000);

    // Max poll time: 60 minutes (720 polls at 5s each)
    const maxPollTimeout = setTimeout(() => {
      clearInterval(pollInterval);
      setError('Status check timed out. Please check your purchases in your library.');
    }, 60 * 60 * 1000);

    return () => {
      clearInterval(pollInterval);
      clearTimeout(maxPollTimeout);
    };
  }, [purchaseId, batchPurchaseId, fetchStatus]);

  if (loading) {
    return (
      <div style={{
        padding: '24px',
        backgroundColor: '#0f172a',
        border: '1px solid #1e293b',
        borderRadius: '12px',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: '24px', marginBottom: '12px' }}>⏳</div>
        <div style={{ color: '#94a3b8' }}>Loading purchase status...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        padding: '24px',
        backgroundColor: '#7f1d1d',
        border: '1px solid #ef4444',
        borderRadius: '12px',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: '24px', marginBottom: '12px' }}>❌</div>
        <div style={{ color: '#fecaca', marginBottom: '12px' }}>{error}</div>
        <button
          onClick={() => {
            setError(null);
            setLoading(true);
            fetchStatus();
          }}
          style={{
            padding: '8px 16px',
            backgroundColor: '#ef4444',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  const currentConfig = status ? STATUS_CONFIG[status.status] || STATUS_CONFIG.payment_pending : STATUS_CONFIG.payment_pending;
  const currentStep = currentConfig.step;

  return (
    <div style={{
      padding: '24px',
      backgroundColor: '#0f172a',
      border: '1px solid #1e293b',
      borderRadius: '12px',
    }}>
      {/* Header */}
      <div style={{
        textAlign: 'center',
        marginBottom: '24px',
      }}>
        <div style={{
          fontSize: '48px',
          marginBottom: '12px',
        }}>
          {currentConfig.icon}
        </div>
        <h3 style={{
          fontSize: '20px',
          fontWeight: 600,
          color: currentConfig.color,
          marginBottom: '8px',
        }}>
          {currentConfig.message}
        </h3>
        {status?.status === 'bridge_converting' && (
          <p style={{
            fontSize: '14px',
            color: '#94a3b8',
            margin: 0,
          }}>
            This typically takes 5-30 minutes. You can leave this page.
          </p>
        )}
      </div>

      {/* Progress Steps */}
      {currentStep > 0 && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px',
          padding: '0 16px',
        }}>
          {STEPS.map((step, index) => {
            const isActive = currentStep === step.step;
            const isComplete = currentStep > step.step;
            const isPending = currentStep < step.step;

            return (
              <React.Fragment key={step.step}>
                {/* Step Circle */}
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '8px',
                }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '18px',
                    fontWeight: 600,
                    backgroundColor: isComplete
                      ? '#10b981'
                      : isActive
                        ? currentConfig.color
                        : '#334155',
                    color: isComplete || isActive ? 'white' : '#94a3b8',
                    border: isActive ? `2px solid ${currentConfig.color}` : 'none',
                    animation: isActive ? 'pulse 2s infinite' : 'none',
                  }}>
                    {isComplete ? '✓' : step.step}
                  </div>
                  <span style={{
                    fontSize: '12px',
                    fontWeight: isActive ? 600 : 400,
                    color: isActive ? currentConfig.color : isPending ? '#64748b' : '#94a3b8',
                  }}>
                    {step.label}
                  </span>
                </div>

                {/* Connector Line */}
                {index < STEPS.length - 1 && (
                  <div style={{
                    flex: 1,
                    height: '2px',
                    backgroundColor: currentStep > step.step ? '#10b981' : '#334155',
                    margin: '0 8px',
                    marginBottom: '28px',
                  }} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      )}

      {/* Status Details */}
      <div style={{
        padding: '16px',
        backgroundColor: currentConfig.bgColor,
        border: `1px solid ${currentConfig.color}`,
        borderRadius: '8px',
        fontSize: '14px',
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: '8px',
        }}>
          <span style={{ color: '#94a3b8' }}>Status:</span>
          <span style={{ color: currentConfig.color, fontWeight: 600 }}>
            {status?.status_display || status?.status}
          </span>
        </div>

        {status?.nft_mint_address && (
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: '8px',
          }}>
            <span style={{ color: '#94a3b8' }}>NFT Address:</span>
            <a
              href={`https://solscan.io/token/${status.nft_mint_address}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: '#3b82f6',
                textDecoration: 'none',
                fontFamily: 'monospace',
                fontSize: '12px',
              }}
            >
              {status.nft_mint_address.slice(0, 8)}...{status.nft_mint_address.slice(-6)}
            </a>
          </div>
        )}

        {status?.transaction_signature && (
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
          }}>
            <span style={{ color: '#94a3b8' }}>Transaction:</span>
            <a
              href={`https://solscan.io/tx/${status.transaction_signature}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: '#3b82f6',
                textDecoration: 'none',
                fontFamily: 'monospace',
                fontSize: '12px',
              }}
            >
              {status.transaction_signature.slice(0, 8)}...{status.transaction_signature.slice(-6)}
            </a>
          </div>
        )}
      </div>

      {/* Polling indicator */}
      <div style={{
        marginTop: '16px',
        fontSize: '12px',
        color: '#64748b',
        textAlign: 'center',
      }}>
        Auto-refreshing every 5 seconds {pollCount > 0 && `(${pollCount} checks)`}
      </div>

      {/* CSS for pulse animation */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.05); }
        }
      `}</style>
    </div>
  );
}
