/**
 * UnifiedTimeline Component
 * Main container that renders a chronological timeline of tasks and activities
 */

import React from 'react';
import { ListTodo, Activity as ActivityIcon } from 'lucide-react';
import {
  TimelineItem,
  GroupedTimeline,
  groupTimelineByDate,
} from '../../../utils/timelineUtils';
import { TaskTimelineItem } from './TaskTimelineItem';
import { ActivityTimelineItem } from './ActivityTimelineItem';

interface UnifiedTimelineProps {
  items: TimelineItem[];
  isLoading?: boolean;
  onTaskClick?: (taskId: number) => void;
}

// Date group styling
const groupStyles: Record<string, { color: string; bgColor: string }> = {
  overdue: { color: '#ef4444', bgColor: 'rgba(239, 68, 68, 0.15)' },
  today: { color: '#f59e0b', bgColor: 'rgba(245, 158, 11, 0.1)' },
  tomorrow: { color: '#3b82f6', bgColor: 'rgba(59, 130, 246, 0.1)' },
  this_week: { color: '#8b5cf6', bgColor: 'rgba(139, 92, 246, 0.1)' },
  this_month: { color: '#06b6d4', bgColor: 'rgba(6, 182, 212, 0.1)' },
  future: { color: '#10b981', bgColor: 'rgba(16, 185, 129, 0.1)' },
  older: { color: '#64748b', bgColor: 'rgba(100, 116, 139, 0.1)' },
};

export function UnifiedTimeline({ items, isLoading = false, onTaskClick }: UnifiedTimelineProps) {
  // Group items by date
  const groupedItems = groupTimelineByDate(items);

  // Count stats
  const taskCount = items.filter(i => i.type === 'task').length;
  const activityCount = items.filter(i => i.type === 'activity').length;
  const overdueCount = items.filter(i => i.type === 'task' && i.task?.is_overdue).length;

  if (isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 60,
          color: '#94a3b8',
        }}
      >
        Loading timeline...
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div
        style={{
          background: 'var(--panel)',
          border: '1px solid var(--panel-border)',
          borderRadius: 12,
          padding: 48,
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: 'rgba(139, 92, 246, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
          }}
        >
          <ListTodo size={28} style={{ color: '#8b5cf6' }} />
        </div>
        <h3 style={{ margin: '0 0 8px', color: 'var(--text)', fontSize: 16, fontWeight: 600 }}>
          No Timeline Items
        </h3>
        <p style={{ margin: 0, color: '#64748b', fontSize: 14 }}>
          Tasks and activities will appear here as your team collaborates.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Summary stats */}
      <div
        style={{
          display: 'flex',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        {overdueCount > 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 14px',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: 8,
            }}
          >
            <ListTodo size={16} style={{ color: '#ef4444' }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: '#ef4444' }}>
              {overdueCount} overdue
            </span>
          </div>
        )}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 14px',
            background: 'var(--panel)',
            border: '1px solid var(--panel-border)',
            borderRadius: 8,
          }}
        >
          <ListTodo size={16} style={{ color: '#3b82f6' }} />
          <span style={{ fontSize: 13, color: '#94a3b8' }}>
            {taskCount} task{taskCount !== 1 ? 's' : ''}
          </span>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 14px',
            background: 'var(--panel)',
            border: '1px solid var(--panel-border)',
            borderRadius: 8,
          }}
        >
          <ActivityIcon size={16} style={{ color: '#8b5cf6' }} />
          <span style={{ fontSize: 13, color: '#94a3b8' }}>
            {activityCount} activit{activityCount !== 1 ? 'ies' : 'y'}
          </span>
        </div>
      </div>

      {/* Grouped timeline */}
      {groupedItems.map((group) => (
        <TimelineGroup
          key={group.group}
          group={group}
          onTaskClick={onTaskClick}
        />
      ))}
    </div>
  );
}

/**
 * Timeline Group - renders a date-grouped section
 */
interface TimelineGroupProps {
  group: GroupedTimeline;
  onTaskClick?: (taskId: number) => void;
}

function TimelineGroup({ group, onTaskClick }: TimelineGroupProps) {
  const style = groupStyles[group.group] || groupStyles.older;

  return (
    <div>
      {/* Group header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 12,
        }}
      >
        <div
          style={{
            padding: '6px 14px',
            background: style.bgColor,
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 700,
            color: style.color,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          {group.label}
        </div>
        <div
          style={{
            flex: 1,
            height: 1,
            background: 'var(--panel-border)',
          }}
        />
        <span style={{ fontSize: 12, color: '#64748b' }}>
          {group.items.length} item{group.items.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Items */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {group.items.map((item) => (
          <div key={item.id}>
            {item.type === 'task' && item.task ? (
              <TaskTimelineItem
                task={item.task}
                onViewDetails={onTaskClick ? () => onTaskClick(item.task!.id) : undefined}
              />
            ) : item.type === 'activity' && item.activity ? (
              <ActivityTimelineItem activity={item.activity} />
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

export default UnifiedTimeline;
