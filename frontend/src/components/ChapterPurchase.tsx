/**
 * ChapterPurchase Component
 *
 * Displays chapter purchase UI with transparent revenue breakdown.
 * Shows buyers exactly what they're paying and where it goes:
 * - Chapter price (set by creator) = what buyer pays
 * - Creator receives their share (based on platform fee tier)
 * - Platform receives its fee
 */

import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, FlaskConical } from 'lucide-react';
import { useBetaMode } from '../hooks/useBetaMode';
import { API_URL } from '../config';
import AddToCartButton from './AddToCartButton';
import { useBalance } from '../contexts/BalanceContext';

interface PaymentBreakdown {
  chapter_price: string;
  buyer_total: string;
  creator_receives: string;
  platform_receives: string;
  platform_fee_percent: string;
  gas_fee: string;
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
  const [breakdown, setBreakdown] = useState<PaymentBreakdown | null>(null);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const { isTestMode } = useBetaMode();
  const { displayBalance, getBalanceNumber, syncStatus, isBalanceSufficient } = useBalance();

  // Buyer pays exactly the chapter price
  const buyerTotal = chapterPrice;
  const balanceAfterPurchase = getBalanceNumber() - buyerTotal;
  const canAfford = isBalanceSufficient(buyerTotal);

  useEffect(() => {
    fetchBreakdown();
  }, [chapterPrice]);

  async function fetchBreakdown() {
    try {
      const res = await fetch(`${API_URL}/api/checkout/fee-breakdown/?chapter_price=${chapterPrice}`, {
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

      {/* Price */}
      <div style={{
        padding: '16px',
        backgroundColor: '#1e293b',
        borderRadius: '8px',
        border: '1px solid #334155',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
          <span style={{ fontSize: '16px', fontWeight: 600 }}>Price:</span>
          <span style={{ fontSize: '20px', fontWeight: 700, color: '#3b82f6' }}>
            ${chapterPrice.toFixed(2)}
          </span>
        </div>

        {/* Breakdown Toggle */}
        {breakdown && (
          <>
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
              {showBreakdown ? <><ChevronDown size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /> Hide breakdown</> : <><ChevronRight size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /> See where your money goes</>}
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
                  <span style={{ color: '#94a3b8' }}>Creator receives:</span>
                  <span style={{ fontWeight: 500, color: '#10b981' }}>{breakdown.creator_receives}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ color: '#94a3b8' }}>Platform fee ({breakdown.platform_fee_percent}):</span>
                  <span style={{ fontWeight: 500 }}>{breakdown.platform_receives}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94a3b8' }}>Network fee:</span>
                  <span style={{ fontWeight: 500 }}>{breakdown.gas_fee}</span>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Balance Preview - Only show if wallet connected */}
      {syncStatus !== 'no_wallet' && (
        <div style={{
          padding: '12px 16px',
          backgroundColor: canAfford ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
          border: `1px solid ${canAfford ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
          borderRadius: '8px',
          fontSize: '14px',
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: '8px'
          }}>
            <span style={{ color: '#94a3b8' }}>Current balance:</span>
            <span style={{ fontWeight: 500 }}>{displayBalance || '$0.00'}</span>
          </div>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            paddingTop: '8px',
            borderTop: `1px solid ${canAfford ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
          }}>
            <span style={{ color: canAfford ? '#10b981' : '#f87171', fontWeight: 500 }}>
              Balance after purchase:
            </span>
            <span style={{
              fontWeight: 600,
              color: canAfford ? '#10b981' : '#ef4444'
            }}>
              ${balanceAfterPurchase >= 0 ? balanceAfterPurchase.toFixed(2) : '0.00'}
              {!canAfford && ' (insufficient)'}
            </span>
          </div>
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
              The creator receives <strong>{breakdown.creator_receives}</strong> of your purchase.
              No hidden fees — what you see is what you pay.
            </>
          )}
        </div>
      </div>

      {/* Add to Cart Button */}
      <AddToCartButton
        chapterId={chapterId}
        price={chapterPrice.toFixed(2)}
        alreadyOwned={false}
      />

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
          <strong><FlaskConical size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> Test Mode:</strong> Solana devnet - No real transactions
        </div>
      )}

      {/* Help Text */}
      <div style={{
        fontSize: '12px',
        color: '#64748b',
        textAlign: 'center',
        lineHeight: '1.4',
      }}>
        Paid with USDC from your wallet balance
      </div>
    </div>
  );
}
