import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, DollarSign, Shield, Loader2, CheckCircle, Gift, Users, CreditCard, Wallet, ExternalLink } from 'lucide-react';
import campaignApi, { Campaign, CampaignTier, ContributionIntentResponse } from '../../services/campaignApi';
import { signMessageForSponsoredTx } from '../../services/web3authService';

interface CampaignContributionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onContributed: () => void;
  campaign: Campaign;
}

type Step = 'amount' | 'loading' | 'confirm' | 'processing' | 'success' | 'error';

export function CampaignContributionModal({
  isOpen,
  onClose,
  onContributed,
  campaign,
}: CampaignContributionModalProps) {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('amount');
  const [amount, setAmount] = useState('');
  const [selectedTier, setSelectedTier] = useState<CampaignTier | null>(null);
  const [intent, setIntent] = useState<ContributionIntentResponse | null>(null);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const tiers = campaign.tiers || [];
  const hasTiers = tiers.length > 0;

  const handleSelectTier = (tier: CampaignTier) => {
    setSelectedTier(tier);
    setAmount(tier.minimum_amount);
  };

  const handleCreateIntent = async () => {
    if (!amount || parseFloat(amount) < 1) {
      setError('Minimum contribution is $1.00');
      return;
    }
    setStep('loading');
    setError('');
    try {
      const response = await campaignApi.createContributionIntent(campaign.id, amount);
      setIntent(response);
      setStep('confirm');
    } catch (err: any) {
      setError(err.message || 'Failed to create contribution');
      setStep('error');
    }
  };

  const handleConfirm = async () => {
    if (!intent) return;
    setStep('processing');
    try {
      if (intent.on_chain) {
        // On-chain flow: fetch a FRESH sponsored tx right before signing
        // (avoids blockhash expiry between intent creation and user clicking sign)
        const freshIntent = await campaignApi.createContributionIntent(intent.campaign_id, intent.amount);

        if (!freshIntent.serialized_transaction || !freshIntent.serialized_message) {
          throw new Error('On-chain transaction could not be built');
        }

        // Sign with Web3Auth
        const { signedTransaction } = await signMessageForSponsoredTx(
          freshIntent.serialized_transaction
        );

        // Send the full signed transaction to backend
        await campaignApi.submitSignedContribution(
          freshIntent.contribution_id,
          freshIntent.serialized_message,
          signedTransaction,
        );
      } else {
        // Off-chain / balance-based flow
        await campaignApi.confirmContribution(intent.contribution_id);
      }

      setStep('success');
      setTimeout(() => {
        onContributed();
        onClose();
        setStep('amount');
        setAmount('');
        setSelectedTier(null);
        setIntent(null);
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to process contribution');
      setStep('error');
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.7)',
    }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: 'var(--dropdown-bg)', border: '1px solid var(--border)',
        borderRadius: 16, padding: 24, maxWidth: 480, width: '90%',
        maxHeight: '85vh', overflowY: 'auto',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 20,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <DollarSign size={20} style={{ color: '#8b5cf6' }} />
            <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>
              Back this Campaign
            </span>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
          }}>
            <X size={20} />
          </button>
        </div>

        {/* Amount Selection */}
        {step === 'amount' && (
          <>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
              {campaign.title}
            </div>

            {/* Tier-based selection */}
            {hasTiers && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                {tiers.map((tier, i) => {
                  const isSelected = selectedTier?.title === tier.title;
                  const tierAmount = parseFloat(tier.minimum_amount);
                  const available = tier.is_available !== false;
                  return (
                    <div
                      key={i}
                      onClick={() => available && handleSelectTier(tier)}
                      style={{
                        padding: 14, borderRadius: 10, cursor: available ? 'pointer' : 'not-allowed',
                        background: isSelected ? '#4f46e515' : 'var(--bg-secondary)',
                        border: `2px solid ${isSelected ? '#4f46e5' : 'var(--border)'}`,
                        opacity: available ? 1 : 0.5,
                        transition: 'all 0.2s',
                      }}
                    >
                      <div style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        marginBottom: 6,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Gift size={14} style={{ color: isSelected ? '#8b5cf6' : 'var(--text-muted)' }} />
                          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
                            {tier.title}
                          </span>
                        </div>
                        <span style={{
                          fontSize: 14, fontWeight: 700,
                          color: isSelected ? '#8b5cf6' : '#10b981',
                        }}>
                          ${tierAmount.toFixed(0)}+
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                        {tier.description}
                      </div>
                      {tier.max_backers && (
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: 4,
                          fontSize: 11, color: available ? '#64748b' : '#ef4444', marginTop: 6,
                        }}>
                          <Users size={10} />
                          {available
                            ? `${tier.current_backers || 0}/${tier.max_backers} claimed`
                            : 'Sold out'}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Custom amount option */}
                <div
                  onClick={() => { setSelectedTier(null); setAmount(''); }}
                  style={{
                    padding: 12, borderRadius: 10, cursor: 'pointer',
                    background: !selectedTier && !amount ? '#4f46e510' : 'transparent',
                    border: `1px dashed ${!selectedTier ? '#4f46e540' : 'var(--border)'}`,
                    textAlign: 'center',
                  }}
                >
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    Or enter a custom amount
                  </span>
                </div>
              </div>
            )}

            {/* Preset amounts (only when no tiers) */}
            {!hasTiers && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                {[10, 25, 50, 100].filter(v => v <= parseFloat(campaign.funding_goal) - parseFloat(campaign.current_amount)).map(preset => (
                  <button
                    key={preset}
                    onClick={() => setAmount(String(preset))}
                    style={{
                      flex: 1, padding: '8px 4px', borderRadius: 8,
                      background: amount === String(preset) ? '#4f46e520' : 'var(--bg-secondary)',
                      border: `1px solid ${amount === String(preset) ? '#4f46e5' : 'var(--border)'}`,
                      color: 'var(--text)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    ${preset}
                  </button>
                ))}
              </div>
            )}

            {/* Custom amount input (always visible when no tier selected, or no tiers exist) */}
            {(!hasTiers || !selectedTier) && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: 'var(--bg-secondary)', borderRadius: 8, padding: '8px 12px',
                border: '1px solid var(--border)', marginBottom: 16,
              }}>
                <span style={{ color: 'var(--text-muted)', fontSize: 16 }}>$</span>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Enter amount"
                  style={{
                    background: 'transparent', border: 'none', outline: 'none',
                    color: 'var(--text)', fontSize: 16, width: '100%',
                  }}
                />
              </div>
            )}

            {/* Selected tier summary */}
            {selectedTier && (
              <div style={{
                background: 'var(--bg-secondary)', borderRadius: 8, padding: 12,
                marginBottom: 16, border: '1px solid #4f46e540',
              }}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  marginBottom: 4,
                }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                    {selectedTier.title}
                  </span>
                  <span style={{ fontSize: 15, fontWeight: 700, color: '#10b981' }}>
                    ${parseFloat(amount).toFixed(2)}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {selectedTier.description}
                </div>
              </div>
            )}

            {/* Fee note */}
            <div style={{
              background: 'var(--bg-secondary)', borderRadius: 8, padding: 10, border: '1px solid var(--border)',
              display: 'flex', gap: 8, fontSize: 12, color: '#8b5cf6',
              marginBottom: 16, lineHeight: 1.4,
            }}>
              <Shield size={14} style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <strong>0% campaign fee.</strong> Your full contribution goes to the project.
                Funds are held in escrow until the creator delivers.
              </div>
            </div>

            {error && (
              <div style={{
                color: '#ef4444', fontSize: 12, marginBottom: 12, textAlign: 'center',
              }}>
                {error}
              </div>
            )}

            <button
              onClick={handleCreateIntent}
              disabled={!amount || parseFloat(amount) < 1}
              style={{
                width: '100%', padding: '12px 16px', borderRadius: 8,
                background: amount && parseFloat(amount) >= 1 ? '#4f46e5' : '#334155',
                border: 'none', color: '#fff', fontSize: 14, fontWeight: 600,
                cursor: amount && parseFloat(amount) >= 1 ? 'pointer' : 'not-allowed',
              }}
            >
              {selectedTier ? `Back as ${selectedTier.title}` : 'Continue'}
            </button>
          </>
        )}

        {/* Loading */}
        {step === 'loading' && (
          <div style={{ textAlign: 'center', padding: 24 }}>
            <Loader2 size={32} style={{ color: '#8b5cf6', animation: 'spin 1s linear infinite' }} />
            <div style={{ color: 'var(--text-muted)', marginTop: 12, fontSize: 14 }}>
              Preparing contribution...
            </div>
          </div>
        )}

        {/* Confirm — with payment options when balance is insufficient */}
        {step === 'confirm' && intent && (
          <div style={{ padding: 16 }}>
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 14, color: 'var(--text)', marginBottom: 8 }}>
                Contribute <strong style={{ color: '#10b981' }}>${intent.amount}</strong> to {campaign.title}?
              </div>
              {selectedTier && (
                <div style={{
                  fontSize: 12, color: '#a78bfa', marginBottom: 8,
                  background: '#4f46e515', borderRadius: 6, padding: '6px 10px', display: 'inline-block',
                }}>
                  {selectedTier.title} tier
                </div>
              )}
            </div>

            {(intent.has_sufficient_balance || intent.has_wallet_balance) ? (
              <>
                {/* Sufficient balance — show confirm */}
                <div style={{
                  background: '#10b98110', borderRadius: 8, padding: 12, border: '1px solid #10b98130',
                  marginBottom: 16, textAlign: 'center',
                }}>
                  {intent.has_wallet_balance && intent.on_chain ? (
                    <>
                      <div style={{ fontSize: 13, color: '#10b981' }}>
                        Wallet USDC: <strong>${parseFloat(intent.wallet_balance || '0').toFixed(2)}</strong>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                        Pays directly from your wallet via on-chain escrow
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize: 13, color: '#10b981' }}>
                        Balance: <strong>${intent.current_balance}</strong>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                        After contribution: ${(parseFloat(intent.current_balance) - parseFloat(intent.amount)).toFixed(2)}
                      </div>
                    </>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    onClick={() => { setStep('amount'); setIntent(null); }}
                    style={{
                      flex: 1, padding: '10px 16px', borderRadius: 8,
                      background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)',
                      fontSize: 13, cursor: 'pointer',
                    }}
                  >
                    Back
                  </button>
                  <button
                    onClick={handleConfirm}
                    style={{
                      flex: 1, padding: '10px 16px', borderRadius: 8,
                      background: '#10b981', border: 'none', color: '#fff',
                      fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    {intent.on_chain ? 'Sign & Back' : `Confirm — Pay $${intent.amount}`}
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Insufficient balance — show payment options */}
                <div style={{
                  background: 'var(--bg-secondary)', borderRadius: 8, padding: 12,
                  marginBottom: 16, textAlign: 'center',
                }}>
                  <div style={{ fontSize: 13, color: '#f59e0b' }}>
                    Your balance: <strong>${intent.current_balance}</strong>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                    Need <strong style={{ color: 'var(--text)' }}>
                      ${(parseFloat(intent.amount) - parseFloat(intent.current_balance)).toFixed(2)}
                    </strong> more to back this campaign
                  </div>
                </div>

                {/* Payment method: Add Funds with Card */}
                <div
                  onClick={() => navigate('/wallet-info')}
                  style={{
                    padding: 14, borderRadius: 10, cursor: 'pointer', marginBottom: 10,
                    background: 'var(--bg-secondary)', border: '2px solid #334155',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = '#8b5cf6'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = '#334155'}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 8,
                      background: '#4f46e520', display: 'flex',
                      alignItems: 'center', justifyContent: 'center',
                    }}>
                      <CreditCard size={18} style={{ color: '#8b5cf6' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
                        Add Funds with Card
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        Apple Pay, debit card ($5 minimum)
                      </div>
                    </div>
                    <ExternalLink size={14} style={{ color: 'var(--text-muted)' }} />
                  </div>
                </div>

                {/* Payment method: Pay with Crypto Wallet (coming soon) */}
                <div style={{
                  padding: 14, borderRadius: 10, marginBottom: 16,
                  background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                  opacity: 0.5, cursor: 'not-allowed',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 8,
                      background: 'var(--bg-secondary)', display: 'flex',
                      alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Wallet size={18} style={{ color: 'var(--text-muted)' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-muted)' }}>
                        Pay with Crypto Wallet
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                        Phantom, Solflare — coming soon
                      </div>
                    </div>
                  </div>
                </div>

                {/* Wallet link */}
                <div style={{ textAlign: 'center', marginBottom: 16 }}>
                  <button
                    onClick={() => navigate('/wallet-info')}
                    style={{
                      background: 'none', border: 'none', color: 'var(--text-muted)',
                      fontSize: 12, cursor: 'pointer', textDecoration: 'underline',
                    }}
                  >
                    Or manage your wallet
                  </button>
                </div>

                <button
                  onClick={() => { setStep('amount'); setIntent(null); }}
                  style={{
                    width: '100%', padding: '10px 16px', borderRadius: 8,
                    background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)',
                    fontSize: 13, cursor: 'pointer',
                  }}
                >
                  Back
                </button>
              </>
            )}
          </div>
        )}

        {/* Processing */}
        {step === 'processing' && (
          <div style={{ textAlign: 'center', padding: 24 }}>
            <Loader2 size={32} style={{ color: '#10b981', animation: 'spin 1s linear infinite' }} />
            <div style={{ color: 'var(--text-muted)', marginTop: 12, fontSize: 14 }}>
              Processing contribution...
            </div>
          </div>
        )}

        {/* Success */}
        {step === 'success' && (
          <div style={{ textAlign: 'center', padding: 24 }}>
            <CheckCircle size={40} style={{ color: '#10b981' }} />
            <div style={{ color: 'var(--text)', marginTop: 12, fontSize: 16, fontWeight: 600 }}>
              Thank you!
            </div>
            <div style={{ color: 'var(--text-muted)', marginTop: 4, fontSize: 13 }}>
              {selectedTier
                ? `You're now a ${selectedTier.title} backer!`
                : 'Your contribution has been recorded.'}
            </div>
          </div>
        )}

        {/* Error */}
        {step === 'error' && (
          <div style={{ textAlign: 'center', padding: 24 }}>
            <div style={{ color: '#ef4444', fontSize: 14, marginBottom: 16 }}>{error}</div>
            <button
              onClick={() => { setStep('amount'); setError(''); }}
              style={{
                padding: '10px 24px', borderRadius: 8,
                background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)',
                fontSize: 13, cursor: 'pointer',
              }}
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
