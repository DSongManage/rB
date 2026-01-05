/**
 * Payout history table component.
 * Updated with dark theme styling.
 */

import React, { useEffect, useState } from 'react';
import { CheckCircle, Clock, XCircle, ExternalLink, RefreshCw, type LucideIcon } from 'lucide-react';
import { listPayouts } from '../../services/bridgeApi';
import type { BridgeDrain } from '../../types/bridge';

// Dark theme colors
const colors = {
  bg: '#0f172a',
  bgCard: '#1e293b',
  bgHover: '#334155',
  border: '#334155',
  text: '#f8fafc',
  textSecondary: '#cbd5e1',
  textMuted: '#94a3b8',
  accent: '#f59e0b',
  success: '#10b981',
  successBg: 'rgba(16,185,129,0.15)',
  error: '#ef4444',
  errorBg: 'rgba(239,68,68,0.15)',
  warning: '#f59e0b',
  warningBg: 'rgba(245,158,11,0.15)',
  info: '#3b82f6',
  infoBg: 'rgba(59,130,246,0.15)',
};

interface BridgePayoutHistoryProps {
  className?: string;
}

export const BridgePayoutHistory: React.FC<BridgePayoutHistoryProps> = ({
  className = '',
}) => {
  const [payouts, setPayouts] = useState<BridgeDrain[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPayouts = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listPayouts();
      setPayouts(data.payouts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load payouts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayouts();
  }, []);

  const statusConfig: Record<
    BridgeDrain['status'],
    { icon: LucideIcon; color: string; bgColor: string; label: string }
  > = {
    pending: { icon: Clock, color: colors.warning, bgColor: colors.warningBg, label: 'Pending' },
    processing: { icon: Clock, color: colors.info, bgColor: colors.infoBg, label: 'Processing' },
    completed: { icon: CheckCircle, color: colors.success, bgColor: colors.successBg, label: 'Completed' },
    failed: { icon: XCircle, color: colors.error, bgColor: colors.errorBg, label: 'Failed' },
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div style={{
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        borderRadius: 12,
        padding: 24,
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '32px 0',
        }}>
          <RefreshCw
            size={24}
            style={{
              color: colors.textMuted,
              animation: 'spin 1s linear infinite',
            }}
          />
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
      background: colors.bg,
      border: `1px solid ${colors.border}`,
      borderRadius: 12,
      overflow: 'hidden',
    }}>
      <div style={{
        padding: 16,
        borderBottom: `1px solid ${colors.border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <h3 style={{
          fontSize: 16,
          fontWeight: 600,
          color: colors.text,
          margin: 0,
        }}>
          Payout History
        </h3>
        <button
          onClick={fetchPayouts}
          title="Refresh"
          style={{
            padding: 8,
            background: 'transparent',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            color: colors.textMuted,
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = colors.bgHover}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {error && (
        <div style={{
          padding: 16,
          background: colors.errorBg,
          color: colors.error,
          fontSize: 13,
        }}>
          {error}
        </div>
      )}

      {payouts.length === 0 ? (
        <div style={{
          padding: 32,
          textAlign: 'center',
          color: colors.textMuted,
        }}>
          <p style={{ margin: 0, fontSize: 14 }}>No payouts yet</p>
          <p style={{ margin: '8px 0 0', fontSize: 13 }}>
            Payouts appear here when USDC is converted to USD
          </p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
          }}>
            <thead>
              <tr style={{ background: colors.bgCard }}>
                <th style={{
                  textAlign: 'left',
                  fontSize: 11,
                  fontWeight: 600,
                  color: colors.textMuted,
                  textTransform: 'uppercase',
                  padding: '12px 16px',
                  letterSpacing: '0.5px',
                }}>
                  Date
                </th>
                <th style={{
                  textAlign: 'left',
                  fontSize: 11,
                  fontWeight: 600,
                  color: colors.textMuted,
                  textTransform: 'uppercase',
                  padding: '12px 16px',
                  letterSpacing: '0.5px',
                }}>
                  USDC Amount
                </th>
                <th style={{
                  textAlign: 'left',
                  fontSize: 11,
                  fontWeight: 600,
                  color: colors.textMuted,
                  textTransform: 'uppercase',
                  padding: '12px 16px',
                  letterSpacing: '0.5px',
                }}>
                  USD Deposited
                </th>
                <th style={{
                  textAlign: 'left',
                  fontSize: 11,
                  fontWeight: 600,
                  color: colors.textMuted,
                  textTransform: 'uppercase',
                  padding: '12px 16px',
                  letterSpacing: '0.5px',
                }}>
                  Fee
                </th>
                <th style={{
                  textAlign: 'left',
                  fontSize: 11,
                  fontWeight: 600,
                  color: colors.textMuted,
                  textTransform: 'uppercase',
                  padding: '12px 16px',
                  letterSpacing: '0.5px',
                }}>
                  Status
                </th>
                <th style={{
                  textAlign: 'left',
                  fontSize: 11,
                  fontWeight: 600,
                  color: colors.textMuted,
                  textTransform: 'uppercase',
                  padding: '12px 16px',
                  letterSpacing: '0.5px',
                }}>
                  Transaction
                </th>
              </tr>
            </thead>
            <tbody>
              {payouts.map((payout, index) => {
                const status = statusConfig[payout.status];
                const StatusIcon = status.icon;

                return (
                  <tr
                    key={payout.id}
                    style={{
                      borderTop: index > 0 ? `1px solid ${colors.border}` : undefined,
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = colors.bgCard}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{
                      padding: '12px 16px',
                      fontSize: 13,
                      color: colors.textSecondary,
                    }}>
                      {formatDate(payout.initiated_at)}
                    </td>
                    <td style={{
                      padding: '12px 16px',
                      fontSize: 13,
                      fontWeight: 500,
                      color: colors.text,
                    }}>
                      ${Number(payout.usdc_amount).toFixed(2)}
                    </td>
                    <td style={{
                      padding: '12px 16px',
                      fontSize: 13,
                      fontWeight: 600,
                      color: colors.success,
                    }}>
                      ${Number(payout.usd_amount).toFixed(2)}
                    </td>
                    <td style={{
                      padding: '12px 16px',
                      fontSize: 13,
                      color: colors.textMuted,
                    }}>
                      ${Number(payout.fee_amount).toFixed(2)}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '4px 10px',
                        background: status.bgColor,
                        borderRadius: 20,
                      }}>
                        <StatusIcon size={14} style={{ color: status.color }} />
                        <span style={{
                          fontSize: 12,
                          fontWeight: 500,
                          color: status.color,
                        }}>
                          {status.label}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {payout.source_tx_signature && (
                        <a
                          href={`https://solscan.io/tx/${payout.source_tx_signature}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            fontSize: 13,
                            color: colors.info,
                            textDecoration: 'none',
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
                          onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
                        >
                          View
                          <ExternalLink size={12} />
                        </a>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default BridgePayoutHistory;
