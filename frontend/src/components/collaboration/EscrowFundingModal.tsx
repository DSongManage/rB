/**
 * EscrowFundingModal Component
 *
 * Modal for project owner to fund escrow for a collaborator.
 * Uses the payment intent flow (same as cart checkout):
 * 1. Create escrow intent → check balance
 * 2. Show payment options (balance, Coinbase onramp, direct crypto)
 * 3. Process payment through selected method
 */

import React, { useState, useEffect } from 'react';
import { X, DollarSign, Shield, Lock, AlertTriangle, Loader2, CheckCircle, Wallet } from 'lucide-react';
import paymentApi from '../../services/paymentApi';
import { PurchaseIntentResponse } from '../../services/paymentApi';

interface EscrowFundingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFunded: () => void;
  projectId: number;
  collaborator: {
    id: number;
    username: string;
    display_name?: string;
    effective_role_name?: string;
    contract_type: string;
    total_contract_amount: string;
    escrow_funded_amount: string;
    tasks_total: number;
  };
}

type Step = 'loading' | 'options' | 'confirming' | 'signing' | 'processing' | 'success' | 'error';

export function EscrowFundingModal({
  isOpen,
  onClose,
  onFunded,
  projectId,
  collaborator,
}: EscrowFundingModalProps) {
  const [step, setStep] = useState<Step>('loading');
  const [intent, setIntent] = useState<PurchaseIntentResponse | null>(null);
  const [error, setError] = useState('');

  const totalAmount = parseFloat(collaborator.total_contract_amount) || 0;
  const alreadyFunded = parseFloat(collaborator.escrow_funded_amount) || 0;
  const amountToFund = totalAmount - alreadyFunded;
  const displayName = collaborator.display_name || collaborator.username;
  const roleName = collaborator.effective_role_name || 'Collaborator';

  // Create escrow funding intent on open
  useEffect(() => {
    if (!isOpen) {
      setStep('loading');
      setIntent(null);
      setError('');
      return;
    }

    const createIntent = async () => {
      setStep('loading');
      setError('');
      try {
        const response = await paymentApi.createEscrowIntent(projectId, collaborator.id);
        setIntent(response);
        setStep('options');
      } catch (err: any) {
        setError(err.message || 'Failed to create escrow funding intent');
        setStep('error');
      }
    };

    createIntent();
  }, [isOpen, projectId, collaborator.id]);

  if (!isOpen) return null;

  const handleSelectPaymentMethod = async (method: 'balance' | 'coinbase' | 'direct_crypto') => {
    if (!intent) return;

    setError('');

    if (method === 'balance') {
      setStep('confirming');
    } else if (method === 'coinbase') {
      // For Coinbase, select method then redirect to onramp
      try {
        await paymentApi.selectPaymentMethod(intent.intent_id, 'coinbase');
        // TODO: Open CoinbaseOnrampWidget
        setError('Coinbase onramp coming soon. Please use balance payment for now.');
        setStep('options');
      } catch (err: any) {
        setError(err.message || 'Failed to select payment method');
      }
    } else {
      setError('Direct crypto payment coming soon. Please use balance payment for now.');
    }
  };

  const handleConfirmBalancePayment = async () => {
    if (!intent) return;

    setStep('signing');
    setError('');

    try {
      // Select balance method
      await paymentApi.selectPaymentMethod(intent.intent_id, 'balance');

      // Get the sponsored transaction to sign
      const balanceResponse = await paymentApi.payWithBalance(intent.intent_id);

      // Sign with Web3Auth wallet
      const { signMessageForSponsoredTx } = await import('../../services/web3authService');
      const { signedTransaction, userSignatureIndex } = await signMessageForSponsoredTx(
        balanceResponse.serialized_transaction
      );

      setStep('processing');

      // Submit signed transaction
      const result = await paymentApi.submitSponsoredPayment(
        intent.intent_id,
        signedTransaction,
        userSignatureIndex
      );

      setStep('success');

      // Refresh project data after short delay
      setTimeout(() => {
        onFunded();
        onClose();
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Payment failed');
      setStep('error');
    }
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.7)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#1e293b', borderRadius: 16, padding: 24,
          width: '100%', maxWidth: 440,
          border: '1px solid #334155',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', marginBottom: 20,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Shield size={20} style={{ color: '#8b5cf6' }} />
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#e2e8f0' }}>
              Fund Escrow
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#64748b', padding: 4,
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Contract details */}
        <div style={{
          background: '#0f172a', borderRadius: 12,
          padding: 16, marginBottom: 16,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ color: '#94a3b8', fontSize: 13 }}>Collaborator</span>
            <span style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 500 }}>@{collaborator.username}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ color: '#94a3b8', fontSize: 13 }}>Role</span>
            <span style={{ color: '#e2e8f0', fontSize: 13 }}>{roleName}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ color: '#94a3b8', fontSize: 13 }}>Milestones</span>
            <span style={{ color: '#e2e8f0', fontSize: 13 }}>{collaborator.tasks_total} tasks</span>
          </div>
          <div style={{
            borderTop: '1px solid #334155', paddingTop: 12,
            display: 'flex', justifyContent: 'space-between',
          }}>
            <span style={{ color: '#e2e8f0', fontSize: 14, fontWeight: 600 }}>Amount to Fund</span>
            <span style={{
              color: '#10b981', fontSize: 18, fontWeight: 700,
              display: 'flex', alignItems: 'center', gap: 2,
            }}>
              <DollarSign size={16} />
              {amountToFund.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Step: Loading */}
        {step === 'loading' && (
          <div style={{ textAlign: 'center', padding: 24, color: '#94a3b8' }}>
            <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
            <div>Checking your balance...</div>
          </div>
        )}

        {/* Step: Payment Options */}
        {step === 'options' && intent && (
          <>
            {/* Balance info */}
            <div style={{
              background: '#0f172a', borderRadius: 8, padding: 12, marginBottom: 16,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Wallet size={16} style={{ color: '#94a3b8' }} />
                <span style={{ color: '#94a3b8', fontSize: 13 }}>Your Balance</span>
              </div>
              <span style={{
                color: intent.balance.sufficient ? '#10b981' : '#f59e0b',
                fontSize: 15, fontWeight: 700,
              }}>
                {intent.balance.display}
              </span>
            </div>

            {/* Payment options */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              {intent.payment_options.map((option) => (
                <button
                  key={option.method}
                  onClick={() => handleSelectPaymentMethod(option.method as any)}
                  disabled={!option.available}
                  style={{
                    padding: '14px 16px', borderRadius: 10,
                    background: option.primary ? 'linear-gradient(135deg, #8b5cf6, #6366f1)' : '#0f172a',
                    border: option.primary ? 'none' : '1px solid #334155',
                    color: option.available ? '#fff' : '#64748b',
                    cursor: option.available ? 'pointer' : 'not-allowed',
                    textAlign: 'left',
                    opacity: option.available ? 1 : 0.5,
                  }}
                >
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{option.label}</div>
                  <div style={{ fontSize: 12, color: option.primary ? '#c4b5fd' : '#64748b', marginTop: 2 }}>
                    {option.description}
                  </div>
                </button>
              ))}
            </div>

            {/* Info notice */}
            <div style={{
              background: '#1e3a5f', borderRadius: 8,
              padding: 12, display: 'flex', gap: 10,
              fontSize: 12, color: '#93c5fd', lineHeight: 1.5,
            }}>
              <Lock size={16} style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <strong>Funds go to an on-chain escrow vault.</strong> renaissBlock never holds your funds.
                They are released to {displayName} as milestones are completed.
                A 3% service fee applies when milestone payments are released.
              </div>
            </div>
          </>
        )}

        {/* Step: Confirm Balance Payment */}
        {step === 'confirming' && (
          <div style={{ textAlign: 'center', padding: 16 }}>
            <div style={{ fontSize: 14, color: '#e2e8f0', marginBottom: 16 }}>
              Confirm payment of <strong style={{ color: '#10b981' }}>${amountToFund.toFixed(2)}</strong> from your balance to fund escrow for @{collaborator.username}?
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setStep('options')}
                style={{
                  flex: 1, padding: '10px 16px', borderRadius: 8,
                  background: '#334155', border: 'none',
                  color: '#e2e8f0', fontSize: 13, cursor: 'pointer',
                }}
              >
                Back
              </button>
              <button
                onClick={handleConfirmBalancePayment}
                style={{
                  flex: 1, padding: '10px 16px', borderRadius: 8,
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}
              >
                Confirm & Sign
              </button>
            </div>
          </div>
        )}

        {/* Step: Signing */}
        {step === 'signing' && (
          <div style={{ textAlign: 'center', padding: 24, color: '#94a3b8' }}>
            <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
            <div>Please approve the transaction in your wallet...</div>
          </div>
        )}

        {/* Step: Processing */}
        {step === 'processing' && (
          <div style={{ textAlign: 'center', padding: 24, color: '#94a3b8' }}>
            <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
            <div>Processing escrow funding on Solana...</div>
          </div>
        )}

        {/* Step: Success */}
        {step === 'success' && (
          <div style={{ textAlign: 'center', padding: 24 }}>
            <CheckCircle size={48} style={{ color: '#10b981', margin: '0 auto 12px' }} />
            <div style={{ color: '#10b981', fontSize: 16, fontWeight: 600 }}>
              Escrow Funded!
            </div>
            <div style={{ color: '#94a3b8', fontSize: 13, marginTop: 8 }}>
              ${amountToFund.toFixed(2)} is now locked in escrow for @{collaborator.username}.
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{
            background: '#7f1d1d30', borderRadius: 8,
            padding: 10, marginTop: 16,
            display: 'flex', gap: 8, alignItems: 'center',
            fontSize: 12, color: '#f87171',
          }}>
            <AlertTriangle size={14} />
            {error}
          </div>
        )}

        {/* Step: Error with retry */}
        {step === 'error' && !error && (
          <div style={{ textAlign: 'center', padding: 16 }}>
            <AlertTriangle size={32} style={{ color: '#ef4444', margin: '0 auto 12px' }} />
            <div style={{ color: '#ef4444', fontSize: 14, marginBottom: 16 }}>Something went wrong</div>
            <button
              onClick={() => { setError(''); setStep('loading'); }}
              style={{
                padding: '10px 24px', borderRadius: 8,
                background: '#334155', border: 'none',
                color: '#e2e8f0', fontSize: 13, cursor: 'pointer',
              }}
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
