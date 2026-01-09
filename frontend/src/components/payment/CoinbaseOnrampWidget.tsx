/**
 * CoinbaseOnrampWidget Component
 *
 * Integrates Coinbase Onramp SDK for Apple Pay and debit card payments.
 * USDC is sent directly to user's Web3Auth wallet.
 *
 * User sees: "Add Funds with Card"
 * Never shows: "Coinbase", "USDC", "crypto"
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { X, CreditCard, Loader2, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { paymentApi, CoinbaseWidgetConfig } from '../../services/paymentApi';
import { useBalance } from '../../contexts/BalanceContext';

// Coinbase Onramp SDK types
declare global {
  interface Window {
    CBPay?: {
      create: (config: {
        appId: string;
        widgetParameters: {
          destinationWallets: Array<{
            address: string;
            blockchains: string[];
            assets: string[];
          }>;
          presetCryptoAmount?: number;
          defaultAsset?: string;
          defaultNetwork?: string;
          defaultExperience?: string;
          handlingRequestedUrls?: boolean;
          partnerUserId?: string;
        };
        onSuccess: () => void;
        onExit: (event?: { reason?: string }) => void;
        onEvent: (event: { eventName: string; eventData?: Record<string, unknown> }) => void;
      }) => {
        open: () => void;
        destroy: () => void;
      };
    };
  }
}

interface CoinbaseOnrampWidgetProps {
  intentId: number;
  onSuccess: () => void;
  onCancel: () => void;
  onError: (error: string) => void;
}

type WidgetStatus = 'loading' | 'ready' | 'processing' | 'success' | 'error';

export function CoinbaseOnrampWidget({
  intentId,
  onSuccess,
  onCancel,
  onError,
}: CoinbaseOnrampWidgetProps) {
  const [status, setStatus] = useState<WidgetStatus>('loading');
  const [config, setConfig] = useState<{
    widget_config: CoinbaseWidgetConfig;
    transaction_id: number;
    amount_to_add: string;
    explanation: string;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);
  const widgetRef = useRef<{ open: () => void; destroy: () => void } | null>(null);
  const { forceSync } = useBalance();

  // Load Coinbase SDK script
  useEffect(() => {
    if (document.getElementById('coinbase-onramp-sdk')) return;

    const script = document.createElement('script');
    script.id = 'coinbase-onramp-sdk';
    script.src = 'https://pay.coinbase.com/sdk/v1/cbpay.js';
    script.async = true;
    document.body.appendChild(script);

    return () => {
      // Don't remove the script on unmount - it may be needed by other components
    };
  }, []);

  // Initialize widget config from backend
  useEffect(() => {
    const initializeWidget = async () => {
      try {
        setStatus('loading');
        const response = await paymentApi.initiateCoinbaseOnramp(intentId);
        setConfig(response);
        setStatus('ready');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to initialize payment';
        setErrorMessage(message);
        setStatus('error');
        onError(message);
      }
    };

    initializeWidget();
  }, [intentId, onError]);

  // Poll for transaction completion
  const startPolling = useCallback((transactionId: number) => {
    const interval = setInterval(async () => {
      try {
        const status = await paymentApi.getCoinbaseStatus(transactionId);

        if (status.status === 'completed') {
          clearInterval(interval);
          setPollingInterval(null);
          setStatus('success');

          // Sync balance and notify success
          await forceSync();

          // Complete the onramp to trigger purchase
          await paymentApi.completeCoinbaseOnramp(transactionId);

          setTimeout(() => {
            onSuccess();
          }, 1500);
        } else if (status.status === 'failed') {
          clearInterval(interval);
          setPollingInterval(null);
          setErrorMessage(status.failure_reason || 'Payment failed');
          setStatus('error');
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 3000);

    setPollingInterval(interval);
  }, [forceSync, onSuccess]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
      if (widgetRef.current) {
        widgetRef.current.destroy();
      }
    };
  }, [pollingInterval]);

  // Open Coinbase widget
  const openWidget = useCallback(() => {
    if (!config || !window.CBPay) {
      setErrorMessage('Payment widget not ready');
      setStatus('error');
      return;
    }

    const { widget_config } = config;

    try {
      widgetRef.current = window.CBPay.create({
        appId: widget_config.appId,
        widgetParameters: {
          destinationWallets: widget_config.destinationWallets,
          presetCryptoAmount: widget_config.presetCryptoAmount,
          defaultAsset: widget_config.defaultAsset,
          defaultNetwork: widget_config.defaultNetwork,
          defaultExperience: widget_config.defaultExperience,
          handlingRequestedUrls: widget_config.handlingRequestedUrls,
          partnerUserId: widget_config.partnerUserId,
        },
        onSuccess: () => {
          setStatus('processing');
          startPolling(config.transaction_id);
        },
        onExit: (event) => {
          if (event?.reason === 'user_exit' || status === 'ready') {
            // User closed without completing
            onCancel();
          }
        },
        onEvent: (event) => {
          console.log('Coinbase event:', event.eventName, event.eventData);

          if (event.eventName === 'error') {
            const errorData = event.eventData as { message?: string } | undefined;
            setErrorMessage(errorData?.message || 'Payment error occurred');
            setStatus('error');
          }
        },
      });

      widgetRef.current.open();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to open payment widget';
      setErrorMessage(message);
      setStatus('error');
    }
  }, [config, onCancel, startPolling, status]);

  // Auto-open widget when ready
  useEffect(() => {
    if (status === 'ready' && window.CBPay) {
      // Small delay to ensure SDK is fully initialized
      const timer = setTimeout(() => {
        openWidget();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [status, openWidget]);

  return (
    <div
      className="rb-coinbase-onramp"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '20px',
      }}
    >
      <div
        style={{
          backgroundColor: 'var(--bg-primary, #0f172a)',
          borderRadius: '16px',
          padding: '32px',
          maxWidth: '420px',
          width: '100%',
          border: '1px solid var(--border, #334155)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '24px',
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: '20px',
              fontWeight: 600,
              color: 'var(--text-primary, #f1f5f9)',
            }}
          >
            Add Funds
          </h2>
          {status !== 'processing' && status !== 'success' && (
            <button
              onClick={onCancel}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '8px',
                backgroundColor: 'transparent',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                color: 'var(--text-muted, #94a3b8)',
              }}
            >
              <X size={20} />
            </button>
          )}
        </div>

        {/* Content based on status */}
        <div style={{ textAlign: 'center' }}>
          {status === 'loading' && (
            <>
              <Loader2
                size={48}
                style={{
                  color: 'var(--accent, #3b82f6)',
                  animation: 'spin 1s linear infinite',
                  marginBottom: '16px',
                }}
              />
              <p style={{ color: 'var(--text-secondary, #cbd5e1)', margin: 0 }}>
                Preparing secure payment...
              </p>
            </>
          )}

          {status === 'ready' && (
            <>
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '16px',
                  backgroundColor: 'rgba(59, 130, 246, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px',
                }}
              >
                <CreditCard size={32} style={{ color: 'var(--accent, #3b82f6)' }} />
              </div>
              <p style={{ color: 'var(--text-secondary, #cbd5e1)', margin: '0 0 16px' }}>
                Opening secure payment window...
              </p>
              {config && (
                <p
                  style={{
                    fontSize: '14px',
                    color: 'var(--text-muted, #94a3b8)',
                    margin: 0,
                    padding: '12px',
                    backgroundColor: 'var(--bg-secondary, #1e293b)',
                    borderRadius: '8px',
                  }}
                >
                  {config.explanation}
                </p>
              )}
              <button
                onClick={openWidget}
                style={{
                  marginTop: '16px',
                  padding: '12px 24px',
                  backgroundColor: 'var(--accent, #3b82f6)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '15px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  margin: '16px auto 0',
                }}
              >
                <CreditCard size={18} />
                Open Payment Window
              </button>
            </>
          )}

          {status === 'processing' && (
            <>
              <Loader2
                size={48}
                style={{
                  color: 'var(--accent, #3b82f6)',
                  animation: 'spin 1s linear infinite',
                  marginBottom: '16px',
                }}
              />
              <h3
                style={{
                  color: 'var(--text-primary, #f1f5f9)',
                  fontSize: '18px',
                  margin: '0 0 8px',
                }}
              >
                Processing Payment
              </h3>
              <p style={{ color: 'var(--text-secondary, #cbd5e1)', margin: 0 }}>
                Your funds are being added to your account...
              </p>
              <p
                style={{
                  fontSize: '13px',
                  color: 'var(--text-muted, #94a3b8)',
                  margin: '16px 0 0',
                }}
              >
                This usually takes 10-30 seconds
              </p>
            </>
          )}

          {status === 'success' && (
            <>
              <CheckCircle
                size={48}
                style={{
                  color: '#22c55e',
                  marginBottom: '16px',
                }}
              />
              <h3
                style={{
                  color: 'var(--text-primary, #f1f5f9)',
                  fontSize: '18px',
                  margin: '0 0 8px',
                }}
              >
                Funds Added!
              </h3>
              <p style={{ color: 'var(--text-secondary, #cbd5e1)', margin: 0 }}>
                Completing your purchase...
              </p>
            </>
          )}

          {status === 'error' && (
            <>
              <AlertCircle
                size={48}
                style={{
                  color: 'var(--error, #ef4444)',
                  marginBottom: '16px',
                }}
              />
              <h3
                style={{
                  color: 'var(--text-primary, #f1f5f9)',
                  fontSize: '18px',
                  margin: '0 0 8px',
                }}
              >
                Payment Issue
              </h3>
              <p style={{ color: 'var(--text-secondary, #cbd5e1)', margin: '0 0 16px' }}>
                {errorMessage || 'Something went wrong with your payment.'}
              </p>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                <button
                  onClick={() => {
                    setStatus('loading');
                    setErrorMessage(null);
                    paymentApi.initiateCoinbaseOnramp(intentId).then((response) => {
                      setConfig(response);
                      setStatus('ready');
                    }).catch((err) => {
                      setErrorMessage(err.message);
                      setStatus('error');
                    });
                  }}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: 'var(--accent, #3b82f6)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <RefreshCw size={16} />
                  Try Again
                </button>
                <button
                  onClick={onCancel}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: 'var(--bg-secondary, #1e293b)',
                    color: 'var(--text-primary, #f1f5f9)',
                    border: '1px solid var(--border, #334155)',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default CoinbaseOnrampWidget;
