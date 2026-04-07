import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, ExternalLink } from 'lucide-react';
import campaignApi, { BackedCampaign } from '../services/campaignApi';

function statusLabel(s: string): { text: string; color: string; bg: string } {
  switch (s) {
    case 'active':      return { text: 'Funding', color: '#2563eb', bg: '#2563eb15' };
    case 'funded':      return { text: 'Funded', color: '#059669', bg: '#05966915' };
    case 'transferred': return { text: 'In Production', color: '#8b5cf6', bg: '#8b5cf615' };
    case 'completed':   return { text: 'Complete', color: '#10b981', bg: '#10b98115' };
    case 'failed':      return { text: 'Failed', color: '#ef4444', bg: '#ef444415' };
    case 'reclaimable': return { text: 'Refund Available', color: '#f59e0b', bg: '#f59e0b15' };
    case 'reclaimed':   return { text: 'Refunded', color: '#6b7280', bg: '#6b728015' };
    default:            return { text: s, color: '#6b7280', bg: '#6b728015' };
  }
}

function contributionStatus(b: BackedCampaign): { text: string; color: string } {
  if (b.refunded) return { text: 'Refunded', color: '#6b7280' };
  if (b.withdrawn) return { text: 'Withdrawn', color: '#f59e0b' };
  if (b.status === 'confirmed') return { text: 'Confirmed', color: '#10b981' };
  if (b.status === 'transferred') return { text: 'In Escrow', color: '#8b5cf6' };
  if (b.status === 'pending') return { text: 'Pending', color: '#f59e0b' };
  return { text: b.status, color: '#6b7280' };
}

export default function BackerDashboardPage() {
  const navigate = useNavigate();
  const [backed, setBacked] = useState<BackedCampaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    campaignApi.getMyBackedCampaigns()
      .then(setBacked)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const totalBacked = backed.reduce((s, b) => s + parseFloat(b.amount), 0);
  const activeCount = backed.filter(b => ['active', 'funded', 'transferred'].includes(b.campaign.status)).length;

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '32px 24px' }}>
      <button onClick={() => navigate(-1)} style={{
        background: 'none', border: 'none', color: '#8b5cf6',
        fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
        marginBottom: 16, padding: 0,
      }}>
        <ArrowLeft size={16} /> Back
      </button>

      <h1 style={{
        fontFamily: 'var(--font-heading)', fontSize: 32, fontWeight: 400,
        color: 'var(--text)', margin: '0 0 8px', letterSpacing: '-0.02em',
      }}>
        My Backed Campaigns
      </h1>
      <p style={{ fontSize: 15, color: 'var(--text-muted)', margin: '0 0 24px' }}>
        Track every project you've supported.
      </p>

      {/* Stats */}
      <div style={{
        display: 'flex', gap: 12, marginBottom: 28,
      }}>
        <div style={{
          flex: 1, padding: 16, borderRadius: 12,
          background: 'var(--panel)', border: '1px solid var(--panel-border)',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)' }}>{backed.length}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Campaigns backed</div>
        </div>
        <div style={{
          flex: 1, padding: 16, borderRadius: 12,
          background: 'var(--panel)', border: '1px solid var(--panel-border)',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#10b981' }}>${totalBacked.toFixed(2)}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Total contributed</div>
        </div>
        <div style={{
          flex: 1, padding: 16, borderRadius: 12,
          background: 'var(--panel)', border: '1px solid var(--panel-border)',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#8b5cf6' }}>{activeCount}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Active</div>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>Loading...</div>
      ) : backed.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: 48, color: 'var(--text-muted)',
          background: 'var(--panel)', border: '1px solid var(--panel-border)', borderRadius: 12,
        }}>
          <p style={{ fontSize: 16, marginBottom: 8 }}>You haven't backed any campaigns yet.</p>
          <button onClick={() => navigate('/campaigns')} style={{
            background: '#E8981F', color: '#fff', border: 'none', borderRadius: 8,
            padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
          }}>
            Discover campaigns
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {backed.map(b => {
            const cs = statusLabel(b.campaign.status);
            const ms = contributionStatus(b);
            return (
              <div
                key={b.contribution_id}
                onClick={() => navigate(`/campaigns/${b.campaign.id}`)}
                style={{
                  display: 'flex', gap: 16, padding: 16, borderRadius: 12,
                  background: 'var(--panel)', border: '1px solid var(--panel-border)',
                  cursor: 'pointer', transition: 'border-color 0.2s',
                  alignItems: 'center',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#E8981F'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--panel-border)'; }}
              >
                {/* Cover */}
                <div style={{
                  width: 56, height: 56, borderRadius: 10, flexShrink: 0, overflow: 'hidden',
                  background: b.campaign.cover_image
                    ? `url(${b.campaign.cover_image}) center/cover`
                    : 'linear-gradient(135deg, #1e1b4b, #312e81)',
                }} />

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{
                      fontSize: 15, fontWeight: 600, color: 'var(--text)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {b.campaign.title}
                    </span>
                    <span style={{
                      fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 10,
                      background: cs.bg, color: cs.color, flexShrink: 0,
                    }}>
                      {cs.text}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 2 }}>
                    by {b.campaign.creator_username} · {b.campaign.content_type}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {b.tier_title && <span>{b.tier_title} · </span>}
                    {new Date(b.contributed_at).toLocaleDateString()}
                  </div>
                </div>

                {/* Amount + status */}
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
                    ${parseFloat(b.amount).toFixed(2)}
                  </div>
                  <div style={{ fontSize: 11, color: ms.color, fontWeight: 600 }}>
                    {ms.text}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
