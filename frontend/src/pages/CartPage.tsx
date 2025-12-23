/**
 * Cart Page Component
 *
 * Full shopping cart view with items, totals, savings, and checkout.
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, Trash2, CreditCard, ArrowLeft, Sparkles, Heart, AlertCircle, BookOpen } from 'lucide-react';
import { useCart } from '../contexts/CartContext';
import { API_URL } from '../config';

export default function CartPage() {
  const { cart, loading, error, removeFromCart, clearCart, checkout, refreshCart } = useCart();
  const [checkingOut, setCheckingOut] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const navigate = useNavigate();

  async function handleRemove(itemId: number) {
    setRemovingId(itemId);
    await removeFromCart(itemId);
    setRemovingId(null);
  }

  async function handleCheckout() {
    setCheckingOut(true);
    const checkoutUrl = await checkout();
    if (checkoutUrl) {
      window.location.href = checkoutUrl;
    }
    setCheckingOut(false);
  }

  async function handleClear() {
    if (window.confirm('Remove all items from your cart?')) {
      await clearCart();
    }
  }

  if (loading) {
    return (
      <div className="rb-cart-page rb-cart-page--loading" style={{
        padding: '60px 20px',
        textAlign: 'center',
        color: 'var(--text-muted, #94a3b8)',
      }}>
        <ShoppingCart size={48} style={{ opacity: 0.5, marginBottom: '16px' }} />
        <div>Loading cart...</div>
      </div>
    );
  }

  if (!cart || cart.item_count === 0) {
    return (
      <div className="rb-cart-page rb-cart-page--empty" style={{
        padding: '60px 20px',
        textAlign: 'center',
        maxWidth: '500px',
        margin: '0 auto',
      }}>
        <ShoppingCart size={64} style={{ opacity: 0.3, marginBottom: '24px' }} />
        <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '12px' }}>
          Your Cart is Empty
        </h1>
        <p style={{ color: 'var(--text-muted, #94a3b8)', marginBottom: '32px' }}>
          Browse chapters and add them to your cart to purchase multiple items at once and save on fees.
        </p>
        <button
          onClick={() => navigate('/')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '14px 28px',
            backgroundColor: 'var(--accent, #3b82f6)',
            color: 'white',
            border: 'none',
            borderRadius: '10px',
            fontSize: '16px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <ArrowLeft size={18} />
          Browse Marketplace
        </button>
      </div>
    );
  }

  const savings = parseFloat(cart.savings_vs_individual || '0');
  const hasSavings = savings > 0;

  return (
    <div className="rb-cart-page" style={{
      maxWidth: '900px',
      margin: '0 auto',
      padding: '40px 20px',
    }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '8px' }}>
          Shopping Cart
        </h1>
        <p style={{ color: 'var(--text-muted, #94a3b8)' }}>
          {cart.item_count} {cart.item_count === 1 ? 'item' : 'items'} in your cart
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '32px' }}>
        {/* Items List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {cart.items.map(item => {
            // Build cover URL - handle relative paths from Django
            let coverSrc = null;
            if (item.cover_url) {
              coverSrc = item.cover_url.startsWith('http')
                ? item.cover_url
                : `${API_URL}${item.cover_url}`;
            }

            return (
              <div
                key={item.id}
                style={{
                  display: 'flex',
                  gap: '16px',
                  padding: '16px',
                  backgroundColor: 'var(--bg-secondary, #1e293b)',
                  borderRadius: '12px',
                  border: '1px solid var(--border, #334155)',
                  opacity: removingId === item.id ? 0.5 : 1,
                  transition: 'opacity 0.2s ease',
                }}
              >
                {/* Cover Image */}
                <div style={{
                  width: '80px',
                  height: '100px',
                  flexShrink: 0,
                  borderRadius: '8px',
                  overflow: 'hidden',
                  backgroundColor: 'var(--bg-tertiary, #0f172a)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  {coverSrc ? (
                    <img
                      src={coverSrc}
                      alt={item.title}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                      }}
                    />
                  ) : (
                    <BookOpen size={32} style={{ color: 'var(--text-muted, #64748b)', opacity: 0.5 }} />
                  )}
                </div>

                {/* Item Details */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 style={{
                    fontSize: '16px',
                    fontWeight: 600,
                    marginBottom: '4px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {item.title}
                  </h3>
                  {item.book_title && (
                    <p style={{
                      fontSize: '13px',
                      color: 'var(--text-muted, #94a3b8)',
                      marginBottom: '4px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {item.book_title} &bull; Chapter {item.chapter_order}
                    </p>
                  )}
                  <p style={{ fontSize: '13px', color: 'var(--text-muted, #64748b)' }}>
                    By @{item.creator_username}
                  </p>
                </div>

                {/* Price and Actions */}
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-end',
                  justifyContent: 'space-between',
                  flexShrink: 0,
                }}>
                  <span style={{ fontSize: '18px', fontWeight: 600, color: 'var(--accent, #3b82f6)' }}>
                    ${item.unit_price}
                  </span>
                  <button
                    onClick={() => handleRemove(item.id)}
                    disabled={removingId === item.id}
                    style={{
                      padding: '8px',
                      backgroundColor: 'transparent',
                      color: 'var(--text-error, #ef4444)',
                      border: '1px solid var(--text-error, #ef4444)',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      opacity: removingId === item.id ? 0.5 : 1,
                    }}
                    title="Remove from cart"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
          })}

          {/* Clear Cart */}
          <button
            onClick={handleClear}
            style={{
              alignSelf: 'flex-start',
              padding: '8px 16px',
              backgroundColor: 'transparent',
              color: 'var(--text-muted, #94a3b8)',
              border: '1px solid var(--border, #334155)',
              borderRadius: '6px',
              fontSize: '13px',
              cursor: 'pointer',
              marginTop: '8px',
            }}
          >
            Clear Cart
          </button>
        </div>

        {/* Order Summary */}
        <div style={{
          padding: '24px',
          backgroundColor: 'var(--bg-secondary, #1e293b)',
          borderRadius: '16px',
          border: '1px solid var(--border, #334155)',
          height: 'fit-content',
          position: 'sticky',
          top: '100px',
        }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '20px' }}>
            Order Summary
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted, #94a3b8)' }}>
                Subtotal ({cart.item_count} items)
              </span>
              <span>${cart.subtotal}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted, #94a3b8)' }}>
                Credit Card Fee
              </span>
              <span>${cart.credit_card_fee}</span>
            </div>

            {hasSavings && (
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '10px 12px',
                backgroundColor: 'var(--bg-success, #052e16)',
                borderRadius: '8px',
                border: '1px solid var(--border-success, #16a34a)',
              }}>
                <span style={{ color: 'var(--text-success, #4ade80)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Sparkles size={14} />
                  Cart Savings
                </span>
                <span style={{ color: 'var(--text-success, #4ade80)', fontWeight: 600 }}>
                  -${cart.savings_vs_individual}
                </span>
              </div>
            )}

            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              paddingTop: '16px',
              borderTop: '1px solid var(--border, #334155)',
              fontSize: '20px',
              fontWeight: 700,
            }}>
              <span>Total</span>
              <span style={{ color: 'var(--accent, #3b82f6)' }}>${cart.total}</span>
            </div>
          </div>

          {error && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '16px',
              padding: '12px',
              backgroundColor: 'var(--bg-error, #450a0a)',
              border: '1px solid var(--border-error, #ef4444)',
              borderRadius: '8px',
              color: 'var(--text-error, #fca5a5)',
              fontSize: '14px',
            }}>
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <button
            onClick={handleCheckout}
            disabled={checkingOut}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              padding: '16px 24px',
              backgroundColor: checkingOut ? 'var(--bg-disabled, #475569)' : '#f59e0b',
              color: checkingOut ? '#94a3b8' : '#000',
              border: 'none',
              borderRadius: '10px',
              fontSize: '16px',
              fontWeight: 600,
              cursor: checkingOut ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.2s ease',
            }}
          >
            <CreditCard size={20} />
            {checkingOut ? 'Processing...' : `Checkout - $${cart.total}`}
          </button>

          {/* Creator Support Message */}
          <div style={{
            marginTop: '20px',
            padding: '16px',
            backgroundColor: 'var(--bg-tertiary, #0f172a)',
            borderRadius: '10px',
            fontSize: '13px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <Heart size={16} style={{ color: 'var(--text-success, #10b981)' }} />
              <span style={{ fontWeight: 600, color: 'var(--text-success, #10b981)' }}>
                Supporting Creators
              </span>
            </div>
            <p style={{ color: 'var(--text-muted, #94a3b8)', lineHeight: '1.5' }}>
              Creators receive 90% of each item's price. By using cart checkout, you save on credit card fees while supporting the creators you love.
            </p>
          </div>

          {/* Test Mode Notice */}
          <div style={{
            marginTop: '12px',
            padding: '10px 12px',
            backgroundColor: 'var(--bg-warning, #422006)',
            borderRadius: '8px',
            fontSize: '12px',
            color: 'var(--text-warning, #fcd34d)',
          }}>
            <strong>Test Mode:</strong> Use card 4242 4242 4242 4242
          </div>
        </div>
      </div>
    </div>
  );
}
