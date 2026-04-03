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
        borderRadius: 12,
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = '#8b5cf6';
        e.currentTarget.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--panel-border)';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      {/* Cover image with status badge */}
      <div style={{ position: 'relative' }}>
        {campaign.cover_image ? (
          <div style={{
            height: 140,
            background: `url(${campaign.cover_image}) center/cover`,
          }} />
        ) : (
          <div style={{
            height: 140,
            background: 'linear-gradient(135deg, #1e1b4b, #312e81)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 32,
            color: '#4f46e5',
          }}>
            {campaign.campaign_type === 'solo' ? '📖' : '👥'}
          </div>
        )}
        {campaign.status !== 'active' && (
          <div style={{ position: 'absolute', top: 8, right: 8 }}>
            <CampaignStatusBadge status={campaign.status} />
          </div>
        )}
      </div>

      <div style={{ padding: 16 }}>
        {/* Type badge */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          <span style={{
            fontSize: 10, padding: '2px 8px', borderRadius: 4,
            background: campaign.campaign_type === 'solo' ? '#1e3a5f' : '#1e3b2f',
            color: campaign.campaign_type === 'solo' ? '#60a5fa' : '#4ade80',
          }}>
            {campaign.campaign_type === 'solo' ? 'Solo' : 'Collaborative'}
          </span>
          <span style={{
            fontSize: 10, padding: '2px 8px', borderRadius: 4,
            background: 'var(--bg-secondary)', color: 'var(--text-muted)',
          }}>
            {campaign.content_type}
          </span>
        </div>

        {/* Title */}
        <h3 style={{
          fontSize: 15, fontWeight: 600, color: 'var(--text)',
          margin: '0 0 4px', lineHeight: 1.3,
          overflow: 'hidden', textOverflow: 'ellipsis',
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
        }}>
          {campaign.title}
        </h3>

        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
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
          marginTop: 10, fontSize: 11, color: 'var(--text-muted)',
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Users size={12} /> {campaign.backer_count}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Clock size={12} /> {formatDeadline(campaign.deadline)}
          </span>
        </div>
      </div>
    </div>
  );
}
