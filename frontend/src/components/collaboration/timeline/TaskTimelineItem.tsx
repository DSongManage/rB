/**
 * TaskTimelineItem Component
 * Renders a task deadline with urgency-based styling
 */

import React from 'react';
import {
  AlertTriangle,
  Clock,
  CircleDot,
  CircleCheck,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { TaskTimelineData, getTaskUrgency, formatRelativeTime } from '../../../utils/timelineUtils';

interface TaskTimelineItemProps {
  task: TaskTimelineData;
  onViewDetails?: () => void;
}

// Urgency-based styling configurations
const urgencyStyles = {
  overdue: {
    background: 'rgba(239, 68, 68, 0.1)',
    borderColor: '#ef4444',
    textColor: '#f87171',
    icon: AlertTriangle,
    statusLabel: 'Overdue',
    statusBg: '#ef444420',
  },
  due_today: {
    background: 'rgba(245, 158, 11, 0.12)',
    borderColor: '#f59e0b',
    textColor: '#fbbf24',
    icon: Clock,
    statusLabel: 'Due Today',
    statusBg: '#f59e0b20',
  },
  due_soon: {
    background: 'rgba(245, 158, 11, 0.08)',
    borderColor: '#f59e0b',
    textColor: '#fbbf24',
    icon: Clock,
    statusLabel: 'Due Soon',
    statusBg: '#f59e0b20',
  },
  pending: {
    background: 'var(--bg)',
    borderColor: '#3b82f6',
    textColor: 'var(--text)',
    icon: CircleDot,
    statusLabel: 'Pending',
    statusBg: '#3b82f620',
  },
  complete: {
    background: 'rgba(245, 158, 11, 0.06)',
    borderColor: '#f59e0b',
    textColor: '#fbbf24',
    icon: CircleCheck,
    statusLabel: 'Awaiting Sign-off',
    statusBg: '#f59e0b20',
  },
  signed_off: {
    background: 'rgba(16, 185, 129, 0.08)',
    borderColor: '#10b981',
    textColor: '#34d399',
    icon: CheckCircle2,
    statusLabel: 'Signed Off',
    statusBg: '#10b98120',
  },
};

export function TaskTimelineItem({ task, onViewDetails }: TaskTimelineItemProps) {
  const urgency = getTaskUrgency(task);
  const style = urgencyStyles[urgency];
  const Icon = style.icon;

  // Format deadline date
  const deadlineDate = new Date(task.deadline);
  const formattedDeadline = deadlineDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: deadlineDate.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
  });

  // Get time indicator text
  const getTimeIndicator = () => {
    if (task.status === 'signed_off') {
      return task.signed_off_at ? formatRelativeTime(new Date(task.signed_off_at)) : 'Completed';
    }
    if (task.status === 'complete') {
      return 'Awaiting review';
    }
    if (task.is_overdue) {
      const daysOverdue = task.days_until_deadline ? Math.abs(task.days_until_deadline) : 0;
      return `${daysOverdue} day${daysOverdue !== 1 ? 's' : ''} overdue`;
    }
    if (task.days_until_deadline !== undefined) {
      if (task.days_until_deadline === 0) return 'Due today';
      if (task.days_until_deadline === 1) return 'Due tomorrow';
      return `${task.days_until_deadline} days left`;
    }
    return formattedDeadline;
  };

  return (
    <div
      onClick={onViewDetails}
      style={{
        background: style.background,
        borderLeft: `4px solid ${style.borderColor}`,
        borderRadius: 8,
        padding: 16,
        cursor: onViewDetails ? 'pointer' : 'default',
        transition: 'background 0.15s ease',
      }}
      onMouseEnter={(e) => {
        if (onViewDetails) {
          e.currentTarget.style.background = urgency === 'overdue'
            ? 'rgba(239, 68, 68, 0.15)'
            : urgency === 'due_today' || urgency === 'due_soon'
              ? 'rgba(245, 158, 11, 0.15)'
              : 'rgba(59, 130, 246, 0.08)';
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = style.background;
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        {/* Icon */}
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            background: style.statusBg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Icon size={18} style={{ color: style.borderColor }} />
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Title row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <h4
              style={{
                margin: 0,
                fontSize: 14,
                fontWeight: 600,
                color: style.textColor,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {task.title}
            </h4>
            <span
              style={{
                fontSize: 12,
                color: style.textColor,
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              {formattedDeadline}
            </span>
          </div>

          {/* Collaborator info */}
          <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: '#94a3b8' }}>
              @{task.collaborator_username}
            </span>
            <span style={{ fontSize: 12, color: '#64748b' }}>
              {task.collaborator_role}
            </span>
          </div>

          {/* Description (if short enough) */}
          {task.description && task.description.length <= 100 && (
            <p
              style={{
                margin: '8px 0 0',
                fontSize: 13,
                color: '#94a3b8',
                lineHeight: 1.4,
              }}
            >
              {task.description}
            </p>
          )}

          {/* Footer row */}
          <div
            style={{
              marginTop: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            {/* Time indicator */}
            <span
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: style.borderColor,
              }}
            >
              {getTimeIndicator()}
            </span>

            {/* Status badge */}
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                padding: '3px 8px',
                borderRadius: 4,
                background: style.statusBg,
                color: style.borderColor,
                textTransform: 'uppercase',
                letterSpacing: '0.02em',
              }}
            >
              {task.status === 'in_progress' ? 'In Progress' : style.statusLabel}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TaskTimelineItem;
