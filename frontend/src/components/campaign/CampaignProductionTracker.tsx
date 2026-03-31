import React from 'react';
import { Check, Clock, BookOpen } from 'lucide-react';
import { Campaign } from '../../services/campaignApi';

interface CampaignProductionTrackerProps {
  campaign: Campaign;
}

export function CampaignProductionTracker({ campaign }: CampaignProductionTrackerProps) {
  const chapters = campaign.chapter_count || 0;
  const published = campaign.chapters_published || 0;
  const perChapter = campaign.amount_per_chapter ? parseFloat(campaign.amount_per_chapter) : 0;
  const released = published * perChapter;
  const remaining = parseFloat(campaign.funding_goal) - released;
  const isComplete = published >= chapters;

  return (
    <div style={{
      background: 'var(--panel)', border: '1px solid var(--panel-border)',
      borderRadius: 12, padding: 24, marginBottom: 24,
    }}>
      <h2 style={{ fontSize: 16, fontWeight: 600, color: '#e2e8f0', marginBottom: 16 }}>
        <BookOpen size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />
        Production Progress
      </h2>

      {/* Chapter progress bar */}
      <div style={{ marginBottom: 16 }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', marginBottom: 6,
          fontSize: 13, color: '#94a3b8',
        }}>
          <span>{published} of {chapters} chapters released</span>
          <span>{isComplete ? '100%' : `${Math.round((published / Math.max(chapters, 1)) * 100)}%`}</span>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {Array.from({ length: chapters }, (_, i) => (
            <div key={i} style={{
              flex: 1, height: 8, borderRadius: 4,
              background: i < published ? '#10b981' : '#334155',
              transition: 'background 0.3s',
            }} />
          ))}
        </div>
      </div>

      {/* Chapter list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {Array.from({ length: chapters }, (_, i) => {
          const isReleased = i < published;
          return (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '8px 12px', borderRadius: 8,
              background: isReleased ? '#10b98110' : '#1e293b',
              border: `1px solid ${isReleased ? '#10b98130' : '#334155'}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {isReleased ? (
                  <Check size={14} style={{ color: '#10b981' }} />
                ) : (
                  <Clock size={14} style={{ color: '#64748b' }} />
                )}
                <span style={{ fontSize: 13, color: isReleased ? '#e2e8f0' : '#94a3b8' }}>
                  Chapter {i + 1}
                </span>
              </div>
              <span style={{
                fontSize: 12, fontWeight: 600,
                color: isReleased ? '#10b981' : '#64748b',
              }}>
                {isReleased ? `$${perChapter.toFixed(0)} released` : `$${perChapter.toFixed(0)} pending`}
              </span>
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', marginTop: 16,
        paddingTop: 12, borderTop: '1px solid #334155',
        fontSize: 12, color: '#64748b',
      }}>
        <span>Released: <strong style={{ color: '#10b981' }}>${released.toFixed(0)}</strong></span>
        <span>Remaining in escrow: <strong style={{ color: '#e2e8f0' }}>${remaining.toFixed(0)}</strong></span>
      </div>
    </div>
  );
}
