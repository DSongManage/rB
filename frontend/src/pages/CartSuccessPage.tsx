/**
 * Cart Success Page Component
 *
 * Displayed after successful batch/cart purchase.
 * Shows purchase status and minting progress.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, Package, Loader2, Home, BookOpen, ArrowRight } from 'lucide-react';
import { useCart } from '../contexts/CartContext';

export default function CartSuccessPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { refreshCart } = useCart();
  const [countdown, setCountdown] = useState(10);

  const sessionId = searchParams.get('session_id');

  // Refresh cart to clear it after successful purchase
  useEffect(() => {
    refreshCart();
  }, [refreshCart]);

  // Auto-redirect countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          navigate('/');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [navigate]);

  return (
    <div style={{
      maxWidth: '600px',
      margin: '0 auto',
      padding: '60px 20px',
      textAlign: 'center',
    }}>
      {/* Success Animation */}
      <div style={{
        width: '80px',
        height: '80px',
        borderRadius: '50%',
        backgroundColor: 'var(--bg-success, #052e16)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto 24px',
        animation: 'pulse 2s ease-in-out infinite',
      }}>
        <CheckCircle size={40} style={{ color: 'var(--text-success, #4ade80)' }} />
      </div>

      <h1 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '12px' }}>
        Purchase Successful!
      </h1>

      <p style={{
        color: 'var(--text-muted, #94a3b8)',
        fontSize: '16px',
        marginBottom: '32px',
        lineHeight: '1.6',
      }}>
        Thank you for your purchase. Your NFTs are being minted and will appear in your library shortly.
      </p>

      {/* Status Card */}
      <div style={{
        padding: '24px',
        backgroundColor: 'var(--bg-secondary, #1e293b)',
        borderRadius: '16px',
        border: '1px solid var(--border, #334155)',
        marginBottom: '32px',
        textAlign: 'left',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <div style={{
            padding: '8px',
            backgroundColor: 'var(--bg-info, #1e3a5f)',
            borderRadius: '8px',
          }}>
            <Package size={20} style={{ color: 'var(--text-info, #60a5fa)' }} />
          </div>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '2px' }}>
              Processing Your Purchase
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted, #94a3b8)' }}>
              Minting NFTs to your wallet
            </p>
          </div>
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '12px 16px',
          backgroundColor: 'var(--bg-tertiary, #0f172a)',
          borderRadius: '8px',
          fontSize: '14px',
        }}>
          <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
          <span style={{ color: 'var(--text-muted, #94a3b8)' }}>
            Your NFTs are being minted on Solana...
          </span>
        </div>

        {sessionId && (
          <div style={{
            marginTop: '16px',
            padding: '10px 12px',
            backgroundColor: 'var(--bg-tertiary, #0f172a)',
            borderRadius: '6px',
            fontSize: '12px',
            color: 'var(--text-muted, #64748b)',
          }}>
            Session: {sessionId.substring(0, 20)}...
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <button
          onClick={() => navigate('/profile')}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            padding: '16px 24px',
            backgroundColor: 'var(--accent, #3b82f6)',
            color: 'white',
            border: 'none',
            borderRadius: '10px',
            fontSize: '16px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <BookOpen size={20} />
          Go to My Library
          <ArrowRight size={18} />
        </button>

        <button
          onClick={() => navigate('/')}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            padding: '14px 24px',
            backgroundColor: 'transparent',
            color: 'var(--text-muted, #94a3b8)',
            border: '1px solid var(--border, #334155)',
            borderRadius: '10px',
            fontSize: '15px',
            cursor: 'pointer',
          }}
        >
          <Home size={18} />
          Back to Home
        </button>
      </div>

      {/* Auto-redirect notice */}
      <p style={{
        marginTop: '32px',
        fontSize: '13px',
        color: 'var(--text-muted, #64748b)',
      }}>
        Redirecting to home in {countdown} seconds...
      </p>

      {/* CSS for animations */}
      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.05); opacity: 0.9; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
