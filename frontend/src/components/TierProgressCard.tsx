/**
 * TierProgressCard — analytics dashboard card showing tier progress.
 * Uses inline styles to match the rest of the ProfilePageRedesigned.
 */
import React, { useEffect, useState } from 'react';
import { getMyTierProgress, getFoundingStatus, TierProgress, FoundingStatus } from '../services/tierApi';
import { Award, TrendingUp, Zap, Star } from 'lucide-react';

const TIER_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; icon: React.ReactNode }> = {
  founding: {
    label: 'Founding Creator',
    color: '#f59e0b',
    bg: 'linear-gradient(135deg, rgba(245,158,11,0.15), rgba(217,119,6,0.08))',
    border: 'rgba(245,158,11,0.4)',
    icon: <Star size={16} fill="#f59e0b" color="#f59e0b" />,
  },
  level_5: {
    label: 'Level 5',
    color: '#a855f7',
    bg: 'linear-gradient(135deg, rgba(168,85,247,0.15), rgba(139,92,246,0.08))',
    border: 'rgba(168,85,247,0.4)',
    icon: <Zap size={16} color="#a855f7" />,
  },
  level_4: {
    label: 'Level 4',
    color: '#6366f1',
    bg: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(79,70,229,0.08))',
    border: 'rgba(99,102,241,0.4)',
    icon: <Zap size={16} color="#6366f1" />,
  },
  level_3: {
    label: 'Level 3',
    color: '#3b82f6',
    bg: 'linear-gradient(135deg, rgba(59,130,246,0.15), rgba(37,99,235,0.08))',
    border: 'rgba(59,130,246,0.4)',
    icon: <TrendingUp size={16} color="#3b82f6" />,
  },
  level_2: {
    label: 'Level 2',
    color: '#14b8a6',
    bg: 'linear-gradient(135deg, rgba(20,184,166,0.15), rgba(13,148,136,0.08))',
    border: 'rgba(20,184,166,0.4)',
    icon: <TrendingUp size={16} color="#14b8a6" />,
  },
  level_1: {
    label: 'Level 1',
    color: '#22c55e',
    bg: 'linear-gradient(135deg, rgba(34,197,94,0.15), rgba(22,163,74,0.08))',
    border: 'rgba(34,197,94,0.4)',
    icon: <TrendingUp size={16} color="#22c55e" />,
  },
  standard: {
    label: 'Standard',
    color: '#94a3b8',
    bg: 'linear-gradient(135deg, rgba(148,163,184,0.1), rgba(100,116,139,0.05))',
    border: 'rgba(148,163,184,0.3)',
    icon: <Award size={16} color="#94a3b8" />,
  },
};

// All tiers in order for the roadmap
const TIER_ORDER = [
  { key: 'standard', threshold: 0 },
  { key: 'level_1', threshold: 500 },
  { key: 'level_2', threshold: 1000 },
  { key: 'level_3', threshold: 2500 },
  { key: 'level_4', threshold: 5000 },
  { key: 'level_5', threshold: 10000 },
];

const TierProgressCard: React.FC = () => {
  const [progress, setProgress] = useState<TierProgress | null>(null);
  const [founding, setFounding] = useState<FoundingStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getMyTierProgress().catch(() => null),
      getFoundingStatus().catch(() => null),
    ]).then(([p, f]) => {
      setProgress(p);
      setFounding(f);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--panel-border-strong)',
        borderRadius: 16,
        padding: 24,
        marginBottom: 24,
      }}>
        <div style={{ height: 20, background: 'var(--panel-border-strong)', borderRadius: 8, width: '40%', marginBottom: 16 }} />
        <div style={{ height: 40, background: 'var(--panel-border-strong)', borderRadius: 8, width: '60%' }} />
      </div>
    );
  }

  if (!progress) return null;

  const tierKey = progress.tier in TIER_CONFIG ? progress.tier : 'standard';
  const tier = TIER_CONFIG[tierKey];
  const salesNum = parseFloat(progress.lifetime_project_sales);
  const progressPct = progress.progress_to_next ? parseFloat(progress.progress_to_next) : null;

  // Find current tier index for the roadmap
  const currentTierIdx = TIER_ORDER.findIndex(t => t.key === tierKey);

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--panel-border-strong)',
      borderRadius: 16,
      padding: 24,
      marginBottom: 24,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 20,
      }}>
        <h3 style={{
          fontSize: 18,
          fontWeight: 700,
          color: 'var(--text)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          <Award size={20} style={{ color: tier.color }} />
          Creator Tier
        </h3>

        {/* Tier Badge */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 14px',
          background: tier.bg,
          border: `1px solid ${tier.border}`,
          borderRadius: 20,
          color: tier.color,
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: '0.02em',
        }}>
          {tier.icon}
          {tier.label}
        </div>
      </div>

      {/* Stats Row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: 16,
        marginBottom: 24,
      }}>
        {/* Platform Fee */}
        <div style={{
          background: tier.bg,
          border: `1px solid ${tier.border}`,
          borderRadius: 12,
          padding: 16,
        }}>
          <div style={{
            fontSize: 11,
            color: 'var(--text-muted)',
            marginBottom: 6,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            fontWeight: 600,
          }}>
            Platform Fee
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: tier.color }}>
            {progress.fee_percent}
          </div>
        </div>

        {/* Lifetime Sales */}
        <div style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid var(--panel-border-strong)',
          borderRadius: 12,
          padding: 16,
        }}>
          <div style={{
            fontSize: 11,
            color: 'var(--text-muted)',
            marginBottom: 6,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            fontWeight: 600,
          }}>
            Lifetime Project Sales
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text)' }}>
            ${salesNum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      {/* Progress to Next Level */}
      {progress.next_level && progress.next_threshold && progressPct !== null && (
        <div style={{ marginBottom: 24 }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 8,
          }}>
            <span style={{
              fontSize: 13,
              color: 'var(--text-muted)',
              fontWeight: 600,
            }}>
              Progress to {(TIER_CONFIG[progress.next_level]?.label || progress.next_level).toUpperCase()}
            </span>
            <span style={{
              fontSize: 13,
              color: TIER_CONFIG[progress.next_level]?.color || '#94a3b8',
              fontWeight: 700,
            }}>
              {progressPct.toFixed(1)}%
            </span>
          </div>

          {/* Progress Bar */}
          <div style={{
            width: '100%',
            height: 10,
            background: 'rgba(255,255,255,0.06)',
            borderRadius: 10,
            overflow: 'hidden',
            position: 'relative',
          }}>
            <div style={{
              width: `${Math.min(progressPct, 100)}%`,
              height: '100%',
              background: `linear-gradient(90deg, ${tier.color}, ${TIER_CONFIG[progress.next_level]?.color || tier.color})`,
              borderRadius: 10,
              transition: 'width 0.6s ease-out',
              boxShadow: `0 0 12px ${tier.color}40`,
            }} />
          </div>

          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: 6,
          }}>
            <span style={{ fontSize: 11, color: 'var(--subtle)' }}>
              ${salesNum.toLocaleString()}
            </span>
            <span style={{ fontSize: 11, color: 'var(--subtle)' }}>
              ${parseFloat(progress.next_threshold).toLocaleString()}
            </span>
          </div>
        </div>
      )}

      {/* Tier Roadmap */}
      <div style={{ marginBottom: 20 }}>
        <div style={{
          fontSize: 12,
          color: 'var(--text-muted)',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: 12,
        }}>
          Tier Roadmap
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 0,
          position: 'relative',
        }}>
          {TIER_ORDER.map((t, i) => {
            const tc = TIER_CONFIG[t.key];
            const isActive = i <= currentTierIdx;
            const isCurrent = t.key === tierKey;

            return (
              <React.Fragment key={t.key}>
                {/* Connector line */}
                {i > 0 && (
                  <div style={{
                    flex: 1,
                    height: 3,
                    background: isActive
                      ? `linear-gradient(90deg, ${TIER_CONFIG[TIER_ORDER[i - 1].key].color}, ${tc.color})`
                      : 'rgba(255,255,255,0.08)',
                    borderRadius: 2,
                  }} />
                )}

                {/* Node */}
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  position: 'relative',
                }}>
                  <div style={{
                    width: isCurrent ? 28 : 18,
                    height: isCurrent ? 28 : 18,
                    borderRadius: '50%',
                    background: isActive ? tc.color : 'rgba(255,255,255,0.08)',
                    border: isCurrent ? `3px solid ${tc.color}` : 'none',
                    boxShadow: isCurrent ? `0 0 16px ${tc.color}50` : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.3s',
                    flexShrink: 0,
                  }}>
                    {isCurrent && (
                      <div style={{
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        background: '#fff',
                      }} />
                    )}
                  </div>
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    marginTop: 6,
                    fontSize: 9,
                    fontWeight: isCurrent ? 700 : 500,
                    color: isActive ? tc.color : 'var(--subtle)',
                    whiteSpace: 'nowrap',
                    textAlign: 'center',
                    letterSpacing: '0.02em',
                  }}>
                    {tc.label}
                    {t.threshold > 0 && (
                      <div style={{ fontSize: 8, color: 'var(--subtle)', fontWeight: 400, marginTop: 1 }}>
                        ${t.threshold.toLocaleString()}
                      </div>
                    )}
                  </div>
                </div>
              </React.Fragment>
            );
          })}
        </div>

        {/* Spacer for roadmap labels */}
        <div style={{ height: 36 }} />
      </div>

      {/* Founding Creator Section */}
      {progress.is_founding && progress.founding_slot && (
        <div style={{
          padding: 16,
          background: 'linear-gradient(135deg, rgba(245,158,11,0.12), rgba(217,119,6,0.06))',
          border: '1px solid rgba(245,158,11,0.3)',
          borderRadius: 12,
          marginTop: 4,
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 6,
          }}>
            <Star size={16} fill="#f59e0b" color="#f59e0b" />
            <span style={{ fontSize: 14, fontWeight: 700, color: '#f59e0b' }}>
              Founding Creator
            </span>
          </div>
          <div style={{ fontSize: 12, color: '#d97706', lineHeight: 1.5 }}>
            Earned via "{progress.founding_slot.project}" — ${progress.founding_slot.qualifying_amount} in project sales
          </div>
        </div>
      )}

      {/* Founding Race Banner */}
      {founding && founding.is_open && !progress.is_founding && (
        <div style={{
          padding: 16,
          background: 'linear-gradient(135deg, rgba(59,130,246,0.1), rgba(99,102,241,0.06))',
          border: '1px solid rgba(59,130,246,0.25)',
          borderRadius: 12,
          marginTop: 4,
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 8,
          }}>
            <Zap size={16} color="#3b82f6" />
            <span style={{ fontSize: 14, fontWeight: 700, color: '#3b82f6' }}>
              Founding Creator Race
            </span>
          </div>

          {/* Slots Progress */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 8,
          }}>
            <div style={{
              flex: 1,
              height: 8,
              background: 'rgba(255,255,255,0.06)',
              borderRadius: 8,
              overflow: 'hidden',
            }}>
              <div style={{
                width: `${(founding.slots_claimed / founding.slots_total) * 100}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #3b82f6, #f59e0b)',
                borderRadius: 8,
                transition: 'width 0.6s ease-out',
              }} />
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#3b82f6', whiteSpace: 'nowrap' }}>
              {founding.slots_remaining}/{founding.slots_total}
            </span>
          </div>

          <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
            {founding.slots_remaining} slots remaining. Participate in a project that reaches ${founding.threshold} in cumulative sales to unlock <span style={{ color: '#f59e0b', fontWeight: 600 }}>1% platform fee forever</span>.
          </div>
        </div>
      )}
    </div>
  );
};

export default TierProgressCard;
