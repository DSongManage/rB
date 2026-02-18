/**
 * Payout Settings Page
 * Full configuration page for Bridge.xyz integration and payout preferences.
 * Redesigned with dark theme to match app aesthetic.
 */

import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
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
  linkBankAccountManual,
  lookupRoutingNumber,
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

// Shared form styles
const labelStyle: React.CSSProperties = {
  display: 'block',
  color: colors.textSecondary,
  fontSize: 13,
  marginBottom: 6,
  fontWeight: 500,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  background: colors.bgCard,
  border: `1px solid ${colors.border}`,
  borderRadius: 8,
  color: colors.text,
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
};

export const PayoutSettingsPage: React.FC = () => {
  const [status, setStatus] = useState<BridgeOnboardingStatus | null>(null);
  const [bankAccounts, setBankAccounts] = useState<BridgeExternalAccount[]>([]);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showBankForm, setShowBankForm] = useState(false);
  const [bankFormLoading, setBankFormLoading] = useState(false);
  const [bankFormError, setBankFormError] = useState<string | null>(null);
  const [bankFormData, setBankFormData] = useState({
    first_name: '',
    last_name: '',
    routing_number: '',
    account_number: '',
    account_number_confirm: '',
    checking_or_savings: 'checking' as 'checking' | 'savings',
    street_line_1: '',
    street_line_2: '',
    city: '',
    state: '',
    postal_code: '',
  });
  const [routingLookup, setRoutingLookup] = useState<{ bank_name?: string; valid?: boolean; loading?: boolean } | null>(null);
  const routingLookupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [confirmTouched, setConfirmTouched] = useState(false);
  const addressInputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [creatingAddress, setCreatingAddress] = useState(false);
  const [activeTab, setActiveTab] = useState<'withdraw' | 'send'>('withdraw');

  // Account number mismatch detection
  const accountNumberMismatch = useMemo(() => {
    if (!confirmTouched) return false;
    if (!bankFormData.account_number_confirm) return false;
    return bankFormData.account_number !== bankFormData.account_number_confirm;
  }, [bankFormData.account_number, bankFormData.account_number_confirm, confirmTouched]);

  const accountNumbersMatch = useMemo(() => {
    if (!bankFormData.account_number || !bankFormData.account_number_confirm) return false;
    return bankFormData.account_number === bankFormData.account_number_confirm;
  }, [bankFormData.account_number, bankFormData.account_number_confirm]);

  const fetchData = async (background = false) => {
    if (!background) {
      setLoading(true);
      setError(null);
    }
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
      if (!background) {
        setError(err instanceof Error ? err.message : 'Failed to load payout settings');
      }
    } finally {
      if (!background) {
        setLoading(false);
      }
    }
  };

  // Background refresh for polling — no loading spinner, no error display
  const refreshStatus = useCallback(() => fetchData(true), []);

  useEffect(() => {
    fetchData();
  }, []);

  // Load Google Places script & attach autocomplete when form is shown
  useEffect(() => {
    if (!showBankForm) return;

    const apiKey = import.meta.env.VITE_GOOGLE_PLACES_API_KEY;
    if (!apiKey) return;

    const initAutocomplete = () => {
      if (!addressInputRef.current || autocompleteRef.current) return;
      const ac = new google.maps.places.Autocomplete(addressInputRef.current, {
        types: ['address'],
        componentRestrictions: { country: 'us' },
        fields: ['address_components'],
      });
      ac.addListener('place_changed', () => {
        const place = ac.getPlace();
        if (!place.address_components) return;
        let street_number = '';
        let route = '';
        let city = '';
        let state = '';
        let postal_code = '';
        let subpremise = '';
        for (const c of place.address_components) {
          const t = c.types[0];
          if (t === 'street_number') street_number = c.long_name;
          else if (t === 'route') route = c.short_name;
          else if (t === 'locality') city = c.long_name;
          else if (t === 'sublocality_level_1' && !city) city = c.long_name;
          else if (t === 'administrative_area_level_1') state = c.short_name;
          else if (t === 'postal_code') postal_code = c.long_name;
          else if (t === 'subpremise') subpremise = c.long_name;
        }
        setBankFormData(prev => ({
          ...prev,
          street_line_1: `${street_number} ${route}`.trim(),
          street_line_2: subpremise ? `#${subpremise}` : prev.street_line_2,
          city,
          state,
          postal_code,
        }));
      });
      autocompleteRef.current = ac;
    };

    // If Google Maps is already loaded
    if (window.google?.maps?.places) {
      initAutocomplete();
      return;
    }

    // Load the script
    const existing = document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]');
    if (existing) {
      existing.addEventListener('load', initAutocomplete);
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.onload = initAutocomplete;
    document.head.appendChild(script);

    return () => {
      autocompleteRef.current = null;
    };
  }, [showBankForm]);

  const handleRoutingNumberChange = (value: string) => {
    const clean = value.replace(/\D/g, '');
    setBankFormData(prev => ({ ...prev, routing_number: clean }));

    // Clear previous timer
    if (routingLookupTimer.current) clearTimeout(routingLookupTimer.current);

    if (clean.length !== 9) {
      setRoutingLookup(null);
      return;
    }

    // Debounce the lookup
    setRoutingLookup({ loading: true });
    routingLookupTimer.current = setTimeout(async () => {
      try {
        const result = await lookupRoutingNumber(clean);
        setRoutingLookup(result);
      } catch {
        setRoutingLookup(null);
      }
    }, 300);
  };

  const handleLinkBankAccount = () => {
    setShowBankForm(true);
    setBankFormError(null);
    setRoutingLookup(null);
  };

  const handleBankFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBankFormError(null);

    // Validate
    if (!bankFormData.first_name.trim() || !bankFormData.last_name.trim()) {
      setBankFormError('First and last name are required');
      return;
    }
    if (bankFormData.account_number !== bankFormData.account_number_confirm) {
      setBankFormError('Account numbers do not match');
      return;
    }
    if (bankFormData.routing_number.length !== 9) {
      setBankFormError('Routing number must be 9 digits');
      return;
    }
    if (routingLookup?.valid === false) {
      setBankFormError('Please enter a valid routing number');
      return;
    }
    if (bankFormData.account_number.length < 4) {
      setBankFormError('Account number must be at least 4 digits');
      return;
    }
    if (!bankFormData.street_line_1.trim() || !bankFormData.city.trim() || !bankFormData.state.trim() || !bankFormData.postal_code.trim()) {
      setBankFormError('Complete mailing address is required');
      return;
    }

    setBankFormLoading(true);
    try {
      await linkBankAccountManual({
        account_number: bankFormData.account_number,
        routing_number: bankFormData.routing_number,
        checking_or_savings: bankFormData.checking_or_savings,
        account_owner_name: `${bankFormData.first_name} ${bankFormData.last_name}`,
        first_name: bankFormData.first_name,
        last_name: bankFormData.last_name,
        street_line_1: bankFormData.street_line_1,
        street_line_2: bankFormData.street_line_2 || undefined,
        city: bankFormData.city,
        state: bankFormData.state.toUpperCase(),
        postal_code: bankFormData.postal_code,
      });
      setShowBankForm(false);
      setRoutingLookup(null);
      setConfirmTouched(false);
      setBankFormData({
        first_name: '',
        last_name: '',
        routing_number: '',
        account_number: '',
        account_number_confirm: '',
        checking_or_savings: 'checking',
        street_line_1: '',
        street_line_2: '',
        city: '',
        state: '',
        postal_code: '',
      });
      await fetchData();
    } catch (err) {
      setBankFormError(err instanceof Error ? err.message : 'Failed to link bank account');
    } finally {
      setBankFormLoading(false);
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
          .pac-container {
            background: #1e293b;
            border: 1px solid #475569;
            border-radius: 8px;
            margin-top: 4px;
            font-family: inherit;
            box-shadow: 0 8px 24px rgba(0,0,0,0.4);
          }
          .pac-item {
            padding: 8px 14px;
            color: #f8fafc;
            border-top: 1px solid #334155;
            cursor: pointer;
            font-size: 14px;
          }
          .pac-item:first-child { border-top: none; }
          .pac-item:hover, .pac-item-selected {
            background: #334155;
          }
          .pac-item-query { color: #f8fafc; font-weight: 500; }
          .pac-matched { color: #f59e0b; font-weight: 600; }
          .pac-icon { display: none; }
          .pac-item span:last-child { color: #94a3b8; }
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

        {/* USDC Info Banner */}
        <div style={{
          background: colors.successBg,
          border: `1px solid ${colors.success}40`,
          borderRadius: 12,
          padding: 16,
          marginBottom: 24,
          display: 'flex',
          alignItems: 'flex-start',
          gap: 14,
        }}>
          <div style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: `${colors.success}20`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Banknote size={20} style={{ color: colors.success }} />
          </div>
          <div>
            <div style={{ color: colors.text, fontWeight: 600, fontSize: 15, marginBottom: 4 }}>
              Your earnings are paid in USDC
            </div>
            <p style={{ color: colors.textSecondary, margin: 0, fontSize: 13, lineHeight: 1.5 }}>
              USDC is a digital dollar — always worth exactly $1 USD. Set up bank deposits below
              to automatically convert to regular dollars, or keep your balance for purchases on renaissBlock.
            </p>
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
                onStatusChange={refreshStatus}
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
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  <Plus size={16} />
                  Link Account
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
              ) : (
                <>
                  {/* Bank Account Form */}
                  {showBankForm && (
                    <div style={{
                      background: colors.bg,
                      border: `1px solid ${colors.borderLight}`,
                      borderRadius: 12,
                      padding: 24,
                      marginBottom: bankAccounts.length > 0 ? 16 : 0,
                    }}>
                      <h3 style={{ color: colors.text, fontSize: 16, fontWeight: 600, margin: '0 0 4px' }}>
                        Link Bank Account
                      </h3>
                      <p style={{ color: colors.textMuted, fontSize: 13, margin: '0 0 20px' }}>
                        Enter your US bank account details for direct deposits.
                      </p>

                      {bankFormError && (
                        <div style={{
                          background: colors.errorBg,
                          border: `1px solid ${colors.error}40`,
                          borderRadius: 8,
                          padding: 12,
                          marginBottom: 16,
                          color: colors.error,
                          fontSize: 13,
                        }}>
                          {bankFormError}
                        </div>
                      )}

                      <form onSubmit={handleBankFormSubmit}>
                        <div style={{ display: 'grid', gap: 16 }}>
                          {/* Name */}
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                            <div>
                              <label style={labelStyle}>First Name *</label>
                              <input
                                type="text"
                                required
                                value={bankFormData.first_name}
                                onChange={(e) => setBankFormData(prev => ({ ...prev, first_name: e.target.value }))}
                                placeholder="First name"
                                style={inputStyle}
                              />
                            </div>
                            <div>
                              <label style={labelStyle}>Last Name *</label>
                              <input
                                type="text"
                                required
                                value={bankFormData.last_name}
                                onChange={(e) => setBankFormData(prev => ({ ...prev, last_name: e.target.value }))}
                                placeholder="Last name"
                                style={inputStyle}
                              />
                            </div>
                          </div>

                          {/* Routing Number */}
                          <div>
                            <label style={labelStyle}>Routing Number *</label>
                            <input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              maxLength={9}
                              required
                              value={bankFormData.routing_number}
                              onChange={(e) => handleRoutingNumberChange(e.target.value)}
                              placeholder="9-digit routing number"
                              style={{
                                ...inputStyle,
                                borderColor: routingLookup?.valid === false ? colors.error
                                  : routingLookup?.valid === true ? colors.success
                                  : colors.border,
                              }}
                            />
                            {routingLookup && (
                              <div style={{
                                marginTop: 6,
                                fontSize: 13,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                              }}>
                                {routingLookup.loading ? (
                                  <span style={{ color: colors.textMuted }}>Looking up...</span>
                                ) : routingLookup.valid ? (
                                  <>
                                    <CheckCircle2 size={14} style={{ color: colors.success }} />
                                    <span style={{ color: colors.success, fontWeight: 500 }}>
                                      {routingLookup.bank_name}
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    <AlertCircle size={14} style={{ color: colors.error }} />
                                    <span style={{ color: colors.error }}>
                                      Invalid routing number
                                    </span>
                                  </>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Account Number */}
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                            <div>
                              <label style={labelStyle}>Account Number *</label>
                              <input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                required
                                value={bankFormData.account_number}
                                onChange={(e) => setBankFormData(prev => ({ ...prev, account_number: e.target.value.replace(/\D/g, '') }))}
                                placeholder="Account number"
                                style={inputStyle}
                              />
                            </div>
                            <div>
                              <label style={labelStyle}>Confirm Account Number *</label>
                              <input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                required
                                value={bankFormData.account_number_confirm}
                                onChange={(e) => {
                                  setConfirmTouched(true);
                                  setBankFormData(prev => ({ ...prev, account_number_confirm: e.target.value.replace(/\D/g, '') }));
                                }}
                                placeholder="Re-enter account number"
                                style={{
                                  ...inputStyle,
                                  borderColor: accountNumberMismatch ? colors.error
                                    : accountNumbersMatch ? colors.success
                                    : colors.border,
                                }}
                              />
                              {(accountNumberMismatch || accountNumbersMatch) && (
                                <div style={{
                                  marginTop: 6,
                                  fontSize: 13,
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 6,
                                }}>
                                  {accountNumberMismatch ? (
                                    <>
                                      <AlertCircle size={14} style={{ color: colors.error }} />
                                      <span style={{ color: colors.error }}>Account numbers don't match</span>
                                    </>
                                  ) : (
                                    <>
                                      <CheckCircle2 size={14} style={{ color: colors.success }} />
                                      <span style={{ color: colors.success, fontWeight: 500 }}>Numbers match</span>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Account Type */}
                          <div>
                            <label style={labelStyle}>Account Type *</label>
                            <div style={{ display: 'flex', gap: 12 }}>
                              {(['checking', 'savings'] as const).map((type) => (
                                <button
                                  key={type}
                                  type="button"
                                  onClick={() => setBankFormData(prev => ({ ...prev, checking_or_savings: type }))}
                                  style={{
                                    flex: 1,
                                    padding: '10px 16px',
                                    background: bankFormData.checking_or_savings === type ? `${colors.accent}20` : colors.bgCard,
                                    border: `1px solid ${bankFormData.checking_or_savings === type ? colors.accent : colors.border}`,
                                    borderRadius: 8,
                                    color: bankFormData.checking_or_savings === type ? colors.accent : colors.textSecondary,
                                    fontSize: 14,
                                    fontWeight: 500,
                                    cursor: 'pointer',
                                    textTransform: 'capitalize',
                                  }}
                                >
                                  {type}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Address Section */}
                          <div style={{ borderTop: `1px solid ${colors.border}`, paddingTop: 16 }}>
                            <label style={{ ...labelStyle, fontSize: 14, fontWeight: 600, marginBottom: 12, display: 'block' }}>
                              Mailing Address
                            </label>
                            <div style={{ display: 'grid', gap: 12 }}>
                              <div>
                                <label style={labelStyle}>Street Address *</label>
                                <input
                                  ref={addressInputRef}
                                  type="text"
                                  required
                                  value={bankFormData.street_line_1}
                                  onChange={(e) => setBankFormData(prev => ({ ...prev, street_line_1: e.target.value }))}
                                  placeholder="Start typing to search..."
                                  autoComplete="off"
                                  style={inputStyle}
                                />
                              </div>
                              <div>
                                <label style={labelStyle}>Apt / Suite (optional)</label>
                                <input
                                  type="text"
                                  value={bankFormData.street_line_2}
                                  onChange={(e) => setBankFormData(prev => ({ ...prev, street_line_2: e.target.value }))}
                                  placeholder="Apt 4B"
                                  style={inputStyle}
                                />
                              </div>
                              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12 }}>
                                <div>
                                  <label style={labelStyle}>City *</label>
                                  <input
                                    type="text"
                                    required
                                    value={bankFormData.city}
                                    onChange={(e) => setBankFormData(prev => ({ ...prev, city: e.target.value }))}
                                    placeholder="City"
                                    style={inputStyle}
                                  />
                                </div>
                                <div>
                                  <label style={labelStyle}>State *</label>
                                  <input
                                    type="text"
                                    required
                                    maxLength={2}
                                    value={bankFormData.state}
                                    onChange={(e) => setBankFormData(prev => ({ ...prev, state: e.target.value.toUpperCase().replace(/[^A-Z]/g, '') }))}
                                    placeholder="CA"
                                    style={inputStyle}
                                  />
                                </div>
                                <div>
                                  <label style={labelStyle}>ZIP *</label>
                                  <input
                                    type="text"
                                    required
                                    maxLength={10}
                                    value={bankFormData.postal_code}
                                    onChange={(e) => setBankFormData(prev => ({ ...prev, postal_code: e.target.value }))}
                                    placeholder="94107"
                                    style={inputStyle}
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div style={{ display: 'flex', gap: 12, marginTop: 24, justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            onClick={() => { setShowBankForm(false); setBankFormError(null); }}
                            style={{
                              padding: '10px 20px',
                              background: colors.bgHover,
                              color: colors.textSecondary,
                              border: `1px solid ${colors.border}`,
                              borderRadius: 8,
                              fontSize: 14,
                              fontWeight: 500,
                              cursor: 'pointer',
                            }}
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={bankFormLoading || accountNumberMismatch}
                            style={{
                              padding: '10px 24px',
                              background: colors.accent,
                              color: '#000',
                              border: 'none',
                              borderRadius: 8,
                              fontSize: 14,
                              fontWeight: 600,
                              cursor: (bankFormLoading || accountNumberMismatch) ? 'not-allowed' : 'pointer',
                              opacity: (bankFormLoading || accountNumberMismatch) ? 0.6 : 1,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                            }}
                          >
                            {bankFormLoading && <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} />}
                            {bankFormLoading ? 'Linking...' : 'Link Account'}
                          </button>
                        </div>
                      </form>
                    </div>
                  )}

                  {/* Empty state or account list */}
                  {bankAccounts.length === 0 && !showBankForm ? (
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
                          cursor: 'pointer',
                        }}
                      >
                        <Plus size={18} />
                        Link Your First Bank Account
                      </button>
                    </div>
                  ) : bankAccounts.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {bankAccounts.map((account) => (
                        <BridgeBankAccountCard
                          key={account.id}
                          account={account}
                          onUpdate={fetchData}
                        />
                      ))}
                    </div>
                  ) : null}
                </>
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
