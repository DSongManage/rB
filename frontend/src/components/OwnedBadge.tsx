import React from 'react';

interface OwnedBadgeProps {
  owned: boolean;
  compact?: boolean;
}

export function OwnedBadge({ owned, compact = false }: OwnedBadgeProps) {
  if (!owned) return null;

  if (compact) {
    return (
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 24,
          height: 24,
          background: 'rgba(16, 185, 129, 0.2)',
          border: '1px solid #10b981',
          borderRadius: '50%',
          fontSize: 12,
        }}
        title="You own this"
      >
        ✓
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        background: 'rgba(16, 185, 129, 0.15)',
        border: '1px solid #10b981',
        borderRadius: 6,
        padding: '4px 8px',
        fontSize: 11,
        fontWeight: 700,
        color: '#10b981',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
      }}
    >
      <svg
        width="12"
        height="12"
        viewBox="0 0 12 12"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="2,6 5,9 10,3" />
      </svg>
      Owned
    </div>
  );
}
