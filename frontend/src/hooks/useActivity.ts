/**
 * React Hook for Activity System
 * Provides easy integration with activityService in React components
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import activityService, {
  Activity,
  OnlineUser,
  CurrentlyEditing,
  ActivityType,
  events,
} from '../services/activityService';

interface UseActivityOptions {
  projectId: number;
  autoStart?: boolean; // Auto-start polling when hook mounts
  onNewActivity?: (activity: Activity) => void; // Callback for new activities
}

interface UseActivityReturn {
  activities: Activity[];
  onlineUsers: OnlineUser[];
  currentlyEditing: CurrentlyEditing[];
  isLoading: boolean;
  isPolling: boolean;
  error: Error | null;

  // Actions
  refresh: () => Promise<void>;
  startEditing: (sectionId: number) => Promise<void>;
  stopEditing: (sectionId: number) => Promise<void>;
  logActivity: (
    activityType: ActivityType,
    description: string,
    metadata?: Record<string, any>
  ) => Promise<void>;
  startPolling: () => void;
  stopPolling: () => void;

  // Utility functions
  isUserOnline: (userId: number) => boolean;
  isSectionBeingEdited: (sectionId: number) => boolean;
  getEditorsForSection: (sectionId: number) => CurrentlyEditing[];
}

/**
 * Custom hook for managing project activity
 */
export function useActivity(options: UseActivityOptions): UseActivityReturn {
  const { projectId, autoStart = false, onNewActivity } = options;

  // State
  const [activities, setActivities] = useState<Activity[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [currentlyEditing, setCurrentlyEditing] = useState<CurrentlyEditing[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isPolling, setIsPolling] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  // Track current editing section
  const currentEditingSectionRef = useRef<number | null>(null);

  // Refresh all activity data
  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [activitiesData, onlineUsersData, editingData] = await Promise.all([
        activityService.getProjectActivities(projectId),
        activityService.getOnlineUsers(projectId),
        activityService.getCurrentlyEditing(projectId),
      ]);

      setActivities(activitiesData);
      setOnlineUsers(onlineUsersData);
      setCurrentlyEditing(editingData);
    } catch (err) {
      setError(err as Error);
      console.error('Failed to refresh activity:', err);
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  // Start editing a section
  const startEditing = useCallback(
    async (sectionId: number) => {
      try {
        await activityService.startEditingSection(projectId, sectionId);
        currentEditingSectionRef.current = sectionId;
      } catch (err) {
        setError(err as Error);
        console.error('Failed to start editing:', err);
        throw err;
      }
    },
    [projectId]
  );

  // Stop editing a section
  const stopEditing = useCallback(
    async (sectionId: number) => {
      try {
        await activityService.stopEditingSection(projectId, sectionId);
        if (currentEditingSectionRef.current === sectionId) {
          currentEditingSectionRef.current = null;
        }
      } catch (err) {
        setError(err as Error);
        console.error('Failed to stop editing:', err);
        throw err;
      }
    },
    [projectId]
  );

  // Log an activity
  const logActivity = useCallback(
    async (
      activityType: ActivityType,
      description: string,
      metadata?: Record<string, any>
    ) => {
      try {
        await activityService.logActivity(
          projectId,
          activityType,
          description,
          metadata
        );
      } catch (err) {
        setError(err as Error);
        console.error('Failed to log activity:', err);
        throw err;
      }
    },
    [projectId]
  );

  // Start polling
  const startPollingCallback = useCallback(() => {
    activityService.startPolling(projectId);
    setIsPolling(true);
  }, [projectId]);

  // Stop polling
  const stopPollingCallback = useCallback(() => {
    activityService.stopPolling(projectId);
    setIsPolling(false);
  }, [projectId]);

  // Utility: Check if user is online
  const isUserOnline = useCallback(
    (userId: number): boolean => {
      return onlineUsers.some(u => u.user_id === userId && u.is_online);
    },
    [onlineUsers]
  );

  // Utility: Check if section is being edited
  const isSectionBeingEdited = useCallback(
    (sectionId: number): boolean => {
      return currentlyEditing.some(e => e.section_id === sectionId);
    },
    [currentlyEditing]
  );

  // Utility: Get editors for a section
  const getEditorsForSection = useCallback(
    (sectionId: number): CurrentlyEditing[] => {
      return currentlyEditing.filter(e => e.section_id === sectionId);
    },
    [currentlyEditing]
  );

  // Subscribe to activity events
  useEffect(() => {
    // Handle activities updated
    const unsubActivities = events.on('activity:updated', ({ projectId: pid, activities: acts }) => {
      if (pid === projectId) {
        setActivities(acts);
      }
    });

    // Handle new activity
    const unsubNew = events.on('activity:new', ({ projectId: pid, activity }) => {
      if (pid === projectId) {
        if (onNewActivity) {
          onNewActivity(activity);
        }
      }
    });

    // Handle online users updated
    const unsubOnlineUsers = events.on('activity:online-users', ({ projectId: pid, onlineUsers: users }) => {
      if (pid === projectId) {
        setOnlineUsers(users);
      }
    });

    // Handle currently editing updated
    const unsubEditing = events.on('activity:currently-editing', ({ projectId: pid, editing }) => {
      if (pid === projectId) {
        setCurrentlyEditing(editing);
      }
    });

    // Handle polling state changes
    const unsubPollingStarted = events.on('activity:polling-started', ({ projectId: pid }) => {
      if (pid === projectId) {
        setIsPolling(true);
      }
    });

    const unsubPollingStopped = events.on('activity:polling-stopped', ({ projectId: pid }) => {
      if (pid === projectId) {
        setIsPolling(false);
      }
    });

    // Handle polling errors
    const unsubPollingError = events.on('activity:polling-error', ({ projectId: pid, error: err }) => {
      if (pid === projectId) {
        setError(err);
        setIsPolling(false);
      }
    });

    // Cleanup subscriptions
    return () => {
      unsubActivities();
      unsubNew();
      unsubOnlineUsers();
      unsubEditing();
      unsubPollingStarted();
      unsubPollingStopped();
      unsubPollingError();
    };
  }, [projectId, onNewActivity]);

  // Auto-start polling if enabled
  useEffect(() => {
    if (autoStart) {
      startPollingCallback();
      refresh();
    }

    return () => {
      if (autoStart) {
        stopPollingCallback();

        // Stop editing current section on unmount
        if (currentEditingSectionRef.current !== null) {
          activityService.stopEditingSection(projectId, currentEditingSectionRef.current);
        }
      }
    };
  }, [autoStart, startPollingCallback, stopPollingCallback, refresh, projectId]);

  return {
    activities,
    onlineUsers,
    currentlyEditing,
    isLoading,
    isPolling,
    error,

    refresh,
    startEditing,
    stopEditing,
    logActivity,
    startPolling: startPollingCallback,
    stopPolling: stopPollingCallback,

    isUserOnline,
    isSectionBeingEdited,
    getEditorsForSection,
  };
}

/**
 * Simple hook to just get online status
 */
export function useOnlineStatus(
  projectId: number,
  autoStart = false
): {
  onlineUsers: OnlineUser[];
  isUserOnline: (userId: number) => boolean;
  refresh: () => Promise<void>;
} {
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);

  const refresh = useCallback(async () => {
    try {
      const users = await activityService.getOnlineUsers(projectId);
      setOnlineUsers(users);
    } catch (err) {
      console.error('Failed to get online users:', err);
    }
  }, [projectId]);

  const isUserOnline = useCallback(
    (userId: number): boolean => {
      return onlineUsers.some(u => u.user_id === userId && u.is_online);
    },
    [onlineUsers]
  );

  useEffect(() => {
    const unsubOnlineUsers = events.on('activity:online-users', ({ projectId: pid, onlineUsers: users }) => {
      if (pid === projectId) {
        setOnlineUsers(users);
      }
    });

    if (autoStart) {
      refresh();
    }

    return () => {
      unsubOnlineUsers();
    };
  }, [autoStart, refresh, projectId]);

  return { onlineUsers, isUserOnline, refresh };
}

/**
 * Simple hook for editing indicators
 */
export function useEditingIndicators(
  projectId: number,
  autoStart = false
): {
  currentlyEditing: CurrentlyEditing[];
  isSectionBeingEdited: (sectionId: number) => boolean;
  getEditorsForSection: (sectionId: number) => CurrentlyEditing[];
  refresh: () => Promise<void>;
} {
  const [currentlyEditing, setCurrentlyEditing] = useState<CurrentlyEditing[]>([]);

  const refresh = useCallback(async () => {
    try {
      const editing = await activityService.getCurrentlyEditing(projectId);
      setCurrentlyEditing(editing);
    } catch (err) {
      console.error('Failed to get editing indicators:', err);
    }
  }, [projectId]);

  const isSectionBeingEdited = useCallback(
    (sectionId: number): boolean => {
      return currentlyEditing.some(e => e.section_id === sectionId);
    },
    [currentlyEditing]
  );

  const getEditorsForSection = useCallback(
    (sectionId: number): CurrentlyEditing[] => {
      return currentlyEditing.filter(e => e.section_id === sectionId);
    },
    [currentlyEditing]
  );

  useEffect(() => {
    const unsubEditing = events.on('activity:currently-editing', ({ projectId: pid, editing }) => {
      if (pid === projectId) {
        setCurrentlyEditing(editing);
      }
    });

    if (autoStart) {
      refresh();
    }

    return () => {
      unsubEditing();
    };
  }, [autoStart, refresh, projectId]);

  return {
    currentlyEditing,
    isSectionBeingEdited,
    getEditorsForSection,
    refresh,
  };
}

export default useActivity;
