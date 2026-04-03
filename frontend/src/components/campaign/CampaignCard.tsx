import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, Users } from 'lucide-react';
import { Campaign } from '../../services/campaignApi';
import { CampaignProgressBar } from './CampaignProgressBar';
import { CampaignStatusBadge } from './CampaignStatusBadge';

interface CampaignCardProps {
  campaign: Campaign;
}

function formatDeadline(deadline: string): string {
  const now = new Date();
  const target = new Date(deadline);
  const diff = target.getTime() - now.getTime();
  if (diff <= 0) return 'Ended';
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days > 1) return `${days} days left`;
  const hours = Math.floor(diff / (1000 * 60 * 60));
  return `${hours}h left`;
}

export function CampaignCard({ campaign }: CampaignCardProps) {
  const navigate = useNavigate();
  const currentAmount = parseFloat(campaign.current_amount) || 0;
  const fundingGoal = parseFloat(campaign.funding_goal) || 0;

  return (
    <div
      onClick={() => navigate(`/campaigns/${campaign.id}`)}
      style={{
        background: 'var(--panel)',
        border: '1px solid var(--panel-border)',
        borderRadius: 14,
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = '#E8981F';
        e.currentTarget.style.transform = 'translateY(-3px)';
        e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.06)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--panel-border)';
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      {/* Cover image with status badge */}
      <div style={{ position: 'relative' }}>
        {campaign.cover_image ? (
          <div style={{
            height: 160,
            background: `url(${campaign.cover_image}) center/cover`,
          }} />
        ) : (
          <div style={{
            height: 160,
            background: 'linear-gradient(135deg, #1e1b4b, #312e81)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 36,
            color: '#4f46e5',
          }}>
            {campaign.campaign_type === 'solo' ? '\u{1F4D6}' : '\u{1F465}'}
          </div>
        )}
        {campaign.status !== 'active' && (
          <div style={{ position: 'absolute', top: 10, right: 10 }}>
            <CampaignStatusBadge status={campaign.status} />
          </div>
        )}
      </div>

      <div style={{ padding: 20 }}>
        {/* Type badges */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          <span style={{
            fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 6,
            background: campaign.campaign_type === 'solo' ? 'rgba(59,130,246,0.1)' : 'rgba(16,185,129,0.1)',
            color: campaign.campaign_type === 'solo' ? '#2563eb' : '#059669',
          }}>
            {campaign.campaign_type === 'solo' ? 'Solo' : 'Collaborative'}
          </span>
          <span style={{
            fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 6,
            background: 'var(--chip-bg)', color: 'var(--text-muted)',
          }}>
            {campaign.content_type}
          </span>
        </div>

        {/* Title */}
        <h3 style={{
          fontSize: 18, fontWeight: 700, color: 'var(--text)',
          margin: '0 0 6px', lineHeight: 1.3,
          overflow: 'hidden', textOverflow: 'ellipsis',
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
        }}>
          {campaign.title}
        </h3>

        <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 14 }}>
          by {campaign.creator_display_name || campaign.creator_username}
        </div>

        {/* Progress */}
        <CampaignProgressBar
          currentAmount={currentAmount}
          fundingGoal={fundingGoal}
          backerCount={campaign.backer_count}
          compact
        />

        {/* Footer */}
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          marginTop: 12, fontSize: 13, color: 'var(--text-muted)',
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <Users size={14} /> {campaign.backer_count}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <Clock size={14} /> {formatDeadline(campaign.deadline)}
          </span>
        </div>
      </div>
    </div>
  );
}
