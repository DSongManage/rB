import React from 'react';

interface BetaBadgeProps {
  variant?: 'header' | 'inline' | 'full';
  showTestMode?: boolean;
}

export function BetaBadge({ variant = 'header', showTestMode = true }: BetaBadgeProps) {
  if (variant === 'header') {
    return (
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
          padding: '4px 12px',
          borderRadius: '6px',
          fontSize: '12px',
          fontWeight: 700,
          color: '#000',
          letterSpacing: '0.5px',
          boxShadow: '0 2px 8px rgba(245, 158, 11, 0.3)',
        }}
      >
        <span>BETA</span>
        {showTestMode && (
          <span
            style={{
              background: 'rgba(0, 0, 0, 0.2)',
              padding: '2px 6px',
              borderRadius: '4px',
              fontSize: '10px',
            }}
          >
            TEST MODE
          </span>
        )}
      </div>
    );
  }

  if (variant === 'inline') {
    return (
      <span
        style={{
          display: 'inline-block',
          background: '#f59e0b',
          color: '#000',
          padding: '2px 8px',
          borderRadius: '4px',
          fontSize: '11px',
          fontWeight: 700,
          letterSpacing: '0.5px',
          marginLeft: '8px',
        }}
      >
        BETA
      </span>
    );
  }

  if (variant === 'full') {
    return (
      <div
        style={{
          background: 'linear-gradient(135deg, #f59e0b15 0%, #d9770615 100%)',
          border: '1px solid #f59e0b40',
          borderRadius: '12px',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
        }}
      >
        <div
          style={{
            background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
            padding: '8px 16px',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: 700,
            color: '#000',
            letterSpacing: '0.5px',
            whiteSpace: 'nowrap',
          }}
        >
          BETA
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '14px', fontWeight: 600, color: '#e5e7eb', marginBottom: '4px' }}>
            You're in the Beta!
          </div>
          <div style={{ fontSize: '13px', color: '#94a3b8', lineHeight: 1.4 }}>
            Help us improve by{' '}
            <a
              href="mailto:feedback@renaissblock.com"
              style={{
                color: '#f59e0b',
                textDecoration: 'none',
                fontWeight: 600,
              }}
            >
              sharing feedback
            </a>
            . All transactions are in test mode.
          </div>
        </div>
      </div>
    );
  }

  return null;
}

export function TestModeBanner() {
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: 'linear-gradient(90deg, #f59e0b 0%, #d97706 100%)',
        color: '#000',
        padding: '12px 20px',
        textAlign: 'center',
        fontSize: '13px',
        fontWeight: 600,
        zIndex: 1000,
        boxShadow: '0 -2px 10px rgba(0, 0, 0, 0.3)',
      }}
    >
      🧪 <strong>TEST MODE:</strong> No real money charged. Blockchain transactions use Solana devnet.
      {' '}
      <a
        href="mailto:feedback@renaissblock.com"
        style={{
          color: '#000',
          textDecoration: 'underline',
          fontWeight: 700,
          marginLeft: '8px',
        }}
      >
        Report Issues
      </a>
    </div>
  );
}

export function BetaWelcomeModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#1a1f2e',
          border: '1px solid #2a3444',
          borderRadius: '16px',
          padding: '32px',
          maxWidth: '500px',
          width: '100%',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div
            style={{
              display: 'inline-block',
              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              padding: '12px 24px',
              borderRadius: '12px',
              fontSize: '18px',
              fontWeight: 700,
              color: '#000',
              letterSpacing: '1px',
              marginBottom: '16px',
            }}
          >
            BETA TESTER
          </div>
          <h2 style={{ fontSize: '24px', fontWeight: 700, color: '#e5e7eb', margin: '0 0 8px 0' }}>
            Welcome to renaissBlock Beta!
          </h2>
          <p style={{ fontSize: '14px', color: '#94a3b8', margin: 0 }}>
            You're one of the first creators to experience the future
          </p>
        </div>

        {/* Content */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#f59e0b', marginBottom: '8px' }}>
              🧪 Test Mode Active
            </div>
            <ul style={{ fontSize: '13px', color: '#cbd5e1', margin: '0', paddingLeft: '20px', lineHeight: 1.6 }}>
              <li>No real money charged (use test card: 4242 4242 4242 4242)</li>
              <li>Blockchain features use Solana devnet (fake SOL)</li>
              <li>Some features still being polished</li>
            </ul>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#f59e0b', marginBottom: '8px' }}>
              💡 What to Try
            </div>
            <ul style={{ fontSize: '13px', color: '#cbd5e1', margin: '0', paddingLeft: '20px', lineHeight: 1.6 }}>
              <li>Create and publish your first content</li>
              <li>Collaborate with other beta testers</li>
              <li>Test the purchase and reading experience</li>
            </ul>
          </div>

          <div
            style={{
              background: '#f59e0b20',
              border: '1px solid #f59e0b40',
              borderRadius: '8px',
              padding: '12px',
              marginTop: '16px',
            }}
          >
            <div style={{ fontSize: '13px', color: '#fbbf24', fontWeight: 600, marginBottom: '4px' }}>
              🎁 Beta Perks
            </div>
            <p style={{ fontSize: '12px', color: '#cbd5e1', margin: 0, lineHeight: 1.5 }}>
              As a beta tester, you'll get early access to new features and special recognition when we launch!
            </p>
          </div>
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center' }}>
          <button
            onClick={onClose}
            style={{
              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              color: '#000',
              border: 'none',
              padding: '12px 32px',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 700,
              cursor: 'pointer',
              width: '100%',
              marginBottom: '12px',
            }}
          >
            Let's Go! 🚀
          </button>
          <div style={{ fontSize: '12px', color: '#64748b' }}>
            Questions?{' '}
            <a
              href="mailto:feedback@renaissblock.com"
              style={{ color: '#f59e0b', textDecoration: 'none', fontWeight: 600 }}
            >
              feedback@renaissblock.com
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
