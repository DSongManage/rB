import { useState, useEffect, useCallback } from 'react';
import { API_URL } from '../config';
import { disconnectWeb3Auth } from '../services/web3authService';

/**
 * Authentication hook
 *
 * Provides authentication state and methods for the entire app.
 * Checks auth status on mount and provides loading state.
 */

interface User {
  id: number;
  username: string;
  email?: string;
  display_name?: string;
  avatar?: string;
  has_seen_beta_welcome?: boolean;
}

interface AuthState {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
}

export const useAuth = () => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    loading: true,
    isAuthenticated: false,
  });

  const checkAuth = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/auth/status/`, {
        credentials: 'include',
      });

      if (!response.ok) {
        setAuthState({
          user: null,
          loading: false,
          isAuthenticated: false,
        });
        return;
      }

      const data = await response.json();

      if (data?.authenticated && data?.user) {
        setAuthState({
          user: data.user,
          loading: false,
          isAuthenticated: true,
        });
      } else {
        setAuthState({
          user: null,
          loading: false,
          isAuthenticated: false,
        });
      }
    } catch (error) {
      console.error('[useAuth] Auth check failed:', error);
      setAuthState({
        user: null,
        loading: false,
        isAuthenticated: false,
      });
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      // Get CSRF token
      const csrfResponse = await fetch(`${API_URL}/api/auth/csrf/`, {
        credentials: 'include',
      });
      const csrfData = await csrfResponse.json();
      const csrfToken = csrfData?.csrfToken || '';

      // Logout from Django
      await fetch(`${API_URL}/api/auth/logout/`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'X-CSRFToken': csrfToken,
          'X-Requested-With': 'XMLHttpRequest',
        },
      });

      // CRITICAL: Disconnect Web3Auth to prevent session key mismatch on next login
      try {
        await disconnectWeb3Auth();
      } catch (e) {
        console.warn('[useAuth] Web3Auth disconnect failed:', e);
      }

      // Update state
      setAuthState({
        user: null,
        loading: false,
        isAuthenticated: false,
      });
    } catch (error) {
      console.error('Logout failed:', error);
    }
  }, []);

  const refreshAuth = useCallback(() => {
    setAuthState(prev => ({ ...prev, loading: true }));
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Listen for logout events from other components (e.g., Header)
  useEffect(() => {
    const handleLogoutEvent = () => {
      setAuthState({
        user: null,
        loading: false,
        isAuthenticated: false,
      });
    };

    window.addEventListener('auth-logout', handleLogoutEvent);
    return () => {
      window.removeEventListener('auth-logout', handleLogoutEvent);
    };
  }, []);

  return {
    user: authState.user,
    loading: authState.loading,
    isAuthenticated: authState.isAuthenticated,
    logout,
    refreshAuth,
  };
};

export default useAuth;
