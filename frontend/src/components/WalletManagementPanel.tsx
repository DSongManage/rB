import React, { useState } from 'react';
import { API_URL } from '../config';
import {
  Wallet, Globe, Link, Loader, Info, CheckCircle, Copy, ExternalLink,
  Settings, AlertTriangle, AlertCircle, DollarSign, ChevronDown, ChevronUp
} from 'lucide-react';

interface WalletManagementPanelProps {
  walletAddress: string | null;
  walletProvider: 'web3auth' | 'external' | null;
  onWalletUpdate: () => void;
}

type WalletAction = 'create_web3auth' | 'connect_external' | 'switch' | 'disconnect' | null;

export function WalletManagementPanel({
  walletAddress,
  walletProvider,
  onWalletUpdate
}: WalletManagementPanelProps) {
  const [showManageMenu, setShowManageMenu] = useState(false);
  const [activeAction, setActiveAction] = useState<WalletAction>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Helper: Shorten wallet address for display
  const shortenAddress = (addr: string) => {
    if (!addr || addr.length < 12) return addr;
    return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
  };

  // Helper: Get Solscan explorer link
  const getExplorerLink = (addr: string) => {
    // Use devnet for development, mainnet for production
    const network = import.meta.env.VITE_SOLANA_NETWORK === 'mainnet-beta' ? '' : '?cluster=devnet';
    return `https://solscan.io/account/${addr}${network}`;
  };

  // Helper: Copy to clipboard
  const copyAddress = async () => {
    if (!walletAddress) return;
    try {
      await navigator.clipboard.writeText(walletAddress);
      setSuccess('Address copied!');
      setTimeout(() => setSuccess(''), 2000);
    } catch (e) {
      setError('Failed to copy');
    }
  };

  // Helper: Get CSRF token
  const getCsrfToken = async () => {
    const res = await fetch(`${API_URL}/api/auth/csrf/`, { credentials: 'include' });
    const data = await res.json();
    return data?.csrfToken || '';
  };

  // Action: Create Web3Auth wallet
  const createWeb3AuthWallet = async () => {
    setError('');
    setLoading(true);

    try {
      const { Web3Auth } = await import('@web3auth/modal');
      const { CHAIN_NAMESPACES } = await import('@web3auth/base');
      const { SolanaPrivateKeyProvider } = await import('@web3auth/solana-provider');

      const clientId = import.meta.env.VITE_WEB3AUTH_CLIENT_ID || '';
      if (!clientId) {
        throw new Error('Web3Auth client ID not configured');
      }

      const chainConfig = {
        chainNamespace: CHAIN_NAMESPACES.SOLANA,
        chainId: "0x3", // Solana devnet
        rpcTarget: "https://api.devnet.solana.com",
      };

      const privateKeyProvider = new SolanaPrivateKeyProvider({
        config: { chainConfig },
      });

      const web3auth = new Web3Auth({
        clientId,
        chainConfig,
        privateKeyProvider,
        web3AuthNetwork: 'sapphire_devnet',
        uiConfig: {
          appName: "RenaissBlock",
          mode: "dark",
          loginMethodsOrder: ["google", "discord"],
          defaultLanguage: "en",
        },
      });

      // Initialize the modal (not just init())
      await web3auth.initModal();

      // Connect will open the modal for user to select login method
      await web3auth.connect();

      const userInfo: any = await web3auth.getUserInfo();
      const idToken = userInfo?.idToken || userInfo?.id_token;

      if (!idToken) {
        throw new Error('Could not obtain Web3Auth token');
      }

      // Link wallet to account
      const csrf = await getCsrfToken();
      const res = await fetch(`${API_URL}/api/wallet/link/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrf,
          'X-Requested-With': 'XMLHttpRequest',
        },
        credentials: 'include',
        body: JSON.stringify({ web3auth_token: idToken }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Failed to link wallet');
      }

      setSuccess('Wallet created and linked!');
      setActiveAction(null);
      onWalletUpdate();
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  // Action: Connect external wallet with signature verification
  const connectExternalWallet = async () => {
    setError('');
    setLoading(true);

    try {
      // Check for Solana wallet provider (Phantom, Backpack, Solflare, etc.)
      const provider = (window as any).solana;

      if (!provider) {
        throw new Error('No Solana wallet found. Please install Phantom, Backpack, or Solflare.');
      }

      // Connect to wallet
      const resp = await provider.connect();
      const publicKey = resp.publicKey.toString();

      // Generate nonce for signature
      const nonce = Math.random().toString(36).substring(2, 15);
      const message = `Connect wallet to RenaissBlock\n\nNonce: ${nonce}\nTimestamp: ${Date.now()}`;

      // Request signature
      const encodedMessage = new TextEncoder().encode(message);
      const signedMessage = await provider.signMessage(encodedMessage, 'utf8');
      const signature = Buffer.from(signedMessage.signature).toString('base64');

      // Link wallet with signature verification
      const csrf = await getCsrfToken();
      const res = await fetch(`${API_URL}/api/wallet/link/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrf,
          'X-Requested-With': 'XMLHttpRequest',
        },
        credentials: 'include',
        body: JSON.stringify({
          wallet_address: publicKey,
          signature: signature,
          message: message,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Failed to link wallet');
      }

      setSuccess('External wallet connected!');
      setActiveAction(null);
      onWalletUpdate();
    } catch (e: any) {
      // Handle user rejection gracefully
      if (e?.code === 4001 || e?.message?.includes('User rejected')) {
        setError('Connection cancelled');
      } else {
        setError(e?.message || String(e));
      }
    } finally {
      setLoading(false);
    }
  };

  // Action: Disconnect wallet
  const disconnectWallet = async () => {
    setError('');
    setLoading(true);

    try {
      const csrf = await getCsrfToken();
      const res = await fetch(`${API_URL}/api/wallet/link/`, {
        method: 'DELETE',
        headers: {
          'X-CSRFToken': csrf,
          'X-Requested-With': 'XMLHttpRequest',
        },
        credentials: 'include',
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Failed to disconnect wallet');
      }

      setSuccess('Wallet disconnected');
      setActiveAction(null);
      setShowManageMenu(false);
      onWalletUpdate();
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  // Render: No wallet connected
  if (!walletAddress) {
    return (
      <div style={{
        background: 'var(--panel)',
        border: '1px solid var(--panel-border)',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
      }}>
        <div style={{ fontWeight: 600, color: '#f1f5f9', fontSize: 16, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Wallet size={20} /> Wallet Setup
        </div>
        <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 16 }}>
          Connect a wallet to receive USDC payments and own NFTs.
        </div>

        {error && (
          <div style={{
            background: '#ef444420',
            border: '1px solid #ef4444',
            borderRadius: 8,
            padding: 12,
            color: '#fca5a5',
            fontSize: 13,
            marginBottom: 12,
          }}>
            {error}
          </div>
        )}

        {success && (
          <div style={{
            background: '#10b98120',
            border: '1px solid #10b981',
            borderRadius: 8,
            padding: 12,
            color: '#6ee7b7',
            fontSize: 13,
            marginBottom: 12,
          }}>
            {success}
          </div>
        )}

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
          <button
            onClick={createWeb3AuthWallet}
            disabled={loading}
            style={{
              background: loading ? '#6b7280' : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              border: 'none',
              color: '#fff',
              padding: '10px 20px',
              borderRadius: 8,
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: 14,
              transition: 'all 0.2s',
            }}
            onMouseOver={(e) => {
              if (!loading) e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Loader size={16} /> Creating...
              </span>
            ) : (
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Globe size={16} /> Create Wallet with Web3Auth
              </span>
            )}
          </button>

          <button
            onClick={connectExternalWallet}
            disabled={loading}
            style={{
              background: 'transparent',
              border: '1px solid #334155',
              color: '#cbd5e1',
              padding: '10px 20px',
              borderRadius: 8,
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: 14,
              transition: 'all 0.2s',
            }}
            onMouseOver={(e) => {
              if (!loading) {
                e.currentTarget.style.borderColor = '#cbd5e1';
                e.currentTarget.style.background = 'rgba(203, 213, 225, 0.05)';
              }
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.borderColor = '#334155';
              e.currentTarget.style.background = 'transparent';
            }}
          >
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Loader size={16} /> Connecting...
              </span>
            ) : (
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Link size={16} /> Connect External Wallet
              </span>
            )}
          </button>
        </div>

        <div style={{
          fontSize: 12,
          color: '#94a3b8',
          padding: 12,
          background: '#0b1220',
          borderRadius: 8,
          border: '1px solid #1f2937',
        }}>
          <div style={{ marginBottom: 6, fontWeight: 600, color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Info size={14} /> Web3Auth (Recommended)
          </div>
          <div>
            Easiest option - create a wallet with Google/Discord. No browser extension needed.
            Your wallet is non-custodial and secured by social login.
          </div>
        </div>
      </div>
    );
  }

  // Render: Wallet connected
  const providerLabel = walletProvider === 'web3auth' ? 'Web3Auth' : 'External Wallet';
  const providerIcon = walletProvider === 'web3auth' ? <Globe size={12} /> : <Link size={12} />;

  return (
    <div style={{
      background: 'var(--panel)',
      border: '1px solid #10b981',
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
      position: 'relative',
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
      }}>
        <div style={{ flex: 1 }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 8,
          }}>
            <CheckCircle size={20} style={{ color: '#10b981' }} />
            <span style={{ fontWeight: 600, color: '#f1f5f9', fontSize: 16 }}>
              Wallet Connected
            </span>
            <span style={{
              fontSize: 11,
              color: '#6ee7b7',
              background: '#10b98120',
              padding: '2px 8px',
              borderRadius: 12,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}>
              {providerIcon} {providerLabel}
            </span>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap',
          }}>
            <div style={{
              fontSize: 14,
              color: '#e5e7eb',
              fontFamily: 'monospace',
              background: '#0b1220',
              padding: '6px 12px',
              borderRadius: 6,
              border: '1px solid #1f2937',
            }}>
              {shortenAddress(walletAddress)}
            </div>

            <button
              onClick={copyAddress}
              style={{
                background: '#1f2937',
                border: '1px solid #374151',
                color: '#cbd5e1',
                padding: '6px 12px',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = '#374151';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = '#1f2937';
              }}
            >
              <Copy size={14} style={{ marginRight: 4 }} /> Copy
            </button>

            <a
              href={getExplorerLink(walletAddress)}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                background: '#1f2937',
                border: '1px solid #374151',
                color: '#cbd5e1',
                padding: '6px 12px',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
                textDecoration: 'none',
                display: 'inline-block',
                transition: 'all 0.2s',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = '#374151';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = '#1f2937';
              }}
            >
              <ExternalLink size={14} style={{ marginRight: 4 }} /> Explorer
            </a>

            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowManageMenu(!showManageMenu)}
                style={{
                  background: '#1f2937',
                  border: '1px solid #374151',
                  color: '#cbd5e1',
                  padding: '6px 12px',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = '#374151';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = '#1f2937';
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Settings size={14} /> Manage {showManageMenu ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </span>
              </button>

              {showManageMenu && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: 8,
                  background: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: 8,
                  padding: 8,
                  minWidth: 220,
                  zIndex: 100,
                  boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                }}>
                  <button
                    onClick={() => setActiveAction('switch')}
                    style={{
                      width: '100%',
                      background: 'transparent',
                      border: 'none',
                      color: '#cbd5e1',
                      padding: '8px 12px',
                      borderRadius: 6,
                      fontSize: 13,
                      fontWeight: 500,
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.2s',
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.background = '#334155';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {walletProvider === 'web3auth' ? (
                        <>
                          <Link size={14} /> Switch to External Wallet
                        </>
                      ) : (
                        <>
                          <Globe size={14} /> Switch to Web3Auth
                        </>
                      )}
                    </span>
                  </button>

                  <div style={{
                    height: 1,
                    background: '#334155',
                    margin: '8px 0',
                  }} />

                  <button
                    onClick={() => setActiveAction('disconnect')}
                    style={{
                      width: '100%',
                      background: 'transparent',
                      border: 'none',
                      color: '#fca5a5',
                      padding: '8px 12px',
                      borderRadius: 6,
                      fontSize: 13,
                      fontWeight: 500,
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.2s',
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.background = '#ef444420';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <AlertTriangle size={14} /> Disconnect Wallet
                    </span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {success && (
        <div style={{
          background: '#10b98120',
          border: '1px solid #10b981',
          borderRadius: 8,
          padding: 12,
          color: '#6ee7b7',
          fontSize: 13,
          marginTop: 12,
        }}>
          {success}
        </div>
      )}

      {error && (
        <div style={{
          background: '#ef444420',
          border: '1px solid #ef4444',
          borderRadius: 8,
          padding: 12,
          color: '#fca5a5',
          fontSize: 13,
          marginTop: 12,
        }}>
          {error}
        </div>
      )}

      <div style={{
        fontSize: 12,
        color: '#10b981',
        marginTop: 8,
        fontWeight: 600,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}>
        <DollarSign size={14} /> Ready to receive USDC payments and own NFTs
      </div>

      {/* Switch Wallet Warning Modal */}
      {activeAction === 'switch' && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(4px)',
          display: 'grid',
          placeItems: 'center',
          zIndex: 2000,
        }}>
          <div style={{
            background: '#1e293b',
            border: '1px solid #334155',
            borderRadius: 12,
            padding: 24,
            maxWidth: 500,
            width: '90%',
          }}>
            <div style={{
              fontSize: 18,
              fontWeight: 700,
              color: '#f59e0b',
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}>
              <AlertTriangle size={20} /> Switch Wallet?
            </div>

            <div style={{
              fontSize: 14,
              color: '#cbd5e1',
              marginBottom: 16,
              lineHeight: 1.6,
            }}>
              <p style={{ marginBottom: 12 }}>
                Your existing NFTs will remain in your old wallet. You'll need to manually
                transfer them if you want them in the new wallet.
              </p>
              <p style={{ marginBottom: 12 }}>
                New purchases and payments will go to the new wallet address.
              </p>
              <div style={{
                background: '#0b1220',
                border: '1px solid #334155',
                borderRadius: 8,
                padding: 12,
                fontSize: 12,
                fontFamily: 'monospace',
                marginTop: 12,
              }}>
                <div style={{ color: '#94a3b8', marginBottom: 4 }}>Current wallet:</div>
                <div style={{ color: '#e5e7eb' }}>{walletAddress}</div>
              </div>
            </div>

            {error && (
              <div style={{
                background: '#ef444420',
                border: '1px solid #ef4444',
                borderRadius: 8,
                padding: 12,
                color: '#fca5a5',
                fontSize: 13,
                marginBottom: 16,
              }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => {
                  setActiveAction(null);
                  setError('');
                }}
                disabled={loading}
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: '1px solid #475569',
                  color: '#cbd5e1',
                  padding: '10px 20px',
                  borderRadius: 8,
                  fontWeight: 600,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontSize: 14,
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setActiveAction(null);
                  setShowManageMenu(false);
                  // Trigger the appropriate wallet connection flow
                  if (walletProvider === 'web3auth') {
                    connectExternalWallet();
                  } else {
                    createWeb3AuthWallet();
                  }
                }}
                disabled={loading}
                style={{
                  flex: 1,
                  background: loading ? '#6b7280' : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                  border: 'none',
                  color: '#fff',
                  padding: '10px 20px',
                  borderRadius: 8,
                  fontWeight: 600,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontSize: 14,
                }}
              >
                {loading ? 'Processing...' : 'Continue'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Disconnect Wallet Warning Modal */}
      {activeAction === 'disconnect' && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(4px)',
          display: 'grid',
          placeItems: 'center',
          zIndex: 2000,
        }}>
          <div style={{
            background: '#1e293b',
            border: '2px solid #ef4444',
            borderRadius: 12,
            padding: 24,
            maxWidth: 500,
            width: '90%',
          }}>
            <div style={{
              fontSize: 18,
              fontWeight: 700,
              color: '#ef4444',
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}>
              <AlertCircle size={20} /> Disconnect Wallet?
            </div>

            <div style={{
              fontSize: 14,
              color: '#cbd5e1',
              marginBottom: 16,
              lineHeight: 1.6,
            }}>
              <p style={{ marginBottom: 12, fontWeight: 600, color: '#fca5a5' }}>
                Warning: Without a wallet you CANNOT:
              </p>
              <ul style={{ paddingLeft: 20, marginBottom: 12 }}>
                <li>Receive USDC payments from new sales</li>
                <li>Receive purchased NFTs</li>
                <li>Purchase content on RenaissBlock</li>
                <li>Mint new content</li>
              </ul>
              <p style={{ marginBottom: 12 }}>
                Your library of owned NFTs will disappear until you reconnect a wallet.
              </p>
              <div style={{
                background: '#0b1220',
                border: '1px solid #334155',
                borderRadius: 8,
                padding: 12,
                fontSize: 12,
                fontFamily: 'monospace',
                marginTop: 12,
              }}>
                <div style={{ color: '#94a3b8', marginBottom: 4 }}>Your NFTs will remain in:</div>
                <div style={{ color: '#e5e7eb' }}>{walletAddress}</div>
              </div>
            </div>

            {error && (
              <div style={{
                background: '#ef444420',
                border: '1px solid #ef4444',
                borderRadius: 8,
                padding: 12,
                color: '#fca5a5',
                fontSize: 13,
                marginBottom: 16,
              }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => {
                  setActiveAction(null);
                  setError('');
                }}
                disabled={loading}
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: '1px solid #475569',
                  color: '#cbd5e1',
                  padding: '10px 20px',
                  borderRadius: 8,
                  fontWeight: 600,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontSize: 14,
                }}
              >
                Cancel
              </button>
              <button
                onClick={disconnectWallet}
                disabled={loading}
                style={{
                  flex: 1,
                  background: loading ? '#6b7280' : '#ef4444',
                  border: 'none',
                  color: '#fff',
                  padding: '10px 20px',
                  borderRadius: 8,
                  fontWeight: 600,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontSize: 14,
                }}
              >
                {loading ? 'Disconnecting...' : 'Yes, Disconnect'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
