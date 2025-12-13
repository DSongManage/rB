/**
 * ChapterPurchase Component
 *
 * Displays chapter purchase UI with transparent credit card fee breakdown.
 * Shows buyers exactly what they're paying and where it goes:
 * - Chapter price (set by creator)
 * - Credit card processing fee
 * - Total amount charged
 * - Creator receives 90% of chapter price
 */

import React, { useState, useEffect } from 'react';
import { useBetaMode } from '../hooks/useBetaMode';

interface PaymentBreakdown {
  chapter_price: string;
  credit_card_fee: string;
  buyer_total: string;
  creator_receives: string;
  platform_receives: string;
}

interface ChapterPurchaseProps {
  chapterId: number;
  chapterTitle: string;
  chapterPrice: number;
  alreadyOwned?: boolean;
  onPurchaseComplete?: () => void;
}

export default function ChapterPurchase({
  chapterId,
  chapterTitle,
  chapterPrice,
  alreadyOwned = false,
  onPurchaseComplete,
}: ChapterPurchaseProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [breakdown, setBreakdown] = useState<PaymentBreakdown | null>(null);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const { isTestMode } = useBetaMode();

  useEffect(() => {
    // Calculate fee breakdown when component mounts
    fetchBreakdown();
  }, [chapterPrice]);

  async function fetchBreakdown() {
    try {
      const res = await fetch(`/api/checkout/fee-breakdown/?chapter_price=${chapterPrice}`, {
        credentials: 'include',
      });

      if (res.ok) {
        const data = await res.json();
        setBreakdown(data.breakdown_display);
      }
    } catch (e) {
      console.error('Failed to fetch fee breakdown:', e);
    }
  }

  async function handlePurchase() {
    setLoading(true);
    setError(null);

    try {
      // Get CSRF token
      const csrfToken = await fetch('/api/auth/csrf/', { credentials: 'include' })
        .then(r => r.json())
        .then(j => j?.csrfToken || '');

      // Create Stripe checkout session
      const res = await fetch('/api/checkout/session/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrfToken,
        },
        credentials: 'include',
        body: JSON.stringify({ chapter_id: chapterId }),
      });

      const data = await res.json();

      if (!res.ok) {
        // Handle specific error codes
        if (data?.code === 'ALREADY_OWNED') {
          throw new Error('You already own this chapter');
        } else if (data?.code === 'STRIPE_ERROR') {
          throw new Error('Payment system error. Please try again.');
        } else {
          throw new Error(data?.error || 'Checkout failed');
        }
      }

      // Redirect to Stripe Checkout
      if (data?.checkout_url) {
        window.location.href = data.checkout_url;
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (e: any) {
      setError(e?.message || 'Checkout failed');
      setLoading(false);
    }
  }

  if (alreadyOwned) {
    return (
      <div style={{
        padding: '16px',
        backgroundColor: '#064e3b',
        border: '1px solid #10b981',
        borderRadius: '12px',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: '16px', fontWeight: 600, color: '#10b981', marginBottom: '4px' }}>
          ✓ Owned
        </div>
        <div style={{ fontSize: '14px', color: '#6ee7b7' }}>
          You already own this chapter
        </div>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '16px',
      padding: '20px',
      backgroundColor: '#0f172a',
      border: '1px solid #1e293b',
      borderRadius: '12px',
    }}>
      {/* Header */}
      <div>
        <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>
          Purchase Chapter
        </h3>
        <p style={{ fontSize: '14px', color: '#94a3b8', margin: 0 }}>
          {chapterTitle}
        </p>
      </div>

      {/* Price Summary */}
      {breakdown && (
        <div style={{
          padding: '16px',
          backgroundColor: '#1e293b',
          borderRadius: '8px',
          border: '1px solid #334155',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '16px', fontWeight: 600 }}>You'll pay:</span>
            <span style={{ fontSize: '20px', fontWeight: 700, color: '#3b82f6' }}>
              {breakdown.buyer_total}
            </span>
          </div>

          {/* Breakdown Toggle */}
          <button
            onClick={() => setShowBreakdown(!showBreakdown)}
            style={{
              width: '100%',
              padding: '8px',
              backgroundColor: '#334155',
              border: 'none',
              borderRadius: '6px',
              color: '#94a3b8',
              fontSize: '13px',
              cursor: 'pointer',
              transition: 'background-color 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#475569';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#334155';
            }}
          >
            {showBreakdown ? '▼ Hide breakdown' : '▶ See price breakdown'}
          </button>

          {/* Expanded Breakdown */}
          {showBreakdown && (
            <div style={{
              marginTop: '16px',
              paddingTop: '16px',
              borderTop: '1px solid #334155',
              fontSize: '14px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: '#94a3b8' }}>Chapter price:</span>
                <span style={{ fontWeight: 500 }}>{breakdown.chapter_price}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: '#94a3b8' }}>Credit card fee:</span>
                <span style={{ fontWeight: 500 }}>{breakdown.credit_card_fee}</span>
              </div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                paddingTop: '8px',
                borderTop: '1px solid #334155',
                fontWeight: 600,
              }}>
                <span>Total:</span>
                <span style={{ color: '#3b82f6' }}>{breakdown.buyer_total}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Creator Transparency */}
      <div style={{
        padding: '12px',
        backgroundColor: '#1e3a1e',
        border: '1px solid #10b981',
        borderRadius: '8px',
        fontSize: '13px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
          <span style={{ fontSize: '16px' }}>✨</span>
          <span style={{ fontWeight: 600, color: '#10b981' }}>Supporting the Creator</span>
        </div>
        <div style={{ color: '#6ee7b7', lineHeight: '1.5' }}>
          {breakdown && (
            <>
              The creator receives <strong>{breakdown.creator_receives}</strong> (90% of the chapter price).
              The credit card fee is passed to you so creators get their full share.
            </>
          )}
        </div>
      </div>

      {/* Purchase Button */}
      <button
        onClick={handlePurchase}
        disabled={loading}
        style={{
          padding: '14px 24px',
          fontSize: '16px',
          fontWeight: 600,
          backgroundColor: loading ? '#64748b' : '#3b82f6',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          cursor: loading ? 'not-allowed' : 'pointer',
          transition: 'background-color 0.2s',
        }}
        onMouseEnter={(e) => {
          if (!loading) {
            e.currentTarget.style.backgroundColor = '#2563eb';
          }
        }}
        onMouseLeave={(e) => {
          if (!loading) {
            e.currentTarget.style.backgroundColor = '#3b82f6';
          }
        }}
      >
        {loading ? 'Processing...' : `Purchase for ${breakdown?.buyer_total || `$${chapterPrice.toFixed(2)}`}`}
      </button>

      {/* Error Message */}
      {error && (
        <div style={{
          padding: '12px 16px',
          backgroundColor: '#7f1d1d',
          border: '1px solid #ef4444',
          color: '#fecaca',
          borderRadius: '8px',
          fontSize: '14px',
        }}>
          {error}
        </div>
      )}

      {/* Test Mode Warning */}
      {isTestMode && (
        <div style={{
          padding: '12px',
          backgroundColor: '#422006',
          border: '1px solid #f59e0b',
          borderRadius: '8px',
          fontSize: '13px',
          color: '#fbbf24',
          textAlign: 'center',
        }}>
          <strong>🧪 Test Mode:</strong> Use card 4242 4242 4242 4242 - No real charges
        </div>
      )}

      {/* Help Text */}
      <div style={{
        fontSize: '12px',
        color: '#64748b',
        textAlign: 'center',
        lineHeight: '1.4',
      }}>
        Secure payment via Stripe • NFT ownership recorded on blockchain
      </div>
    </div>
  );
}
