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
        color: 'var(--text, #e2e8f0)',
        textDecoration: 'none',
      }}
    >
      <span style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <ShoppingCart size={20} />
        {!loading && itemCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: '-6px',
              right: '-8px',
              backgroundColor: 'var(--accent, #3b82f6)',
              color: 'white',
              fontSize: '10px',
              fontWeight: 600,
              minWidth: '16px',
              height: '16px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 3px',
            }}
          >
            {itemCount > 99 ? '99+' : itemCount}
          </span>
        )}
      </span>
      <span>Cart</span>
    </Link>
  );
}
