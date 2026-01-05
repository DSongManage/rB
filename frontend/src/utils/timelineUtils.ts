/**
 * Timeline Utilities
 * Merges task deadlines and activities into a unified chronological timeline
 */

import { CollaboratorRole, ContractTask } from '../services/collaborationApi';
import { Activity } from '../services/activityService';

// Timeline item types
export type TimelineItemType = 'task' | 'activity';

export type TaskStatus = 'pending' | 'in_progress' | 'complete' | 'signed_off' | 'cancelled';

export interface TaskTimelineData {
  id: number;
  title: string;
  description: string;
  deadline: string;
  status: TaskStatus;
  is_overdue: boolean;
  days_until_deadline?: number;
  collaborator_username: string;
  collaborator_id: number;
  collaborator_role: string;
  marked_complete_at?: string;
  signed_off_at?: string;
}

export interface TimelineItem {
  id: string;
  type: TimelineItemType;
  timestamp: Date;
  sortPriority: number; // Lower = higher priority (overdue tasks get 0)
  task?: TaskTimelineData;
  activity?: Activity;
}

export type DateGroup = 'overdue' | 'today' | 'tomorrow' | 'this_week' | 'this_month' | 'older' | 'future';

export interface GroupedTimeline {
  group: DateGroup;
  label: string;
  items: TimelineItem[];
}

/**
 * Merge tasks and activities into a unified timeline
 */
export function mergeTasksAndActivities(
  collaborators: CollaboratorRole[],
  activities: Activity[]
): TimelineItem[] {
  const items: TimelineItem[] = [];

  // Extract and convert tasks from all collaborators
  collaborators.forEach(collaborator => {
    if (collaborator.contract_tasks && collaborator.contract_tasks.length > 0) {
      collaborator.contract_tasks.forEach(task => {
        // Use deadline as primary timestamp, or completion/signoff date if available
        let timestamp: Date;
        if (task.signed_off_at) {
          timestamp = new Date(task.signed_off_at);
        } else if (task.marked_complete_at) {
          timestamp = new Date(task.marked_complete_at);
        } else {
          timestamp = new Date(task.deadline);
        }

        // Overdue tasks get highest priority (0), then by date
        const sortPriority = task.is_overdue ? 0 : 1;

        items.push({
          id: `task-${task.id}`,
          type: 'task',
          timestamp,
          sortPriority,
          task: {
            id: task.id,
            title: task.title,
            description: task.description,
            deadline: task.deadline,
            status: task.status,
            is_overdue: task.is_overdue,
            days_until_deadline: task.days_until_deadline,
            collaborator_username: collaborator.username,
            collaborator_id: collaborator.user,
            collaborator_role: collaborator.role,
            marked_complete_at: task.marked_complete_at,
            signed_off_at: task.signed_off_at,
          },
        });
      });
    }
  });

  // Convert activities to timeline items
  activities.forEach(activity => {
    items.push({
      id: `activity-${activity.id}`,
      type: 'activity',
      timestamp: new Date(activity.created_at),
      sortPriority: 2, // Activities have lower priority than tasks
      activity,
    });
  });

  // Sort: overdue tasks first (priority 0), then by timestamp descending
  return items.sort((a, b) => {
    // First sort by priority (overdue tasks first)
    if (a.sortPriority !== b.sortPriority) {
      return a.sortPriority - b.sortPriority;
    }
    // Then by timestamp (newest first for activities, soonest deadline first for tasks)
    if (a.type === 'task' && b.type === 'task') {
      // For tasks, sort by deadline (soonest first)
      return a.timestamp.getTime() - b.timestamp.getTime();
    }
    // For activities or mixed, sort newest first
    return b.timestamp.getTime() - a.timestamp.getTime();
  });
}

/**
 * Get date group for a given date
 */
export function getDateGroup(date: Date): DateGroup {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dayAfterTomorrow = new Date(today);
  dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);
  const oneWeekFromNow = new Date(today);
  oneWeekFromNow.setDate(oneWeekFromNow.getDate() + 7);
  const oneMonthFromNow = new Date(today);
  oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1);

  const itemDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (itemDate < today) {
    return 'older';
  } else if (itemDate.getTime() === today.getTime()) {
    return 'today';
  } else if (itemDate.getTime() === tomorrow.getTime()) {
    return 'tomorrow';
  } else if (itemDate < oneWeekFromNow) {
    return 'this_week';
  } else if (itemDate < oneMonthFromNow) {
    return 'this_month';
  } else {
    return 'future';
  }
}

/**
 * Get label for date group
 */
export function getDateGroupLabel(group: DateGroup): string {
  switch (group) {
    case 'overdue':
      return 'Overdue';
    case 'today':
      return 'Today';
    case 'tomorrow':
      return 'Tomorrow';
    case 'this_week':
      return 'This Week';
    case 'this_month':
      return 'This Month';
    case 'older':
      return 'Earlier';
    case 'future':
      return 'Upcoming';
    default:
      return 'Other';
  }
}

/**
 * Group timeline items by date
 */
export function groupTimelineByDate(items: TimelineItem[]): GroupedTimeline[] {
  const groups: Map<DateGroup, TimelineItem[]> = new Map();

  items.forEach(item => {
    let group: DateGroup;

    // For tasks, check if overdue first
    if (item.type === 'task' && item.task?.is_overdue) {
      group = 'overdue';
    } else {
      group = getDateGroup(item.timestamp);
    }

    if (!groups.has(group)) {
      groups.set(group, []);
    }
    groups.get(group)!.push(item);
  });

  // Define group order
  const groupOrder: DateGroup[] = ['overdue', 'today', 'tomorrow', 'this_week', 'this_month', 'future', 'older'];

  // Build result in order
  const result: GroupedTimeline[] = [];
  groupOrder.forEach(group => {
    const groupItems = groups.get(group);
    if (groupItems && groupItems.length > 0) {
      result.push({
        group,
        label: getDateGroupLabel(group),
        items: groupItems,
      });
    }
  });

  return result;
}

/**
 * Get urgency level for a task
 */
export function getTaskUrgency(task: TaskTimelineData): 'overdue' | 'due_today' | 'due_soon' | 'pending' | 'complete' | 'signed_off' {
  if (task.status === 'signed_off') return 'signed_off';
  if (task.status === 'complete') return 'complete';
  if (task.status === 'cancelled') return 'pending';
  if (task.is_overdue) return 'overdue';

  const daysUntil = task.days_until_deadline;
  if (daysUntil !== undefined) {
    if (daysUntil === 0) return 'due_today';
    if (daysUntil <= 3) return 'due_soon';
  }

  return 'pending';
}

/**
 * Format relative time (e.g., "2 hours ago", "in 3 days")
 */
export function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffMins = Math.round(diffMs / (1000 * 60));
  const diffHours = Math.round(diffMs / (1000 * 60 * 60));
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffMs < 0) {
    // Past
    const absDays = Math.abs(diffDays);
    const absHours = Math.abs(diffHours);
    const absMins = Math.abs(diffMins);

    if (absDays >= 1) return `${absDays} day${absDays > 1 ? 's' : ''} ago`;
    if (absHours >= 1) return `${absHours} hour${absHours > 1 ? 's' : ''} ago`;
    if (absMins >= 1) return `${absMins} min${absMins > 1 ? 's' : ''} ago`;
    return 'just now';
  } else {
    // Future
    if (diffDays >= 1) return `in ${diffDays} day${diffDays > 1 ? 's' : ''}`;
    if (diffHours >= 1) return `in ${diffHours} hour${diffHours > 1 ? 's' : ''}`;
    if (diffMins >= 1) return `in ${diffMins} min${diffMins > 1 ? 's' : ''}`;
    return 'now';
  }
}
