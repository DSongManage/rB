/**
 * NotificationDropdown Component
 * Dropdown panel showing recent notifications (last 10)
 */

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../../hooks/useNotifications';
import { Notification } from '../../services/notificationService';
import NotificationItem from './NotificationItem';
import { InviteResponseModal } from '../collaboration/InviteResponseModal';

interface NotificationDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  anchorEl?: HTMLElement | null;
}

export function NotificationDropdown({ isOpen, onClose, anchorEl }: NotificationDropdownProps) {
  const navigate = useNavigate();
  const panelRef = useRef<HTMLDivElement>(null);

  // State for invite modal
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [selectedInvite, setSelectedInvite] = useState<Notification | null>(null);

  const {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refresh,
  } = useNotifications();

  // Get last 10 notifications
  const recentNotifications = notifications.slice(0, 10);

  // Handle viewing an invite
  const handleViewInvite = async (notification: Notification) => {
    // Mark as read
    if (!notification.read) {
      await markAsRead(notification.id);
    }
    setSelectedInvite(notification);
    setInviteModalOpen(true);
  };

  // Close invite modal
  const handleCloseInviteModal = () => {
    setInviteModalOpen(false);
    setSelectedInvite(null);
    refresh(); // Refresh notifications after modal closes
  };

  // Close panel when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(event.target as Node) &&
        anchorEl &&
        !anchorEl.contains(event.target as Node)
      ) {
        onClose();
      }
    };

    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose, anchorEl]);

  // Close on escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Refresh notifications when panel opens
  useEffect(() => {
    if (isOpen) {
      refresh();
    }
  }, [isOpen, refresh]);

  const handleNotificationClick = async (notification: any) => {
    // Mark as read
    if (!notification.read) {
      await markAsRead(notification.id);
    }

    // Navigate to action URL if provided
    if (notification.action_url) {
      navigate(notification.action_url);
      onClose();
    } else if (notification.project_id) {
      navigate(`/collaborations/${notification.project_id}`);
      onClose();
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllAsRead();
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const handleDelete = async (e: React.MouseEvent, notificationId: number) => {
    e.stopPropagation();
    try {
      await deleteNotification(notificationId);
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }
  };

  const handleViewAll = () => {
    navigate('/notifications');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Notifications"
      aria-modal="false"
      style={{
        position: 'absolute',
        top: '100%',
        right: 0,
        marginTop: 8,
        width: 420,
        maxHeight: 600,
        background: '#0f172a',
        border: '1px solid #1f2937',
        borderRadius: 12,
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)',
        zIndex: 3000,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px 20px',
          borderBottom: '1px solid #1f2937',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#e5e7eb', margin: 0 }}>
            Notifications
          </h3>
          {unreadCount > 0 && (
            <div
              aria-label={`${unreadCount} unread`}
              style={{
                background: '#ef4444',
                color: '#fff',
                fontSize: 11,
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: 10,
                minWidth: 20,
                textAlign: 'center',
              }}
            >
              {unreadCount}
            </div>
          )}
        </div>

        {recentNotifications.length > 0 && unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            aria-label="Mark all as read"
            style={{
              background: 'transparent',
              color: '#3b82f6',
              border: 'none',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: 4,
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#1e293b';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            Mark All Read
          </button>
        )}
      </div>

      {/* Content */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          maxHeight: 500,
        }}
      >
        {isLoading && recentNotifications.length === 0 ? (
          <div
            style={{
              padding: 40,
              textAlign: 'center',
              color: '#94a3b8',
              fontSize: 14,
            }}
          >
            Loading notifications...
          </div>
        ) : recentNotifications.length === 0 ? (
          <div
            style={{
              padding: 40,
              textAlign: 'center',
              color: '#94a3b8',
            }}
          >
            <div style={{ fontSize: 48, marginBottom: 12 }} aria-hidden="true">
              🔔
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
              No notifications yet
            </div>
            <div style={{ fontSize: 12, color: '#64748b' }}>
              We'll notify you when there's activity on your collaborations
            </div>
          </div>
        ) : (
          <div style={{ padding: '8px 0' }}>
            {recentNotifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onClick={() => handleNotificationClick(notification)}
                onDelete={(e) => handleDelete(e, notification.id)}
                onViewInvite={handleViewInvite}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {recentNotifications.length > 0 && (
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid #1f2937',
            display: 'flex',
            gap: 8,
          }}
        >
          {notifications.length > 10 && (
            <button
              onClick={handleViewAll}
              aria-label="View all notifications"
              style={{
                background: 'transparent',
                color: '#3b82f6',
                border: 'none',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                padding: '6px 12px',
                borderRadius: 6,
                flex: 1,
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#1e293b';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              View All
            </button>
          )}
        </div>
      )}

      {/* Invite Response Modal */}
      {selectedInvite && selectedInvite.project_id && (
        <InviteResponseModal
          open={inviteModalOpen}
          onClose={handleCloseInviteModal}
          projectId={selectedInvite.project_id}
          notificationMessage={selectedInvite.message}
        />
      )}
    </div>
  );
}

export default NotificationDropdown;
