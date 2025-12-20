/**
 * NotificationsPage
 * Full page view for all notifications
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, Trash2, ArrowLeft } from 'lucide-react';
import { useNotifications } from '../hooks/useNotifications';
import { Notification } from '../services/notificationService';
import NotificationItem from '../components/notifications/NotificationItem';
import { InviteResponseModal } from '../components/collaboration/InviteResponseModal';

type FilterType = 'all' | 'unread' | 'read';

export default function NotificationsPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<FilterType>('unread');
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

  // Refresh on mount
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Filter notifications
  const filteredNotifications = notifications.filter((notification) => {
    if (filter === 'unread') return !notification.read;
    if (filter === 'read') return notification.read;
    return true;
  });

  // Handle notification click
  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.read) {
      await markAsRead(notification.id);
    }

    if (notification.action_url) {
      navigate(notification.action_url);
    } else if (notification.project_id) {
      navigate(`/collaborations/${notification.project_id}`);
    }
  };

  // Handle view invite
  const handleViewInvite = async (notification: Notification) => {
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
    refresh();
  };

  // Handle delete
  const handleDelete = async (e: React.MouseEvent, notificationId: number) => {
    e.stopPropagation();
    await deleteNotification(notificationId);
  };

  // Handle mark all as read
  const handleMarkAllRead = async () => {
    await markAllAsRead();
  };

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px 16px' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'transparent',
            border: 'none',
            color: '#94a3b8',
            fontSize: 14,
            cursor: 'pointer',
            padding: '8px 0',
            marginBottom: 16,
          }}
        >
          <ArrowLeft size={18} />
          Back
        </button>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Bell size={28} color="#f59e0b" />
            <h1 style={{ fontSize: 24, fontWeight: 700, color: '#e5e7eb', margin: 0 }}>
              Notifications
            </h1>
            {unreadCount > 0 && (
              <span
                style={{
                  background: '#ef4444',
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 700,
                  padding: '4px 10px',
                  borderRadius: 12,
                }}
              >
                {unreadCount} unread
              </span>
            )}
          </div>

          <button
            onClick={handleMarkAllRead}
            disabled={unreadCount === 0}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: unreadCount > 0 ? '#f59e0b' : 'transparent',
              border: unreadCount > 0 ? 'none' : '1px solid #374151',
              color: unreadCount > 0 ? '#000' : '#64748b',
              fontSize: 13,
              fontWeight: 600,
              padding: '8px 16px',
              borderRadius: 8,
              cursor: unreadCount > 0 ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s',
              opacity: unreadCount > 0 ? 1 : 0.6,
            }}
            onMouseEnter={(e) => {
              if (unreadCount > 0) {
                e.currentTarget.style.background = '#fbbf24';
              }
            }}
            onMouseLeave={(e) => {
              if (unreadCount > 0) {
                e.currentTarget.style.background = '#f59e0b';
              }
            }}
          >
            <CheckCheck size={16} />
            Mark All Read
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          marginBottom: 20,
          borderBottom: '1px solid #1f2937',
          paddingBottom: 12,
        }}
      >
        {(['unread', 'read', 'all'] as FilterType[]).map((filterType) => (
          <button
            key={filterType}
            onClick={() => setFilter(filterType)}
            style={{
              background: filter === filterType ? '#1f2937' : 'transparent',
              border: 'none',
              color: filter === filterType ? '#f59e0b' : '#94a3b8',
              fontSize: 13,
              fontWeight: 600,
              padding: '8px 16px',
              borderRadius: 6,
              cursor: 'pointer',
              textTransform: 'capitalize',
              transition: 'all 0.2s',
            }}
          >
            {filterType}
            {filterType === 'unread' && unreadCount > 0 && (
              <span style={{ marginLeft: 6 }}>({unreadCount})</span>
            )}
          </button>
        ))}
      </div>

      {/* Notifications List */}
      <div
        style={{
          background: '#0f172a',
          borderRadius: 12,
          border: '1px solid #1f2937',
          overflow: 'hidden',
        }}
      >
        {isLoading && notifications.length === 0 ? (
          <div
            style={{
              padding: 60,
              textAlign: 'center',
              color: '#94a3b8',
            }}
          >
            Loading notifications...
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div
            style={{
              padding: 60,
              textAlign: 'center',
              color: '#94a3b8',
            }}
          >
            <Bell size={40} style={{ marginBottom: 16, opacity: 0.5 }} />
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
              {filter === 'all'
                ? 'No notifications yet'
                : filter === 'unread'
                ? 'No unread notifications'
                : 'No read notifications'}
            </div>
            <div style={{ fontSize: 13, color: '#64748b' }}>
              {filter === 'all'
                ? "We'll notify you when there's activity on your collaborations"
                : 'Check back later for updates'}
            </div>
          </div>
        ) : (
          <div>
            {filteredNotifications.map((notification) => (
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

      {/* Stats */}
      {notifications.length > 0 && (
        <div
          style={{
            marginTop: 16,
            padding: 12,
            textAlign: 'center',
            fontSize: 12,
            color: '#64748b',
          }}
        >
          Showing {filteredNotifications.length} of {notifications.length} notifications
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
