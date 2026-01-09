/**
 * PaymentOptionsSelector Component
 *
 * Shows payment options based on user's balance:
 * - "Pay with renaissBlock Balance" (if sufficient) - Primary
 * - "Add Funds with Card" (Coinbase) - Shows $5 min explainer
 * - "Pay with Crypto Wallet" - Secondary option
 */

import React, { useState } from 'react';
import { Wallet, CreditCard, QrCode, Check, ChevronRight, Info } from 'lucide-react';
import type { PaymentOption, PurchaseIntentResponse } from '../../services/paymentApi';

interface PaymentOptionsSelectorProps {
  intent: PurchaseIntentResponse;
  onSelect: (method: 'balance' | 'coinbase' | 'direct_crypto') => void;
  loading?: boolean;
  selectedMethod?: string | null;
}

export function PaymentOptionsSelector({
  intent,
  onSelect,
  loading = false,
  selectedMethod = null,
}: PaymentOptionsSelectorProps) {
  const [showExplainer, setShowExplainer] = useState(false);

  // Find the Coinbase option for the explainer
  const coinbaseOption = intent.payment_options.find(opt => opt.method === 'coinbase');

  // Get icon for payment method
  const getIcon = (method: string) => {
    switch (method) {
      case 'balance':
        return <Wallet size={20} />;
      case 'coinbase':
        return <CreditCard size={20} />;
      case 'direct_crypto':
        return <QrCode size={20} />;
      default:
        return <Wallet size={20} />;
    }
  };

  // Get background color based on method and state
  const getOptionStyle = (option: PaymentOption, isSelected: boolean) => {
    const baseStyle: React.CSSProperties = {
      display: 'flex',
      alignItems: 'center',
      gap: '14px',
      padding: '16px',
      borderRadius: '12px',
      cursor: option.available && !loading ? 'pointer' : 'not-allowed',
      opacity: option.available ? 1 : 0.5,
      transition: 'all 0.2s ease',
      border: '2px solid',
    };

    if (isSelected) {
      return {
        ...baseStyle,
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderColor: 'var(--accent, #3b82f6)',
      };
    }

    if (option.primary && option.available) {
      return {
        ...baseStyle,
        backgroundColor: 'rgba(59, 130, 246, 0.05)',
        borderColor: 'var(--border, #334155)',
      };
    }

    return {
      ...baseStyle,
      backgroundColor: 'var(--bg-secondary, #1e293b)',
      borderColor: 'var(--border, #334155)',
    };
  };

  return (
    <div className="rb-payment-options" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Balance info */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 16px',
          backgroundColor: 'var(--bg-tertiary, #0f172a)',
          borderRadius: '8px',
          fontSize: '14px',
        }}
      >
        <span style={{ color: 'var(--text-muted, #94a3b8)' }}>
          Current Balance
        </span>
        <span style={{ fontWeight: 600, color: 'var(--text-primary, #f1f5f9)' }}>
          {intent.balance.display}
        </span>
      </div>

      {/* Payment options */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {intent.payment_options.map((option) => {
          const isSelected = selectedMethod === option.method;

          return (
            <div key={option.method}>
              <button
                onClick={() => option.available && !loading && onSelect(option.method)}
                disabled={!option.available || loading}
                style={getOptionStyle(option, isSelected)}
              >
                {/* Icon */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '40px',
                    height: '40px',
                    borderRadius: '10px',
                    backgroundColor: isSelected
                      ? 'var(--accent, #3b82f6)'
                      : 'var(--bg-tertiary, #0f172a)',
                    color: isSelected ? 'white' : 'var(--text-muted, #94a3b8)',
                  }}
                >
                  {getIcon(option.method)}
                </div>

                {/* Content */}
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      marginBottom: '4px',
                    }}
                  >
                    <span
                      style={{
                        fontWeight: 600,
                        fontSize: '15px',
                        color: 'var(--text-primary, #f1f5f9)',
                      }}
                    >
                      {option.label}
                    </span>
                    {option.primary && option.available && (
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 500,
                          padding: '2px 6px',
                          borderRadius: '4px',
                          backgroundColor: 'rgba(34, 197, 94, 0.1)',
                          color: '#22c55e',
                        }}
                      >
                        Recommended
                      </span>
                    )}
                  </div>
                  <span
                    style={{
                      fontSize: '13px',
                      color: 'var(--text-muted, #94a3b8)',
                    }}
                  >
                    {option.description}
                  </span>
                </div>

                {/* Selection indicator */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '24px',
                    height: '24px',
                    borderRadius: '12px',
                    backgroundColor: isSelected
                      ? 'var(--accent, #3b82f6)'
                      : 'transparent',
                    border: isSelected
                      ? 'none'
                      : '2px solid var(--border, #334155)',
                  }}
                >
                  {isSelected && <Check size={14} color="white" />}
                </div>
              </button>

              {/* Coinbase $5 minimum explainer */}
              {option.method === 'coinbase' && option.explanation && (
                <div
                  style={{
                    marginTop: '8px',
                    marginLeft: '54px',
                    padding: '10px 12px',
                    backgroundColor: 'rgba(59, 130, 246, 0.05)',
                    borderRadius: '8px',
                    border: '1px solid rgba(59, 130, 246, 0.2)',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '8px',
                  }}
                >
                  <Info size={16} style={{ color: 'var(--accent, #3b82f6)', flexShrink: 0, marginTop: '2px' }} />
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary, #cbd5e1)', lineHeight: 1.5 }}>
                    {option.explanation}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Purchase total */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px',
          backgroundColor: 'var(--bg-tertiary, #0f172a)',
          borderRadius: '8px',
          marginTop: '8px',
          borderTop: '1px solid var(--border, #334155)',
        }}
      >
        <span style={{ fontWeight: 500, color: 'var(--text-primary, #f1f5f9)' }}>
          Total
        </span>
        <span style={{ fontWeight: 700, fontSize: '18px', color: 'var(--text-primary, #f1f5f9)' }}>
          {intent.display_total}
        </span>
      </div>

      {/* After purchase balance preview */}
      {intent.balance.sufficient && intent.balance.after_purchase && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '10px 16px',
            fontSize: '13px',
            color: 'var(--text-muted, #94a3b8)',
          }}
        >
          <span>Balance after purchase</span>
          <span style={{ fontWeight: 500 }}>
            ${parseFloat(intent.balance.after_purchase).toFixed(2)}
          </span>
        </div>
      )}
    </div>
  );
}

export default PaymentOptionsSelector;
