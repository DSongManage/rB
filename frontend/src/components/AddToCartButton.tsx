/**
 * Add to Cart Button Component
 *
 * Button for adding chapters/content to shopping cart.
 * Shows appropriate state: loading, in cart, cart full, or add action.
 */

import React, { useState } from 'react';
import { ShoppingCart, Check, AlertCircle } from 'lucide-react';
import { useCart } from '../contexts/CartContext';

interface AddToCartButtonProps {
  chapterId?: number;
  contentId?: number;
  price: string;
  alreadyOwned?: boolean;
  compact?: boolean;
  onSuccess?: () => void;
  className?: string;
}

export default function AddToCartButton({
  chapterId,
  contentId,
  price,
  alreadyOwned = false,
  compact = false,
  onSuccess,
  className = '',
}: AddToCartButtonProps) {
  const { addToCart, cart, error, isInCart } = useCart();
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [justAdded, setJustAdded] = useState(false);

  const type = chapterId ? 'chapter' : 'content';
  const itemId = chapterId || contentId || 0;
  const inCart = isInCart(itemId, type);
  const cartFull = cart && cart.item_count >= cart.max_items;

  async function handleClick() {
    if (alreadyOwned || inCart || cartFull || loading) return;

    setLoading(true);
    setLocalError(null);

    const success = await addToCart(chapterId, contentId);

    if (success) {
      setJustAdded(true);
      setTimeout(() => setJustAdded(false), 2000);
      onSuccess?.();
    } else {
      setLocalError(error || 'Failed to add to cart');
    }

    setLoading(false);
  }

  // Already owned state
  if (alreadyOwned) {
    return (
      <button
        disabled
        className={`rb-cart-btn rb-cart-btn--owned ${className}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: compact ? '6px 12px' : '10px 16px',
          backgroundColor: 'var(--bg-success, #064e3b)',
          color: 'var(--text-success, #10b981)',
          border: '1px solid var(--border-success, #10b981)',
          borderRadius: '8px',
          cursor: 'not-allowed',
          fontSize: compact ? '13px' : '14px',
          fontWeight: 500,
        }}
      >
        <Check size={compact ? 14 : 16} />
        Owned
      </button>
    );
  }

  // In cart state
  if (inCart || justAdded) {
    return (
      <button
        disabled
        className={`rb-cart-btn rb-cart-btn--in-cart ${className}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: compact ? '6px 12px' : '10px 16px',
          backgroundColor: 'var(--bg-info, #1e3a5f)',
          color: 'var(--text-info, #60a5fa)',
          border: '1px solid var(--border-info, #3b82f6)',
          borderRadius: '8px',
          cursor: 'not-allowed',
          fontSize: compact ? '13px' : '14px',
          fontWeight: 500,
        }}
      >
        <Check size={compact ? 14 : 16} />
        {justAdded ? 'Added!' : 'In Cart'}
      </button>
    );
  }

  // Add to cart button
  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', gap: '4px' }}>
      <button
        onClick={handleClick}
        disabled={loading || cartFull}
        className={`rb-cart-btn rb-cart-btn--add ${className}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: compact ? '6px 12px' : '10px 16px',
          backgroundColor: loading || cartFull ? 'var(--bg-disabled, #475569)' : 'var(--accent, #3b82f6)',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          cursor: loading || cartFull ? 'not-allowed' : 'pointer',
          fontSize: compact ? '13px' : '14px',
          fontWeight: 500,
          transition: 'all 0.2s ease',
        }}
      >
        <ShoppingCart size={compact ? 14 : 16} />
        {loading ? 'Adding...' : compact ? `$${price}` : `Add to Cart - $${price}`}
      </button>

      {localError && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          color: 'var(--text-error, #ef4444)',
          fontSize: '12px',
        }}>
          <AlertCircle size={12} />
          {localError}
        </div>
      )}

      {cartFull && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          color: 'var(--text-warning, #f59e0b)',
          fontSize: '12px',
        }}>
          <AlertCircle size={12} />
          Cart full (max {cart?.max_items})
        </div>
      )}
    </div>
  );
}
