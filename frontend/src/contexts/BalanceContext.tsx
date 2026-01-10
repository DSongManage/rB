/**
 * Balance Context
 *
 * Provides user's renaissBlock Balance (USDC) state to all components.
 * Handles fetching, caching, and refreshing balance from the backend.
 *
 * Terminology:
 * - User sees: "renaissBlock Balance: $X.XX"
 * - We never show "USDC" to regular users
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { paymentApi, BalanceResponse } from '../services/paymentApi';

interface BalanceContextType {
  // Balance state
  balance: string | null;
  displayBalance: string | null;
  loading: boolean;
  error: string | null;
  lastSynced: Date | null;
  syncStatus: 'synced' | 'syncing' | 'stale' | 'error' | 'no_wallet' | null;

  // Actions
  refreshBalance: () => Promise<void>;
  forceSync: () => Promise<void>;

  // Helpers
  isBalanceSufficient: (amount: string | number) => boolean;
  getBalanceNumber: () => number;
}

const BalanceContext = createContext<BalanceContextType | null>(null);

interface BalanceProviderProps {
  children: ReactNode;
}

export function BalanceProvider({ children }: BalanceProviderProps) {
  const [balance, setBalance] = useState<string | null>(null);
  const [displayBalance, setDisplayBalance] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [syncStatus, setSyncStatus] = useState<BalanceContextType['syncStatus']>(null);

  // Fetch balance from backend
  const fetchBalance = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response: BalanceResponse = await paymentApi.getBalance();

      setBalance(response.balance);
      setDisplayBalance(response.display_balance);
      setSyncStatus(response.sync_status);

      if (response.last_synced) {
        setLastSynced(new Date(response.last_synced));
      }

      if (response.error) {
        setError(response.error);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch balance';
      setError(errorMessage);
      console.error('Balance fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Force sync from blockchain
  const forceSync = useCallback(async () => {
    try {
      setLoading(true);
      setSyncStatus('syncing');
      setError(null);

      const response: BalanceResponse = await paymentApi.syncBalance();

      setBalance(response.balance);
      setDisplayBalance(response.display_balance);
      setSyncStatus(response.sync_status);

      if (response.last_synced) {
        setLastSynced(new Date(response.last_synced));
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to sync balance';
      setError(errorMessage);
      setSyncStatus('error');
      console.error('Balance sync error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Refresh balance (uses cached if available)
  const refreshBalance = useCallback(async () => {
    await fetchBalance();
  }, [fetchBalance]);

  // Check if balance is sufficient for an amount
  const isBalanceSufficient = useCallback((amount: string | number): boolean => {
    if (!balance) return false;

    const balanceNum = parseFloat(balance);
    const amountNum = typeof amount === 'string' ? parseFloat(amount) : amount;

    return balanceNum >= amountNum;
  }, [balance]);

  // Get balance as number
  const getBalanceNumber = useCallback((): number => {
    if (!balance) return 0;
    return parseFloat(balance);
  }, [balance]);

  // Fetch balance on mount
  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  // Auto-refresh when balance is syncing or stale
  // Poll more aggressively to show updated balance quickly
  useEffect(() => {
    if (syncStatus === 'stale') {
      // Stale balance - fetch after 2 seconds to get freshly synced value
      const timer = setTimeout(() => {
        fetchBalance();
      }, 2000);

      return () => clearTimeout(timer);
    }

    if (syncStatus === 'syncing') {
      // Actively syncing - poll every 1.5 seconds until synced
      const timer = setInterval(() => {
        fetchBalance();
      }, 1500);

      return () => clearInterval(timer);
    }
  }, [syncStatus, fetchBalance]);

  const value: BalanceContextType = {
    balance,
    displayBalance,
    loading,
    error,
    lastSynced,
    syncStatus,
    refreshBalance,
    forceSync,
    isBalanceSufficient,
    getBalanceNumber,
  };

  return (
    <BalanceContext.Provider value={value}>
      {children}
    </BalanceContext.Provider>
  );
}

export function useBalance(): BalanceContextType {
  const context = useContext(BalanceContext);

  if (!context) {
    throw new Error('useBalance must be used within a BalanceProvider');
  }

  return context;
}

export default BalanceContext;
