import React from 'react';
import { PageStatus } from '../../../services/collaborationApi';

const STATUS_CONFIG: Record<PageStatus, { label: string; color: string; bg: string }> = {
  script_only: { label: 'Script Only', color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.15)' },
  in_progress: { label: 'In Progress', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)' },
  art_delivered: { label: 'Art Delivered', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' },
  revision_requested: { label: 'Revision Requested', color: '#f97316', bg: 'rgba(249, 115, 22, 0.15)' },
  approved: { label: 'Approved', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' },
};

// Small colored dot for sidebar
export function PageStatusDot({ status }: { status: PageStatus }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.script_only;
  return (
    <span
      style={{
        display: 'inline-block',
        width: 8,
        height: 8,
        borderRadius: '50%',
        backgroundColor: config.color,
        flexShrink: 0,
      }}
      title={config.label}
    />
  );
}

// Full pill badge for header
export default function PageStatusBadge({
  status,
  size = 'normal',
}: {
  status: PageStatus;
  size?: 'small' | 'normal';
}) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.script_only;
  const isSmall = size === 'small';

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: isSmall ? '2px 8px' : '4px 12px',
        borderRadius: 20,
        background: config.bg,
        color: config.color,
        fontSize: isSmall ? 11 : 12,
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          backgroundColor: config.color,
        }}
      />
      {config.label}
    </span>
  );
}
