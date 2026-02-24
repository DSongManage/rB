/**
 * Real-time Notification Service
 * Handles collaboration notifications, activity tracking, and real-time updates
 */

import { API_URL } from '../config';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

export type NotificationType =
  | 'invitation'
  | 'invitation_response'
  | 'counter_proposal'
  | 'comment'
  | 'approval'
  | 'section_update'
  | 'revenue_proposal'
  | 'mint_ready'
  | 'content_like'
  | 'content_comment'
  | 'content_rating'
  | 'creator_review'
  | 'content_purchase'
  | 'new_follower';

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

export interface NotificationPreference {
  notification_type: NotificationType;
  label: string;
  in_app: boolean;
  email: boolean;
}

export interface NotificationPreferencesResponse {
  action_items: NotificationPreference[];
  engagement: NotificationPreference[];
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
  knownNotificationIds: Set<number>; // Track IDs of notifications we've seen
  initialLoadComplete: boolean; // Prevent toast spam on first load
}

const state: NotificationState = {
  notifications: [],
  unreadCount: 0,
  lastChecked: null,
  isPolling: false,
  lastError: null,
  knownNotificationIds: new Set(),
  initialLoadComplete: false,
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
    const response = await fetch(`${API_URL}/api/auth/csrf/`, { credentials: 'include' });
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
  // Prepend API_URL if url is relative (starts with /)
  const fullUrl = url.startsWith('/') ? `${API_URL}${url}` : url;

  const response = await fetch(fullUrl, {
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

    // Track known notification IDs (for detecting truly new notifications)
    notifications.forEach(n => state.knownNotificationIds.add(n.id));

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
  // Helper to update local state after delete
  const removeFromLocalState = () => {
    const index = state.notifications.findIndex(n => n.id === notificationId);
    if (index !== -1) {
      const wasUnread = !state.notifications[index].read;
      state.notifications.splice(index, 1);

      if (wasUnread) {
        state.unreadCount = Math.max(0, state.unreadCount - 1);
      }

      // Also remove from known IDs
      state.knownNotificationIds.delete(notificationId);

      events.emit('notifications:updated', {
        notifications: state.notifications,
        unreadCount: state.unreadCount
      });
      events.emit('notifications:unread-count', { count: state.unreadCount });
    }
  };

  try {
    const csrfToken = await getCsrfToken();

    const fullUrl = `${API_URL}/api/notifications/${notificationId}/`;
    const response = await fetch(fullUrl, {
      method: 'DELETE',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': csrfToken,
      },
    });

    // Handle 404 gracefully - notification doesn't exist or already deleted
    // Still remove from local state since it's effectively "gone"
    if (response.status === 404) {
      console.warn(`Notification ${notificationId} not found on server, removing from local state`);
      removeFromLocalState();
      return;
    }

    if (!response.ok) {
      throw new Error(`Failed to delete notification: ${response.status}`);
    }

    // Successfully deleted - update local state
    removeFromLocalState();
  } catch (error) {
    console.error('Failed to delete notification:', error);
    // On network error, still try to remove from local state for better UX
    removeFromLocalState();
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
      counter_proposal: 0,
      comment: 0,
      approval: 0,
      section_update: 0,
      revenue_proposal: 0,
      mint_ready: 0,
      content_like: 0,
      content_comment: 0,
      content_rating: 0,
      creator_review: 0,
      content_purchase: 0,
      new_follower: 0,
    },
  };

  notifications.forEach(n => {
    stats.by_type[n.type] = (stats.by_type[n.type] || 0) + 1;
  });

  return stats;
}

/**
 * Fetch notification preferences (all 14 types with effective settings)
 */
export async function getNotificationPreferences(): Promise<NotificationPreferencesResponse> {
  return apiRequest<NotificationPreferencesResponse>('/api/notifications/preferences/');
}

/**
 * Update notification preferences
 */
export async function updateNotificationPreferences(
  preferences: { notification_type: string; in_app?: boolean; email?: boolean }[]
): Promise<void> {
  const csrfToken = await getCsrfToken();
  await apiRequest('/api/notifications/preferences/update/', {
    method: 'PUT',
    headers: { 'X-CSRFToken': csrfToken },
    body: JSON.stringify({ preferences }),
  });
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
    // Store IDs of previously known notifications before fetching
    const previouslyKnownIds = new Set(state.knownNotificationIds);

    await getNotifications();

    // Only emit 'notifications:new' after initial load is complete
    // This prevents a flood of toasts when the page first loads
    if (state.initialLoadComplete) {
      // Find truly NEW notifications (IDs we haven't seen before)
      const newNotifications = state.notifications.filter(
        n => !previouslyKnownIds.has(n.id) && !n.read
      );

      if (newNotifications.length > 0) {
        events.emit('notifications:new', {
          notifications: newNotifications,
          count: newNotifications.length
        });
      }
    } else {
      // Mark initial load as complete after first successful fetch
      state.initialLoadComplete = true;
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
  state.knownNotificationIds.clear();
  state.initialLoadComplete = false;
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
    counter_proposal: '🔄',
    comment: '💬',
    approval: '✅',
    section_update: '📝',
    revenue_proposal: '💰',
    mint_ready: '🎉',
    content_like: '❤️',
    content_comment: '💬',
    content_rating: '⭐',
    creator_review: '📋',
    content_purchase: '💵',
    new_follower: '👤',
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
    counter_proposal: '#f97316', // orange
    comment: '#06b6d4', // cyan
    approval: '#10b981', // green
    section_update: '#f59e0b', // amber
    revenue_proposal: '#eab308', // yellow
    mint_ready: '#ec4899', // pink
    content_like: '#ef4444', // red
    content_comment: '#06b6d4', // cyan
    content_rating: '#f59e0b', // amber
    creator_review: '#8b5cf6', // purple
    content_purchase: '#10b981', // green for money/success
    new_follower: '#3b82f6', // blue
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
  getNotificationPreferences,
  updateNotificationPreferences,

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
