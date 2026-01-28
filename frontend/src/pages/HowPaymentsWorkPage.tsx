/**
 * How Payments Work Page
 *
 * Educational page explaining USDC payments to users.
 * Positions USDC as a "digital dollar" rather than cryptocurrency.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import {
  DollarSign, CreditCard, Wallet, Building2, Shield, Zap,
  ArrowRight, CheckCircle, ExternalLink, Users, ArrowLeft
} from 'lucide-react';

const colors = {
  bg: '#0f172a',
  bgCard: '#1e293b',
  bgHover: '#334155',
  border: '#334155',
  text: '#f8fafc',
  textSecondary: '#cbd5e1',
  textMuted: '#94a3b8',
  accent: '#f59e0b',
  success: '#22c55e',
  successBg: 'rgba(34, 197, 94, 0.1)',
  info: '#3b82f6',
  infoBg: 'rgba(59, 130, 246, 0.1)',
};

export default function HowPaymentsWorkPage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: colors.bg,
      padding: '24px 16px 80px',
    }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        {/* Back Link */}
        <Link
          to="/"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            color: colors.textMuted,
            textDecoration: 'none',
            fontSize: 14,
            marginBottom: 24,
            transition: 'color 0.2s',
          }}
        >
          <ArrowLeft size={16} />
          Back to Home
        </Link>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{
            width: 72,
            height: 72,
            margin: '0 auto 20px',
            borderRadius: 18,
            background: colors.successBg,
            border: `2px solid ${colors.success}40`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <DollarSign size={36} style={{ color: colors.success }} />
          </div>
          <h1 style={{
            fontSize: 36,
            fontWeight: 800,
            color: colors.text,
            marginBottom: 16,
          }}>
            How Payments Work
          </h1>
          <p style={{
            fontSize: 18,
            color: colors.textSecondary,
            maxWidth: 600,
            margin: '0 auto',
            lineHeight: 1.6,
          }}>
            renaissBlock uses digital dollars (USDC) for instant, automatic payments.
            Here's everything you need to know.
          </p>
        </div>

        {/* The Short Version */}
        <section style={{
          background: colors.successBg,
          border: `1px solid ${colors.success}40`,
          borderRadius: 16,
          padding: 32,
          marginBottom: 32,
        }}>
          <h2 style={{
            fontSize: 20,
            fontWeight: 700,
            color: colors.success,
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}>
            <CheckCircle size={24} />
            The Short Version
          </h2>
          <p style={{
            fontSize: 18,
            color: colors.text,
            lineHeight: 1.7,
            margin: 0,
          }}>
            <strong>USDC is a digital dollar</strong> — always worth exactly $1 USD.
            Unlike volatile cryptocurrencies, your earnings maintain their value.
            You can withdraw to your bank anytime, or keep your balance for purchases on renaissBlock.
          </p>
        </section>

        {/* For Buyers */}
        <section style={{
          background: colors.bgCard,
          border: `1px solid ${colors.border}`,
          borderRadius: 16,
          padding: 32,
          marginBottom: 24,
        }}>
          <h2 style={{
            fontSize: 20,
            fontWeight: 700,
            color: colors.text,
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}>
            <CreditCard size={24} style={{ color: colors.accent }} />
            For Buyers
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
              <div style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: colors.infoBg,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                color: colors.info,
                fontSize: 14,
                fontWeight: 700,
              }}>1</div>
              <div>
                <h3 style={{ color: colors.text, fontSize: 16, fontWeight: 600, margin: '0 0 4px' }}>
                  Pay with Card or Crypto
                </h3>
                <p style={{ color: colors.textMuted, margin: 0, fontSize: 14, lineHeight: 1.5 }}>
                  Use your credit card, debit card, Apple Pay, or Google Pay. We handle the conversion to USDC automatically.
                  Already have crypto? Pay directly from any Solana wallet.
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
              <div style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: colors.infoBg,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                color: colors.info,
                fontSize: 14,
                fontWeight: 700,
              }}>2</div>
              <div>
                <h3 style={{ color: colors.text, fontSize: 16, fontWeight: 600, margin: '0 0 4px' }}>
                  Use Your Balance
                </h3>
                <p style={{ color: colors.textMuted, margin: 0, fontSize: 14, lineHeight: 1.5 }}>
                  Your renaissBlock Balance is held in USDC. Use it for future purchases — the checkout is instant, no card needed.
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
              <div style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: colors.infoBg,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                color: colors.info,
                fontSize: 14,
                fontWeight: 700,
              }}>3</div>
              <div>
                <h3 style={{ color: colors.text, fontSize: 16, fontWeight: 600, margin: '0 0 4px' }}>
                  Sales Are Final
                </h3>
                <p style={{ color: colors.textMuted, margin: 0, fontSize: 14, lineHeight: 1.5 }}>
                  Because payments are on the blockchain, transactions are final and cannot be reversed.
                  This protects creators from chargebacks and keeps fees low.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* For Creators */}
        <section style={{
          background: colors.bgCard,
          border: `1px solid ${colors.border}`,
          borderRadius: 16,
          padding: 32,
          marginBottom: 24,
        }}>
          <h2 style={{
            fontSize: 20,
            fontWeight: 700,
            color: colors.text,
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}>
            <Wallet size={24} style={{ color: colors.success }} />
            For Writers & Artists
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
              <div style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: colors.successBg,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                color: colors.success,
                fontSize: 14,
                fontWeight: 700,
              }}>1</div>
              <div>
                <h3 style={{ color: colors.text, fontSize: 16, fontWeight: 600, margin: '0 0 4px' }}>
                  Instant Earnings
                </h3>
                <p style={{ color: colors.textMuted, margin: 0, fontSize: 14, lineHeight: 1.5 }}>
                  You receive 90% of each sale immediately in USDC. No waiting for payment processing or monthly payouts.
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
              <div style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: colors.successBg,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                color: colors.success,
                fontSize: 14,
                fontWeight: 700,
              }}>2</div>
              <div>
                <h3 style={{ color: colors.text, fontSize: 16, fontWeight: 600, margin: '0 0 4px' }}>
                  Automatic Revenue Splits
                </h3>
                <p style={{ color: colors.textMuted, margin: 0, fontSize: 14, lineHeight: 1.5 }}>
                  Working with a co-creator? Revenue splits happen automatically at the time of purchase.
                  Every team member gets paid instantly — no invoices, no chasing payments.
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
              <div style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: colors.successBg,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                color: colors.success,
                fontSize: 14,
                fontWeight: 700,
              }}>3</div>
              <div>
                <h3 style={{ color: colors.text, fontSize: 16, fontWeight: 600, margin: '0 0 4px' }}>
                  Withdraw to Your Bank
                </h3>
                <p style={{ color: colors.textMuted, margin: 0, fontSize: 14, lineHeight: 1.5 }}>
                  Convert your USDC to regular dollars and deposit directly to your bank account.
                  Withdrawals typically arrive in 1-2 business days.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* What is USDC */}
        <section style={{
          background: colors.bgCard,
          border: `1px solid ${colors.border}`,
          borderRadius: 16,
          padding: 32,
          marginBottom: 24,
        }}>
          <h2 style={{
            fontSize: 20,
            fontWeight: 700,
            color: colors.text,
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}>
            <Shield size={24} style={{ color: colors.info }} />
            What is USDC?
          </h2>
          <p style={{
            color: colors.textSecondary,
            fontSize: 15,
            lineHeight: 1.7,
            marginBottom: 20,
          }}>
            USDC (USD Coin) is a <strong style={{ color: colors.text }}>stablecoin</strong> — a type of digital currency
            designed to always be worth exactly $1 USD. It's issued by <strong style={{ color: colors.text }}>Circle</strong>,
            a regulated financial technology company, and is backed by fully reserved assets (cash and short-term U.S. Treasury bonds).
          </p>
          <div style={{
            background: colors.infoBg,
            borderRadius: 12,
            padding: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <CheckCircle size={18} style={{ color: colors.info }} />
              <span style={{ color: colors.textSecondary, fontSize: 14 }}>
                <strong style={{ color: colors.text }}>1 USDC = $1 USD</strong> — always
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <CheckCircle size={18} style={{ color: colors.info }} />
              <span style={{ color: colors.textSecondary, fontSize: 14 }}>
                Regulated and audited monthly by Grant Thornton
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <CheckCircle size={18} style={{ color: colors.info }} />
              <span style={{ color: colors.textSecondary, fontSize: 14 }}>
                Used by major companies including Visa, Mastercard, and Stripe
              </span>
            </div>
          </div>
          <a
            href="https://www.circle.com/en/usdc"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              marginTop: 16,
              color: colors.info,
              textDecoration: 'none',
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            Learn more about USDC on Circle.com
            <ExternalLink size={14} />
          </a>
        </section>

        {/* Why USDC */}
        <section style={{
          background: colors.bgCard,
          border: `1px solid ${colors.border}`,
          borderRadius: 16,
          padding: 32,
          marginBottom: 32,
        }}>
          <h2 style={{
            fontSize: 20,
            fontWeight: 700,
            color: colors.text,
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}>
            <Zap size={24} style={{ color: colors.accent }} />
            Why We Use USDC
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 20,
          }}>
            <div style={{
              background: colors.bgHover,
              borderRadius: 12,
              padding: 20,
              textAlign: 'center',
            }}>
              <Zap size={28} style={{ color: colors.accent, marginBottom: 12 }} />
              <h3 style={{ color: colors.text, fontSize: 15, fontWeight: 600, marginBottom: 8 }}>
                Instant Payments
              </h3>
              <p style={{ color: colors.textMuted, fontSize: 13, margin: 0, lineHeight: 1.5 }}>
                Creators get paid the moment you buy — no waiting days for processing.
              </p>
            </div>
            <div style={{
              background: colors.bgHover,
              borderRadius: 12,
              padding: 20,
              textAlign: 'center',
            }}>
              <Users size={28} style={{ color: colors.accent, marginBottom: 12 }} />
              <h3 style={{ color: colors.text, fontSize: 15, fontWeight: 600, marginBottom: 8 }}>
                Automatic Splits
              </h3>
              <p style={{ color: colors.textMuted, fontSize: 13, margin: 0, lineHeight: 1.5 }}>
                Collaborators are paid their share automatically — no middlemen needed.
              </p>
            </div>
            <div style={{
              background: colors.bgHover,
              borderRadius: 12,
              padding: 20,
              textAlign: 'center',
            }}>
              <DollarSign size={28} style={{ color: colors.accent, marginBottom: 12 }} />
              <h3 style={{ color: colors.text, fontSize: 15, fontWeight: 600, marginBottom: 8 }}>
                Low Fees
              </h3>
              <p style={{ color: colors.textMuted, fontSize: 13, margin: 0, lineHeight: 1.5 }}>
                Blockchain payments are cheap. More of your money goes to creators.
              </p>
            </div>
            <div style={{
              background: colors.bgHover,
              borderRadius: 12,
              padding: 20,
              textAlign: 'center',
            }}>
              <Shield size={28} style={{ color: colors.accent, marginBottom: 12 }} />
              <h3 style={{ color: colors.text, fontSize: 15, fontWeight: 600, marginBottom: 8 }}>
                Transparent
              </h3>
              <p style={{ color: colors.textMuted, fontSize: 13, margin: 0, lineHeight: 1.5 }}>
                Every transaction is recorded on the blockchain — fully verifiable.
              </p>
            </div>
          </div>
        </section>

        {/* CTA */}
        <div style={{
          textAlign: 'center',
          padding: '32px 0',
        }}>
          <Link
            to="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              padding: '16px 32px',
              background: colors.accent,
              color: '#000',
              textDecoration: 'none',
              borderRadius: 12,
              fontSize: 16,
              fontWeight: 700,
              transition: 'all 0.2s',
            }}
          >
            Start Creating
            <ArrowRight size={18} />
          </Link>
        </div>
      </div>
    </div>
  );
}
