/**
 * React Hook for Notification System
 * Provides easy integration with notificationService in React components
 */

import { useEffect, useState, useCallback } from 'react';
import notificationService, {
  Notification,
  NotificationStats,
  events,
} from '../services/notificationService';

interface UseNotificationsOptions {
  autoStart?: boolean; // Auto-start polling when hook mounts
  onNewNotification?: (notifications: Notification[]) => void; // Callback for new notifications
}

interface UseNotificationsReturn {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  isPolling: boolean;
  error: Error | null;

  // Actions
  refresh: () => Promise<void>;
  markAsRead: (notificationId: number) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (notificationId: number) => Promise<void>;
  startPolling: () => void;
  stopPolling: () => void;
  getStats: () => Promise<NotificationStats>;
}

/**
 * Custom hook for managing notifications
 */
export function useNotifications(
  options: UseNotificationsOptions = {}
): UseNotificationsReturn {
  const { autoStart = false, onNewNotification } = options;

  // State
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isPolling, setIsPolling] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  // Refresh notifications
  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await notificationService.getNotifications();
      setNotifications(data);
      setUnreadCount(data.filter(n => !n.read).length);
    } catch (err) {
      setError(err as Error);
      console.error('Failed to refresh notifications:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Mark notification as read
  const markAsRead = useCallback(async (notificationId: number) => {
    try {
      await notificationService.markNotificationRead(notificationId);
      // State will be updated via event listener
    } catch (err) {
      setError(err as Error);
      console.error('Failed to mark notification as read:', err);
      throw err;
    }
  }, []);

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    try {
      await notificationService.markAllNotificationsRead();
      // State will be updated via event listener
    } catch (err) {
      setError(err as Error);
      console.error('Failed to mark all notifications as read:', err);
      throw err;
    }
  }, []);

  // Delete notification
  const deleteNotificationCallback = useCallback(async (notificationId: number) => {
    try {
      await notificationService.deleteNotification(notificationId);
      // State will be updated via event listener
    } catch (err) {
      setError(err as Error);
      console.error('Failed to delete notification:', err);
      throw err;
    }
  }, []);

  // Start polling
  const startPollingCallback = useCallback(() => {
    notificationService.startPolling();
    setIsPolling(true);
  }, []);

  // Stop polling
  const stopPollingCallback = useCallback(() => {
    notificationService.stopPolling();
    setIsPolling(false);
  }, []);

  // Get statistics
  const getStats = useCallback(async () => {
    try {
      return await notificationService.getNotificationStats();
    } catch (err) {
      setError(err as Error);
      console.error('Failed to get notification stats:', err);
      throw err;
    }
  }, []);

  // Subscribe to notification events
  useEffect(() => {
    // Handle notifications updated
    const unsubUpdated = events.on('notifications:updated', ({ notifications, unreadCount }) => {
      setNotifications(notifications);
      setUnreadCount(unreadCount);
    });

    // Handle unread count changes
    const unsubUnreadCount = events.on('notifications:unread-count', ({ count }) => {
      setUnreadCount(count);
    });

    // Handle new notifications
    const unsubNew = events.on('notifications:new', ({ notifications: newNotifs }) => {
      if (onNewNotification) {
        onNewNotification(newNotifs);
      }
    });

    // Handle polling state changes
    const unsubPollingStarted = events.on('notifications:polling-started', () => {
      setIsPolling(true);
    });

    const unsubPollingStopped = events.on('notifications:polling-stopped', () => {
      setIsPolling(false);
    });

    // Handle polling errors
    const unsubPollingError = events.on('notifications:polling-error', ({ error }) => {
      setError(error);
      setIsPolling(false);
    });

    // Cleanup subscriptions
    return () => {
      unsubUpdated();
      unsubUnreadCount();
      unsubNew();
      unsubPollingStarted();
      unsubPollingStopped();
      unsubPollingError();
    };
  }, [onNewNotification]);

  // Auto-start polling if enabled
  useEffect(() => {
    if (autoStart) {
      startPollingCallback();
      refresh();
    }

    return () => {
      if (autoStart) {
        stopPollingCallback();
      }
    };
  }, [autoStart, startPollingCallback, stopPollingCallback, refresh]);

  return {
    notifications,
    unreadCount,
    isLoading,
    isPolling,
    error,

    refresh,
    markAsRead,
    markAllAsRead,
    deleteNotification: deleteNotificationCallback,
    startPolling: startPollingCallback,
    stopPolling: stopPollingCallback,
    getStats,
  };
}

/**
 * Simple hook to just get unread count
 */
export function useUnreadCount(autoStart = false): {
  unreadCount: number;
  refresh: () => Promise<void>;
} {
  const [unreadCount, setUnreadCount] = useState<number>(0);

  const refresh = useCallback(async () => {
    try {
      const count = await notificationService.getUnreadCount();
      setUnreadCount(count);
    } catch (err) {
      console.error('Failed to get unread count:', err);
    }
  }, []);

  useEffect(() => {
    const unsubUnreadCount = events.on('notifications:unread-count', ({ count }) => {
      setUnreadCount(count);
    });

    if (autoStart) {
      refresh();
    }

    return () => {
      unsubUnreadCount();
    };
  }, [autoStart, refresh]);

  return { unreadCount, refresh };
}

export default useNotifications;
