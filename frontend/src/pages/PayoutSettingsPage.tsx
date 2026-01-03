/**
 * Payout Settings Page
 * Full configuration page for Bridge.xyz integration and payout preferences.
 * Redesigned with dark theme to match app aesthetic.
 */

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Plus, RefreshCw, Shield, Building2, Wallet,
  CheckCircle2, Clock, AlertCircle, ChevronRight, Banknote,
  CreditCard, History, Info, Zap, Send, ArrowRightLeft
} from 'lucide-react';
import {
  BridgeKYCStatus,
  BridgeBankAccountCard,
  BridgePayoutHistory,
} from '../components/bridge';
import { WithdrawToBank } from '../components/bridge/WithdrawToBank';
import { SendUSDC } from '../components/wallet/SendUSDC';
import {
  getBridgeOnboardingStatus,
  listBankAccounts,
  createLiquidationAddress,
  openBankLinkingFlow,
} from '../services/bridgeApi';
import type {
  BridgeOnboardingStatus,
  BridgeExternalAccount,
} from '../types/bridge';
import { API_URL } from '../config';

// Consistent dark theme colors
const colors = {
  bg: '#0f172a',
  bgCard: '#1e293b',
  bgHover: '#334155',
  border: '#334155',
  borderLight: '#475569',
  text: '#f8fafc',
  textSecondary: '#cbd5e1',
  textMuted: '#94a3b8',
  textDim: '#64748b',
  accent: '#f59e0b',
  accentHover: '#fbbf24',
  success: '#10b981',
  successBg: 'rgba(16,185,129,0.1)',
  error: '#ef4444',
  errorBg: 'rgba(239,68,68,0.1)',
  warning: '#f59e0b',
  warningBg: 'rgba(245,158,11,0.1)',
  info: '#3b82f6',
  infoBg: 'rgba(59,130,246,0.1)',
};

export const PayoutSettingsPage: React.FC = () => {
  const [status, setStatus] = useState<BridgeOnboardingStatus | null>(null);
  const [bankAccounts, setBankAccounts] = useState<BridgeExternalAccount[]>([]);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [linkingBank, setLinkingBank] = useState(false);
  const [creatingAddress, setCreatingAddress] = useState(false);
  const [activeTab, setActiveTab] = useState<'withdraw' | 'send'>('withdraw');

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [statusData, accountsData, profileData] = await Promise.all([
        getBridgeOnboardingStatus(),
        listBankAccounts().catch(() => ({ accounts: [] })),
        fetch(`${API_URL}/api/users/profile/`, { credentials: 'include' })
          .then(r => r.ok ? r.json() : null)
          .catch(() => null),
      ]);
      setStatus(statusData);
      setBankAccounts(accountsData.accounts || []);
      if (profileData?.wallet_address) {
        setWalletAddress(profileData.wallet_address);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load payout settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleLinkBankAccount = async () => {
    setLinkingBank(true);
    try {
      await openBankLinkingFlow();
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to link bank account');
    } finally {
      setLinkingBank(false);
    }
  };

  const handleCreateLiquidationAddress = async () => {
    const defaultAccount = bankAccounts.find((a) => a.is_default) || bankAccounts[0];
    if (!defaultAccount) {
      setError('Please link a bank account first');
      return;
    }

    setCreatingAddress(true);
    try {
      await createLiquidationAddress(defaultAccount.id);
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create payout address');
    } finally {
      setCreatingAddress(false);
    }
  };

  // Calculate setup progress
  const getSetupProgress = () => {
    let completed = 0;
    const total = 3;
    if (status?.kyc_status === 'approved') completed++;
    if (bankAccounts.length > 0) completed++;
    if (status?.has_liquidation_address) completed++;
    return { completed, total, percentage: Math.round((completed / total) * 100) };
  };

  const progress = getSetupProgress();

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: colors.bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{ textAlign: 'center' }}>
          <RefreshCw
            size={40}
            style={{
              color: colors.accent,
              animation: 'spin 1s linear infinite',
              marginBottom: 16,
            }}
          />
          <div style={{ color: colors.textMuted, fontSize: 14 }}>
            Loading payout settings...
          </div>
        </div>
        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: colors.bg,
      padding: '24px 16px 48px',
    }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <Link
            to="/profile"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              color: colors.textMuted,
              textDecoration: 'none',
              fontSize: 14,
              marginBottom: 16,
              transition: 'color 0.2s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = colors.text}
            onMouseLeave={(e) => e.currentTarget.style.color = colors.textMuted}
          >
            <ArrowLeft size={16} />
            Back to Profile
          </Link>

          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <h1 style={{
                color: colors.text,
                fontSize: 28,
                fontWeight: 700,
                margin: 0,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}>
                <Banknote size={32} style={{ color: colors.accent }} />
                Payout Settings
              </h1>
              <p style={{ color: colors.textMuted, marginTop: 8, fontSize: 15 }}>
                Configure how you receive your earnings from sales
              </p>
            </div>

            {/* Progress Indicator */}
            <div style={{
              background: colors.bgCard,
              border: `1px solid ${colors.border}`,
              borderRadius: 12,
              padding: '16px 20px',
              minWidth: 200,
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 8,
              }}>
                <span style={{ color: colors.textSecondary, fontSize: 13 }}>Setup Progress</span>
                <span style={{
                  color: progress.percentage === 100 ? colors.success : colors.accent,
                  fontSize: 14,
                  fontWeight: 600
                }}>
                  {progress.completed}/{progress.total}
                </span>
              </div>
              <div style={{
                height: 6,
                background: colors.bgHover,
                borderRadius: 3,
                overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%',
                  width: `${progress.percentage}%`,
                  background: progress.percentage === 100
                    ? `linear-gradient(90deg, ${colors.success}, #34d399)`
                    : `linear-gradient(90deg, ${colors.accent}, ${colors.accentHover})`,
                  borderRadius: 3,
                  transition: 'width 0.3s ease',
                }} />
              </div>
            </div>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div style={{
            background: colors.errorBg,
            border: `1px solid ${colors.error}`,
            borderRadius: 12,
            padding: 16,
            marginBottom: 24,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}>
            <AlertCircle size={20} style={{ color: colors.error, flexShrink: 0 }} />
            <span style={{ color: colors.error, flex: 1, fontSize: 14 }}>{error}</span>
            <button
              onClick={() => setError(null)}
              style={{
                background: 'transparent',
                border: 'none',
                color: colors.error,
                cursor: 'pointer',
                padding: 4,
                fontSize: 18,
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Step 1: KYC Verification */}
          <section style={{
            background: colors.bgCard,
            border: `1px solid ${colors.border}`,
            borderRadius: 16,
            overflow: 'hidden',
          }}>
            <div style={{
              padding: '20px 24px',
              borderBottom: `1px solid ${colors.border}`,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}>
              <div style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: status?.kyc_status === 'approved' ? colors.successBg : `${colors.accent}15`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Shield size={20} style={{
                  color: status?.kyc_status === 'approved' ? colors.success : colors.accent
                }} />
              </div>
              <div style={{ flex: 1 }}>
                <h2 style={{ color: colors.text, fontSize: 16, fontWeight: 600, margin: 0 }}>
                  Step 1: Identity Verification
                </h2>
                <p style={{ color: colors.textMuted, fontSize: 13, margin: '4px 0 0' }}>
                  Verify your identity to enable payouts
                </p>
              </div>
              {status?.kyc_status === 'approved' && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  color: colors.success,
                  fontSize: 13,
                  fontWeight: 600,
                }}>
                  <CheckCircle2 size={16} />
                  Verified
                </div>
              )}
            </div>
            <div style={{ padding: 24 }}>
              <BridgeKYCStatus
                status={status?.kyc_status || null}
                hasCustomer={status?.has_bridge_customer || false}
                onStatusChange={fetchData}
              />
            </div>
          </section>

          {/* Step 2: Bank Accounts */}
          <section style={{
            background: colors.bgCard,
            border: `1px solid ${colors.border}`,
            borderRadius: 16,
            overflow: 'hidden',
          }}>
            <div style={{
              padding: '20px 24px',
              borderBottom: `1px solid ${colors.border}`,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}>
              <div style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: bankAccounts.length > 0 ? colors.successBg : `${colors.accent}15`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Building2 size={20} style={{
                  color: bankAccounts.length > 0 ? colors.success : colors.accent
                }} />
              </div>
              <div style={{ flex: 1 }}>
                <h2 style={{ color: colors.text, fontSize: 16, fontWeight: 600, margin: 0 }}>
                  Step 2: Bank Accounts
                </h2>
                <p style={{ color: colors.textMuted, fontSize: 13, margin: '4px 0 0' }}>
                  Link your bank account for direct deposits
                </p>
              </div>
              {status?.kyc_status === 'approved' && (
                <button
                  onClick={handleLinkBankAccount}
                  disabled={linkingBank}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 16px',
                    background: colors.accent,
                    color: '#000',
                    border: 'none',
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: linkingBank ? 'not-allowed' : 'pointer',
                    opacity: linkingBank ? 0.6 : 1,
                    transition: 'all 0.2s',
                  }}
                >
                  <Plus size={16} />
                  {linkingBank ? 'Linking...' : 'Link Account'}
                </button>
              )}
            </div>
            <div style={{ padding: 24 }}>
              {status?.kyc_status !== 'approved' ? (
                <div style={{
                  background: colors.bgHover,
                  borderRadius: 12,
                  padding: 32,
                  textAlign: 'center',
                }}>
                  <Clock size={32} style={{ color: colors.textMuted, marginBottom: 12 }} />
                  <p style={{ color: colors.textMuted, margin: 0, fontSize: 14 }}>
                    Complete identity verification first to link bank accounts
                  </p>
                </div>
              ) : bankAccounts.length === 0 ? (
                <div style={{
                  background: `linear-gradient(135deg, ${colors.bg} 0%, ${colors.bgHover} 100%)`,
                  border: `1px dashed ${colors.borderLight}`,
                  borderRadius: 12,
                  padding: 32,
                  textAlign: 'center',
                }}>
                  <CreditCard size={40} style={{ color: colors.textMuted, marginBottom: 16 }} />
                  <p style={{ color: colors.textSecondary, margin: '0 0 16px', fontSize: 15 }}>
                    No bank accounts linked yet
                  </p>
                  <p style={{ color: colors.textMuted, margin: '0 0 20px', fontSize: 13 }}>
                    Link a bank account to receive direct deposits from your sales
                  </p>
                  <button
                    onClick={handleLinkBankAccount}
                    disabled={linkingBank}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '12px 24px',
                      background: colors.accent,
                      color: '#000',
                      border: 'none',
                      borderRadius: 10,
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: linkingBank ? 'not-allowed' : 'pointer',
                      opacity: linkingBank ? 0.6 : 1,
                    }}
                  >
                    <Plus size={18} />
                    {linkingBank ? 'Linking...' : 'Link Your First Bank Account'}
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {bankAccounts.map((account) => (
                    <BridgeBankAccountCard
                      key={account.id}
                      account={account}
                      onUpdate={fetchData}
                    />
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Step 3: Payout Address */}
          {status?.kyc_status === 'approved' && bankAccounts.length > 0 && (
            <section style={{
              background: colors.bgCard,
              border: `1px solid ${colors.border}`,
              borderRadius: 16,
              overflow: 'hidden',
            }}>
              <div style={{
                padding: '20px 24px',
                borderBottom: `1px solid ${colors.border}`,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}>
                <div style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: status?.has_liquidation_address ? colors.successBg : `${colors.accent}15`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Wallet size={20} style={{
                    color: status?.has_liquidation_address ? colors.success : colors.accent
                  }} />
                </div>
                <div style={{ flex: 1 }}>
                  <h2 style={{ color: colors.text, fontSize: 16, fontWeight: 600, margin: 0 }}>
                    Step 3: Payout Address
                  </h2>
                  <p style={{ color: colors.textMuted, fontSize: 13, margin: '4px 0 0' }}>
                    Enable automatic USDC to USD conversion
                  </p>
                </div>
                {status?.has_liquidation_address && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    color: colors.success,
                    fontSize: 13,
                    fontWeight: 600,
                  }}>
                    <CheckCircle2 size={16} />
                    Active
                  </div>
                )}
              </div>
              <div style={{ padding: 24 }}>
                {!status?.has_liquidation_address ? (
                  <div style={{
                    background: `linear-gradient(135deg, ${colors.bg} 0%, ${colors.bgHover} 100%)`,
                    border: `1px dashed ${colors.borderLight}`,
                    borderRadius: 12,
                    padding: 32,
                    textAlign: 'center',
                  }}>
                    <Zap size={40} style={{ color: colors.accent, marginBottom: 16 }} />
                    <p style={{ color: colors.textSecondary, margin: '0 0 12px', fontSize: 15 }}>
                      Create a payout address for automatic conversions
                    </p>
                    <p style={{ color: colors.textMuted, margin: '0 0 20px', fontSize: 13, maxWidth: 400, marginLeft: 'auto', marginRight: 'auto' }}>
                      Once created, earnings sent to this address will automatically convert to USD and deposit to your bank account
                    </p>
                    <button
                      onClick={handleCreateLiquidationAddress}
                      disabled={creatingAddress}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '12px 24px',
                        background: colors.success,
                        color: '#fff',
                        border: 'none',
                        borderRadius: 10,
                        fontSize: 14,
                        fontWeight: 600,
                        cursor: creatingAddress ? 'not-allowed' : 'pointer',
                        opacity: creatingAddress ? 0.6 : 1,
                      }}
                    >
                      {creatingAddress ? (
                        <>
                          <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} />
                          Creating...
                        </>
                      ) : (
                        <>
                          <Plus size={18} />
                          Create Payout Address
                        </>
                      )}
                    </button>
                  </div>
                ) : (
                  <div style={{
                    background: colors.successBg,
                    border: `1px solid ${colors.success}40`,
                    borderRadius: 12,
                    padding: 20,
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 16,
                  }}>
                    <CheckCircle2 size={24} style={{ color: colors.success, flexShrink: 0, marginTop: 2 }} />
                    <div>
                      <div style={{ color: colors.success, fontWeight: 600, fontSize: 15, marginBottom: 4 }}>
                        Payout Address Active
                      </div>
                      <p style={{ color: colors.textSecondary, margin: 0, fontSize: 13, lineHeight: 1.5 }}>
                        Your payout address is set up and ready to receive USDC. Funds will automatically convert to USD and deposit to your bank account.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Transfer USDC Section - Only show when wallet is connected */}
          {walletAddress && (
            <section style={{
              background: colors.bgCard,
              border: `1px solid ${colors.border}`,
              borderRadius: 16,
              overflow: 'hidden',
            }}>
              <div style={{
                padding: '20px 24px',
                borderBottom: `1px solid ${colors.border}`,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}>
                <div style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: `${colors.accent}15`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Send size={20} style={{ color: colors.accent }} />
                </div>
                <div style={{ flex: 1 }}>
                  <h2 style={{ color: colors.text, fontSize: 16, fontWeight: 600, margin: 0 }}>
                    Transfer USDC
                  </h2>
                  <p style={{ color: colors.textMuted, fontSize: 13, margin: '4px 0 0' }}>
                    Withdraw to bank or send to external wallet
                  </p>
                </div>
              </div>

              {/* Tab Navigation */}
              <div style={{
                display: 'flex',
                borderBottom: `1px solid ${colors.border}`,
                padding: '0 24px',
              }}>
                <button
                  onClick={() => setActiveTab('withdraw')}
                  style={{
                    padding: '12px 20px',
                    background: 'none',
                    border: 'none',
                    color: activeTab === 'withdraw' ? colors.accent : colors.textMuted,
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: 'pointer',
                    borderBottom: activeTab === 'withdraw' ? `2px solid ${colors.accent}` : '2px solid transparent',
                    marginBottom: -1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <ArrowRightLeft size={16} />
                  Withdraw to Bank
                </button>
                <button
                  onClick={() => setActiveTab('send')}
                  style={{
                    padding: '12px 20px',
                    background: 'none',
                    border: 'none',
                    color: activeTab === 'send' ? colors.info : colors.textMuted,
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: 'pointer',
                    borderBottom: activeTab === 'send' ? `2px solid ${colors.info}` : '2px solid transparent',
                    marginBottom: -1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <Send size={16} />
                  Send to Wallet
                </button>
              </div>

              <div style={{ padding: 24 }}>
                {activeTab === 'withdraw' ? (
                  status?.is_fully_setup ? (
                    <WithdrawToBank
                      walletAddress={walletAddress}
                      onWithdrawComplete={fetchData}
                    />
                  ) : (
                    <div style={{
                      background: colors.bgHover,
                      borderRadius: 12,
                      padding: 32,
                      textAlign: 'center',
                    }}>
                      <Banknote size={40} style={{ color: colors.textMuted, marginBottom: 16 }} />
                      <p style={{ color: colors.textSecondary, margin: '0 0 8px', fontSize: 15 }}>
                        Complete Bridge Setup First
                      </p>
                      <p style={{ color: colors.textMuted, margin: 0, fontSize: 13 }}>
                        Finish identity verification, link a bank account, and create a payout address to enable withdrawals.
                      </p>
                    </div>
                  )
                ) : (
                  <SendUSDC
                    walletAddress={walletAddress}
                    onSendComplete={fetchData}
                  />
                )}
              </div>
            </section>
          )}

          {/* No Wallet Warning */}
          {!walletAddress && (
            <section style={{
              background: colors.warningBg,
              border: `1px solid ${colors.accent}40`,
              borderRadius: 16,
              padding: 24,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 16,
            }}>
              <Wallet size={24} style={{ color: colors.accent, flexShrink: 0 }} />
              <div>
                <h3 style={{ color: colors.text, fontSize: 16, fontWeight: 600, margin: '0 0 8px' }}>
                  Wallet Not Connected
                </h3>
                <p style={{ color: colors.textSecondary, margin: 0, fontSize: 14 }}>
                  You need to connect a Web3Auth wallet to transfer USDC. Go to your{' '}
                  <Link to="/profile" style={{ color: colors.accent }}>Profile</Link> to set up your wallet.
                </p>
              </div>
            </section>
          )}

          {/* Payout History */}
          {status?.is_fully_setup && (
            <section style={{
              background: colors.bgCard,
              border: `1px solid ${colors.border}`,
              borderRadius: 16,
              overflow: 'hidden',
            }}>
              <div style={{
                padding: '20px 24px',
                borderBottom: `1px solid ${colors.border}`,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}>
                <div style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: `${colors.accent}15`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <History size={20} style={{ color: colors.accent }} />
                </div>
                <div>
                  <h2 style={{ color: colors.text, fontSize: 16, fontWeight: 600, margin: 0 }}>
                    Payout History
                  </h2>
                  <p style={{ color: colors.textMuted, fontSize: 13, margin: '4px 0 0' }}>
                    View your past payouts and transactions
                  </p>
                </div>
              </div>
              <div style={{ padding: 24 }}>
                <BridgePayoutHistory />
              </div>
            </section>
          )}

          {/* Info Section */}
          <section style={{
            background: `linear-gradient(135deg, ${colors.infoBg} 0%, rgba(59,130,246,0.05) 100%)`,
            border: `1px solid ${colors.info}30`,
            borderRadius: 16,
            padding: 24,
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
              <div style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: colors.infoBg,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Info size={22} style={{ color: colors.info }} />
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ color: colors.text, fontSize: 16, fontWeight: 600, margin: '0 0 12px' }}>
                  How Direct Bank Deposits Work
                </h3>
                <div style={{ display: 'grid', gap: 10 }}>
                  {[
                    { num: 1, text: 'Complete identity verification (KYC) - usually takes a few minutes' },
                    { num: 2, text: 'Link your bank account securely via Plaid or manual entry' },
                    { num: 3, text: 'Create a payout address to enable USDC to USD conversion' },
                    { num: 4, text: 'Transfer USDC from your wallet to withdraw to bank or send externally' },
                    { num: 5, text: 'Withdrawals convert to USD and deposit within 1-2 business days' },
                  ].map(({ num, text }) => (
                    <div key={num} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                      <div style={{
                        width: 24,
                        height: 24,
                        borderRadius: 6,
                        background: colors.info,
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 12,
                        fontWeight: 700,
                        flexShrink: 0,
                      }}>
                        {num}
                      </div>
                      <span style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 1.5 }}>
                        {text}
                      </span>
                    </div>
                  ))}
                </div>
                <p style={{
                  color: colors.textMuted,
                  fontSize: 12,
                  margin: '16px 0 0',
                  paddingTop: 12,
                  borderTop: `1px solid ${colors.info}20`,
                }}>
                  Powered by Bridge.xyz. Funds typically arrive within 1-2 business days.
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default PayoutSettingsPage;
