/**
 * ActivityFeed Component
 * Shows recent project activities
 */

import React from 'react';
import {
  Activity,
  ActivityType,
  getActivityIcon,
  getActivityColor,
  getTimeAgo,
} from '../../services/activityService';

interface ActivityFeedProps {
  activities: Activity[];
  maxItems?: number;
  showAvatar?: boolean;
  compact?: boolean;
}

/**
 * Activity Feed - shows list of recent activities
 */
export function ActivityFeed({
  activities,
  maxItems = 20,
  showAvatar = true,
  compact = false,
}: ActivityFeedProps) {
  const displayActivities = activities.slice(0, maxItems);

  if (displayActivities.length === 0) {
    return (
      <div
        style={{
          padding: compact ? 16 : 32,
          textAlign: 'center',
          color: '#64748b',
        }}
      >
        <div style={{ fontSize: compact ? 32 : 48, marginBottom: 8 }}>📋</div>
        <div style={{ fontSize: compact ? 12 : 14, fontWeight: 600, marginBottom: 4 }}>
          No activity yet
        </div>
        <div style={{ fontSize: compact ? 11 : 12, color: '#64748b' }}>
          Project activities will appear here
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: compact ? 6 : 8,
      }}
    >
      {displayActivities.map((activity) => (
        <ActivityItem
          key={activity.id}
          activity={activity}
          showAvatar={showAvatar}
          compact={compact}
        />
      ))}
    </div>
  );
}

/**
 * Single Activity Item
 */
interface ActivityItemProps {
  activity: Activity;
  showAvatar?: boolean;
  compact?: boolean;
}

function ActivityItem({ activity, showAvatar = true, compact = false }: ActivityItemProps) {
  const icon = getActivityIcon(activity.activity_type);
  const color = getActivityColor(activity.activity_type);
  const timeAgo = getTimeAgo(activity.created_at);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: compact ? 'center' : 'flex-start',
        gap: compact ? 8 : 12,
        padding: compact ? '8px 12px' : '12px 16px',
        background: 'var(--bg)',
        border: '1px solid var(--panel-border)',
        borderLeft: `3px solid ${color}`,
        borderRadius: 8,
        transition: 'all 0.2s',
        cursor: 'pointer',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--panel)';
        e.currentTarget.style.borderLeftColor = color;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'var(--bg)';
        e.currentTarget.style.borderLeftColor = color;
      }}
    >
      {/* Icon or Avatar */}
      {showAvatar ? (
        <div
          style={{
            position: 'relative',
            width: compact ? 28 : 36,
            height: compact ? 28 : 36,
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
            flexShrink: 0,
          }}
        >
          {!activity.avatar && activity.username.charAt(0).toUpperCase()}

          {/* Activity type badge */}
          <div
            style={{
              position: 'absolute',
              bottom: -2,
              right: -2,
              width: compact ? 14 : 16,
              height: compact ? 14 : 16,
              borderRadius: '50%',
              background: `${color}`,
              border: '2px solid var(--bg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: compact ? 8 : 9,
            }}
          >
            {icon}
          </div>
        </div>
      ) : (
        <div
          style={{
            width: compact ? 24 : 32,
            height: compact ? 24 : 32,
            borderRadius: 8,
            background: `${color}20`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: compact ? 14 : 16,
            flexShrink: 0,
          }}
        >
          {icon}
        </div>
      )}

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: compact ? 12 : 13,
            fontWeight: 600,
            color: 'var(--text)',
            marginBottom: compact ? 2 : 4,
            lineHeight: 1.4,
          }}
        >
          {activity.description}
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: compact ? 10 : 11,
            color: '#64748b',
          }}
        >
          <span>@{activity.username}</span>
          {activity.section_title && (
            <>
              <span>•</span>
              <span style={{ color: '#94a3b8' }}>{activity.section_title}</span>
            </>
          )}
          <span>•</span>
          <span>{timeAgo}</span>
        </div>
      </div>

      {/* Activity type badge (for non-avatar mode) */}
      {!showAvatar && !compact && (
        <div
          style={{
            padding: '2px 8px',
            background: `${color}20`,
            color: color,
            fontSize: 10,
            fontWeight: 700,
            borderRadius: 4,
            textTransform: 'uppercase',
            flexShrink: 0,
          }}
        >
          {activity.activity_type.replace(/_/g, ' ')}
        </div>
      )}
    </div>
  );
}

/**
 * Activity Feed Panel - with header and filters
 */
interface ActivityFeedPanelProps {
  activities: Activity[];
  isLoading?: boolean;
  onRefresh?: () => void;
  filterType?: ActivityType | 'all';
  onFilterChange?: (type: ActivityType | 'all') => void;
}

export function ActivityFeedPanel({
  activities,
  isLoading = false,
  onRefresh,
  filterType = 'all',
  onFilterChange,
}: ActivityFeedPanelProps) {
  // Filter activities by type
  const filteredActivities =
    filterType === 'all'
      ? activities
      : activities.filter(a => a.activity_type === filterType);

  const activityTypes: Array<ActivityType | 'all'> = [
    'all',
    'section_updated',
    'comment_added',
    'collaborator_joined',
    'approval_given',
  ];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
          paddingBottom: 12,
          borderBottom: '1px solid var(--panel-border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h3
            style={{
              margin: 0,
              fontSize: 16,
              fontWeight: 700,
              color: 'var(--text)',
            }}
          >
            Recent Activity
          </h3>
          {isLoading && (
            <div
              style={{
                fontSize: 12,
                color: '#f59e0b',
                fontWeight: 600,
              }}
            >
              Updating...
            </div>
          )}
        </div>

        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isLoading}
            style={{
              background: 'transparent',
              border: '1px solid var(--panel-border)',
              borderRadius: 6,
              padding: '4px 12px',
              color: '#94a3b8',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              fontSize: 11,
              fontWeight: 600,
              opacity: isLoading ? 0.5 : 1,
            }}
          >
            🔄 Refresh
          </button>
        )}
      </div>

      {/* Filters */}
      {onFilterChange && (
        <div
          style={{
            display: 'flex',
            gap: 6,
            marginBottom: 12,
            flexWrap: 'wrap',
          }}
        >
          {activityTypes.map((type) => {
            const isActive = filterType === type;
            return (
              <button
                key={type}
                onClick={() => onFilterChange(type)}
                style={{
                  background: isActive ? '#3b82f6' : 'transparent',
                  color: isActive ? '#fff' : '#94a3b8',
                  border: `1px solid ${isActive ? '#3b82f6' : 'var(--panel-border)'}`,
                  borderRadius: 6,
                  padding: '4px 10px',
                  fontSize: 10,
                  fontWeight: 600,
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.borderColor = '#3b82f6';
                    e.currentTarget.style.color = '#3b82f6';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.borderColor = 'var(--panel-border)';
                    e.currentTarget.style.color = '#94a3b8';
                  }
                }}
              >
                {type === 'all' ? 'All' : type.replace(/_/g, ' ')}
              </button>
            );
          })}
        </div>
      )}

      {/* Activity List */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
        }}
      >
        <ActivityFeed activities={filteredActivities} maxItems={50} />
      </div>
    </div>
  );
}

/**
 * Compact Activity Summary - for sidebar
 */
interface ActivitySummaryProps {
  activities: Activity[];
  maxItems?: number;
}

export function ActivitySummary({ activities, maxItems = 5 }: ActivitySummaryProps) {
  const recentActivities = activities.slice(0, maxItems);

  if (recentActivities.length === 0) {
    return (
      <div
        style={{
          padding: 12,
          textAlign: 'center',
          color: '#64748b',
          fontSize: 11,
        }}
      >
        No recent activity
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      {recentActivities.map((activity) => {
        const icon = getActivityIcon(activity.activity_type);
        const color = getActivityColor(activity.activity_type);
        const timeAgo = getTimeAgo(activity.created_at);

        return (
          <div
            key={activity.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 11,
              color: '#cbd5e1',
              lineHeight: 1.4,
            }}
          >
            <span style={{ fontSize: 12 }}>{icon}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{ fontWeight: 600, color: color }}>
                @{activity.username}
              </span>{' '}
              <span style={{ color: '#94a3b8' }}>
                {activity.description.toLowerCase()}
              </span>
              <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>
                {timeAgo}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default ActivityFeed;
