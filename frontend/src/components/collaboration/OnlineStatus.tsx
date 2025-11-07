/**
 * OnlineStatus Component
 * Shows online/offline indicator with last seen timestamp
 */

import React from 'react';
import { OnlineUser, getTimeAgo } from '../../services/activityService';

interface OnlineStatusProps {
  userId: number;
  onlineUsers: OnlineUser[];
  size?: 'small' | 'medium' | 'large';
  showLabel?: boolean;
  showLastSeen?: boolean;
}

export function OnlineStatus({
  userId,
  onlineUsers,
  size = 'medium',
  showLabel = false,
  showLastSeen = false,
}: OnlineStatusProps) {
  const user = onlineUsers.find(u => u.user_id === userId);
  const isOnline = user?.is_online ?? false;
  const lastSeen = user?.last_seen;

  // Sizes for the indicator dot
  const dotSizes = {
    small: 6,
    medium: 8,
    large: 10,
  };

  const dotSize = dotSizes[size];

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
      }}
      title={
        isOnline
          ? 'Online'
          : lastSeen
          ? `Last seen ${getTimeAgo(lastSeen)}`
          : 'Offline'
      }
    >
      {/* Status Indicator Dot */}
      <div
        aria-label={isOnline ? 'Online' : 'Offline'}
        style={{
          width: dotSize,
          height: dotSize,
          borderRadius: '50%',
          background: isOnline ? '#10b981' : '#64748b',
          boxShadow: isOnline ? '0 0 8px rgba(16, 185, 129, 0.5)' : 'none',
          transition: 'all 0.3s',
        }}
      />

      {/* Optional Label */}
      {showLabel && (
        <span
          style={{
            fontSize: size === 'small' ? 10 : size === 'medium' ? 11 : 12,
            color: isOnline ? '#10b981' : '#64748b',
            fontWeight: 600,
          }}
        >
          {isOnline ? 'Online' : 'Offline'}
        </span>
      )}

      {/* Optional Last Seen */}
      {!isOnline && showLastSeen && lastSeen && (
        <span
          style={{
            fontSize: size === 'small' ? 9 : size === 'medium' ? 10 : 11,
            color: '#64748b',
          }}
        >
          {getTimeAgo(lastSeen)}
        </span>
      )}
    </div>
  );
}

/**
 * Online Status Badge (for larger display)
 */
interface OnlineStatusBadgeProps {
  userId: number;
  username: string;
  onlineUsers: OnlineUser[];
  avatar?: string;
}

export function OnlineStatusBadge({
  userId,
  username,
  onlineUsers,
  avatar,
}: OnlineStatusBadgeProps) {
  const user = onlineUsers.find(u => u.user_id === userId);
  const isOnline = user?.is_online ?? false;
  const lastSeen = user?.last_seen;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 12px',
        background: 'var(--bg)',
        border: '1px solid var(--panel-border)',
        borderRadius: 8,
      }}
    >
      {/* Avatar or placeholder */}
      <div
        style={{
          position: 'relative',
          width: 32,
          height: 32,
          borderRadius: '50%',
          background: avatar
            ? `url(${avatar}) center/cover`
            : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontSize: 14,
          fontWeight: 700,
        }}
      >
        {!avatar && username.charAt(0).toUpperCase()}

        {/* Online indicator on avatar */}
        <div
          aria-label={isOnline ? 'Online' : 'Offline'}
          style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: isOnline ? '#10b981' : '#64748b',
            border: '2px solid var(--bg)',
            boxShadow: isOnline ? '0 0 8px rgba(16, 185, 129, 0.5)' : 'none',
          }}
        />
      </div>

      {/* User info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--text)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          @{username}
        </div>
        <div
          style={{
            fontSize: 11,
            color: isOnline ? '#10b981' : '#64748b',
          }}
        >
          {isOnline ? (
            'Online now'
          ) : lastSeen ? (
            `Last seen ${getTimeAgo(lastSeen)}`
          ) : (
            'Offline'
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Online Users Summary (shows count)
 */
interface OnlineUsersSummaryProps {
  onlineUsers: OnlineUser[];
  totalUsers: number;
}

export function OnlineUsersSummary({
  onlineUsers,
  totalUsers,
}: OnlineUsersSummaryProps) {
  const onlineCount = onlineUsers.filter(u => u.is_online).length;

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        background: onlineCount > 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(100, 116, 139, 0.1)',
        border: `1px solid ${onlineCount > 0 ? '#10b981' : '#64748b'}`,
        borderRadius: 12,
        fontSize: 11,
        fontWeight: 600,
      }}
      title={`${onlineCount} online, ${totalUsers - onlineCount} offline`}
    >
      <div
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: onlineCount > 0 ? '#10b981' : '#64748b',
        }}
      />
      <span style={{ color: onlineCount > 0 ? '#10b981' : '#64748b' }}>
        {onlineCount} / {totalUsers} online
      </span>
    </div>
  );
}

export default OnlineStatus;
