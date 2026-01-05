/**
 * ActivityTimelineItem Component
 * Renders an activity event in the unified timeline
 */

import React from 'react';
import {
  FileEdit,
  MessageCircle,
  UserPlus,
  UserMinus,
  CheckCircle,
  Bell,
  Sparkles,
  Coins,
  Upload,
  Send,
  Activity as ActivityIcon,
} from 'lucide-react';
import { Activity, ActivityType, getTimeAgo } from '../../../services/activityService';

interface ActivityTimelineItemProps {
  activity: Activity;
  compact?: boolean;
}

// Activity type configurations with Lucide icons
const activityConfig: Record<ActivityType, { icon: React.ElementType; color: string; label: string }> = {
  section_updated: { icon: FileEdit, color: '#3b82f6', label: 'Section Updated' },
  comment_added: { icon: MessageCircle, color: '#06b6d4', label: 'Comment Added' },
  collaborator_joined: { icon: UserPlus, color: '#10b981', label: 'Joined' },
  collaborator_left: { icon: UserMinus, color: '#64748b', label: 'Left' },
  approval_given: { icon: CheckCircle, color: '#10b981', label: 'Approved' },
  approval_requested: { icon: Bell, color: '#f59e0b', label: 'Approval Requested' },
  ready_for_mint: { icon: Sparkles, color: '#ec4899', label: 'Ready for Mint' },
  project_minted: { icon: Coins, color: '#fbbf24', label: 'Minted' },
  media_uploaded: { icon: Upload, color: '#8b5cf6', label: 'Media Uploaded' },
  invitation_sent: { icon: Send, color: '#f59e0b', label: 'Invitation Sent' },
};

export function ActivityTimelineItem({ activity, compact = false }: ActivityTimelineItemProps) {
  const config = activityConfig[activity.activity_type] || {
    icon: ActivityIcon,
    color: '#64748b',
    label: 'Activity',
  };

  const Icon = config.icon;
  const timeAgo = getTimeAgo(activity.created_at);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: compact ? 'center' : 'flex-start',
        gap: compact ? 10 : 12,
        padding: compact ? '10px 14px' : '14px 16px',
        background: 'var(--bg)',
        borderLeft: `3px solid ${config.color}`,
        borderRadius: 8,
        transition: 'background 0.15s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'var(--bg)';
      }}
    >
      {/* Avatar with activity badge */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <div
          style={{
            width: compact ? 32 : 40,
            height: compact ? 32 : 40,
            borderRadius: '50%',
            background: activity.avatar
              ? `url(${activity.avatar}) center/cover`
              : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: compact ? 12 : 14,
            fontWeight: 700,
          }}
        >
          {!activity.avatar && activity.username.charAt(0).toUpperCase()}
        </div>

        {/* Activity type badge */}
        <div
          style={{
            position: 'absolute',
            bottom: -2,
            right: -2,
            width: compact ? 16 : 18,
            height: compact ? 16 : 18,
            borderRadius: '50%',
            background: config.color,
            border: '2px solid var(--bg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon size={compact ? 8 : 10} style={{ color: '#fff' }} />
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Description */}
        <div
          style={{
            fontSize: compact ? 12 : 13,
            fontWeight: 500,
            color: 'var(--text)',
            lineHeight: 1.4,
            marginBottom: compact ? 2 : 4,
          }}
        >
          {activity.description}
        </div>

        {/* Meta row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: compact ? 10 : 11,
            color: '#64748b',
            flexWrap: 'wrap',
          }}
        >
          <span style={{ color: config.color, fontWeight: 600 }}>
            @{activity.username}
          </span>
          {activity.section_title && (
            <>
              <span style={{ color: '#475569' }}>in</span>
              <span style={{ color: '#94a3b8' }}>{activity.section_title}</span>
            </>
          )}
          <span style={{ color: '#475569' }}>•</span>
          <span>{timeAgo}</span>
        </div>
      </div>
    </div>
  );
}

export default ActivityTimelineItem;
