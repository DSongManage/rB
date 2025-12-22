/**
 * Cart Icon Component
 *
 * Shopping cart icon for header navigation.
 * Shows item count badge when cart has items.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { ShoppingCart } from 'lucide-react';
import { useCart } from '../contexts/CartContext';

interface CartIconProps {
  className?: string;
}

export default function CartIcon({ className = '' }: CartIconProps) {
  const { cart, loading } = useCart();
  const itemCount = cart?.item_count || 0;

  return (
    <Link
      to="/cart"
      className={`rb-nav-link rb-cart-icon ${className}`}
      title={itemCount > 0 ? `Cart (${itemCount} items)` : 'Cart'}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        padding: '8px',
        color: 'var(--text, #e2e8f0)',
        textDecoration: 'none',
      }}
    >
      <ShoppingCart size={20} />

      {!loading && itemCount > 0 && (
        <span
          style={{
            position: 'absolute',
            top: '0',
            right: '0',
            backgroundColor: 'var(--accent, #3b82f6)',
            color: 'white',
            fontSize: '11px',
            fontWeight: 600,
            minWidth: '18px',
            height: '18px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 4px',
          }}
        >
          {itemCount > 99 ? '99+' : itemCount}
        </span>
      )}
    </Link>
  );
}
