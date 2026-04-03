import React from 'react';
import { CheckCircle, Rocket, Clock, AlertTriangle, XCircle, RefreshCw } from 'lucide-react';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon?: any }> = {
  draft: { label: 'Draft', color: 'var(--text-muted)', bg: '#94a3b820' },
  active: { label: 'Active', color: '#10b981', bg: '#10b98120', icon: Rocket },
  funded: { label: 'Funded!', color: '#8b5cf6', bg: '#8b5cf620', icon: CheckCircle },
  transferred: { label: 'In Production', color: '#3b82f6', bg: '#3b82f620', icon: Clock },
  completed: { label: 'Completed', color: '#f59e0b', bg: '#f59e0b20', icon: CheckCircle },
  failed: { label: 'Goal Not Met', color: '#ef4444', bg: '#ef444420', icon: XCircle },
  reclaimable: { label: 'Refund Available', color: '#f59e0b', bg: '#f59e0b20', icon: RefreshCw },
  reclaimed: { label: 'Refunded', color: 'var(--text-muted)', bg: '#64748b20' },
  cancelled: { label: 'Cancelled', color: 'var(--text-muted)', bg: '#64748b20', icon: XCircle },
};

interface CampaignStatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

export function CampaignStatusBadge({ status, size = 'sm' }: CampaignStatusBadgeProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
  const Icon = config.icon;
  const fontSize = size === 'sm' ? 10 : 12;
  const padding = size === 'sm' ? '3px 8px' : '4px 12px';
  const iconSize = size === 'sm' ? 10 : 12;

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize, fontWeight: 700, padding, borderRadius: 4,
      background: config.bg, color: config.color,
      textTransform: 'uppercase', letterSpacing: 0.5,
    }}>
      {Icon && <Icon size={iconSize} />}
      {config.label}
    </span>
  );
}
