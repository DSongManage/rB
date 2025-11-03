/**
 * NotificationItem Component
 * Reusable component for individual notifications
 */

import React from 'react';
import {
  Notification,
  getTimeAgo,
  getNotificationIcon,
  getNotificationColor,
} from '../../services/notificationService';

interface NotificationItemProps {
  notification: Notification;
  onClick: () => void;
  onDelete: (e: React.MouseEvent) => void;
}

export function NotificationItem({ notification, onClick, onDelete }: NotificationItemProps) {
  const icon = getNotificationIcon(notification.type);
  const color = getNotificationColor(notification.type);
  const timeAgo = getTimeAgo(notification.created_at);

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      aria-label={`${notification.read ? 'Read' : 'Unread'} notification: ${notification.title}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      style={{
        padding: '12px 20px',
        cursor: 'pointer',
        background: notification.read ? 'transparent' : '#0b1220',
        borderLeft: `3px solid ${notification.read ? 'transparent' : color}`,
        transition: 'all 0.2s',
        position: 'relative',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = '#1e293b';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = notification.read ? 'transparent' : '#0b1220';
      }}
    >
      <div style={{ display: 'flex', gap: 12 }}>
        {/* Icon */}
        <div
          style={{
            fontSize: 24,
            width: 40,
            height: 40,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: `${color}20`,
            borderRadius: 8,
            flexShrink: 0,
          }}
          aria-hidden="true"
        >
          {icon}
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: '#e5e7eb',
              marginBottom: 4,
              lineHeight: 1.4,
            }}
          >
            {notification.title}
          </div>
          <div
            style={{
              fontSize: 12,
              color: '#94a3b8',
              marginBottom: 6,
              lineHeight: 1.5,
            }}
          >
            {notification.message}
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 11,
              color: '#64748b',
            }}
          >
            <span>@{notification.from_user.username}</span>
            <span>•</span>
            <span>{timeAgo}</span>
          </div>
        </div>

        {/* Delete button */}
        <button
          onClick={onDelete}
          aria-label="Delete notification"
          style={{
            background: 'transparent',
            border: 'none',
            color: '#64748b',
            cursor: 'pointer',
            padding: 4,
            borderRadius: 4,
            fontSize: 18,
            width: 28,
            height: 28,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            opacity: 0.6,
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#1e293b';
            e.currentTarget.style.color = '#ef4444';
            e.currentTarget.style.opacity = '1';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = '#64748b';
            e.currentTarget.style.opacity = '0.6';
          }}
        >
          ×
        </button>
      </div>

      {/* Unread indicator */}
      {!notification.read && (
        <div
          aria-label="Unread"
          style={{
            position: 'absolute',
            top: 18,
            right: 20,
            width: 8,
            height: 8,
            background: color,
            borderRadius: '50%',
            boxShadow: `0 0 8px ${color}`,
          }}
        />
      )}
    </div>
  );
}

export default NotificationItem;
