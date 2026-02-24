/**
 * NotificationsPage
 * Full page view for all notifications with search, filters, and bulk actions
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  CheckCheck,
  Trash2,
  ArrowLeft,
  Search,
  Filter,
  Calendar,
  CheckSquare,
  Square,
  X,
} from 'lucide-react';
import { useNotifications } from '../hooks/useNotifications';
import { Notification } from '../services/notificationService';
import { useMobile } from '../hooks/useMobile';
import NotificationItem from '../components/notifications/NotificationItem';
import { InviteResponseModal } from '../components/collaboration/InviteResponseModal';

type FilterType = 'all' | 'unread' | 'read';
type DateRangeType = 'all' | 'today' | 'week' | 'month';

// Notification type labels for the filter dropdown
const NOTIFICATION_TYPES = [
  { value: 'all', label: 'All Types' },
  { value: 'invitation', label: 'Invitations' },
  { value: 'invitation_response', label: 'Invite Responses' },
  { value: 'counter_proposal', label: 'Counter Proposals' },
  { value: 'comment', label: 'Comments' },
  { value: 'approval', label: 'Approvals' },
  { value: 'section_update', label: 'Updates' },
  { value: 'revenue_proposal', label: 'Revenue Proposals' },
  { value: 'mint_ready', label: 'Mint Ready' },
  { value: 'content_like', label: 'Likes' },
  { value: 'content_comment', label: 'Content Comments' },
  { value: 'content_rating', label: 'Ratings' },
  { value: 'creator_review', label: 'Reviews' },
  { value: 'content_purchase', label: 'Purchases' },
  { value: 'new_follower', label: 'New Followers' },
];

const DATE_RANGE_OPTIONS = [
  { value: 'all', label: 'All Time' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
];

export default function NotificationsPage() {
  const navigate = useNavigate();
  const { isMobile, isPhone } = useMobile();

  // Filter states
  const [readFilter, setReadFilter] = useState<FilterType>('unread');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<DateRangeType>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Bulk selection states
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Modal states
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [selectedInvite, setSelectedInvite] = useState<Notification | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

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

  // Clear selection when exiting select mode
  useEffect(() => {
    if (!selectMode) {
      setSelectedIds(new Set());
    }
  }, [selectMode]);

  // Date range filter logic
  const isWithinDateRange = (dateStr: string): boolean => {
    if (dateRange === 'all') return true;

    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    switch (dateRange) {
      case 'today':
        return diffDays === 0;
      case 'week':
        return diffDays <= 7;
      case 'month':
        return diffDays <= 30;
      default:
        return true;
    }
  };

  // Combined filtering
  const filteredNotifications = useMemo(() => {
    return notifications.filter((notification) => {
      // Read/unread filter
      if (readFilter === 'unread' && notification.read) return false;
      if (readFilter === 'read' && !notification.read) return false;

      // Type filter
      if (typeFilter !== 'all' && notification.type !== typeFilter) return false;

      // Date range filter
      if (!isWithinDateRange(notification.created_at)) return false;

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = notification.title?.toLowerCase().includes(query);
        const matchesMessage = notification.message?.toLowerCase().includes(query);
        if (!matchesTitle && !matchesMessage) return false;
      }

      return true;
    });
  }, [notifications, readFilter, typeFilter, dateRange, searchQuery]);

  // Selection handlers
  const toggleSelect = (id: number) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const selectAllVisible = () => {
    setSelectedIds(new Set(filteredNotifications.map((n) => n.id)));
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  // Bulk actions
  const handleBulkMarkRead = async () => {
    for (const id of selectedIds) {
      await markAsRead(id);
    }
    clearSelection();
    setSelectMode(false);
  };

  const handleBulkDelete = async () => {
    for (const id of selectedIds) {
      await deleteNotification(id);
    }
    clearSelection();
    setSelectMode(false);
    setDeleteConfirmOpen(false);
  };

  // Individual notification handlers
  const handleNotificationClick = async (notification: Notification) => {
    if (selectMode) {
      toggleSelect(notification.id);
      return;
    }

    if (!notification.read) {
      await markAsRead(notification.id);
    }

    if (notification.action_url) {
      navigate(notification.action_url);
    } else if (notification.project_id) {
      navigate(`/studio/${notification.project_id}`);
    }
  };

  const handleViewInvite = async (notification: Notification) => {
    if (!notification.read) {
      await markAsRead(notification.id);
    }
    setSelectedInvite(notification);
    setInviteModalOpen(true);
  };

  const handleCloseInviteModal = () => {
    setInviteModalOpen(false);
    setSelectedInvite(null);
    refresh();
  };

  const handleDelete = async (e: React.MouseEvent, notificationId: number) => {
    e.stopPropagation();
    await deleteNotification(notificationId);
  };

  const handleMarkAllRead = async () => {
    await markAllAsRead();
  };

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: isPhone ? '16px 12px' : '24px 16px' }}>
      {/* Header */}
      <div style={{ marginBottom: isPhone ? 16 : 24 }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            fontSize: 14,
            cursor: 'pointer',
            padding: '8px 0',
            marginBottom: isPhone ? 12 : 16,
            minHeight: 44,
          }}
        >
          <ArrowLeft size={18} />
          Back
        </button>

        <div
          style={{
            display: 'flex',
            flexDirection: isPhone ? 'column' : 'row',
            alignItems: isPhone ? 'flex-start' : 'center',
            justifyContent: 'space-between',
            gap: isPhone ? 12 : 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Bell size={isPhone ? 24 : 28} color="#f59e0b" />
            <h1
              style={{
                fontSize: isPhone ? 20 : 24,
                fontWeight: 700,
                color: 'var(--text)',
                margin: 0,
              }}
            >
              Notifications
            </h1>
            {unreadCount > 0 && (
              <span
                style={{
                  background: '#ef4444',
                  color: '#fff',
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '3px 8px',
                  borderRadius: 12,
                }}
              >
                {unreadCount}
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
              border: unreadCount > 0 ? 'none' : '1px solid var(--border)',
              color: unreadCount > 0 ? '#000' : 'var(--subtle)',
              fontSize: 13,
              fontWeight: 600,
              padding: '10px 16px',
              borderRadius: 8,
              cursor: unreadCount > 0 ? 'pointer' : 'not-allowed',
              opacity: unreadCount > 0 ? 1 : 0.6,
              minHeight: 44,
              width: isPhone ? '100%' : 'auto',
              justifyContent: 'center',
            }}
          >
            <CheckCheck size={16} />
            Mark All Read
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          marginBottom: 16,
        }}
      >
        {/* Search Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            background: 'var(--bg-card)',
            border: '1px solid var(--panel-border-strong)',
            borderRadius: 8,
            padding: '0 12px',
          }}
        >
          <Search size={18} color="var(--subtle)" />
          <input
            type="text"
            placeholder="Search notifications..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              color: 'var(--text)',
              fontSize: 14,
              padding: '12px',
              outline: 'none',
              minHeight: 44,
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--subtle)',
                cursor: 'pointer',
                padding: 4,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Filter Row */}
        <div
          style={{
            display: 'flex',
            flexDirection: isPhone ? 'column' : 'row',
            gap: 8,
          }}
        >
          {/* Type Filter */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Filter size={16} color="var(--subtle)" />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              style={{
                flex: 1,
                background: 'var(--bg-card)',
                border: '1px solid var(--panel-border-strong)',
                borderRadius: 6,
                color: 'var(--text)',
                fontSize: 13,
                padding: '10px 12px',
                cursor: 'pointer',
                outline: 'none',
                minHeight: 44,
              }}
            >
              {NOTIFICATION_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          {/* Date Range Filter */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Calendar size={16} color="var(--subtle)" />
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as DateRangeType)}
              style={{
                flex: 1,
                background: 'var(--bg-card)',
                border: '1px solid var(--panel-border-strong)',
                borderRadius: 6,
                color: 'var(--text)',
                fontSize: 13,
                padding: '10px 12px',
                cursor: 'pointer',
                outline: 'none',
                minHeight: 44,
              }}
            >
              {DATE_RANGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Tab Bar with Select Mode Toggle */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
          borderBottom: '1px solid var(--panel-border-strong)',
          paddingBottom: 12,
          gap: 8,
          flexWrap: 'wrap',
        }}
      >
        {/* Read/Unread/All Tabs */}
        <div
          style={{
            display: 'flex',
            gap: 4,
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {(['unread', 'read', 'all'] as FilterType[]).map((filterType) => (
            <button
              key={filterType}
              onClick={() => setReadFilter(filterType)}
              style={{
                background: readFilter === filterType ? 'var(--dropdown-hover)' : 'transparent',
                border: 'none',
                color: readFilter === filterType ? '#f59e0b' : 'var(--text-muted)',
                fontSize: 13,
                fontWeight: 600,
                padding: '8px 14px',
                borderRadius: 6,
                cursor: 'pointer',
                textTransform: 'capitalize',
                whiteSpace: 'nowrap',
                minHeight: 40,
              }}
            >
              {filterType}
              {filterType === 'unread' && unreadCount > 0 && (
                <span style={{ marginLeft: 4, opacity: 0.8 }}>({unreadCount})</span>
              )}
            </button>
          ))}
        </div>

        {/* Select Mode Toggle */}
        <button
          onClick={() => setSelectMode(!selectMode)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: selectMode ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
            border: `1px solid ${selectMode ? '#3b82f6' : 'var(--border)'}`,
            color: selectMode ? '#3b82f6' : 'var(--text-muted)',
            fontSize: 12,
            fontWeight: 600,
            padding: '6px 12px',
            borderRadius: 6,
            cursor: 'pointer',
            minHeight: 36,
          }}
        >
          <CheckSquare size={14} />
          {selectMode ? 'Cancel' : 'Select'}
        </button>
      </div>

      {/* Bulk Action Bar */}
      {selectMode && (
        <div
          style={{
            display: 'flex',
            flexDirection: isPhone ? 'column' : 'row',
            alignItems: isPhone ? 'stretch' : 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '12px 16px',
            background: 'var(--dropdown-hover)',
            borderRadius: 8,
            marginBottom: 16,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <button
              onClick={selectAllVisible}
              style={{
                background: 'transparent',
                border: '1px solid var(--border)',
                color: 'var(--text-muted)',
                fontSize: 12,
                fontWeight: 600,
                padding: '6px 12px',
                borderRadius: 4,
                cursor: 'pointer',
                minHeight: 36,
              }}
            >
              Select All
            </button>
            <button
              onClick={clearSelection}
              disabled={selectedIds.size === 0}
              style={{
                background: 'transparent',
                border: '1px solid var(--border)',
                color: selectedIds.size > 0 ? 'var(--text-muted)' : 'var(--subtle)',
                fontSize: 12,
                fontWeight: 600,
                padding: '6px 12px',
                borderRadius: 4,
                cursor: selectedIds.size > 0 ? 'pointer' : 'not-allowed',
                minHeight: 36,
              }}
            >
              Clear
            </button>
            <span style={{ fontSize: 13, color: 'var(--subtle)' }}>
              {selectedIds.size} selected
            </span>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleBulkMarkRead}
              disabled={selectedIds.size === 0}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: selectedIds.size > 0 ? '#3b82f6' : 'var(--chip-bg)',
                border: 'none',
                color: selectedIds.size > 0 ? '#fff' : 'var(--subtle)',
                fontSize: 12,
                fontWeight: 600,
                padding: '8px 14px',
                borderRadius: 6,
                cursor: selectedIds.size > 0 ? 'pointer' : 'not-allowed',
                flex: isPhone ? 1 : 'none',
                justifyContent: 'center',
                minHeight: 40,
              }}
            >
              <CheckCheck size={14} />
              Mark Read
            </button>
            <button
              onClick={() => setDeleteConfirmOpen(true)}
              disabled={selectedIds.size === 0}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: selectedIds.size > 0 ? '#dc2626' : 'var(--chip-bg)',
                border: 'none',
                color: selectedIds.size > 0 ? '#fff' : 'var(--subtle)',
                fontSize: 12,
                fontWeight: 600,
                padding: '8px 14px',
                borderRadius: 6,
                cursor: selectedIds.size > 0 ? 'pointer' : 'not-allowed',
                flex: isPhone ? 1 : 'none',
                justifyContent: 'center',
                minHeight: 40,
              }}
            >
              <Trash2 size={14} />
              Delete
            </button>
          </div>
        </div>
      )}

      {/* Notifications List */}
      <div
        style={{
          background: 'var(--bg-card)',
          borderRadius: 12,
          border: '1px solid var(--panel-border-strong)',
          overflow: 'hidden',
        }}
      >
        {isLoading && notifications.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading notifications...
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>
            <Bell size={40} style={{ marginBottom: 16, opacity: 0.5 }} />
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
              {searchQuery
                ? 'No notifications match your search'
                : readFilter === 'all'
                ? 'No notifications yet'
                : readFilter === 'unread'
                ? 'No unread notifications'
                : 'No read notifications'}
            </div>
            <div style={{ fontSize: 13, color: 'var(--subtle)' }}>
              {searchQuery
                ? 'Try adjusting your search or filters'
                : readFilter === 'all'
                ? "We'll notify you when there's activity"
                : 'Check back later for updates'}
            </div>
          </div>
        ) : (
          <div>
            {filteredNotifications.map((notification) => (
              <div
                key={notification.id}
                style={{
                  display: 'flex',
                  alignItems: 'stretch',
                }}
              >
                {/* Checkbox for select mode */}
                {selectMode && (
                  <button
                    onClick={() => toggleSelect(notification.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 48,
                      background: selectedIds.has(notification.id)
                        ? 'rgba(59, 130, 246, 0.1)'
                        : 'transparent',
                      border: 'none',
                      borderRight: '1px solid var(--panel-border-strong)',
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    {selectedIds.has(notification.id) ? (
                      <CheckSquare size={20} color="#3b82f6" />
                    ) : (
                      <Square size={20} color="var(--subtle)" />
                    )}
                  </button>
                )}

                {/* Notification Item */}
                <div style={{ flex: 1 }}>
                  <NotificationItem
                    notification={notification}
                    onClick={() => handleNotificationClick(notification)}
                    onDelete={(e) => {
                      if (!selectMode) handleDelete(e, notification.id);
                    }}
                    onViewInvite={selectMode ? undefined : handleViewInvite}
                  />
                </div>
              </div>
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
            color: 'var(--subtle)',
          }}
        >
          Showing {filteredNotifications.length} of {notifications.length} notifications
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 20,
          }}
          onClick={() => setDeleteConfirmOpen(false)}
        >
          <div
            style={{
              background: 'var(--bg-card)',
              borderRadius: 12,
              padding: 24,
              maxWidth: 400,
              width: '100%',
              border: '1px solid var(--panel-border-strong)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: 'var(--text)',
                margin: '0 0 12px 0',
              }}
            >
              Delete Notifications?
            </h3>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: '0 0 20px 0' }}>
              Are you sure you want to delete {selectedIds.size} notification
              {selectedIds.size !== 1 ? 's' : ''}? This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => setDeleteConfirmOpen(false)}
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  color: 'var(--text-muted)',
                  fontSize: 14,
                  fontWeight: 600,
                  padding: '12px 20px',
                  borderRadius: 8,
                  cursor: 'pointer',
                  minHeight: 48,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleBulkDelete}
                style={{
                  flex: 1,
                  background: '#dc2626',
                  border: 'none',
                  color: '#fff',
                  fontSize: 14,
                  fontWeight: 600,
                  padding: '12px 20px',
                  borderRadius: 8,
                  cursor: 'pointer',
                  minHeight: 48,
                }}
              >
                Delete
              </button>
            </div>
          </div>
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
