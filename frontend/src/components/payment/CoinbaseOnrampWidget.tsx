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
import { initOnRamp, onBroadcastedPostMessage } from '@coinbase/cbpay-js';
import { X, CreditCard, Loader2, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { paymentApi, CoinbaseWidgetConfig } from '../../services/paymentApi';
import { useBalance } from '../../contexts/BalanceContext';

interface CoinbaseOnrampWidgetProps {
  intentId: number;
  onSuccess: () => void;
  onCancel: () => void;
  onError: (error: string) => void;
}

type WidgetStatus = 'loading' | 'ready' | 'processing' | 'checking' | 'success' | 'error';

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
  const instanceRef = useRef<{ open: () => void; destroy: () => void } | null>(null);
  const popupRef = useRef<Window | null>(null);
  const popupCloseCheckRef = useRef<NodeJS.Timeout | null>(null);
  const widgetOpenedRef = useRef(false);
  const statusRef = useRef<WidgetStatus>('loading');
  const { forceSync, getBalanceNumber } = useBalance();

  // Keep statusRef in sync
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

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

  // Handle successful completion (shared by polling and balance check)
  const handleCompletion = useCallback(async (transactionId: number) => {
    setStatus('success');
    await forceSync();
    await paymentApi.completeCoinbaseOnramp(transactionId);
    setTimeout(() => {
      onSuccess();
    }, 1500);
  }, [forceSync, onSuccess]);

  // Poll for transaction completion via backend status + balance check
  const startPolling = useCallback((transactionId: number, maxAttempts?: number) => {
    let attempts = 0;
    const limit = maxAttempts || 0; // 0 = unlimited
    const initialBalance = getBalanceNumber();

    const interval = setInterval(async () => {
      attempts++;

      // Check attempt limit for exit-triggered polling
      if (limit > 0 && attempts > limit) {
        clearInterval(interval);
        setPollingInterval(null);
        // No payment detected after checking - cancel
        onCancel();
        return;
      }

      try {
        // Check 1: Backend transaction status (updated by webhook)
        const txStatus = await paymentApi.getCoinbaseStatus(transactionId);

        if (txStatus.status === 'completed') {
          clearInterval(interval);
          setPollingInterval(null);
          await handleCompletion(transactionId);
          return;
        } else if (txStatus.status === 'failed') {
          clearInterval(interval);
          setPollingInterval(null);
          setErrorMessage(txStatus.failure_reason || 'Payment failed');
          setStatus('error');
          return;
        }

        // Check 2: Balance increase (catches cases where webhook is delayed)
        const syncResult = await forceSync();
        const currentBalance = getBalanceNumber();
        if (currentBalance > initialBalance + 0.01) {
          // Balance increased - funds arrived!
          clearInterval(interval);
          setPollingInterval(null);
          await handleCompletion(transactionId);
          return;
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 3000);

    setPollingInterval(interval);
  }, [forceSync, getBalanceNumber, handleCompletion, onCancel]);

  // Cleanup polling and popup on unmount
  useEffect(() => {
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
      if (instanceRef.current) {
        instanceRef.current.destroy();
      }
      if (popupCloseCheckRef.current) {
        clearInterval(popupCloseCheckRef.current);
      }
    };
  }, [pollingInterval]);

  // Open Coinbase widget via direct URL (session token path — no wallet in URL)
  // We build the URL manually because cbpay-js generateOnRampURL always
  // requires destinationWallets/addresses at runtime (despite TypeScript types
  // claiming sessionToken is an alternative).
  const openWidgetDirect = useCallback(() => {
    if (!config) return;
    const { widget_config } = config;

    const url = new URL('https://pay.coinbase.com/buy/select-asset');
    url.searchParams.set('sessionToken', widget_config.sessionToken!);
    url.searchParams.set('presetCryptoAmount', String(widget_config.presetCryptoAmount));
    url.searchParams.set('defaultNetwork', widget_config.defaultNetwork);
    url.searchParams.set('defaultExperience', 'buy');
    if (widget_config.handlingRequestedUrls) {
      url.searchParams.set('handlingRequestedUrls', 'true');
    }
    if (widget_config.partnerUserId) {
      url.searchParams.set('partnerUserId', widget_config.partnerUserId);
    }
    url.searchParams.sort();

    const popup = window.open(url.toString(), 'coinbase_onramp', 'width=460,height=720,popup=yes');
    if (!popup) {
      setErrorMessage('Popup was blocked. Please allow popups for this site.');
      setStatus('error');
      return;
    }
    widgetOpenedRef.current = true;
    popupRef.current = popup;

    // Listen for Coinbase postMessage events
    const unsubSuccess = onBroadcastedPostMessage('success', {
      onMessage: () => {
        setStatus('processing');
        startPolling(config.transaction_id);
      },
      allowedOrigin: 'https://pay.coinbase.com',
    });
    const unsubExit = onBroadcastedPostMessage('exit', {
      onMessage: () => {
        const currentStatus = statusRef.current;
        if (currentStatus === 'processing' || currentStatus === 'success') return;
        if (widgetOpenedRef.current) {
          setStatus('checking');
          startPolling(config.transaction_id, 8);
        } else {
          onCancel();
        }
      },
      allowedOrigin: 'https://pay.coinbase.com',
    });
    const unsubEvent = onBroadcastedPostMessage('event', {
      onMessage: (data) => {
        const eventName = (data as Record<string, unknown>)?.eventName as string;
        console.log('Coinbase event:', eventName);
        if (eventName === 'transition_view' || eventName === 'request_open_url') {
          widgetOpenedRef.current = true;
        }
      },
      allowedOrigin: 'https://pay.coinbase.com',
    });

    // Poll for popup close (no reliable close event from postMessage)
    const closeCheck = setInterval(() => {
      if (popup.closed) {
        clearInterval(closeCheck);
        unsubSuccess();
        unsubExit();
        unsubEvent();
        const currentStatus = statusRef.current;
        if (currentStatus === 'processing' || currentStatus === 'success') return;
        if (widgetOpenedRef.current) {
          setStatus('checking');
          startPolling(config.transaction_id, 8);
        } else {
          onCancel();
        }
      }
    }, 500);
    popupCloseCheckRef.current = closeCheck;
  }, [config, onCancel, startPolling]);

  // Open Coinbase widget via SDK (fallback when no session token)
  const openWidgetLegacy = useCallback(() => {
    if (!config) return;
    const { widget_config } = config;

    initOnRamp(
      {
        appId: widget_config.appId,
        widgetParameters: {
          destinationWallets: widget_config.destinationWallets,
          presetCryptoAmount: widget_config.presetCryptoAmount,
          defaultNetwork: widget_config.defaultNetwork,
          defaultExperience: 'buy' as const,
          handlingRequestedUrls: widget_config.handlingRequestedUrls,
          partnerUserId: widget_config.partnerUserId,
        } as Record<string, unknown>,
        onSuccess: () => {
          setStatus('processing');
          startPolling(config.transaction_id);
        },
        onExit: () => {
          const currentStatus = statusRef.current;
          if (currentStatus === 'processing' || currentStatus === 'success') return;
          if (widgetOpenedRef.current) {
            setStatus('checking');
            startPolling(config.transaction_id, 8);
          } else {
            onCancel();
          }
        },
        onEvent: (event) => {
          console.log('Coinbase event:', event.eventName);
          if (event.eventName === 'transition_view' || event.eventName === 'request_open_url') {
            widgetOpenedRef.current = true;
          }
          if (event.eventName === 'error') {
            const errorEvent = event as { error?: { message?: string } };
            setErrorMessage(errorEvent.error?.message || 'Payment error occurred');
            setStatus('error');
          }
        },
        experienceLoggedIn: 'popup',
      },
      (error, instance) => {
        if (error) {
          console.error('Coinbase initOnRamp error:', error);
          setErrorMessage(error.message || 'Failed to initialize payment widget');
          setStatus('error');
          return;
        }
        if (instance) {
          instanceRef.current = instance;
          widgetOpenedRef.current = true;
          instance.open();
        }
      },
    );
  }, [config, onCancel, startPolling]);

  // Open Coinbase widget — uses direct URL when session token is available
  const openWidget = useCallback(() => {
    if (!config) {
      setErrorMessage('Payment config not ready');
      setStatus('error');
      return;
    }

    try {
      if (config.widget_config.sessionToken) {
        openWidgetDirect();
      } else {
        openWidgetLegacy();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to open payment widget';
      setErrorMessage(message);
      setStatus('error');
    }
  }, [config, openWidgetDirect, openWidgetLegacy]);

  // Auto-open widget when ready
  useEffect(() => {
    if (status === 'ready' && config) {
      const timer = setTimeout(() => {
        openWidget();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [status, openWidget, config]);

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
          {status !== 'processing' && status !== 'checking' && status !== 'success' && (
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

          {(status === 'processing' || status === 'checking') && (
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
                {status === 'checking' ? 'Checking for Payment' : 'Processing Payment'}
              </h3>
              <p style={{ color: 'var(--text-secondary, #cbd5e1)', margin: 0 }}>
                {status === 'checking'
                  ? 'Verifying your funds arrived...'
                  : 'Your funds are being added to your account...'}
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
