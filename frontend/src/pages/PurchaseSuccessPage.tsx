import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';

export default function PurchaseSuccessPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState(5);

  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    // Countdown redirect to home
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      navigate('/');
    }
  }, [countdown, navigate]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '20px',
      textAlign: 'center',
      backgroundColor: '#f8fafc',
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '16px',
        padding: '48px',
        maxWidth: '500px',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
      }}>
        {/* Success Icon */}
        <div style={{
          width: '80px',
          height: '80px',
          margin: '0 auto 24px',
          backgroundColor: '#10b981',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>

        {/* Success Message */}
        <h1 style={{
          fontSize: '32px',
          fontWeight: 700,
          color: '#1e293b',
          marginBottom: '16px',
        }}>
          Purchase Successful!
        </h1>

        <p style={{
          fontSize: '16px',
          color: '#64748b',
          marginBottom: '24px',
          lineHeight: '1.6',
        }}>
          Thank you for your purchase. Your content is now available in your library.
        </p>

        {sessionId && (
          <div style={{
            backgroundColor: '#f1f5f9',
            borderRadius: '8px',
            padding: '12px',
            marginBottom: '24px',
          }}>
            <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>
              Session ID
            </p>
            <p style={{
              fontSize: '11px',
              color: '#94a3b8',
              fontFamily: 'monospace',
              wordBreak: 'break-all',
            }}>
              {sessionId}
            </p>
          </div>
        )}

        {/* Redirect countdown */}
        <p style={{
          fontSize: '14px',
          color: '#94a3b8',
          marginBottom: '24px',
        }}>
          Redirecting to home in {countdown} second{countdown !== 1 ? 's' : ''}...
        </p>

        {/* Action buttons */}
        <div style={{
          display: 'flex',
          gap: '12px',
          justifyContent: 'center',
        }}>
          <button
            onClick={() => navigate('/')}
            style={{
              padding: '12px 24px',
              fontSize: '16px',
              fontWeight: 600,
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
            }}
          >
            Go to Home
          </button>
          <button
            onClick={() => navigate('/dashboard')}
            style={{
              padding: '12px 24px',
              fontSize: '16px',
              fontWeight: 600,
              backgroundColor: 'white',
              color: '#3b82f6',
              border: '2px solid #3b82f6',
              borderRadius: '8px',
              cursor: 'pointer',
            }}
          >
            View Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
