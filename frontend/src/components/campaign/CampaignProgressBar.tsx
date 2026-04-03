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
        height: compact ? 8 : 10,
        background: 'var(--bg-secondary)',
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
        marginTop: compact ? 6 : 8,
        fontSize: compact ? 13 : 15,
        color: 'var(--text-muted)',
      }}>
        <span>
          <strong style={{ color: 'var(--text)' }}>${currentAmount.toLocaleString()}</strong>
          {' '}of ${fundingGoal.toLocaleString()}
        </span>
        <span>{percentage.toFixed(0)}%</span>
      </div>

      {!compact && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
          {backerCount} backer{backerCount !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}
