import React, { useState } from 'react';
import { AlertTriangle, RefreshCw, CheckCircle, Loader2 } from 'lucide-react';
import campaignApi, { Campaign } from '../../services/campaignApi';

interface BackerReclaimPanelProps {
  campaign: Campaign;
  userContribution: string;
  onReclaimed: () => void;
}

export function BackerReclaimPanel({ campaign, userContribution, onReclaimed }: BackerReclaimPanelProps) {
  const [reclaiming, setReclaiming] = useState(false);
  const [reclaimed, setReclaimed] = useState(false);
  const [error, setError] = useState('');
  const contributionAmount = parseFloat(userContribution) || 0;

  if (contributionAmount <= 0) return null;

  const handleReclaim = async () => {
    setReclaiming(true);
    setError('');
    try {
      await campaignApi.reclaimContribution(campaign.id);
      setReclaimed(true);
      onReclaimed();
    } catch (err: any) {
      setError(err.message || 'Failed to reclaim contribution');
    } finally {
      setReclaiming(false);
    }
  };

  if (reclaimed) {
    return (
      <div style={{
        background: '#1e3b2f', borderRadius: 12, padding: 20,
        marginBottom: 24, textAlign: 'center',
      }}>
        <CheckCircle size={32} style={{ color: '#10b981', marginBottom: 8 }} />
        <div style={{ fontSize: 15, fontWeight: 600, color: '#10b981' }}>
          Funds Reclaimed
        </div>
        <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>
          ${contributionAmount.toFixed(2)} has been returned to your wallet.
        </div>
      </div>
    );
  }

  return (
    <div style={{
      background: '#451a0310', border: '1px solid #ef444430',
      borderRadius: 12, padding: 20, marginBottom: 24,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <AlertTriangle size={20} style={{ color: '#f59e0b' }} />
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0' }}>
            {campaign.status === 'failed'
              ? 'Campaign did not reach its funding goal'
              : 'Funds are available for reclaim'}
          </div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
            {campaign.status === 'failed'
              ? 'The deadline passed before the goal was met. You can reclaim your full contribution.'
              : 'The escrow creation window expired. Your contribution is available for reclaim.'}
          </div>
        </div>
      </div>

      <div style={{
        background: '#1e293b', borderRadius: 8, padding: 12,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 12,
      }}>
        <span style={{ fontSize: 13, color: '#94a3b8' }}>Your contribution</span>
        <span style={{ fontSize: 16, fontWeight: 700, color: '#e2e8f0' }}>
          ${contributionAmount.toFixed(2)}
        </span>
      </div>

      {error && (
        <div style={{ color: '#ef4444', fontSize: 12, marginBottom: 8, textAlign: 'center' }}>
          {error}
        </div>
      )}

      <button
        onClick={handleReclaim}
        disabled={reclaiming}
        style={{
          width: '100%', padding: '12px 16px', borderRadius: 8,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          background: reclaiming ? '#334155' : '#f59e0b',
          border: 'none', color: '#000', fontSize: 14, fontWeight: 700,
          cursor: reclaiming ? 'wait' : 'pointer',
        }}
      >
        {reclaiming ? (
          <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Processing...</>
        ) : (
          <><RefreshCw size={16} /> Reclaim ${contributionAmount.toFixed(2)}</>
        )}
      </button>
    </div>
  );
}
