/**
 * Real-time Notification Service
 * Handles collaboration notifications, activity tracking, and real-time updates
 */

// ============================================================================
// TypeScript Interfaces
// ============================================================================

export type NotificationType =
  | 'invitation'
  | 'invitation_response'
  | 'comment'
  | 'approval'
  | 'section_update'
  | 'revenue_proposal'
  | 'mint_ready';

export interface NotificationUser {
  id: number;
  username: string;
  avatar?: string;
}

export interface Notification {
  id: number;
  type: NotificationType;
  title: string;
  message: string;
  project_id?: number;
  from_user: NotificationUser;
  created_at: string;
  read: boolean;
  action_url?: string;
}

export interface NotificationStats {
  total: number;
  unread: number;
  by_type: Record<NotificationType, number>;
}

// ============================================================================
// Event System for Real-time Updates
// ============================================================================

type NotificationEventHandler = (data: any) => void;

class NotificationEventEmitter {
  private listeners: Map<string, Set<NotificationEventHandler>> = new Map();

  on(event: string, handler: NotificationEventHandler): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);

    // Return unsubscribe function
    return () => this.off(event, handler);
  }

  off(event: string, handler: NotificationEventHandler): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  emit(event: string, data: any): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in notification event handler for ${event}:`, error);
        }
      });
    }
  }

  clear(): void {
    this.listeners.clear();
  }
}

// ============================================================================
// Local State Management
// ============================================================================

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  lastChecked: Date | null;
  isPolling: boolean;
  lastError: Error | null;
}

const state: NotificationState = {
  notifications: [],
  unreadCount: 0,
  lastChecked: null,
  isPolling: false,
  lastError: null,
};

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
  POLLING_INTERVAL: 30000, // 30 seconds
  MAX_RETRIES: 3,
  RETRY_DELAY: 5000, // 5 seconds
  REQUEST_TIMEOUT: 10000, // 10 seconds
};

// ============================================================================
// API Helper Functions
// ============================================================================

async function getCsrfToken(): Promise<string> {
  try {
    const response = await fetch('/api/auth/csrf/', { credentials: 'include' });
    const data = await response.json();
    return data?.csrfToken || '';
  } catch (error) {
    console.error('Failed to get CSRF token:', error);
    return '';
  }
}

async function apiRequest<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(url, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData?.error || `API request failed: ${response.status}`);
  }

  return response.json();
}

// ============================================================================
// Core API Functions
// ============================================================================

/**
 * Fetch all notifications for the current user
 */
export async function getNotifications(): Promise<Notification[]> {
  try {
    const notifications = await apiRequest<Notification[]>('/api/notifications/');
    state.notifications = notifications;
    state.unreadCount = notifications.filter(n => !n.read).length;
    state.lastChecked = new Date();
    state.lastError = null;

    events.emit('notifications:updated', { notifications, unreadCount: state.unreadCount });

    return notifications;
  } catch (error) {
    state.lastError = error as Error;
    console.error('Failed to fetch notifications:', error);
    throw error;
  }
}

/**
 * Get only unread notifications
 */
export async function getUnreadNotifications(): Promise<Notification[]> {
  const allNotifications = await getNotifications();
  return allNotifications.filter(n => !n.read);
}

/**
 * Get unread notification count
 */
export async function getUnreadCount(): Promise<number> {
  try {
    const notifications = await getNotifications();
    const count = notifications.filter(n => !n.read).length;
    state.unreadCount = count;

    events.emit('notifications:unread-count', { count });

    return count;
  } catch (error) {
    console.error('Failed to get unread count:', error);
    return state.unreadCount; // Return cached count on error
  }
}

/**
 * Mark a single notification as read
 */
export async function markNotificationRead(notificationId: number): Promise<void> {
  try {
    const csrfToken = await getCsrfToken();

    await apiRequest(`/api/notifications/${notificationId}/mark-read/`, {
      method: 'POST',
      headers: {
        'X-CSRFToken': csrfToken,
      },
    });

    // Update local state
    const notification = state.notifications.find(n => n.id === notificationId);
    if (notification && !notification.read) {
      notification.read = true;
      state.unreadCount = Math.max(0, state.unreadCount - 1);

      events.emit('notifications:updated', {
        notifications: state.notifications,
        unreadCount: state.unreadCount
      });
      events.emit('notifications:unread-count', { count: state.unreadCount });
    }
  } catch (error) {
    console.error('Failed to mark notification as read:', error);
    throw error;
  }
}

/**
 * Mark all notifications as read
 */
export async function markAllNotificationsRead(): Promise<void> {
  try {
    const csrfToken = await getCsrfToken();

    await apiRequest('/api/notifications/mark-all-read/', {
      method: 'POST',
      headers: {
        'X-CSRFToken': csrfToken,
      },
    });

    // Update local state
    state.notifications.forEach(n => n.read = true);
    state.unreadCount = 0;

    events.emit('notifications:updated', {
      notifications: state.notifications,
      unreadCount: 0
    });
    events.emit('notifications:unread-count', { count: 0 });
  } catch (error) {
    console.error('Failed to mark all notifications as read:', error);
    throw error;
  }
}

/**
 * Delete a notification
 */
export async function deleteNotification(notificationId: number): Promise<void> {
  try {
    const csrfToken = await getCsrfToken();

    await apiRequest(`/api/notifications/${notificationId}/`, {
      method: 'DELETE',
      headers: {
        'X-CSRFToken': csrfToken,
      },
    });

    // Update local state
    const index = state.notifications.findIndex(n => n.id === notificationId);
    if (index !== -1) {
      const wasUnread = !state.notifications[index].read;
      state.notifications.splice(index, 1);

      if (wasUnread) {
        state.unreadCount = Math.max(0, state.unreadCount - 1);
      }

      events.emit('notifications:updated', {
        notifications: state.notifications,
        unreadCount: state.unreadCount
      });
      events.emit('notifications:unread-count', { count: state.unreadCount });
    }
  } catch (error) {
    console.error('Failed to delete notification:', error);
    throw error;
  }
}

/**
 * Get notification statistics
 */
export async function getNotificationStats(): Promise<NotificationStats> {
  const notifications = await getNotifications();

  const stats: NotificationStats = {
    total: notifications.length,
    unread: notifications.filter(n => !n.read).length,
    by_type: {
      invitation: 0,
      invitation_response: 0,
      comment: 0,
      approval: 0,
      section_update: 0,
      revenue_proposal: 0,
      mint_ready: 0,
    },
  };

  notifications.forEach(n => {
    stats.by_type[n.type] = (stats.by_type[n.type] || 0) + 1;
  });

  return stats;
}

// ============================================================================
// Real-time Polling System
// ============================================================================

let pollingInterval: NodeJS.Timeout | null = null;
let retryCount = 0;
let retryTimeout: NodeJS.Timeout | null = null;

/**
 * Poll for new notifications
 */
async function pollNotifications(): Promise<void> {
  if (!state.isPolling) return;

  try {
    const previousUnreadCount = state.unreadCount;
    await getNotifications();

    // Check if there are new notifications
    if (state.unreadCount > previousUnreadCount) {
      const newNotifications = state.notifications
        .filter(n => !n.read)
        .slice(0, state.unreadCount - previousUnreadCount);

      events.emit('notifications:new', {
        notifications: newNotifications,
        count: newNotifications.length
      });
    }

    // Reset retry count on success
    retryCount = 0;
  } catch (error) {
    console.error('Polling error:', error);
    retryCount++;

    if (retryCount >= CONFIG.MAX_RETRIES) {
      console.error('Max retries reached, stopping polling');
      stopPolling();
      events.emit('notifications:polling-error', { error, retryCount });
    } else {
      // Schedule retry
      if (retryTimeout) clearTimeout(retryTimeout);
      retryTimeout = setTimeout(() => {
        pollNotifications();
      }, CONFIG.RETRY_DELAY);
    }
  }
}

/**
 * Start polling for notifications
 */
export function startPolling(): void {
  if (state.isPolling) {
    console.warn('Notification polling already started');
    return;
  }

  console.log('Starting notification polling...');
  state.isPolling = true;
  retryCount = 0;

  // Initial fetch
  pollNotifications();

  // Set up polling interval
  pollingInterval = setInterval(pollNotifications, CONFIG.POLLING_INTERVAL);

  events.emit('notifications:polling-started', {});
}

/**
 * Stop polling for notifications
 */
export function stopPolling(): void {
  if (!state.isPolling) {
    return;
  }

  console.log('Stopping notification polling...');
  state.isPolling = false;

  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }

  if (retryTimeout) {
    clearTimeout(retryTimeout);
    retryTimeout = null;
  }

  events.emit('notifications:polling-stopped', {});
}

/**
 * Check if polling is active
 */
export function isPolling(): boolean {
  return state.isPolling;
}

/**
 * Update polling interval
 */
export function setPollingInterval(intervalMs: number): void {
  CONFIG.POLLING_INTERVAL = intervalMs;

  if (state.isPolling) {
    stopPolling();
    startPolling();
  }
}

// ============================================================================
// Event System Export
// ============================================================================

export const events = new NotificationEventEmitter();

/**
 * Available events:
 * - 'notifications:updated' - Fired when notifications list is updated
 * - 'notifications:unread-count' - Fired when unread count changes
 * - 'notifications:new' - Fired when new notifications are received
 * - 'notifications:polling-started' - Fired when polling starts
 * - 'notifications:polling-stopped' - Fired when polling stops
 * - 'notifications:polling-error' - Fired when polling encounters errors
 */

// ============================================================================
// State Access Functions
// ============================================================================

/**
 * Get current notification state
 */
export function getState(): Readonly<NotificationState> {
  return { ...state };
}

/**
 * Get cached notifications (without API call)
 */
export function getCachedNotifications(): Notification[] {
  return [...state.notifications];
}

/**
 * Get cached unread count (without API call)
 */
export function getCachedUnreadCount(): number {
  return state.unreadCount;
}

/**
 * Clear local state and stop polling
 */
export function reset(): void {
  stopPolling();
  state.notifications = [];
  state.unreadCount = 0;
  state.lastChecked = null;
  state.lastError = null;
  events.clear();
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get human-readable time ago string
 */
export function getTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
}

/**
 * Get notification icon based on type
 */
export function getNotificationIcon(type: NotificationType): string {
  const icons: Record<NotificationType, string> = {
    invitation: '📬',
    invitation_response: '✉️',
    comment: '💬',
    approval: '✅',
    section_update: '📝',
    revenue_proposal: '💰',
    mint_ready: '🎉',
  };
  return icons[type] || '🔔';
}

/**
 * Get notification color based on type
 */
export function getNotificationColor(type: NotificationType): string {
  const colors: Record<NotificationType, string> = {
    invitation: '#3b82f6', // blue
    invitation_response: '#8b5cf6', // purple
    comment: '#06b6d4', // cyan
    approval: '#10b981', // green
    section_update: '#f59e0b', // amber
    revenue_proposal: '#eab308', // yellow
    mint_ready: '#ec4899', // pink
  };
  return colors[type] || '#6b7280';
}

// ============================================================================
// Export Default Service
// ============================================================================

export default {
  // API Functions
  getNotifications,
  getUnreadNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  getNotificationStats,

  // Polling Functions
  startPolling,
  stopPolling,
  isPolling,
  setPollingInterval,

  // State Functions
  getState,
  getCachedNotifications,
  getCachedUnreadCount,
  reset,

  // Event System
  events,

  // Utilities
  getTimeAgo,
  getNotificationIcon,
  getNotificationColor,
};
