/**
 * DirectCryptoPaymentModal Component
 *
 * Shows payment details for users paying with external crypto wallets
 * (Phantom, Solflare, etc.)
 *
 * Features:
 * - Platform USDC address display
 * - Unique memo for payment identification
 * - QR code for Solana Pay
 * - Countdown timer
 * - Polls for payment detection
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  X,
  Copy,
  Check,
  QrCode,
  Clock,
  Loader2,
  CheckCircle,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { paymentApi, DirectCryptoPaymentResponse } from '../../services/paymentApi';

interface DirectCryptoPaymentModalProps {
  intentId: number;
  onSuccess: () => void;
  onCancel: () => void;
  onError: (error: string) => void;
}

type PaymentStatus = 'loading' | 'awaiting' | 'detected' | 'confirming' | 'completed' | 'expired' | 'error';

export function DirectCryptoPaymentModal({
  intentId,
  onSuccess,
  onCancel,
  onError,
}: DirectCryptoPaymentModalProps) {
  const [status, setStatus] = useState<PaymentStatus>('loading');
  const [paymentData, setPaymentData] = useState<DirectCryptoPaymentResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<'address' | 'memo' | 'amount' | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize payment
  useEffect(() => {
    const initializePayment = async () => {
      try {
        setStatus('loading');
        const response = await paymentApi.initiateDirectCrypto(intentId);
        setPaymentData(response);
        setTimeRemaining(response.expires_in_seconds);
        setStatus('awaiting');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to initialize payment';
        setErrorMessage(message);
        setStatus('error');
        onError(message);
      }
    };

    initializePayment();
  }, [intentId, onError]);

  // Poll for payment status
  const pollPaymentStatus = useCallback(async () => {
    if (!paymentData) return;

    try {
      const statusResponse = await paymentApi.getDirectCryptoStatus(paymentData.payment_id);

      switch (statusResponse.status) {
        case 'detected':
          setStatus('detected');
          break;
        case 'confirming':
          setStatus('confirming');
          break;
        case 'completed':
          setStatus('completed');
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
          }
          setTimeout(() => {
            onSuccess();
          }, 1500);
          break;
        case 'expired':
          setStatus('expired');
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
          }
          break;
        case 'failed':
          setStatus('error');
          setErrorMessage(statusResponse.failure_reason || 'Payment failed');
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
          }
          break;
      }
    } catch (err) {
      console.error('Polling error:', err);
    }
  }, [paymentData, onSuccess]);

  // Start polling when awaiting payment
  useEffect(() => {
    if (status === 'awaiting' || status === 'detected' || status === 'confirming') {
      pollingRef.current = setInterval(pollPaymentStatus, 5000);
      return () => {
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
        }
      };
    }
  }, [status, pollPaymentStatus]);

  // Countdown timer
  useEffect(() => {
    if (status === 'awaiting' && timeRemaining > 0) {
      countdownRef.current = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            setStatus('expired');
            if (countdownRef.current) {
              clearInterval(countdownRef.current);
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => {
        if (countdownRef.current) {
          clearInterval(countdownRef.current);
        }
      };
    }
  }, [status, timeRemaining]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  // Copy to clipboard
  const copyToClipboard = async (text: string, field: 'address' | 'memo' | 'amount') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  // Format time remaining
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle cancel
  const handleCancel = async () => {
    if (paymentData && status === 'awaiting') {
      try {
        await paymentApi.cancelDirectCrypto(paymentData.payment_id);
      } catch (err) {
        console.error('Cancel error:', err);
      }
    }
    onCancel();
  };

  return (
    <div
      className="rb-direct-crypto-modal"
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
          maxWidth: '480px',
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto',
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
            Pay with Crypto Wallet
          </h2>
          {(status === 'awaiting' || status === 'loading' || status === 'error' || status === 'expired') && (
            <button
              onClick={handleCancel}
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

        {/* Loading State */}
        {status === 'loading' && (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Loader2
              size={48}
              style={{
                color: 'var(--accent, #3b82f6)',
                animation: 'spin 1s linear infinite',
                marginBottom: '16px',
              }}
            />
            <p style={{ color: 'var(--text-secondary, #cbd5e1)', margin: 0 }}>
              Generating payment details...
            </p>
          </div>
        )}

        {/* Awaiting Payment State */}
        {status === 'awaiting' && paymentData && (
          <>
            {/* Timer */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '12px',
                backgroundColor: timeRemaining < 60 ? 'rgba(239, 68, 68, 0.1)' : 'var(--bg-secondary, #1e293b)',
                borderRadius: '8px',
                marginBottom: '20px',
                color: timeRemaining < 60 ? 'var(--error, #ef4444)' : 'var(--text-secondary, #cbd5e1)',
              }}
            >
              <Clock size={18} />
              <span style={{ fontSize: '14px' }}>
                Payment expires in <strong>{formatTime(timeRemaining)}</strong>
              </span>
            </div>

            {/* Instructions */}
            <p
              style={{
                fontSize: '14px',
                color: 'var(--text-secondary, #cbd5e1)',
                marginBottom: '20px',
                lineHeight: 1.6,
              }}
            >
              {paymentData.instructions}
            </p>

            {/* QR Code */}
            {paymentData.qr_code_data && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  marginBottom: '24px',
                }}
              >
                <div
                  style={{
                    padding: '16px',
                    backgroundColor: 'white',
                    borderRadius: '12px',
                  }}
                >
                  <img
                    src={paymentData.qr_code_data}
                    alt="Payment QR Code"
                    style={{
                      width: '160px',
                      height: '160px',
                      display: 'block',
                    }}
                  />
                </div>
              </div>
            )}

            {/* Payment Details */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Amount */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '12px',
                    fontWeight: 500,
                    color: 'var(--text-muted, #94a3b8)',
                    marginBottom: '6px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  Amount (USDC)
                </label>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '12px',
                    backgroundColor: 'var(--bg-secondary, #1e293b)',
                    borderRadius: '8px',
                    border: '1px solid var(--border, #334155)',
                  }}
                >
                  <span
                    style={{
                      flex: 1,
                      fontSize: '18px',
                      fontWeight: 700,
                      color: 'var(--text-primary, #f1f5f9)',
                    }}
                  >
                    {paymentData.display_amount}
                  </span>
                  <button
                    onClick={() => copyToClipboard(paymentData.expected_amount, 'amount')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '6px 10px',
                      backgroundColor: copiedField === 'amount' ? 'rgba(34, 197, 94, 0.1)' : 'var(--bg-tertiary, #0f172a)',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      color: copiedField === 'amount' ? '#22c55e' : 'var(--text-muted, #94a3b8)',
                      fontSize: '13px',
                    }}
                  >
                    {copiedField === 'amount' ? <Check size={14} /> : <Copy size={14} />}
                    {copiedField === 'amount' ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>

              {/* Address */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '12px',
                    fontWeight: 500,
                    color: 'var(--text-muted, #94a3b8)',
                    marginBottom: '6px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  Send To Address
                </label>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '12px',
                    backgroundColor: 'var(--bg-secondary, #1e293b)',
                    borderRadius: '8px',
                    border: '1px solid var(--border, #334155)',
                  }}
                >
                  <span
                    style={{
                      flex: 1,
                      fontSize: '13px',
                      fontFamily: 'monospace',
                      color: 'var(--text-primary, #f1f5f9)',
                      wordBreak: 'break-all',
                    }}
                  >
                    {paymentData.payment_address}
                  </span>
                  <button
                    onClick={() => copyToClipboard(paymentData.payment_address, 'address')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '6px 10px',
                      backgroundColor: copiedField === 'address' ? 'rgba(34, 197, 94, 0.1)' : 'var(--bg-tertiary, #0f172a)',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      color: copiedField === 'address' ? '#22c55e' : 'var(--text-muted, #94a3b8)',
                      fontSize: '13px',
                      flexShrink: 0,
                    }}
                  >
                    {copiedField === 'address' ? <Check size={14} /> : <Copy size={14} />}
                    {copiedField === 'address' ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>

              {/* Memo */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '12px',
                    fontWeight: 500,
                    color: 'var(--text-muted, #94a3b8)',
                    marginBottom: '6px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  Memo (Required)
                </label>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '12px',
                    backgroundColor: 'rgba(234, 179, 8, 0.1)',
                    borderRadius: '8px',
                    border: '1px solid rgba(234, 179, 8, 0.3)',
                  }}
                >
                  <span
                    style={{
                      flex: 1,
                      fontSize: '16px',
                      fontWeight: 600,
                      fontFamily: 'monospace',
                      color: 'var(--text-primary, #f1f5f9)',
                    }}
                  >
                    {paymentData.payment_memo}
                  </span>
                  <button
                    onClick={() => copyToClipboard(paymentData.payment_memo, 'memo')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '6px 10px',
                      backgroundColor: copiedField === 'memo' ? 'rgba(34, 197, 94, 0.1)' : 'var(--bg-tertiary, #0f172a)',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      color: copiedField === 'memo' ? '#22c55e' : 'var(--text-muted, #94a3b8)',
                      fontSize: '13px',
                      flexShrink: 0,
                    }}
                  >
                    {copiedField === 'memo' ? <Check size={14} /> : <Copy size={14} />}
                    {copiedField === 'memo' ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <p
                  style={{
                    fontSize: '12px',
                    color: '#eab308',
                    margin: '8px 0 0',
                  }}
                >
                  Include this memo in your transaction to identify your payment
                </p>
              </div>
            </div>

            {/* Waiting indicator */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                marginTop: '24px',
                padding: '12px',
                backgroundColor: 'var(--bg-secondary, #1e293b)',
                borderRadius: '8px',
                color: 'var(--text-muted, #94a3b8)',
                fontSize: '14px',
              }}
            >
              <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
              Waiting for payment...
            </div>
          </>
        )}

        {/* Detected State */}
        {(status === 'detected' || status === 'confirming') && (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Loader2
              size={48}
              style={{
                color: '#22c55e',
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
              {status === 'detected' ? 'Payment Detected!' : 'Confirming Transaction...'}
            </h3>
            <p style={{ color: 'var(--text-secondary, #cbd5e1)', margin: 0 }}>
              {status === 'detected'
                ? 'We found your payment. Confirming on the blockchain...'
                : 'Almost done. Finalizing your purchase...'}
            </p>
          </div>
        )}

        {/* Completed State */}
        {status === 'completed' && (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
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
              Payment Complete!
            </h3>
            <p style={{ color: 'var(--text-secondary, #cbd5e1)', margin: 0 }}>
              Your purchase is being processed...
            </p>
          </div>
        )}

        {/* Expired State */}
        {status === 'expired' && (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Clock
              size={48}
              style={{
                color: 'var(--text-muted, #94a3b8)',
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
              Payment Expired
            </h3>
            <p style={{ color: 'var(--text-secondary, #cbd5e1)', margin: '0 0 16px' }}>
              The payment window has expired. Please try again.
            </p>
            <button
              onClick={onCancel}
              style={{
                padding: '12px 24px',
                backgroundColor: 'var(--accent, #3b82f6)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '15px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Start Over
            </button>
          </div>
        )}

        {/* Error State */}
        {status === 'error' && (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
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
                  paymentApi.initiateDirectCrypto(intentId).then((response) => {
                    setPaymentData(response);
                    setTimeRemaining(response.expires_in_seconds);
                    setStatus('awaiting');
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
                }}
              >
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
          </div>
        )}
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

export default DirectCryptoPaymentModal;
