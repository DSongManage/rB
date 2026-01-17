/**
 * TaskTracker Component
 *
 * Displays and manages contract tasks for a collaborator.
 * - Collaborators can mark tasks as complete
 * - Owners can sign off or reject completed tasks
 * - Shows task status, deadlines, and overdue warnings
 */

import React, { useState } from 'react';
import { ClipboardList, ChevronRight, ChevronDown } from 'lucide-react';
import { API_URL } from '../../config';

// Task status type
type TaskStatus = 'pending' | 'in_progress' | 'complete' | 'signed_off' | 'cancelled';

// Contract task interface
interface ContractTask {
  id: number;
  title: string;
  description: string;
  deadline: string;
  status: TaskStatus;
  order: number;
  marked_complete_at?: string;
  marked_complete_by_username?: string;
  completion_notes?: string;
  signed_off_at?: string;
  signed_off_by_username?: string;
  signoff_notes?: string;
  rejection_notes?: string;
  rejected_at?: string;
  is_overdue: boolean;
  days_until_deadline?: number;
}

// Collaborator role interface (partial)
interface CollaboratorRole {
  id: number;
  user: number;
  username: string;
  display_name?: string;
  role: string;
  revenue_percentage: number;
  tasks_total: number;
  tasks_signed_off: number;
  all_tasks_complete: boolean;
  has_active_breach: boolean;
  cancellation_eligible: boolean;
  contract_tasks: ContractTask[];
}

interface TaskTrackerProps {
  collaboratorRole: CollaboratorRole;
  currentUserId: number;
  isProjectOwner: boolean;
  projectId: number;
  onTaskUpdate: () => void;
}

// Status badge component
function StatusBadge({ status, isOverdue }: { status: TaskStatus; isOverdue: boolean }) {
  const statusConfig: Record<TaskStatus, { bg: string; color: string; label: string }> = {
    pending: { bg: '#64748b20', color: '#94a3b8', label: 'Pending' },
    in_progress: { bg: '#3b82f620', color: '#60a5fa', label: 'In Progress' },
    complete: { bg: '#f59e0b20', color: '#fbbf24', label: 'Awaiting Sign-off' },
    signed_off: { bg: '#10b98120', color: '#34d399', label: 'Signed Off' },
    cancelled: { bg: '#ef444420', color: '#f87171', label: 'Cancelled' },
  };

  if (isOverdue && status !== 'signed_off' && status !== 'cancelled') {
    return (
      <span
        style={{
          background: '#ef444430',
          color: '#f87171',
          padding: '4px 10px',
          borderRadius: 6,
          fontSize: 11,
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        <span>🚨</span> Overdue
      </span>
    );
  }

  const config = statusConfig[status];
  return (
    <span
      style={{
        background: config.bg,
        color: config.color,
        padding: '4px 10px',
        borderRadius: 6,
        fontSize: 11,
        fontWeight: 600,
      }}
    >
      {config.label}
    </span>
  );
}

// Helper to fetch CSRF token
async function fetchCsrf(): Promise<string> {
  try {
    const res = await fetch(`${API_URL}/api/auth/csrf/`, { credentials: 'include' });
    const data = await res.json();
    return data?.csrfToken || '';
  } catch {
    return '';
  }
}

export function TaskTracker({
  collaboratorRole,
  currentUserId,
  isProjectOwner,
  projectId,
  onTaskUpdate,
}: TaskTrackerProps) {
  const [expandedTasks, setExpandedTasks] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState<number | null>(null);
  const [error, setError] = useState<string>('');
  const [completionNotes, setCompletionNotes] = useState<Record<number, string>>({});
  const [signoffNotes, setSignoffNotes] = useState<Record<number, string>>({});
  const [rejectionReason, setRejectionReason] = useState<Record<number, string>>({});

  const isOwnTasks = collaboratorRole.user === currentUserId;
  const tasks = collaboratorRole.contract_tasks || [];

  const toggleExpand = (taskId: number) => {
    setExpandedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  // Mark task as complete
  const handleMarkComplete = async (taskId: number) => {
    setLoading(taskId);
    setError('');
    try {
      const csrf = await fetchCsrf();
      const res = await fetch(
        `/api/collaborative-projects/${projectId}/tasks/${taskId}/mark-complete/`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': csrf,
            'X-Requested-With': 'XMLHttpRequest',
          },
          credentials: 'include',
          body: JSON.stringify({
            completion_notes: completionNotes[taskId] || '',
          }),
        }
      );

      if (res.ok) {
        onTaskUpdate();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to mark task complete');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to mark task complete');
    } finally {
      setLoading(null);
    }
  };

  // Sign off on task
  const handleSignOff = async (taskId: number) => {
    setLoading(taskId);
    setError('');
    try {
      const csrf = await fetchCsrf();
      const res = await fetch(
        `/api/collaborative-projects/${projectId}/tasks/${taskId}/sign-off/`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': csrf,
            'X-Requested-With': 'XMLHttpRequest',
          },
          credentials: 'include',
          body: JSON.stringify({
            signoff_notes: signoffNotes[taskId] || '',
          }),
        }
      );

      if (res.ok) {
        onTaskUpdate();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to sign off on task');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to sign off on task');
    } finally {
      setLoading(null);
    }
  };

  // Reject completion
  const handleReject = async (taskId: number) => {
    if (!rejectionReason[taskId]?.trim()) {
      setError('Please provide a reason for rejection');
      return;
    }

    setLoading(taskId);
    setError('');
    try {
      const csrf = await fetchCsrf();
      const res = await fetch(
        `/api/collaborative-projects/${projectId}/tasks/${taskId}/reject-completion/`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': csrf,
            'X-Requested-With': 'XMLHttpRequest',
          },
          credentials: 'include',
          body: JSON.stringify({
            rejection_reason: rejectionReason[taskId],
          }),
        }
      );

      if (res.ok) {
        onTaskUpdate();
        setRejectionReason((prev) => ({ ...prev, [taskId]: '' }));
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to reject task');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to reject task');
    } finally {
      setLoading(null);
    }
  };

  if (tasks.length === 0) {
    return (
      <div
        style={{
          padding: 20,
          background: '#1e293b',
          borderRadius: 12,
          textAlign: 'center',
          color: '#64748b',
          fontSize: 13,
        }}
      >
        No contract tasks defined for this collaborator.
      </div>
    );
  }

  return (
    <div
      style={{
        background: '#1e293b',
        borderRadius: 12,
        padding: 20,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <ClipboardList size={20} style={{ color: '#94a3b8' }} />
            <h3 style={{ margin: 0, color: '#f8fafc', fontSize: 16, fontWeight: 600 }}>
              Contract Tasks for @{collaboratorRole.username}
            </h3>
          </div>
          <div style={{ marginTop: 6, color: '#94a3b8', fontSize: 12 }}>
            {collaboratorRole.role} • {collaboratorRole.revenue_percentage}% revenue share
          </div>
        </div>

        {/* Progress */}
        <div style={{ textAlign: 'right' }}>
          <div
            style={{
              color: collaboratorRole.all_tasks_complete ? '#10b981' : '#f59e0b',
              fontSize: 18,
              fontWeight: 700,
            }}
          >
            {collaboratorRole.tasks_signed_off}/{collaboratorRole.tasks_total}
          </div>
          <div style={{ color: '#64748b', fontSize: 11 }}>signed off</div>
        </div>
      </div>

      {/* Progress bar */}
      <div
        style={{
          height: 6,
          background: '#0f172a',
          borderRadius: 3,
          marginBottom: 20,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${(collaboratorRole.tasks_signed_off / collaboratorRole.tasks_total) * 100}%`,
            background: collaboratorRole.all_tasks_complete
              ? '#10b981'
              : 'linear-gradient(90deg, #f59e0b, #fbbf24)',
            borderRadius: 3,
            transition: 'width 0.3s ease',
          }}
        />
      </div>

      {/* Breach warning */}
      {collaboratorRole.has_active_breach && (
        <div
          style={{
            background: '#ef444420',
            border: '1px solid #ef4444',
            borderRadius: 8,
            padding: 12,
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <span style={{ fontSize: 18 }}>🚨</span>
          <div style={{ color: '#f87171', fontSize: 13 }}>
            <strong>Deadline Breach:</strong> One or more tasks are past their deadline.
            {isProjectOwner && ' You may cancel, extend deadlines, or waive the breach.'}
          </div>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div
          style={{
            background: '#ef444420',
            border: '1px solid #ef4444',
            color: '#f87171',
            padding: 12,
            borderRadius: 8,
            marginBottom: 16,
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      {/* Task list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {tasks.map((task) => {
          const isExpanded = expandedTasks.has(task.id);
          const canMarkComplete = isOwnTasks && task.status === 'in_progress';
          const canSignOff = isProjectOwner && task.status === 'complete';
          const canReject = isProjectOwner && task.status === 'complete';
          const isLoadingThis = loading === task.id;

          return (
            <div
              key={task.id}
              style={{
                background: '#0f172a',
                border: `1px solid ${task.is_overdue ? '#ef4444' : '#334155'}`,
                borderRadius: 10,
                overflow: 'hidden',
              }}
            >
              {/* Task header */}
              <div
                onClick={() => toggleExpand(task.id)}
                style={{
                  padding: 16,
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: 12,
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <StatusBadge status={task.status} isOverdue={task.is_overdue} />
                    <span
                      style={{
                        color: '#f8fafc',
                        fontSize: 14,
                        fontWeight: 600,
                      }}
                    >
                      {task.title}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: '#64748b', fontSize: 12 }}>
                    <span>
                      Due: {new Date(task.deadline).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                    {task.days_until_deadline !== undefined && task.status !== 'signed_off' && (
                      <span
                        style={{
                          color: task.days_until_deadline < 0 ? '#f87171' : task.days_until_deadline < 3 ? '#fbbf24' : '#64748b',
                        }}
                      >
                        {task.days_until_deadline < 0
                          ? `${Math.abs(task.days_until_deadline)} days overdue`
                          : task.days_until_deadline === 0
                          ? 'Due today'
                          : `${task.days_until_deadline} days left`}
                      </span>
                    )}
                  </div>
                </div>
                {isExpanded ? <ChevronDown size={18} style={{ color: '#64748b' }} /> : <ChevronRight size={18} style={{ color: '#64748b' }} />}
              </div>

              {/* Expanded details */}
              {isExpanded && (
                <div style={{ padding: '0 16px 16px', borderTop: '1px solid #334155' }}>
                  {/* Description */}
                  {task.description && (
                    <div style={{ marginTop: 12 }}>
                      <div style={{ color: '#94a3b8', fontSize: 11, marginBottom: 4, textTransform: 'uppercase' }}>
                        Description
                      </div>
                      <div style={{ color: '#cbd5e1', fontSize: 13, lineHeight: 1.6 }}>
                        {task.description}
                      </div>
                    </div>
                  )}

                  {/* Completion notes */}
                  {task.completion_notes && (
                    <div style={{ marginTop: 12 }}>
                      <div style={{ color: '#94a3b8', fontSize: 11, marginBottom: 4, textTransform: 'uppercase' }}>
                        Completion Notes from @{task.marked_complete_by_username}
                      </div>
                      <div
                        style={{
                          color: '#cbd5e1',
                          fontSize: 13,
                          lineHeight: 1.6,
                          background: '#1e293b',
                          padding: 10,
                          borderRadius: 6,
                        }}
                      >
                        {task.completion_notes}
                      </div>
                    </div>
                  )}

                  {/* Sign-off notes */}
                  {task.signoff_notes && (
                    <div style={{ marginTop: 12 }}>
                      <div style={{ color: '#10b981', fontSize: 11, marginBottom: 4, textTransform: 'uppercase' }}>
                        Signed Off by @{task.signed_off_by_username}
                      </div>
                      <div
                        style={{
                          color: '#34d399',
                          fontSize: 13,
                          lineHeight: 1.6,
                          background: '#10b98120',
                          padding: 10,
                          borderRadius: 6,
                        }}
                      >
                        {task.signoff_notes}
                      </div>
                    </div>
                  )}

                  {/* Rejection notes */}
                  {task.rejection_notes && (
                    <div style={{ marginTop: 12 }}>
                      <div style={{ color: '#f87171', fontSize: 11, marginBottom: 4, textTransform: 'uppercase' }}>
                        Revision Requested
                      </div>
                      <div
                        style={{
                          color: '#fca5a5',
                          fontSize: 13,
                          lineHeight: 1.6,
                          background: '#ef444420',
                          padding: 10,
                          borderRadius: 6,
                        }}
                      >
                        {task.rejection_notes}
                      </div>
                    </div>
                  )}

                  {/* Actions for collaborator */}
                  {canMarkComplete && (
                    <div style={{ marginTop: 16 }}>
                      <textarea
                        placeholder="Add notes about what you completed (optional)..."
                        value={completionNotes[task.id] || ''}
                        onChange={(e) => setCompletionNotes((prev) => ({ ...prev, [task.id]: e.target.value }))}
                        style={{
                          width: '100%',
                          background: '#1e293b',
                          border: '1px solid #334155',
                          borderRadius: 6,
                          padding: 10,
                          color: '#f8fafc',
                          fontSize: 13,
                          resize: 'vertical',
                          minHeight: 60,
                          marginBottom: 10,
                        }}
                      />
                      <button
                        onClick={() => handleMarkComplete(task.id)}
                        disabled={isLoadingThis}
                        style={{
                          width: '100%',
                          padding: '12px 20px',
                          borderRadius: 8,
                          border: 'none',
                          background: '#10b981',
                          color: '#fff',
                          fontSize: 14,
                          fontWeight: 600,
                          cursor: isLoadingThis ? 'not-allowed' : 'pointer',
                          opacity: isLoadingThis ? 0.6 : 1,
                        }}
                      >
                        {isLoadingThis ? 'Submitting...' : 'Mark as Complete'}
                      </button>
                    </div>
                  )}

                  {/* Actions for owner */}
                  {canSignOff && (
                    <div style={{ marginTop: 16 }}>
                      <textarea
                        placeholder="Add feedback or approval notes (optional)..."
                        value={signoffNotes[task.id] || ''}
                        onChange={(e) => setSignoffNotes((prev) => ({ ...prev, [task.id]: e.target.value }))}
                        style={{
                          width: '100%',
                          background: '#1e293b',
                          border: '1px solid #334155',
                          borderRadius: 6,
                          padding: 10,
                          color: '#f8fafc',
                          fontSize: 13,
                          resize: 'vertical',
                          minHeight: 60,
                          marginBottom: 10,
                        }}
                      />
                      <div style={{ display: 'flex', gap: 10 }}>
                        <button
                          onClick={() => handleSignOff(task.id)}
                          disabled={isLoadingThis}
                          style={{
                            flex: 2,
                            padding: '12px 20px',
                            borderRadius: 8,
                            border: 'none',
                            background: '#10b981',
                            color: '#fff',
                            fontSize: 14,
                            fontWeight: 600,
                            cursor: isLoadingThis ? 'not-allowed' : 'pointer',
                            opacity: isLoadingThis ? 0.6 : 1,
                          }}
                        >
                          {isLoadingThis ? 'Processing...' : 'Sign Off'}
                        </button>
                        <button
                          onClick={() => toggleExpand(task.id)}
                          style={{
                            flex: 1,
                            padding: '12px 20px',
                            borderRadius: 8,
                            border: '1px solid #ef4444',
                            background: 'transparent',
                            color: '#ef4444',
                            fontSize: 14,
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          Request Changes
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Rejection form (shown when Request Changes clicked) */}
                  {canReject && rejectionReason[task.id] !== undefined && (
                    <div style={{ marginTop: 12 }}>
                      <textarea
                        placeholder="Explain what needs to be revised..."
                        value={rejectionReason[task.id] || ''}
                        onChange={(e) => setRejectionReason((prev) => ({ ...prev, [task.id]: e.target.value }))}
                        style={{
                          width: '100%',
                          background: '#1e293b',
                          border: '1px solid #ef4444',
                          borderRadius: 6,
                          padding: 10,
                          color: '#f8fafc',
                          fontSize: 13,
                          resize: 'vertical',
                          minHeight: 80,
                          marginBottom: 10,
                        }}
                      />
                      <button
                        onClick={() => handleReject(task.id)}
                        disabled={isLoadingThis || !rejectionReason[task.id]?.trim()}
                        style={{
                          width: '100%',
                          padding: '12px 20px',
                          borderRadius: 8,
                          border: 'none',
                          background: '#ef4444',
                          color: '#fff',
                          fontSize: 14,
                          fontWeight: 600,
                          cursor: isLoadingThis || !rejectionReason[task.id]?.trim() ? 'not-allowed' : 'pointer',
                          opacity: isLoadingThis || !rejectionReason[task.id]?.trim() ? 0.6 : 1,
                        }}
                      >
                        {isLoadingThis ? 'Sending...' : 'Request Changes'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default TaskTracker;
