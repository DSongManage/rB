import React, { useState } from 'react';
import { useBetaMode } from '../hooks/useBetaMode';
import { API_URL } from '../config';

type Props = {
  contentId: number;
  price: number;
  editions: number;
};

export default function CheckoutButton({ contentId, price, editions }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isTestMode } = useBetaMode();

  async function onClick() {
    setLoading(true);
    setError(null);

    try {
      // Get CSRF token
      const csrfToken = await fetch(`${API_URL}/api/auth/csrf/`, { credentials: 'include' })
        .then(r => r.json())
        .then(j => j?.csrfToken || '');

      // Call backend to create Stripe checkout session
      const res = await fetch(`${API_URL}/api/checkout/session/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrfToken,
        },
        credentials: 'include',
        body: JSON.stringify({ content_id: contentId }),
      });

      const data = await res.json();

      if (!res.ok) {
        // Handle specific error codes from backend
        if (data?.code === 'NOT_MINTED') {
          throw new Error('Content not available for purchase');
        } else if (data?.code === 'SOLD_OUT') {
          throw new Error('This content is sold out');
        } else if (data?.code === 'ALREADY_OWNED') {
          throw new Error('You already own this content');
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
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Checkout failed');
      setLoading(false);
    }
  }

  // Disable if sold out or already loading
  const disabled = loading || editions <= 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <button
        onClick={onClick}
        disabled={disabled}
        style={{
          padding: '12px 24px',
          fontSize: '16px',
          fontWeight: 600,
          backgroundColor: disabled ? '#94a3b8' : '#3b82f6',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          cursor: disabled ? 'not-allowed' : 'pointer',
          transition: 'background-color 0.2s',
        }}
        onMouseEnter={(e) => {
          if (!disabled) {
            e.currentTarget.style.backgroundColor = '#2563eb';
          }
        }}
        onMouseLeave={(e) => {
          if (!disabled) {
            e.currentTarget.style.backgroundColor = '#3b82f6';
          }
        }}
      >
        {loading ? 'Processing...' : editions <= 0 ? 'Sold Out' : `Purchase for $${price.toFixed(2)}`}
      </button>

      {editions > 0 && (
        <div style={{ fontSize: '12px', color: '#64748b', textAlign: 'center' }}>
          {editions} edition{editions !== 1 ? 's' : ''} available
        </div>
      )}

      {error && (
        <div style={{
          padding: '8px 12px',
          backgroundColor: '#fee2e2',
          color: '#dc2626',
          borderRadius: '6px',
          fontSize: '14px',
        }}>
          {error}
        </div>
      )}

      {isTestMode && (
        <div style={{
          padding: '8px 12px',
          backgroundColor: '#fef3c7',
          color: '#92400e',
          borderRadius: '6px',
          fontSize: '12px',
          textAlign: 'center',
          border: '1px solid #fbbf24',
        }}>
          🧪 <strong>Test Mode:</strong> Use test card 4242 4242 4242 4242 - No real charges
        </div>
      )}
    </div>
  );
}
