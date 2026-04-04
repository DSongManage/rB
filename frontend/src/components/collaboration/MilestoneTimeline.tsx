/**
 * MilestoneTimeline Component
 *
 * Clean timeline of milestones with payment amounts and status indicators.
 */

import React, { useState, useEffect } from 'react';
import { Clock, Check, DollarSign, RotateCcw, TrendingUp } from 'lucide-react';

interface ContractTask {
  id: number;
  title: string;
  status: 'pending' | 'in_progress' | 'complete' | 'signed_off' | 'cancelled';
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
  pending:     { label: 'Pending',      color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.1)' },
  in_progress: { label: 'In Progress',  color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)' },
  complete:    { label: 'Review',       color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' },
  signed_off:  { label: 'Signed Off',   color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)' },
  cancelled:   { label: 'Cancelled',    color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.1)' },
};

export function MilestoneTimeline({ tasks }: MilestoneTimelineProps) {
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
          const isComplete = task.status === 'signed_off';

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

                {/* Payment */}
                {payment > 0 && (
                  <div style={{
                    textAlign: 'right', flexShrink: 0,
                  }}>
                    <div style={{
                      fontSize: 14, fontWeight: 600,
                      color: isComplete ? '#10b981' : 'var(--text)',
                      display: 'flex', alignItems: 'center', gap: 2,
                    }}>
                      ${payment.toFixed(2)}
                      {isComplete && <Check size={14} style={{ color: '#10b981', marginLeft: 2 }} />}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default MilestoneTimeline;
