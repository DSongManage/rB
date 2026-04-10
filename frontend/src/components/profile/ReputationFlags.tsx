/**
 * ReputationFlags — Displays reputation metrics for a user profile.
 *
 * Groups writer/artist flags into categories:
 * - Delivery Performance (artist)
 * - Review Quality (writer)
 * - Cancellation History (both)
 * - Collaboration History (mutual)
 */

import React, { useEffect, useState } from 'react';
import { getUserReputation, UserReputation } from '../../services/collaborationApi';
import { Star, Clock, AlertTriangle, Users, TrendingUp, Shield } from 'lucide-react';

interface ReputationFlagsProps {
  username: string;
  compact?: boolean;
}

function ScoreBadge({ score, label }: { score: string; label: string }) {
  const num = parseFloat(score);
  const color = num >= 75 ? '#10b981' : num >= 50 ? '#f59e0b' : '#ef4444';
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '12px 16px', borderRadius: 10,
      background: `${color}10`, border: `1px solid ${color}30`,
    }}>
      <span style={{ fontSize: 24, fontWeight: 700, color }}>{Math.round(num)}</span>
      <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{label}</span>
    </div>
  );
}

function StatRow({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
      <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: color || 'var(--text)' }}>{value}</span>
    </div>
  );
}

export default function ReputationFlags({ username, compact }: ReputationFlagsProps) {
  const [rep, setRep] = useState<UserReputation | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getUserReputation(username)
      .then(setRep)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [username]);

  if (loading) return <div style={{ padding: 16, color: 'var(--text-muted)', fontSize: 13 }}>Loading reputation...</div>;
  if (!rep || !rep.has_reputation) return null;

  const w = rep.writer;
  const a = rep.artist;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Score overview */}
      <div style={{ display: 'flex', gap: 12 }}>
        {w && <ScoreBadge score={w.score} label="Writer Score" />}
        {a && <ScoreBadge score={a.score} label="Artist Score" />}
        {rep.is_founding_creator && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 14px', borderRadius: 10,
            background: '#E8981F10', border: '1px solid #E8981F30',
          }}>
            <Shield size={16} style={{ color: '#E8981F' }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: '#E8981F' }}>Founding Creator</span>
          </div>
        )}
      </div>

      {!compact && (
        <>
          {/* Writer flags */}
          {w && (
            <div style={{ background: 'var(--panel)', borderRadius: 10, border: '1px solid var(--panel-border)', padding: 16 }}>
              <h4 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 600, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Clock size={14} /> Writer Metrics
              </h4>
              <StatRow label="Projects completed" value={w.projects_completed} />
              <StatRow label="Auto-approve rate" value={`${parseFloat(w.auto_approve_rate).toFixed(0)}%`}
                color={parseFloat(w.auto_approve_rate) > 30 ? '#f59e0b' : undefined} />
              <StatRow label="Avg review time" value={w.avg_review_time_hours ? `${parseFloat(w.avg_review_time_hours).toFixed(0)}h` : 'N/A'} />
              {w.avg_rejection_clarity && <StatRow label="Rejection clarity" value={`${parseFloat(w.avg_rejection_clarity).toFixed(1)}/5`} />}
              {w.avg_communication_rating && <StatRow label="Communication" value={`${parseFloat(w.avg_communication_rating).toFixed(1)}/5`} />}
              {w.grace_period_cancellations > 0 && (
                <StatRow label="Grace period cancellations" value={w.grace_period_cancellations} color="#f59e0b" />
              )}
              {w.post_preproduction_cancellations > 0 && (
                <StatRow label="Post-preproduction cancellations" value={w.post_preproduction_cancellations} color="#ef4444" />
              )}
              {w.projects_ended_early > 0 && (
                <StatRow label="Projects ended early" value={w.projects_ended_early} color="#f59e0b" />
              )}
              {w.campaigns_funded_never_started > 0 && (
                <StatRow label="Campaigns funded, never started" value={w.campaigns_funded_never_started} color="#ef4444" />
              )}
            </div>
          )}

          {/* Artist flags */}
          {a && (
            <div style={{ background: 'var(--panel)', borderRadius: 10, border: '1px solid var(--panel-border)', padding: 16 }}>
              <h4 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 600, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Star size={14} /> Artist Metrics
              </h4>
              <StatRow label="Projects completed" value={a.projects_completed} />
              <StatRow label="On-time delivery" value={`${parseFloat(a.on_time_rate).toFixed(0)}%`}
                color={parseFloat(a.on_time_rate) < 80 ? '#f59e0b' : '#10b981'} />
              <StatRow label="Quality rating" value={`${parseFloat(a.avg_quality_rating).toFixed(1)}/5`} />
              <StatRow label="Communication" value={`${parseFloat(a.avg_communication_rating).toFixed(1)}/5`} />
              {a.revision_rate && <StatRow label="Revision rate" value={`${parseFloat(a.revision_rate).toFixed(0)}%`}
                color={parseFloat(a.revision_rate) > 30 ? '#f59e0b' : undefined} />}
              {a.avg_delivery_speed_days && (
                <StatRow label="Avg delivery speed" value={
                  parseFloat(a.avg_delivery_speed_days) < 0
                    ? `${Math.abs(parseFloat(a.avg_delivery_speed_days)).toFixed(1)}d early`
                    : `${parseFloat(a.avg_delivery_speed_days).toFixed(1)}d late`
                } color={parseFloat(a.avg_delivery_speed_days) > 0 ? '#f59e0b' : '#10b981'} />
              )}
              {a.final_rejection_count > 0 && (
                <StatRow label="Final rejections" value={a.final_rejection_count} color="#ef4444" />
              )}
              {a.stall_count > 0 && (
                <StatRow label="Stalled milestones" value={a.stall_count} color="#ef4444" />
              )}
              {(a.cancellations_during_work > 0 || a.cancellations_before_work > 0) && (
                <StatRow label="Cancellations" value={`${a.cancellations_during_work} active / ${a.cancellations_before_work} before work`}
                  color={a.cancellations_during_work > 0 ? '#ef4444' : '#f59e0b'} />
              )}
            </div>
          )}

          {/* Mutual flags */}
          {rep.mutual && (
            <div style={{ background: 'var(--panel)', borderRadius: 10, border: '1px solid var(--panel-border)', padding: 16 }}>
              <h4 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 600, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Users size={14} /> Collaboration
              </h4>
              {rep.mutual.repeat_collaboration_count > 0 && (
                <StatRow label="Repeat collaborators" value={rep.mutual.repeat_collaboration_count} color="#10b981" />
              )}
              {rep.mutual.mutual_cancellation_count > 0 && (
                <StatRow label="Mutual cancellations" value={rep.mutual.mutual_cancellation_count} />
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
