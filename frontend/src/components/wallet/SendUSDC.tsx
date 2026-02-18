/**
 * Send USDC Component
 *
 * Allows users to send USDC from their Web3Auth wallet to any Solana address
 * (e.g., Coinbase, Phantom, other wallets).
 */

import React, { useState, useEffect } from 'react';
import {
  Send,
  Wallet,
  Loader,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import {
  sendUSDC,
  checkRecipientNeedsAccount,
  estimateTransferFee,
} from '../../services/usdcTransferService';
import {
  getSolBalance,
  isValidSolanaAddress,
  getTransactionExplorerLink,
  getAddressExplorerLink,
} from '../../services/web3authService';
import { API_URL } from '../../config';

// Dark theme colors
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
  info: '#3b82f6',
  infoBg: 'rgba(59,130,246,0.15)',
};

interface SendUSDCProps {
  walletAddress: string;
  onSendComplete?: () => void;
  className?: string;
}

export const SendUSDC: React.FC<SendUSDCProps> = ({
  walletAddress,
  onSendComplete,
  className = '',
}) => {
  const [recipientAddress, setRecipientAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [usdcBalance, setUsdcBalance] = useState<number | null>(null);
  const [solBalance, setSolBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ signature: string; explorerLink: string } | null>(null);
  const [addressValid, setAddressValid] = useState<boolean | null>(null);
  const [needsAccountCreation, setNeedsAccountCreation] = useState(false);
  const [estimatedFee, setEstimatedFee] = useState<number | null>(null);

  // Fetch balances on mount
  useEffect(() => {
    fetchBalances();
  }, [walletAddress]);

  // Validate address when it changes
  useEffect(() => {
    if (recipientAddress.length >= 32) {
      validateAddress(recipientAddress);
    } else {
      setAddressValid(null);
      setNeedsAccountCreation(false);
      setEstimatedFee(null);
    }
  }, [recipientAddress]);

  const fetchBalances = async () => {
    if (!walletAddress) return;
    setLoadingBalance(true);
    try {
      const [earningsRes, sol] = await Promise.all([
        fetch(`${API_URL}/api/earnings-balance/`, { credentials: 'include' }),
        getSolBalance(walletAddress),
      ]);
      if (earningsRes.ok) {
        const data = await earningsRes.json();
        setUsdcBalance(parseFloat(data.balance));
      }
      setSolBalance(sol);
    } catch (err) {
      console.error('Failed to fetch balances:', err);
    } finally {
      setLoadingBalance(false);
    }
  };

  const validateAddress = async (address: string) => {
    const valid = isValidSolanaAddress(address);
    setAddressValid(valid);

    if (valid && address !== walletAddress) {
      try {
        const needsAccount = await checkRecipientNeedsAccount(address);
        setNeedsAccountCreation(needsAccount);
        const fee = await estimateTransferFee(address, needsAccount);
        setEstimatedFee(fee);
      } catch (err) {
        console.error('Failed to check recipient:', err);
      }
    }
  };

  const handleMaxClick = () => {
    if (usdcBalance !== null) {
      setAmount(usdcBalance.toString());
    }
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setAmount(value);
      setError(null);
      setSuccess(null);
    }
  };

  const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRecipientAddress(e.target.value.trim());
    setError(null);
    setSuccess(null);
  };

  const handleSend = async () => {
    const amountNum = parseFloat(amount);

    // Validation
    if (!recipientAddress) {
      setError('Please enter a recipient address');
      return;
    }

    if (!isValidSolanaAddress(recipientAddress)) {
      setError('Invalid Solana address');
      return;
    }

    if (recipientAddress === walletAddress) {
      setError('Cannot send to your own wallet');
      return;
    }

    if (!amount || isNaN(amountNum) || amountNum <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    if (usdcBalance !== null && amountNum > usdcBalance) {
      setError('Insufficient USDC balance');
      return;
    }

    // Check SOL balance for fees
    if (solBalance !== null && solBalance < 0.01) {
      setError('Insufficient SOL for transaction fees. Need at least 0.01 SOL.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await sendUSDC(recipientAddress, amountNum);

      if (result.success && result.signature) {
        setSuccess({
          signature: result.signature,
          explorerLink: result.explorerLink || getTransactionExplorerLink(result.signature),
        });
        setAmount('');
        setRecipientAddress('');
        fetchBalances();
        onSendComplete?.();
      } else {
        setError(result.error || 'Transfer failed');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to send transaction');
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
            backgroundColor: colors.infoBg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Send size={20} color={colors.info} />
        </div>
        <div>
          <h3 style={{ color: colors.text, fontSize: '18px', fontWeight: 600, margin: 0 }}>
            Send USDC
          </h3>
          <p style={{ color: colors.textMuted, fontSize: '14px', margin: 0 }}>
            Transfer USDC to any Solana wallet
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
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Wallet size={16} color={colors.textMuted} />
            <span style={{ color: colors.textSecondary, fontSize: '14px' }}>USDC Balance</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {loadingBalance ? (
              <Loader size={14} color={colors.textMuted} className="animate-spin" />
            ) : (
              <span style={{ color: colors.text, fontSize: '16px', fontWeight: 600 }}>
                {usdcBalance !== null ? `${usdcBalance.toFixed(2)} USDC` : '-- USDC'}
              </span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: colors.textMuted, fontSize: '12px' }}>SOL (for fees)</span>
          <span style={{ color: colors.textMuted, fontSize: '12px' }}>
            {solBalance !== null ? `${solBalance.toFixed(4)} SOL` : '-- SOL'}
          </span>
        </div>
        <button
          onClick={fetchBalances}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '4px',
            marginTop: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            color: colors.textMuted,
            fontSize: '12px',
          }}
        >
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {/* Recipient Address Input */}
      <div style={{ marginBottom: '16px' }}>
        <label
          style={{
            display: 'block',
            color: colors.textSecondary,
            fontSize: '14px',
            marginBottom: '8px',
          }}
        >
          Recipient Address
        </label>
        <input
          type="text"
          value={recipientAddress}
          onChange={handleAddressChange}
          placeholder="Enter Solana wallet address"
          disabled={loading}
          style={{
            width: '100%',
            padding: '12px 16px',
            backgroundColor: colors.bgInput,
            border: `1px solid ${
              addressValid === false ? colors.error : addressValid === true ? colors.success : colors.border
            }`,
            borderRadius: '8px',
            color: colors.text,
            fontSize: '14px',
            outline: 'none',
            boxSizing: 'border-box',
            fontFamily: 'monospace',
          }}
        />
        {addressValid === false && (
          <p style={{ color: colors.error, fontSize: '12px', marginTop: '4px' }}>
            Invalid Solana address
          </p>
        )}
        {addressValid === true && recipientAddress && (
          <a
            href={getAddressExplorerLink(recipientAddress)}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: colors.textMuted,
              fontSize: '12px',
              marginTop: '4px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              textDecoration: 'none',
            }}
          >
            View on Solscan <ExternalLink size={10} />
          </a>
        )}
      </div>

      {/* Account Creation Warning */}
      {needsAccountCreation && (
        <div
          style={{
            backgroundColor: colors.warningBg,
            border: `1px solid ${colors.warning}`,
            borderRadius: '8px',
            padding: '12px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px',
          }}
        >
          <AlertTriangle size={16} color={colors.warning} style={{ marginTop: '2px' }} />
          <div>
            <span style={{ color: colors.warning, fontSize: '13px' }}>
              Recipient doesn't have a USDC account. One will be created automatically.
            </span>
            {estimatedFee !== null && (
              <p style={{ color: colors.textMuted, fontSize: '12px', margin: '4px 0 0 0' }}>
                Estimated fee: ~{estimatedFee.toFixed(5)} SOL
              </p>
            )}
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
            disabled={loading || usdcBalance === null}
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
              Transfer successful!
            </span>
          </div>
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

      {/* Send Button */}
      <button
        onClick={handleSend}
        disabled={loading || !amount || !recipientAddress || addressValid === false}
        style={{
          width: '100%',
          padding: '14px',
          backgroundColor:
            loading || !amount || !recipientAddress ? colors.bgHover : colors.info,
          color: loading || !amount || !recipientAddress ? colors.textMuted : colors.text,
          border: 'none',
          borderRadius: '8px',
          fontSize: '16px',
          fontWeight: 600,
          cursor: loading || !amount || !recipientAddress ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
        }}
      >
        {loading ? (
          <>
            <Loader size={18} className="animate-spin" />
            Sending...
          </>
        ) : (
          <>
            <Send size={18} />
            Send USDC
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
        You'll be asked to authenticate with Web3Auth to sign the transaction.
      </p>
    </div>
  );
};

export default SendUSDC;
