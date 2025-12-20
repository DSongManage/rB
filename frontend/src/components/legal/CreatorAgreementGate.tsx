/**
 * Creator Agreement Gate component.
 * Wraps publishing functionality and ensures user has accepted the creator agreement.
 */

import React, { useState, useEffect } from 'react';
import { useCreatorAgreement } from '../../hooks/useLegalAcceptance';
import { CreatorAgreementModal } from './CreatorAgreementModal';

interface CreatorAgreementGateProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onAccepted?: () => void;
}

/**
 * Wraps content that requires creator agreement acceptance.
 * Shows modal if not accepted, otherwise renders children.
 */
export function CreatorAgreementGate({
  children,
  fallback,
  onAccepted,
}: CreatorAgreementGateProps) {
  const { loading, hasAccepted, refresh } = useCreatorAgreement();
  const [showModal, setShowModal] = useState(false);

  // Show modal if not accepted
  useEffect(() => {
    if (!loading && !hasAccepted) {
      setShowModal(true);
    }
  }, [loading, hasAccepted]);

  const handleAccept = () => {
    setShowModal(false);
    refresh();
    onAccepted?.();
  };

  const handleClose = () => {
    setShowModal(false);
    // If user closes without accepting, they'll see the fallback
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 48,
        color: 'var(--text-muted, #94a3b8)',
      }}>
        Checking agreement status...
      </div>
    );
  }

  // If accepted, render children
  if (hasAccepted) {
    return <>{children}</>;
  }

  // Show modal + fallback while not accepted
  return (
    <>
      <CreatorAgreementModal
        isOpen={showModal}
        onClose={handleClose}
        onAccept={handleAccept}
      />
      {fallback || (
        <div style={{
          padding: 48,
          textAlign: 'center',
          background: 'var(--bg-secondary, #1e293b)',
          borderRadius: 12,
          margin: 24,
        }}>
          <h2 style={{
            fontSize: 20,
            fontWeight: 700,
            color: 'var(--text, #e5e7eb)',
            marginBottom: 12,
          }}>
            Creator Agreement Required
          </h2>
          <p style={{
            fontSize: 14,
            color: 'var(--text-muted, #94a3b8)',
            marginBottom: 24,
          }}>
            You need to accept the Creator Agreement before publishing content.
          </p>
          <button
            onClick={() => setShowModal(true)}
            style={{
              padding: '12px 24px',
              borderRadius: 8,
              border: 'none',
              background: 'var(--accent, #f59e0b)',
              color: '#000',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Review Creator Agreement
          </button>
        </div>
      )}
    </>
  );
}

/**
 * Hook to check and prompt for creator agreement.
 * Useful for programmatic checks before publishing.
 */
export function useCreatorAgreementGate() {
  const { loading, hasAccepted, accept, refresh } = useCreatorAgreement();
  const [showModal, setShowModal] = useState(false);
  const [onAcceptCallback, setOnAcceptCallback] = useState<(() => void) | null>(null);

  const requireAgreement = (onAccept?: () => void): boolean => {
    if (hasAccepted) {
      onAccept?.();
      return true;
    }

    // Store callback and show modal
    if (onAccept) {
      setOnAcceptCallback(() => onAccept);
    }
    setShowModal(true);
    return false;
  };

  const handleAccept = async () => {
    const success = await accept();
    if (success) {
      setShowModal(false);
      onAcceptCallback?.();
      setOnAcceptCallback(null);
    }
  };

  const handleClose = () => {
    setShowModal(false);
    setOnAcceptCallback(null);
  };

  return {
    loading,
    hasAccepted,
    requireAgreement,
    modal: showModal ? (
      <CreatorAgreementModal
        isOpen={showModal}
        onClose={handleClose}
        onAccept={handleAccept}
      />
    ) : null,
  };
}

export default CreatorAgreementGate;
