/**
 * Real-time Activity Service
 * Handles activity tracking, online status, and currently editing indicators
 */

import { API_URL as API_BASE } from '../config';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

export type ActivityType =
  | 'section_updated'
  | 'comment_added'
  | 'collaborator_joined'
  | 'collaborator_left'
  | 'approval_given'
  | 'approval_requested'
  | 'ready_for_mint'
  | 'project_minted'
  | 'media_uploaded'
  | 'invitation_sent';

export interface Activity {
  id: number;
  project_id: number;
  user_id: number;
  username: string;
  avatar?: string;
  activity_type: ActivityType;
  description: string;
  section_id?: number;
  section_title?: string;
  created_at: string;
  metadata?: Record<string, any>;
}

export interface OnlineUser {
  user_id: number;
  username: string;
  avatar?: string;
  last_seen: string;
  is_online: boolean;
}

export interface CurrentlyEditing {
  user_id: number;
  username: string;
  section_id: number;
  section_title: string;
  started_at: string;
}

export interface ActivityState {
  activities: Activity[];
  onlineUsers: OnlineUser[];
  currentlyEditing: CurrentlyEditing[];
  lastUpdated: Date | null;
  isPolling: boolean;
  error: Error | null;
}

// ============================================================================
// Event System for Real-time Updates
// ============================================================================

type ActivityEventHandler = (data: any) => void;

class ActivityEventEmitter {
  private listeners: Map<string, Set<ActivityEventHandler>> = new Map();

  on(event: string, handler: ActivityEventHandler): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);

    return () => this.off(event, handler);
  }

  off(event: string, handler: ActivityEventHandler): void {
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
          console.error(`Error in activity event handler for ${event}:`, error);
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

const projectStates = new Map<number, ActivityState>();

function getProjectState(projectId: number): ActivityState {
  if (!projectStates.has(projectId)) {
    projectStates.set(projectId, {
      activities: [],
      onlineUsers: [],
      currentlyEditing: [],
      lastUpdated: null,
      isPolling: false,
      error: null,
    });
  }
  return projectStates.get(projectId)!;
}

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
  POLLING_INTERVAL: 15000, // 15 seconds
  ONLINE_THRESHOLD: 60000, // 1 minute - consider user offline after this
  MAX_ACTIVITIES: 50, // Keep last 50 activities
  MAX_RETRIES: 3,
  RETRY_DELAY: 5000,
};

// Polling intervals per project
const pollingIntervals = new Map<number, NodeJS.Timeout>();
const retryCounts = new Map<number, number>();

// ============================================================================
// API Helper Functions
// ============================================================================

function getCsrfToken(): string {
  const name = 'csrftoken';
  const cookies = document.cookie.split(';');
  for (let cookie of cookies) {
    const [key, value] = cookie.trim().split('=');
    if (key === name) return value;
  }
  return '';
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
    throw new Error(errorData?.error || errorData?.detail || `API request failed: ${response.status}`);
  }

  return response.json();
}

// ============================================================================
// Core API Functions
// ============================================================================

/**
 * Get recent activities for a project
 */
export async function getProjectActivities(
  projectId: number,
  limit: number = 20
): Promise<Activity[]> {
  try {
    const activities = await apiRequest<Activity[]>(
      `${API_BASE}/api/collaborative-projects/${projectId}/activities/?limit=${limit}`
    );

    const state = getProjectState(projectId);
    state.activities = activities.slice(0, CONFIG.MAX_ACTIVITIES);
    state.lastUpdated = new Date();
    state.error = null;

    events.emit('activity:updated', { projectId, activities });

    return activities;
  } catch (error) {
    const state = getProjectState(projectId);
    state.error = error as Error;

    // Graceful degradation - return cached activities
    console.warn('Failed to fetch activities, using cached data:', error);
    return state.activities;
  }
}

/**
 * Get online users for a project
 */
export async function getOnlineUsers(projectId: number): Promise<OnlineUser[]> {
  try {
    const users = await apiRequest<OnlineUser[]>(
      `${API_BASE}/api/collaborative-projects/${projectId}/online-users/`
    );

    const state = getProjectState(projectId);

    // Determine online status based on last_seen
    const now = Date.now();
    const onlineUsers = users.map(user => ({
      ...user,
      is_online: new Date(user.last_seen).getTime() + CONFIG.ONLINE_THRESHOLD > now,
    }));

    state.onlineUsers = onlineUsers;
    events.emit('activity:online-users', { projectId, onlineUsers });

    return onlineUsers;
  } catch (error) {
    const state = getProjectState(projectId);

    // Graceful degradation
    console.warn('Failed to fetch online users, using cached data:', error);
    return state.onlineUsers;
  }
}

/**
 * Get currently editing users
 */
export async function getCurrentlyEditing(projectId: number): Promise<CurrentlyEditing[]> {
  try {
    const editing = await apiRequest<CurrentlyEditing[]>(
      `${API_BASE}/api/collaborative-projects/${projectId}/currently-editing/`
    );

    const state = getProjectState(projectId);
    state.currentlyEditing = editing;
    events.emit('activity:currently-editing', { projectId, editing });

    return editing;
  } catch (error) {
    const state = getProjectState(projectId);

    // Graceful degradation
    console.warn('Failed to fetch currently editing, using cached data:', error);
    return state.currentlyEditing;
  }
}

/**
 * Update user's heartbeat (indicate they're active)
 */
export async function sendHeartbeat(projectId: number): Promise<void> {
  try {
    await apiRequest(`${API_BASE}/api/collaborative-projects/${projectId}/heartbeat/`, {
      method: 'POST',
      headers: {
        'X-CSRFToken': getCsrfToken(),
      },
    });
  } catch (error) {
    // Fail silently for heartbeat
    console.debug('Heartbeat failed:', error);
  }
}

/**
 * Notify that user is editing a section
 */
export async function startEditingSection(
  projectId: number,
  sectionId: number
): Promise<void> {
  try {
    await apiRequest(
      `${API_BASE}/api/collaborative-projects/${projectId}/start-editing/`,
      {
        method: 'POST',
        headers: {
          'X-CSRFToken': getCsrfToken(),
        },
        body: JSON.stringify({ section_id: sectionId }),
      }
    );

    // Immediately refresh currently editing
    await getCurrentlyEditing(projectId);
  } catch (error) {
    console.warn('Failed to notify start editing:', error);
  }
}

/**
 * Notify that user stopped editing a section
 */
export async function stopEditingSection(
  projectId: number,
  sectionId: number
): Promise<void> {
  try {
    await apiRequest(
      `${API_BASE}/api/collaborative-projects/${projectId}/stop-editing/`,
      {
        method: 'POST',
        headers: {
          'X-CSRFToken': getCsrfToken(),
        },
        body: JSON.stringify({ section_id: sectionId }),
      }
    );

    // Immediately refresh currently editing
    await getCurrentlyEditing(projectId);
  } catch (error) {
    console.warn('Failed to notify stop editing:', error);
  }
}

/**
 * Log a new activity
 */
export async function logActivity(
  projectId: number,
  activityType: ActivityType,
  description: string,
  metadata?: Record<string, any>
): Promise<Activity | null> {
  try {
    const activity = await apiRequest<Activity>(
      `${API_BASE}/api/collaborative-projects/${projectId}/log-activity/`,
      {
        method: 'POST',
        headers: {
          'X-CSRFToken': getCsrfToken(),
        },
        body: JSON.stringify({
          activity_type: activityType,
          description,
          metadata,
        }),
      }
    );

    // Add to local state
    const state = getProjectState(projectId);
    state.activities = [activity, ...state.activities].slice(0, CONFIG.MAX_ACTIVITIES);

    events.emit('activity:new', { projectId, activity });
    events.emit('activity:updated', { projectId, activities: state.activities });

    return activity;
  } catch (error) {
    console.warn('Failed to log activity:', error);
    return null;
  }
}

// ============================================================================
// Real-time Polling System
// ============================================================================

/**
 * Poll for activity updates
 */
async function pollActivity(projectId: number): Promise<void> {
  const state = getProjectState(projectId);
  if (!state.isPolling) return;

  try {
    // Fetch all activity data in parallel
    await Promise.all([
      getProjectActivities(projectId, 20),
      getOnlineUsers(projectId),
      getCurrentlyEditing(projectId),
    ]);

    // Also send heartbeat
    await sendHeartbeat(projectId);

    // Reset retry count on success
    retryCounts.set(projectId, 0);
  } catch (error) {
    console.error('Activity polling error:', error);

    const retryCount = (retryCounts.get(projectId) || 0) + 1;
    retryCounts.set(projectId, retryCount);

    if (retryCount >= CONFIG.MAX_RETRIES) {
      console.error('Max retries reached for activity polling');
      stopPolling(projectId);
      events.emit('activity:polling-error', { projectId, error, retryCount });
    }
  }
}

/**
 * Start polling for a project
 */
export function startPolling(projectId: number): void {
  const state = getProjectState(projectId);

  if (state.isPolling) {
    console.warn(`Activity polling already started for project ${projectId}`);
    return;
  }

  console.log(`Starting activity polling for project ${projectId}...`);
  state.isPolling = true;
  retryCounts.set(projectId, 0);

  // Initial fetch
  pollActivity(projectId);

  // Set up polling interval
  const interval = setInterval(
    () => pollActivity(projectId),
    CONFIG.POLLING_INTERVAL
  );
  pollingIntervals.set(projectId, interval);

  events.emit('activity:polling-started', { projectId });
}

/**
 * Stop polling for a project
 */
export function stopPolling(projectId: number): void {
  const state = getProjectState(projectId);

  if (!state.isPolling) {
    return;
  }

  console.log(`Stopping activity polling for project ${projectId}...`);
  state.isPolling = false;

  const interval = pollingIntervals.get(projectId);
  if (interval) {
    clearInterval(interval);
    pollingIntervals.delete(projectId);
  }

  events.emit('activity:polling-stopped', { projectId });
}

/**
 * Check if polling is active for a project
 */
export function isPolling(projectId: number): boolean {
  const state = getProjectState(projectId);
  return state.isPolling;
}

// ============================================================================
// Event System Export
// ============================================================================

export const events = new ActivityEventEmitter();

/**
 * Available events:
 * - 'activity:updated' - Fired when activities list is updated
 * - 'activity:new' - Fired when a new activity is logged
 * - 'activity:online-users' - Fired when online users list is updated
 * - 'activity:currently-editing' - Fired when editing status changes
 * - 'activity:polling-started' - Fired when polling starts
 * - 'activity:polling-stopped' - Fired when polling stops
 * - 'activity:polling-error' - Fired when polling encounters errors
 */

// ============================================================================
// State Access Functions
// ============================================================================

/**
 * Get current activity state for a project
 */
export function getState(projectId: number): Readonly<ActivityState> {
  return { ...getProjectState(projectId) };
}

/**
 * Get cached activities (without API call)
 */
export function getCachedActivities(projectId: number): Activity[] {
  return [...getProjectState(projectId).activities];
}

/**
 * Get cached online users (without API call)
 */
export function getCachedOnlineUsers(projectId: number): OnlineUser[] {
  return [...getProjectState(projectId).onlineUsers];
}

/**
 * Get cached currently editing (without API call)
 */
export function getCachedCurrentlyEditing(projectId: number): CurrentlyEditing[] {
  return [...getProjectState(projectId).currentlyEditing];
}

/**
 * Clear state and stop polling for a project
 */
export function reset(projectId: number): void {
  stopPolling(projectId);
  projectStates.delete(projectId);
}

/**
 * Clear all states and stop all polling
 */
export function resetAll(): void {
  pollingIntervals.forEach((interval, projectId) => {
    stopPolling(projectId);
  });
  projectStates.clear();
  events.clear();
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get activity icon based on type
 */
export function getActivityIcon(type: ActivityType): string {
  const icons: Record<ActivityType, string> = {
    section_updated: '📝',
    comment_added: '💬',
    collaborator_joined: '👋',
    collaborator_left: '👋',
    approval_given: '✅',
    approval_requested: '🔔',
    ready_for_mint: '🎉',
    project_minted: '🪙',
    media_uploaded: '📁',
    invitation_sent: '📬',
  };
  return icons[type] || '📌';
}

/**
 * Get activity color based on type
 */
export function getActivityColor(type: ActivityType): string {
  const colors: Record<ActivityType, string> = {
    section_updated: '#3b82f6',
    comment_added: '#06b6d4',
    collaborator_joined: '#10b981',
    collaborator_left: '#64748b',
    approval_given: '#10b981',
    approval_requested: '#f59e0b',
    ready_for_mint: '#ec4899',
    project_minted: '#fbbf24',
    media_uploaded: '#8b5cf6',
    invitation_sent: '#f59e0b',
  };
  return colors[type] || '#64748b';
}

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
 * Check if a user is currently editing a specific section
 */
export function isUserEditingSection(
  projectId: number,
  userId: number,
  sectionId: number
): boolean {
  const state = getProjectState(projectId);
  return state.currentlyEditing.some(
    e => e.user_id === userId && e.section_id === sectionId
  );
}

/**
 * Get who is editing a specific section
 */
export function getEditorsForSection(
  projectId: number,
  sectionId: number
): CurrentlyEditing[] {
  const state = getProjectState(projectId);
  return state.currentlyEditing.filter(e => e.section_id === sectionId);
}

// ============================================================================
// Export Default Service
// ============================================================================

export default {
  // API Functions
  getProjectActivities,
  getOnlineUsers,
  getCurrentlyEditing,
  sendHeartbeat,
  startEditingSection,
  stopEditingSection,
  logActivity,

  // Polling Functions
  startPolling,
  stopPolling,
  isPolling,

  // State Functions
  getState,
  getCachedActivities,
  getCachedOnlineUsers,
  getCachedCurrentlyEditing,
  reset,
  resetAll,

  // Event System
  events,

  // Utilities
  getActivityIcon,
  getActivityColor,
  getTimeAgo,
  isUserEditingSection,
  getEditorsForSection,
};
