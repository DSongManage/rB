/**
 * Withdraw to Bank Component
 *
 * Allows users to send USDC from their Web3Auth wallet to their Bridge
 * liquidation address for off-ramp to their bank account.
 */

import React, { useState, useEffect } from 'react';
import {
  ArrowRightLeft,
  Banknote,
  Loader,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  Wallet,
} from 'lucide-react';
import {
  withdrawToBank,
  getPrimaryLiquidationAddress,
  type LiquidationAddress,
} from '../../services/usdcTransferService';
import { getTransactionExplorerLink } from '../../services/web3authService';
import { API_URL } from '../../config';

// Dark theme colors (matching other Bridge components)
const colors = {
  bg: '#0f172a',
  bgCard: '#1e293b',
  bgHover: '#334155',
  bgInput: '#0f172a',
  border: '#334155',
  borderFocus: '#f59e0b',
  text: '#f8fafc',
  textSecondary: '#cbd5e1',
  textMuted: '#94a3b8',
  accent: '#f59e0b',
  accentHover: '#d97706',
  success: '#10b981',
  successBg: 'rgba(16,185,129,0.15)',
  error: '#ef4444',
  errorBg: 'rgba(239,68,68,0.15)',
  warning: '#f59e0b',
  warningBg: 'rgba(245,158,11,0.15)',
};

interface WithdrawToBankProps {
  walletAddress: string;
  onWithdrawComplete?: () => void;
  className?: string;
}

export const WithdrawToBank: React.FC<WithdrawToBankProps> = ({
  walletAddress,
  onWithdrawComplete,
  className = '',
}) => {
  const [amount, setAmount] = useState('');
  const [balance, setBalance] = useState<number | null>(null);
  const [liquidationAddress, setLiquidationAddress] = useState<LiquidationAddress | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ signature: string; explorerLink: string } | null>(null);

  // Fetch balance and liquidation address on mount
  useEffect(() => {
    fetchBalance();
    fetchLiquidationAddress();
  }, [walletAddress]);

  const fetchBalance = async () => {
    setLoadingBalance(true);
    try {
      const res = await fetch(`${API_URL}/api/earnings-balance/`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setBalance(parseFloat(data.balance));
      } else {
        console.error('Failed to fetch earnings balance:', res.status);
      }
    } catch (err) {
      console.error('Failed to fetch balance:', err);
    } finally {
      setLoadingBalance(false);
    }
  };

  const fetchLiquidationAddress = async () => {
    const addr = await getPrimaryLiquidationAddress();
    setLiquidationAddress(addr);
  };

  const handleMaxClick = () => {
    if (balance !== null) {
      setAmount(balance.toString());
    }
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Allow empty, numbers, and decimals
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setAmount(value);
      setError(null);
      setSuccess(null);
    }
  };

  const handleWithdraw = async () => {
    const amountNum = parseFloat(amount);

    // Validation
    if (!amount || isNaN(amountNum) || amountNum <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    if (amountNum < 10) {
      setError('Minimum withdrawal is $10 USDC');
      return;
    }

    if (balance !== null && amountNum > balance) {
      setError('Insufficient balance');
      return;
    }

    if (!liquidationAddress) {
      setError('No bank account linked. Please complete Bridge setup first.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await withdrawToBank(amountNum);

      if (result.success && result.signature) {
        setSuccess({
          signature: result.signature,
          explorerLink: result.explorerLink || getTransactionExplorerLink(result.signature),
        });
        setAmount('');
        fetchBalance(); // Refresh balance
        onWithdrawComplete?.();
      } else {
        setError(result.error || 'Withdrawal failed');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to process withdrawal');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={className}
      style={{
        backgroundColor: colors.bgCard,
        borderRadius: '12px',
        padding: '24px',
        border: `1px solid ${colors.border}`,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <div
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            backgroundColor: colors.warningBg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ArrowRightLeft size={20} color={colors.accent} />
        </div>
        <div>
          <h3 style={{ color: colors.text, fontSize: '18px', fontWeight: 600, margin: 0 }}>
            Withdraw to Bank
          </h3>
          <p style={{ color: colors.textMuted, fontSize: '14px', margin: 0 }}>
            Convert USDC to USD and deposit to your bank
          </p>
        </div>
      </div>

      {/* Balance Display */}
      <div
        style={{
          backgroundColor: colors.bg,
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Wallet size={18} color={colors.textMuted} />
          <span style={{ color: colors.textSecondary, fontSize: '14px' }}>Available Balance</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {loadingBalance ? (
            <Loader size={16} color={colors.textMuted} className="animate-spin" />
          ) : (
            <span style={{ color: colors.text, fontSize: '18px', fontWeight: 600 }}>
              {balance !== null ? `${balance.toFixed(2)} USDC` : '-- USDC'}
            </span>
          )}
          <button
            onClick={fetchBalance}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
            }}
            title="Refresh balance"
          >
            <RefreshCw size={14} color={colors.textMuted} />
          </button>
        </div>
      </div>

      {/* Bank Account Info */}
      {liquidationAddress?.external_account && (
        <div
          style={{
            backgroundColor: colors.bg,
            borderRadius: '8px',
            padding: '12px 16px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <Banknote size={18} color={colors.textMuted} />
          <div>
            <span style={{ color: colors.textSecondary, fontSize: '14px' }}>
              {liquidationAddress.external_account.bank_name}
            </span>
            <span style={{ color: colors.textMuted, fontSize: '14px', marginLeft: '8px' }}>
              ****{liquidationAddress.external_account.account_last_four}
            </span>
          </div>
        </div>
      )}

      {/* Amount Input */}
      <div style={{ marginBottom: '16px' }}>
        <label
          style={{
            display: 'block',
            color: colors.textSecondary,
            fontSize: '14px',
            marginBottom: '8px',
          }}
        >
          Amount (USDC)
        </label>
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            value={amount}
            onChange={handleAmountChange}
            placeholder="0.00"
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px 70px 12px 16px',
              backgroundColor: colors.bgInput,
              border: `1px solid ${error ? colors.error : colors.border}`,
              borderRadius: '8px',
              color: colors.text,
              fontSize: '18px',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          <button
            onClick={handleMaxClick}
            disabled={loading || balance === null}
            style={{
              position: 'absolute',
              right: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              backgroundColor: colors.bgHover,
              color: colors.accent,
              border: 'none',
              borderRadius: '4px',
              padding: '4px 8px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            MAX
          </button>
        </div>
        <p style={{ color: colors.textMuted, fontSize: '12px', marginTop: '4px' }}>
          Minimum withdrawal: $10 USDC
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div
          style={{
            backgroundColor: colors.errorBg,
            border: `1px solid ${colors.error}`,
            borderRadius: '8px',
            padding: '12px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <AlertCircle size={18} color={colors.error} />
          <span style={{ color: colors.error, fontSize: '14px' }}>{error}</span>
        </div>
      )}

      {/* Success Message */}
      {success && (
        <div
          style={{
            backgroundColor: colors.successBg,
            border: `1px solid ${colors.success}`,
            borderRadius: '8px',
            padding: '12px',
            marginBottom: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <CheckCircle size={18} color={colors.success} />
            <span style={{ color: colors.success, fontSize: '14px', fontWeight: 600 }}>
              Withdrawal submitted!
            </span>
          </div>
          <p style={{ color: colors.textSecondary, fontSize: '13px', margin: '0 0 8px 0' }}>
            Your USDC has been sent to Bridge. It will be converted to USD and deposited to your
            bank within 1-2 business days.
          </p>
          <a
            href={success.explorerLink}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: colors.accent,
              fontSize: '13px',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            View transaction <ExternalLink size={12} />
          </a>
        </div>
      )}

      {/* Withdraw Button */}
      <button
        onClick={handleWithdraw}
        disabled={loading || !amount || !liquidationAddress}
        style={{
          width: '100%',
          padding: '14px',
          backgroundColor: loading || !amount ? colors.bgHover : colors.accent,
          color: loading || !amount ? colors.textMuted : colors.bg,
          border: 'none',
          borderRadius: '8px',
          fontSize: '16px',
          fontWeight: 600,
          cursor: loading || !amount ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
        }}
      >
        {loading ? (
          <>
            <Loader size={18} className="animate-spin" />
            Processing...
          </>
        ) : (
          <>
            <Banknote size={18} />
            Withdraw to Bank
          </>
        )}
      </button>

      {/* Info Note */}
      <p
        style={{
          color: colors.textMuted,
          fontSize: '12px',
          marginTop: '12px',
          textAlign: 'center',
        }}
      >
        Powered by Bridge.xyz. You'll be asked to authenticate with Web3Auth to sign the
        transaction.
      </p>
    </div>
  );
};

export default WithdrawToBank;
