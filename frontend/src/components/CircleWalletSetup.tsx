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

    // Initialize SDK
    const sdkInstance = new W3SSdk();
    setSdk(sdkInstance);

    console.log('[Circle Wallet Setup] SDK initialized with App ID:', appId);
  }, []);

  const handleSocialLoginSuccess = async (loginResult: any, csrfToken: string) => {
    try {
      console.log('[Circle Wallet Setup] Handling social login success...');
      console.log('[Circle Wallet Setup] Login result:', loginResult);

      // After successful Google login, create wallet
      createWalletAfterLogin(csrfToken);

    } catch (err: any) {
      console.error('[Circle Wallet Setup] Error handling login:', err);
      setError(err.message || 'Failed after login');
      setLoading(false);
    }
  };

  const createWalletWithGoogle = async () => {
    setLoading(true);
    setError('');
    setStatus('Preparing Google sign-in...');

    try {
      if (!sdk) {
        throw new Error('Circle SDK not initialized');
      }

      // Get CSRF token
      const csrfResponse = await fetch(`${API_URL}/api/auth/csrf/`, { credentials: 'include' });
      const csrfData = await csrfResponse.json();
      const csrfToken = csrfData?.csrfToken || '';

      if (!csrfToken) {
        throw new Error('Failed to get CSRF token');
      }

      console.log('[Circle Wallet Setup] Step 1: Getting device token...');
      setStatus('Initializing...');

      // Step 1: Get device token from backend
      const deviceResponse = await fetch(`${API_URL}/api/circle/device-token/`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrfToken,
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({})
      });

      if (!deviceResponse.ok) {
        const errorData = await deviceResponse.json();
        throw new Error(errorData.error || 'Failed to get device token');
      }

      const deviceData = await deviceResponse.json();
      console.log('[Circle Wallet Setup] Device token received:', deviceData);

      const deviceToken = deviceData.deviceToken || deviceData.device_token;
      const deviceEncryptionKey = deviceData.deviceEncryptionKey || deviceData.device_encryption_key;

      if (!deviceToken || !deviceEncryptionKey) {
        throw new Error('No device token received');
      }

      // Step 2: Re-initialize SDK with device token and Google credentials
      const appId = import.meta.env.VITE_CIRCLE_APP_ID;
      const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

      if (!googleClientId) {
        throw new Error('Google Client ID not configured. Please set VITE_GOOGLE_CLIENT_ID in your .env file');
      }

      console.log('[Circle Wallet Setup] Step 2: Re-initializing SDK with login config...');
      console.log('[Circle Wallet Setup] App ID:', appId);
      console.log('[Circle Wallet Setup] Google Client ID:', googleClientId);
      console.log('[Circle Wallet Setup] Redirect URI:', window.location.origin);
      console.log('[Circle Wallet Setup] Device Token:', deviceToken ? 'present' : 'missing');
      console.log('[Circle Wallet Setup] Device Encryption Key:', deviceEncryptionKey ? 'present' : 'missing');

      // Create new SDK instance with full configuration including callbacks
      const configuredSdk = new W3SSdk({
        appSettings: { appId },
        loginConfigs: {
          deviceToken,
          deviceEncryptionKey,
          google: {
            clientId: googleClientId,
            redirectUri: window.location.origin
          }
        },
        socialLoginCompleteCallback: async (error: any, loginResult: any) => {
          console.log('[Circle SDK] Social login complete callback FIRED!');
          console.log('[Circle SDK] Error:', error);
          console.log('[Circle SDK] Result:', loginResult);

          if (error) {
            console.error('[Circle SDK] Social login error:', error);
            setError(`Login failed: ${error.message || 'Unknown error'}`);
            setLoading(false);
            return;
          }

          if (loginResult) {
            console.log('[Circle SDK] Social login successful!', loginResult);
            setStatus('✅ Logged in! Creating wallet...');

            // Extract tokens from login result
            const userToken = loginResult.userToken;
            const encryptionKey = loginResult.encryptionKey;

            if (!userToken || !encryptionKey) {
              setError('Login succeeded but missing tokens');
              setLoading(false);
              return;
            }

            // Step 4: Initialize user and create wallet
            try {
              await initializeUserAndCreateWallet(userToken, encryptionKey, csrfToken);
            } catch (err: any) {
              console.error('[Circle Wallet Setup] Post-login error:', err);
              setError(err.message || 'Failed to create wallet');
              setLoading(false);
            }
          }
        }
      });

      console.log('[Circle Wallet Setup] SDK instance created:', configuredSdk);
      console.log('[Circle Wallet Setup] Available methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(configuredSdk)));

      // Step 3: Perform social login - this opens Google popup
      setStatus('Opening Google sign-in...');
      console.log('[Circle Wallet Setup] Step 3: Calling performGoogleLogin()...');

      // Call the specific Google login method
      configuredSdk.performGoogleLogin();

    } catch (err: any) {
      console.error('[Circle Wallet Setup] Error:', err);
      setError(err.message || 'Failed to initiate login');
      setLoading(false);
    }
  };

  const initializeUserAndCreateWallet = async (userToken: string, encryptionKey: string, csrfToken: string) => {
    try {
      console.log('[Circle Wallet Setup] Initializing user and creating wallet...');
      setStatus('Creating your wallet...');

      // Call backend to initialize user (creates wallet challenge)
      const initResponse = await fetch(`${API_URL}/api/circle/user/initialize/`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrfToken,
          'X-Requested-With': 'XMLHttpRequest',
          'X-User-Token': userToken
        },
        body: JSON.stringify({
          accountType: 'EOA',
          blockchains: ['SOL-DEVNET']
        })
      });

      if (!initResponse.ok) {
        const errorData = await initResponse.json();
        throw new Error(errorData.error || 'Failed to initialize wallet');
      }

      const initData = await initResponse.json();
      console.log('[Circle Wallet Setup] Initialize response:', initData);

      const challengeId = initData.challengeId || initData.challenge_id;

      if (!challengeId) {
        throw new Error('No challenge ID received');
      }

      // Set authentication and execute challenge
      if (!sdk) {
        throw new Error('SDK not initialized');
      }

      sdk.setAuthentication({ userToken, encryptionKey });

      console.log('[Circle Wallet Setup] Executing wallet creation challenge...');

      sdk.execute(challengeId, (error: any, result: any) => {
        if (error) {
          console.error('[Circle SDK] Wallet creation error:', error);
          setError(`Wallet creation failed: ${error.message || 'Unknown error'}`);
          setLoading(false);
          return;
        }

        if (result) {
          console.log('[Circle SDK] Wallet created!', result);
          saveWalletAddress(result, csrfToken);
        } else {
          setError('Wallet creation completed but no result');
          setLoading(false);
        }
      });

    } catch (err: any) {
      console.error('[Circle Wallet Setup] Initialize error:', err);
      throw err;
    }
  };

  const createWalletAfterLogin = async (csrfToken: string) => {
    try {
      console.log('[Circle Wallet Setup] Creating wallet after Google login...');

      // Call backend to initiate wallet creation
      const walletResponse = await fetch(`${API_URL}/api/circle/wallet/create/`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrfToken,
          'X-Requested-With': 'XMLHttpRequest',
        },
      });

      if (!walletResponse.ok) {
        const errorData = await walletResponse.json();
        throw new Error(errorData.error || 'Failed to create wallet');
      }

      const walletData = await walletResponse.json();
      console.log('[Circle Wallet Setup] Wallet creation response:', walletData);

      const wallet_challenge_id = walletData.challengeId || walletData.challenge_id;
      const wallet_user_token = walletData.userToken || walletData.user_token;
      const wallet_encryption_key = walletData.encryptionKey || walletData.encryption_key;

      if (!wallet_challenge_id) {
        throw new Error('No wallet challenge ID received');
      }

      if (!sdk) {
        throw new Error('Circle SDK not initialized');
      }

      // Create fresh SDK instance for wallet creation
      const appId = import.meta.env.VITE_CIRCLE_APP_ID;
      const walletSdk = new W3SSdk({
        appId: appId
      });

      walletSdk.setAuthentication({
        userToken: wallet_user_token,
        encryptionKey: wallet_encryption_key,
      });

      setStatus('Creating your wallet...');

      // Execute wallet creation
      console.log('[Circle Wallet Setup] Executing wallet creation...');
      walletSdk.execute(wallet_challenge_id, (error: any, result: any) => {
        console.log('[Circle SDK] Wallet creation callback');
        console.log('[Circle SDK] Error:', error);
        console.log('[Circle SDK] Result:', result);

        if (error) {
          console.error('[Circle SDK] Wallet creation error:', error);
          setError(`Wallet creation failed: ${error.message || 'Unknown error'}`);
          setLoading(false);
          return;
        }

        if (result) {
          console.log('[Circle SDK] Wallet created successfully!');
          console.log('[Circle SDK] Wallet data:', result.data);

          // Save wallet address to backend
          saveWalletAddress(result, csrfToken);
        } else {
          console.error('[Circle SDK] No wallet result');
          setError('Wallet creation completed but no result was returned');
          setLoading(false);
        }
      });

    } catch (err: any) {
      console.error('[Circle Wallet Setup] Wallet creation error:', err);
      setError(err.message || 'Failed to create wallet');
      setLoading(false);
    }
  };

  const saveWalletAddress = async (result: any, csrfToken: string) => {
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
          'X-CSRFToken': csrfToken,
          'X-Requested-With': 'XMLHttpRequest',
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
        Create Your Wallet
      </h2>

      <p style={{ marginBottom: 24, color: '#cbd5e1', lineHeight: 1.6 }}>
        Sign in with Google to create your secure Solana wallet.
        Your wallet will be created automatically.
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
          onClick={createWalletWithGoogle}
          disabled={loading || !sdk}
          style={{
            padding: '12px 24px',
            background: loading ? '#475569' : '#fff',
            color: loading ? '#94a3b8' : '#111',
            border: 'none',
            borderRadius: 8,
            fontSize: 16,
            fontWeight: 600,
            cursor: loading || !sdk ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12
          }}
        >
          {loading ? (
            'Creating Wallet...'
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 18 18">
                <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
                <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/>
                <path fill="#FBBC05" d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.175 0 7.55 0 9s.348 2.825.957 4.039l3.007-2.332z"/>
                <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z"/>
              </svg>
              Sign in with Google
            </>
          )}
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
        <strong style={{ color: '#cbd5e1' }}>What happens next?</strong>
        <ol style={{ marginTop: 8, marginBottom: 0, paddingLeft: 20 }}>
          <li>Sign in with your Google account</li>
          <li>Your Solana wallet will be created automatically</li>
          <li>Receive NFTs and USDC payments to this wallet</li>
          <li>Use Google to approve transactions</li>
        </ol>
      </div>
    </div>
  );
}
