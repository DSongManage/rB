/**
 * MilestoneTimeline Component
 *
 * Visual timeline of milestones with payment amounts, status indicators,
 * auto-approve countdown, and revision counters.
 */

import React, { useState, useEffect } from 'react';
import { Clock, Check, AlertCircle, DollarSign, RotateCcw, TrendingUp } from 'lucide-react';

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

  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  }
  return `${hours}h ${minutes}m`;
}

function AutoApproveCountdown({ deadline }: { deadline: string }) {
  const [timeLeft, setTimeLeft] = useState(formatTimeRemaining(deadline));

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(formatTimeRemaining(deadline));
    }, 60000); // Update every minute
    return () => clearInterval(interval);
  }, [deadline]);

  const now = new Date();
  const target = new Date(deadline);
  const hoursLeft = (target.getTime() - now.getTime()) / (1000 * 60 * 60);
  const isUrgent = hoursLeft <= 12;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 4,
      fontSize: 11, color: isUrgent ? '#f87171' : '#f59e0b',
      padding: '3px 8px', borderRadius: 4,
      background: isUrgent ? '#f8717115' : '#f59e0b15',
    }}>
      <Clock size={12} />
      <span>Auto-approve in {timeLeft}</span>
    </div>
  );
}

function RevisionCounter({ used, limit }: { used: number; limit: number }) {
  const atLimit = used >= limit;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 4,
      fontSize: 11,
      color: atLimit ? '#f87171' : '#94a3b8',
    }}>
      <RotateCcw size={11} />
      <span>{used}/{limit} revisions</span>
    </div>
  );
}

export function MilestoneTimeline({ tasks, trustPhase }: MilestoneTimelineProps) {
  if (!tasks || tasks.length === 0) return null;

  const sortedTasks = [...tasks].sort((a, b) => {
    // Sort by page_range_start, then by order
    if (a.page_range_start && b.page_range_start) {
      return a.page_range_start - b.page_range_start;
    }
    return 0;
  });

  const statusColors: Record<string, { bg: string; border: string; dot: string }> = {
    pending: { bg: '#1e293b', border: '#334155', dot: '#64748b' },
    in_progress: { bg: '#1e3a5f', border: '#3b82f6', dot: '#60a5fa' },
    complete: { bg: '#422006', border: '#f59e0b', dot: '#fbbf24' },
    signed_off: { bg: '#052e16', border: '#10b981', dot: '#34d399' },
    cancelled: { bg: '#1c1917', border: '#64748b', dot: '#94a3b8' },
  };

  const milestoneTypeLabels: Record<string, string> = {
    trust_page: 'Trust',
    production_block: 'Production',
    final_delivery: 'Final',
    custom: '',
  };

  return (
    <div style={{
      background: 'var(--dropdown-bg)',
      border: '1px solid #1e293b',
      borderRadius: 12,
      padding: 16,
    }}>
      <div style={{
        fontSize: 13, fontWeight: 600, color: 'var(--text)',
        marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <TrendingUp size={16} style={{ color: '#8b5cf6' }} />
        Milestone Timeline
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {sortedTasks.map((task, index) => {
          const colors = statusColors[task.status] || statusColors.pending;
          const payment = parseFloat(task.payment_amount) || 0;
          const typeLabel = milestoneTypeLabels[task.milestone_type] || '';
          const isLast = index === sortedTasks.length - 1;

          return (
            <div key={task.id} style={{ display: 'flex', gap: 12 }}>
              {/* Timeline connector */}
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                width: 20, flexShrink: 0,
              }}>
                <div style={{
                  width: 12, height: 12, borderRadius: '50%',
                  background: task.status === 'signed_off' ? colors.dot : 'transparent',
                  border: `2px solid ${colors.dot}`,
                  flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {task.status === 'signed_off' && (
                    <Check size={8} style={{ color: '#0f172a' }} />
                  )}
                </div>
                {!isLast && (
                  <div style={{
                    width: 2, flex: 1, minHeight: 20,
                    background: task.status === 'signed_off' ? '#10b98140' : '#334155',
                  }} />
                )}
              </div>

              {/* Milestone card */}
              <div style={{
                flex: 1, padding: '8px 12px', marginBottom: 4,
                background: colors.bg,
                border: `1px solid ${colors.border}30`,
                borderRadius: 8,
              }}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  alignItems: 'flex-start', gap: 8,
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      fontSize: 13, fontWeight: 500, color: 'var(--text)',
                    }}>
                      {task.title}
                      {typeLabel && (
                        <span style={{
                          fontSize: 10, padding: '1px 6px', borderRadius: 4,
                          background: '#8b5cf620', color: '#a78bfa',
                        }}>
                          {typeLabel}
                        </span>
                      )}
                    </div>
                    {task.page_range_start && task.page_range_end && (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                        Pages {task.page_range_start}-{task.page_range_end}
                      </div>
                    )}
                  </div>

                  {/* Payment amount with fee breakdown */}
                  {payment > 0 && (
                    <div style={{ textAlign: 'right' }}>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 3,
                        fontSize: 12, fontWeight: 600,
                        color: task.escrow_release_status === 'released' ? '#10b981' : '#e2e8f0',
                      }}>
                        <DollarSign size={12} />
                        {payment.toFixed(2)}
                        {task.escrow_release_status === 'released' && (
                          <Check size={12} style={{ color: '#10b981' }} />
                        )}
                      </div>
                      {task.escrow_release_status === 'released' && (
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>
                          ${(payment * 0.97).toFixed(2)} artist / ${(payment * 0.03).toFixed(2)} fee
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Status indicators */}
                <div style={{
                  display: 'flex', gap: 8, marginTop: 6,
                  flexWrap: 'wrap', alignItems: 'center',
                }}>
                  {/* Auto-approve countdown */}
                  {task.status === 'complete' && task.auto_approve_deadline && !task.auto_approved && (
                    <AutoApproveCountdown deadline={task.auto_approve_deadline} />
                  )}

                  {/* Auto-approved badge */}
                  {task.auto_approved && (
                    <span style={{
                      fontSize: 11, padding: '2px 6px', borderRadius: 4,
                      background: '#10b98120', color: '#10b981',
                    }}>
                      Auto-approved
                    </span>
                  )}

                  {/* Revision counter */}
                  {task.revisions_used > 0 && (
                    <RevisionCounter used={task.revisions_used} limit={task.revision_limit} />
                  )}

                  {/* Overdue indicator */}
                  {task.is_overdue && task.status !== 'signed_off' && (
                    <span style={{
                      display: 'flex', alignItems: 'center', gap: 3,
                      fontSize: 11, color: '#f87171',
                    }}>
                      <AlertCircle size={11} />
                      Overdue
                    </span>
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
