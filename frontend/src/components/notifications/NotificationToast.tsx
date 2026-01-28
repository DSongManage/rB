/**
 * NotificationToast Component
 * Toast notification with auto-dismiss and action buttons
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Notification,
  getNotificationIcon,
  getNotificationColor,
} from '../../services/notificationService';

interface NotificationToastProps {
  notification: Notification;
  onDismiss: () => void;
  autoDismissMs?: number;
}

export function NotificationToast({
  notification,
  onDismiss,
  autoDismissMs = 5000,
}: NotificationToastProps) {
  const navigate = useNavigate();
  const [isExiting, setIsExiting] = useState(false);
  const icon = getNotificationIcon(notification.type);
  const color = getNotificationColor(notification.type);

  useEffect(() => {
    const timer = setTimeout(() => {
      handleDismiss();
    }, autoDismissMs);

    return () => clearTimeout(timer);
  }, [autoDismissMs]);

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(() => {
      onDismiss();
    }, 300); // Match animation duration
  };

  const handleView = () => {
    if (notification.action_url) {
      navigate(notification.action_url);
    } else if (notification.project_id) {
      navigate(`/studio/${notification.project_id}`);
    }
    handleDismiss();
  };

  return (
    <div
      role="alert"
      aria-live="polite"
      aria-atomic="true"
      style={{
        width: 380,
        background: '#1e293b',
        border: `1px solid ${color}40`,
        borderLeft: `4px solid ${color}`,
        borderRadius: 8,
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)',
        overflow: 'hidden',
        marginBottom: 12,
        animation: isExiting
          ? 'slideOut 0.3s ease-out forwards'
          : 'slideIn 0.3s ease-out',
      }}
    >
      {/* Progress bar */}
      <div
        style={{
          height: 3,
          background: `linear-gradient(90deg, ${color} 0%, transparent 100%)`,
          animation: `progress ${autoDismissMs}ms linear forwards`,
        }}
      />

      <div style={{ padding: '16px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
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

          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: '#e5e7eb',
                marginBottom: 4,
                lineHeight: 1.3,
              }}
            >
              {notification.title}
            </div>
            <div
              style={{
                fontSize: 13,
                color: '#94a3b8',
                lineHeight: 1.4,
              }}
            >
              {notification.message}
            </div>
          </div>

          <button
            onClick={handleDismiss}
            aria-label="Dismiss notification"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#64748b',
              cursor: 'pointer',
              padding: 4,
              fontSize: 20,
              lineHeight: 1,
              transition: 'color 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#e5e7eb';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#64748b';
            }}
          >
            ×
          </button>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8 }}>
          {(notification.action_url || notification.project_id) && (
            <button
              onClick={handleView}
              style={{
                background: color,
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                padding: '6px 16px',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = '0.9';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '1';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              View
            </button>
          )}
          <button
            onClick={handleDismiss}
            style={{
              background: 'transparent',
              color: '#94a3b8',
              border: '1px solid #334155',
              borderRadius: 6,
              padding: '6px 16px',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#334155';
              e.currentTarget.style.color = '#e5e7eb';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = '#94a3b8';
            }}
          >
            Dismiss
          </button>
        </div>
      </div>

      {/* Animations */}
      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(400px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }

        @keyframes slideOut {
          from {
            transform: translateX(0);
            opacity: 1;
          }
          to {
            transform: translateX(400px);
            opacity: 0;
          }
        }

        @keyframes progress {
          from {
            transform: scaleX(1);
          }
          to {
            transform: scaleX(0);
          }
        }
      `}</style>
    </div>
  );
}

export default NotificationToast;
