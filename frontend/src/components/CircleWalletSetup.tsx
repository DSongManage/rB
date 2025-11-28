import React, { useEffect, useState } from 'react';
import { W3SSdk } from '@circle-fin/w3s-pw-web-sdk';
import { API_URL } from '../config';

interface CircleWalletSetupProps {
  onComplete?: () => void;
  onSkip?: () => void;
}

export default function CircleWalletSetup({ onComplete, onSkip }: CircleWalletSetupProps) {
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sdk, setSdk] = useState<W3SSdk | null>(null);

  useEffect(() => {
    // Initialize Circle SDK
    const appId = import.meta.env.VITE_CIRCLE_APP_ID;
    if (!appId) {
      setError('Circle App ID not configured');
      return;
    }

    const sdkInstance = new W3SSdk();
    setSdk(sdkInstance);
  }, []);

  const createWallet = async () => {
    setLoading(true);
    setError('');
    setStatus('Getting wallet token...');

    try {
      // Step 1: Get user token from backend
      const tokenResponse = await fetch(`${API_URL}/api/circle/user-token/`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.json();
        throw new Error(errorData.error || 'Failed to get wallet token');
      }

      const { user_token, encryption_key } = await tokenResponse.json();

      if (!user_token) {
        throw new Error('No user token received from server');
      }

      setStatus('Initializing Circle SDK...');

      // Step 2: Initialize Circle SDK with user token
      if (!sdk) {
        throw new Error('Circle SDK not initialized');
      }

      sdk.setAppSettings({
        appId: import.meta.env.VITE_CIRCLE_APP_ID
      });

      sdk.setAuthentication({
        userToken: user_token,
        encryptionKey: encryption_key,
      });

      setStatus('Please set your wallet PIN...');

      // Step 3: Execute wallet creation (user sets PIN)
      sdk.execute(user_token, (error, result) => {
        if (error) {
          console.error('[Circle SDK] Error:', error);
          setError(`Wallet creation failed: ${error.message || 'Unknown error'}`);
          setLoading(false);
          return;
        }

        if (result) {
          console.log('[Circle SDK] Success:', result);

          // Step 4: Save wallet address to backend
          saveWalletAddress(result);
        }
      });

    } catch (err: any) {
      console.error('[Circle Wallet Setup] Error:', err);
      setError(err.message || 'Failed to create wallet');
      setLoading(false);
    }
  };

  const saveWalletAddress = async (result: any) => {
    setStatus('Saving wallet address...');

    try {
      const walletAddress = result.data?.walletAddress;
      const walletId = result.data?.walletId;

      if (!walletAddress) {
        throw new Error('No wallet address received from Circle');
      }

      const saveResponse = await fetch(`${API_URL}/api/circle/wallet/save/`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          wallet_address: walletAddress,
          wallet_id: walletId,
        }),
      });

      if (!saveResponse.ok) {
        const errorData = await saveResponse.json();
        throw new Error(errorData.error || 'Failed to save wallet');
      }

      setStatus('✅ Wallet created successfully!');
      setLoading(false);

      // Call onComplete callback after a short delay
      setTimeout(() => {
        if (onComplete) {
          onComplete();
        }
      }, 1500);

    } catch (err: any) {
      console.error('[Circle Wallet Setup] Save error:', err);
      setError(err.message || 'Failed to save wallet address');
      setLoading(false);
    }
  };

  return (
    <div style={{
      maxWidth: 500,
      margin: '40px auto',
      padding: 24,
      background: '#1e293b',
      borderRadius: 12,
      border: '1px solid #334155'
    }}>
      <h2 style={{ marginBottom: 16, color: '#f1f5f9' }}>
        Set Up Your Wallet
      </h2>

      <p style={{ marginBottom: 24, color: '#cbd5e1', lineHeight: 1.6 }}>
        Create your secure, non-custodial Solana wallet with a simple PIN code.
        No seed phrases to remember!
      </p>

      {error && (
        <div style={{
          padding: 12,
          marginBottom: 16,
          background: '#7f1d1d',
          border: '1px solid #991b1b',
          borderRadius: 8,
          color: '#fecaca',
          fontSize: 14
        }}>
          {error}
        </div>
      )}

      {status && (
        <div style={{
          padding: 12,
          marginBottom: 16,
          background: '#1e40af',
          border: '1px solid #2563eb',
          borderRadius: 8,
          color: '#dbeafe',
          fontSize: 14
        }}>
          {status}
        </div>
      )}

      <div style={{ display: 'grid', gap: 12 }}>
        <button
          onClick={createWallet}
          disabled={loading || !sdk}
          style={{
            padding: '12px 24px',
            background: loading ? '#475569' : '#f59e0b',
            color: loading ? '#94a3b8' : '#111',
            border: 'none',
            borderRadius: 8,
            fontSize: 16,
            fontWeight: 600,
            cursor: loading || !sdk ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s'
          }}
        >
          {loading ? 'Creating Wallet...' : 'Create Wallet'}
        </button>

        {onSkip && !loading && (
          <button
            onClick={onSkip}
            style={{
              padding: '12px 24px',
              background: 'transparent',
              color: '#94a3b8',
              border: '1px solid #334155',
              borderRadius: 8,
              fontSize: 14,
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            Skip for now
          </button>
        )}
      </div>

      <div style={{
        marginTop: 16,
        padding: 12,
        background: '#0f172a',
        borderRadius: 8,
        fontSize: 13,
        color: '#94a3b8'
      }}>
        <strong style={{ color: '#cbd5e1' }}>Why create a wallet?</strong>
        <ul style={{ marginTop: 8, marginBottom: 0, paddingLeft: 20 }}>
          <li>Receive NFTs from your purchases</li>
          <li>Get paid in USDC for your content</li>
          <li>You control your wallet with your PIN</li>
          <li>No seed phrases to manage</li>
        </ul>
      </div>
    </div>
  );
}
