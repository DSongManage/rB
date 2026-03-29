/**
 * EscrowStatusBar Component
 *
 * Shows funded/released/remaining escrow balance with a progress bar.
 * Used in TeamTab for collaborators with work_for_hire or hybrid contracts.
 */

import React from 'react';
import { DollarSign, Lock, Unlock, TrendingUp } from 'lucide-react';

interface EscrowStatusBarProps {
  contractType: 'work_for_hire' | 'hybrid';
  totalAmount: string;
  fundedAmount: string;
  releasedAmount: string;
  remaining?: string;
  trustPhase: 'not_started' | 'trust_building' | 'production' | 'completed';
  trustPagesCompleted: number;
  fundedAt?: string;
  compact?: boolean;
}

export function EscrowStatusBar({
  contractType,
  totalAmount,
  fundedAmount,
  releasedAmount,
  remaining,
  trustPhase,
  trustPagesCompleted,
  fundedAt,
  compact = false,
}: EscrowStatusBarProps) {
  const total = parseFloat(totalAmount) || 0;
  const funded = parseFloat(fundedAmount) || 0;
  const released = parseFloat(releasedAmount) || 0;
  const rem = remaining ? parseFloat(remaining) : funded - released;
  const releasedPct = total > 0 ? (released / total) * 100 : 0;
  const fundedPct = total > 0 ? (funded / total) * 100 : 0;
  const isFunded = funded >= total && total > 0;

  const trustPhaseLabels: Record<string, { label: string; color: string }> = {
    not_started: { label: 'Not Started', color: '#94a3b8' },
    trust_building: { label: `Trust Phase (${trustPagesCompleted}/5 pages)`, color: '#f59e0b' },
    production: { label: 'Production', color: '#3b82f6' },
    completed: { label: 'Completed', color: '#10b981' },
  };

  const phase = trustPhaseLabels[trustPhase] || trustPhaseLabels.not_started;

  if (compact) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        fontSize: 12, color: '#94a3b8',
      }}>
        <DollarSign size={14} />
        <span style={{ color: '#e2e8f0', fontWeight: 600 }}>
          ${released.toFixed(2)}
        </span>
        <span>/</span>
        <span>${total.toFixed(2)}</span>
        <div style={{
          flex: 1, height: 4, background: '#1e293b',
          borderRadius: 2, minWidth: 60, overflow: 'hidden',
        }}>
          <div style={{
            width: `${releasedPct}%`, height: '100%',
            background: 'linear-gradient(90deg, #10b981, #34d399)',
            borderRadius: 2, transition: 'width 0.3s ease',
          }} />
        </div>
      </div>
    );
  }

  return (
    <div style={{
      background: '#0f172a',
      border: '1px solid #1e293b',
      borderRadius: 12,
      padding: 16,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {isFunded ? (
            <Unlock size={16} style={{ color: '#10b981' }} />
          ) : (
            <Lock size={16} style={{ color: '#f59e0b' }} />
          )}
          <span style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>
            {contractType === 'hybrid' ? 'Hybrid Escrow' : 'Escrow'}
          </span>
        </div>
        <span style={{
          fontSize: 11, padding: '3px 8px', borderRadius: 6,
          background: phase.color + '20', color: phase.color, fontWeight: 600,
        }}>
          {phase.label}
        </span>
      </div>

      {/* Progress bar */}
      <div style={{
        height: 8, background: '#1e293b', borderRadius: 4,
        overflow: 'hidden', marginBottom: 12, position: 'relative',
      }}>
        {/* Funded background */}
        <div style={{
          position: 'absolute', top: 0, left: 0,
          width: `${fundedPct}%`, height: '100%',
          background: '#1e3a5f', borderRadius: 4,
          transition: 'width 0.3s ease',
        }} />
        {/* Released foreground */}
        <div style={{
          position: 'absolute', top: 0, left: 0,
          width: `${releasedPct}%`, height: '100%',
          background: 'linear-gradient(90deg, #10b981, #34d399)',
          borderRadius: 4, transition: 'width 0.3s ease',
        }} />
      </div>

      {/* Amounts */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
        gap: 8, fontSize: 12,
      }}>
        <div>
          <div style={{ color: '#64748b', marginBottom: 2 }}>Total</div>
          <div style={{ color: '#e2e8f0', fontWeight: 600 }}>${total.toFixed(2)}</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: '#64748b', marginBottom: 2 }}>Released</div>
          <div style={{ color: '#10b981', fontWeight: 600 }}>${released.toFixed(2)}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ color: '#64748b', marginBottom: 2 }}>Remaining</div>
          <div style={{ color: '#f59e0b', fontWeight: 600 }}>${rem.toFixed(2)}</div>
        </div>
      </div>

      {/* Funding status */}
      {!isFunded && (
        <div style={{
          marginTop: 10, padding: '6px 10px', borderRadius: 6,
          background: '#f59e0b15', color: '#f59e0b',
          fontSize: 11, textAlign: 'center',
        }}>
          Escrow not yet funded ({fundedPct.toFixed(0)}% of ${total.toFixed(2)})
        </div>
      )}
    </div>
  );
}
