import { useState, useEffect, useCallback } from 'react';
import { API_URL } from '../config';

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
      console.error('Auth check failed:', error);
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

      // Logout
      await fetch(`${API_URL}/api/auth/logout/`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'X-CSRFToken': csrfToken,
          'X-Requested-With': 'XMLHttpRequest',
        },
      });

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

  return {
    user: authState.user,
    loading: authState.loading,
    isAuthenticated: authState.isAuthenticated,
    logout,
    refreshAuth,
  };
};

export default useAuth;
