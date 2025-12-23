/**
 * Cart Context - Shopping cart state management
 *
 * Provides cart state and operations to all components.
 * Persists cart via backend API (database-backed).
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { API_URL } from '../config';

interface CartItem {
  id: number;
  type: 'chapter' | 'content';
  item_id: number;
  title: string;
  creator_username: string;
  unit_price: string;
  added_at: string;
  book_title?: string;
  chapter_order?: number;
  cover_url?: string;
}

interface BreakdownDisplay {
  subtotal: string;
  credit_card_fee: string;
  buyer_total: string;
  savings: string;
  item_count: number;
}

interface Cart {
  id: number;
  status: string;
  item_count: number;
  max_items: number;
  items: CartItem[];
  subtotal?: string;
  credit_card_fee?: string;
  total?: string;
  savings_vs_individual?: string;
  breakdown_display?: BreakdownDisplay;
}

interface CartContextType {
  cart: Cart | null;
  loading: boolean;
  error: string | null;
  addToCart: (chapterId?: number, contentId?: number) => Promise<boolean>;
  removeFromCart: (itemId: number) => Promise<boolean>;
  clearCart: () => Promise<void>;
  checkout: () => Promise<string | null>;
  refreshCart: () => Promise<void>;
  isInCart: (itemId: number, type: 'chapter' | 'content') => boolean;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getCSRFToken = async () => {
    try {
      const res = await fetch(`${API_URL}/api/auth/csrf/`, { credentials: 'include' });
      const data = await res.json();
      return data?.csrfToken || '';
    } catch {
      return '';
    }
  };

  const refreshCart = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/cart/`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setCart(data);
        setError(null);
      } else if (res.status === 403) {
        // Not authenticated
        setCart(null);
      }
    } catch (e) {
      console.error('Failed to fetch cart:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshCart();
  }, [refreshCart]);

  const addToCart = async (chapterId?: number, contentId?: number): Promise<boolean> => {
    setError(null);
    try {
      const csrfToken = await getCSRFToken();
      const res = await fetch(`${API_URL}/api/cart/add/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrfToken,
        },
        credentials: 'include',
        body: JSON.stringify({ chapter_id: chapterId, content_id: contentId }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to add to cart');
        return false;
      }

      await refreshCart();
      return true;
    } catch (e) {
      setError('Failed to add to cart');
      return false;
    }
  };

  const removeFromCart = async (itemId: number): Promise<boolean> => {
    setError(null);
    try {
      const csrfToken = await getCSRFToken();
      const res = await fetch(`${API_URL}/api/cart/remove/${itemId}/`, {
        method: 'DELETE',
        headers: { 'X-CSRFToken': csrfToken },
        credentials: 'include',
      });

      if (res.ok) {
        await refreshCart();
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  };

  const clearCart = async () => {
    setError(null);
    try {
      const csrfToken = await getCSRFToken();
      await fetch(`${API_URL}/api/cart/clear/`, {
        method: 'POST',
        headers: { 'X-CSRFToken': csrfToken },
        credentials: 'include',
      });
      await refreshCart();
    } catch (e) {
      console.error('Failed to clear cart:', e);
    }
  };

  const checkout = async (): Promise<string | null> => {
    setError(null);
    try {
      const csrfToken = await getCSRFToken();
      const res = await fetch(`${API_URL}/api/cart/checkout/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrfToken,
        },
        credentials: 'include',
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Checkout failed');
        return null;
      }

      return data.checkout_url;
    } catch (e) {
      setError('Checkout failed');
      return null;
    }
  };

  const isInCart = (itemId: number, type: 'chapter' | 'content'): boolean => {
    if (!cart) return false;
    return cart.items.some(
      item => item.item_id === itemId && item.type === type
    );
  };

  return (
    <CartContext.Provider value={{
      cart,
      loading,
      error,
      addToCart,
      removeFromCart,
      clearCart,
      checkout,
      refreshCart,
      isInCart,
    }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within CartProvider');
  }
  return context;
}

export default CartContext;
