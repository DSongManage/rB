import React from 'react';

interface CampaignProgressBarProps {
  currentAmount: number;
  fundingGoal: number;
  backerCount: number;
  compact?: boolean;
}

export function CampaignProgressBar({ currentAmount, fundingGoal, backerCount, compact }: CampaignProgressBarProps) {
  const percentage = fundingGoal > 0 ? Math.min(100, (currentAmount / fundingGoal) * 100) : 0;

  return (
    <div>
      {/* Progress bar */}
      <div style={{
        width: '100%',
        height: compact ? 6 : 10,
        background: '#1e293b',
        borderRadius: 5,
        overflow: 'hidden',
      }}>
        <div style={{
          width: `${percentage}%`,
          height: '100%',
          background: percentage >= 100
            ? 'linear-gradient(90deg, #10b981, #34d399)'
            : 'linear-gradient(90deg, #8b5cf6, #a78bfa)',
          borderRadius: 5,
          transition: 'width 0.5s ease',
        }} />
      </div>

      {/* Stats */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginTop: compact ? 4 : 8,
        fontSize: compact ? 11 : 13,
        color: '#94a3b8',
      }}>
        <span>
          <strong style={{ color: '#e2e8f0' }}>${currentAmount.toLocaleString()}</strong>
          {' '}of ${fundingGoal.toLocaleString()}
        </span>
        <span>{percentage.toFixed(0)}%</span>
      </div>

      {!compact && (
        <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
          {backerCount} backer{backerCount !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}
