/**
 * MilestoneTimeline Component
 *
 * Clean timeline of milestones with payment amounts and status indicators.
 */

import React, { useState, useEffect } from 'react';
import { Clock, Check, DollarSign, RotateCcw, TrendingUp, Star, AlertTriangle, Flag, XCircle } from 'lucide-react';

interface ContractTask {
  id: number;
  title: string;
  status: string;
  payment_amount: string;
  escrow_release_status: string;
  milestone_type: string;
  page_range_start?: number;
  page_range_end?: number;
  revision_limit: number;
  revisions_used: number;
  review_window_hours: number;
  auto_approve_deadline?: string;
  auto_approved: boolean;
  deadline: string;
  is_overdue: boolean;
  days_until_deadline?: number;
}

interface MilestoneTimelineProps {
  tasks: ContractTask[];
  trustPhase: string;
  projectId?: number;
  currentUserId?: number;
  isProjectOwner?: boolean;
  isArtist?: boolean;
  onRateTask?: (taskId: number, taskTitle: string) => void;
  onDeadlineAction?: (taskId: number, taskTitle: string) => void;
  onFinalRejectionAction?: (taskId: number, taskTitle: string) => void;
  onScopeChange?: (taskId: number, taskTitle: string) => void;
}

function formatTimeRemaining(deadline: string): string {
  const now = new Date();
  const target = new Date(deadline);
  const diff = target.getTime() - now.getTime();
  if (diff <= 0) return 'Expired';
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`;
  return `${hours}h ${minutes}m`;
}

function AutoApproveCountdown({ deadline }: { deadline: string }) {
  const [timeLeft, setTimeLeft] = useState(formatTimeRemaining(deadline));
  useEffect(() => {
    const interval = setInterval(() => setTimeLeft(formatTimeRemaining(deadline)), 60000);
    return () => clearInterval(interval);
  }, [deadline]);

  const hoursLeft = (new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60);
  const isUrgent = hoursLeft <= 12;

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 12, color: isUrgent ? '#ef4444' : '#f59e0b',
      padding: '2px 8px', borderRadius: 4,
      background: isUrgent ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)',
    }}>
      <Clock size={12} />
      Auto-approve in {timeLeft}
    </span>
  );
}

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  funded:             { label: 'Funded',           color: '#6366f1', bg: 'rgba(99, 102, 241, 0.1)' },
  pending:            { label: 'Pending',          color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.1)' },
  in_progress:        { label: 'In Progress',      color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)' },
  submitted:          { label: 'Submitted',        color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' },
  under_review:       { label: 'Under Review',     color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' },
  revision_requested: { label: 'Revision Needed',  color: '#f97316', bg: 'rgba(249, 115, 22, 0.1)' },
  resubmitted:        { label: 'Resubmitted',      color: '#eab308', bg: 'rgba(234, 179, 8, 0.1)' },
  approved:           { label: 'Approved',         color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)' },
  released:           { label: 'Released',         color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)' },
  complete:           { label: 'Complete',         color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)' },
  signed_off:         { label: 'Signed Off',       color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)' },
  deadline_passed:    { label: 'Deadline Passed',  color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' },
  stalled:            { label: 'Stalled',          color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' },
  final_rejection:    { label: 'Final Rejection',  color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' },
  reassigned:         { label: 'Reassigned',       color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.1)' },
  refunded:           { label: 'Refunded',         color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.1)' },
  cancelled:          { label: 'Cancelled',        color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.1)' },
};

export function MilestoneTimeline({
  tasks,
  trustPhase,
  onRateTask,
  onDeadlineAction,
  onFinalRejectionAction,
  onScopeChange,
  isProjectOwner,
  isArtist,
}: MilestoneTimelineProps) {
  if (!tasks || tasks.length === 0) return null;

  const sortedTasks = [...tasks].sort((a, b) => {
    if (a.page_range_start && b.page_range_start) return a.page_range_start - b.page_range_start;
    return 0;
  });

  return (
    <div style={{
      background: 'var(--panel)',
      border: '1px solid var(--panel-border)',
      borderRadius: 12,
      padding: 20,
    }}>
      <div style={{
        fontSize: 15, fontWeight: 600, color: 'var(--text)',
        marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <TrendingUp size={16} style={{ color: '#8b5cf6' }} />
        Milestone Timeline
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {sortedTasks.map((task, index) => {
          const config = statusConfig[task.status] || statusConfig.pending;
          const payment = parseFloat(task.payment_amount) || 0;
          const isLast = index === sortedTasks.length - 1;
          const isComplete = ['signed_off', 'approved', 'released', 'complete'].includes(task.status);
          const isRefunded = ['refunded', 'cancelled'].includes(task.status);
          const needsRating = ['released', 'approved', 'signed_off'].includes(task.status) && task.escrow_release_status === 'released';
          const needsDeadlineAction = task.status === 'deadline_passed' && isProjectOwner;
          const needsFinalRejectionAction = task.status === 'final_rejection' && isProjectOwner;
          const canFlagScopeChange = task.status === 'in_progress' && isArtist;

          return (
            <div key={task.id} style={{ display: 'flex', gap: 14 }}>
              {/* Timeline connector */}
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                width: 24, flexShrink: 0, paddingTop: 2,
              }}>
                <div style={{
                  width: 16, height: 16, borderRadius: '50%',
                  background: isComplete ? '#10b981' : 'var(--panel)',
                  border: `2px solid ${isComplete ? '#10b981' : config.color}`,
                  flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {isComplete && <Check size={10} style={{ color: '#fff' }} />}
                </div>
                {!isLast && (
                  <div style={{
                    width: 2, flex: 1, minHeight: 16,
                    background: isComplete ? 'rgba(16, 185, 129, 0.3)' : 'var(--panel-border)',
                  }} />
                )}
              </div>

              {/* Milestone row */}
              <div style={{
                flex: 1,
                padding: '10px 14px',
                marginBottom: 6,
                background: config.bg,
                border: `1px solid ${config.color}20`,
                borderRadius: 8,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
                  }}>
                    <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>
                      {task.title}
                    </span>
                    <span style={{
                      fontSize: 11, fontWeight: 600,
                      padding: '2px 8px', borderRadius: 4,
                      color: config.color, background: config.bg,
                      border: `1px solid ${config.color}30`,
                    }}>
                      {config.label}
                    </span>
                  </div>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    fontSize: 13, color: 'var(--text-muted)', marginTop: 3,
                  }}>
                    {task.page_range_start != null && task.page_range_end != null && (
                      <span>
                        {task.page_range_start === task.page_range_end
                          ? `Page ${task.page_range_start}`
                          : `Pages ${task.page_range_start}–${task.page_range_end}`}
                      </span>
                    )}
                    {task.revisions_used > 0 && (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 3,
                        color: task.revisions_used >= task.revision_limit ? '#ef4444' : 'var(--text-muted)',
                      }}>
                        <RotateCcw size={11} />
                        {task.revisions_used}/{task.revision_limit}
                      </span>
                    )}
                    {task.auto_approve_deadline && task.status === 'complete' && (
                      <AutoApproveCountdown deadline={task.auto_approve_deadline} />
                    )}
                  </div>
                </div>

                {/* Payment + Action buttons */}
                <div style={{ textAlign: 'right', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                  {payment > 0 && (
                    <div style={{
                      fontSize: 14, fontWeight: 600,
                      color: isComplete ? '#10b981' : isRefunded ? '#94a3b8' : 'var(--text)',
                      display: 'flex', alignItems: 'center', gap: 2,
                      textDecoration: isRefunded ? 'line-through' : 'none',
                    }}>
                      ${payment.toFixed(2)}
                      {isComplete && <Check size={14} style={{ color: '#10b981', marginLeft: 2 }} />}
                    </div>
                  )}

                  {/* Rate button for released milestones */}
                  {needsRating && onRateTask && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onRateTask(task.id, task.title); }}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        fontSize: 11, fontWeight: 600, padding: '3px 10px',
                        borderRadius: 6, border: '1px solid rgba(245,158,11,0.4)',
                        background: 'rgba(245,158,11,0.1)', color: '#f59e0b',
                        cursor: 'pointer', whiteSpace: 'nowrap',
                      }}
                    >
                      <Star size={11} /> Rate
                    </button>
                  )}

                  {/* Deadline action button */}
                  {needsDeadlineAction && onDeadlineAction && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onDeadlineAction(task.id, task.title); }}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        fontSize: 11, fontWeight: 600, padding: '3px 10px',
                        borderRadius: 6, border: '1px solid rgba(239,68,68,0.4)',
                        background: 'rgba(239,68,68,0.1)', color: '#ef4444',
                        cursor: 'pointer', whiteSpace: 'nowrap',
                      }}
                    >
                      <AlertTriangle size={11} /> Action Needed
                    </button>
                  )}

                  {/* Final rejection action button */}
                  {needsFinalRejectionAction && onFinalRejectionAction && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onFinalRejectionAction(task.id, task.title); }}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        fontSize: 11, fontWeight: 600, padding: '3px 10px',
                        borderRadius: 6, border: '1px solid rgba(239,68,68,0.4)',
                        background: 'rgba(239,68,68,0.1)', color: '#ef4444',
                        cursor: 'pointer', whiteSpace: 'nowrap',
                      }}
                    >
                      <XCircle size={11} /> Resolve
                    </button>
                  )}

                  {/* Scope change button for artist */}
                  {canFlagScopeChange && onScopeChange && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onScopeChange(task.id, task.title); }}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        fontSize: 11, fontWeight: 600, padding: '3px 10px',
                        borderRadius: 6, border: '1px solid rgba(139,92,246,0.4)',
                        background: 'rgba(139,92,246,0.1)', color: '#8b5cf6',
                        cursor: 'pointer', whiteSpace: 'nowrap',
                      }}
                    >
                      <Flag size={11} /> Scope Issue
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default MilestoneTimeline;
