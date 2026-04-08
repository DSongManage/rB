import React, { useState } from 'react';
import { Star, X, Send } from 'lucide-react';
import { collaborationApi } from '../../services/collaborationApi';

interface MilestoneRatingModalProps {
  projectId: number;
  taskId: number;
  taskTitle: string;
  ratedUsername: string;
  onClose: () => void;
  onRated: (bothRated: boolean) => void;
}

function StarRating({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  const [hover, setHover] = useState(0);

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>
        {label}
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            onMouseEnter={() => setHover(star)}
            onMouseLeave={() => setHover(0)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 2,
              transition: 'transform 0.15s',
              transform: (hover || value) >= star ? 'scale(1.15)' : 'scale(1)',
            }}
          >
            <Star
              size={28}
              fill={(hover || value) >= star ? '#f59e0b' : 'transparent'}
              color={(hover || value) >= star ? '#f59e0b' : '#cbd5e1'}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

export default function MilestoneRatingModal({
  projectId,
  taskId,
  taskTitle,
  ratedUsername,
  onClose,
  onRated,
}: MilestoneRatingModalProps) {
  const [quality, setQuality] = useState(0);
  const [communication, setCommunication] = useState(0);
  const [timeliness, setTimeliness] = useState(0);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const canSubmit = quality > 0 && communication > 0 && timeliness > 0;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError('');

    try {
      const result = await collaborationApi.rateMilestone(projectId, taskId, {
        quality_score: quality,
        communication_score: communication,
        timeliness_score: timeliness,
        private_note: note || undefined,
      });
      onRated(result.both_rated);
    } catch (err: any) {
      setError(err.message || 'Failed to submit rating');
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 16,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: 'var(--bg)',
          borderRadius: 16,
          padding: 24,
          maxWidth: 400,
          width: '100%',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 18, color: 'var(--text)' }}>Rate Milestone</h3>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
          >
            <X size={20} />
          </button>
        </div>

        <div style={{
          background: 'var(--panel-bg)',
          borderRadius: 10,
          padding: 12,
          marginBottom: 20,
          border: '1px solid var(--panel-border)',
        }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{taskTitle}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
            Rating @{ratedUsername}
          </div>
        </div>

        <StarRating label="Quality of Work" value={quality} onChange={setQuality} />
        <StarRating label="Communication" value={communication} onChange={setCommunication} />
        <StarRating label="Timeliness" value={timeliness} onChange={setTimeliness} />

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>
            Private Note (optional)
          </div>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Any feedback you'd like to share..."
            style={{
              width: '100%',
              minHeight: 60,
              padding: 10,
              borderRadius: 8,
              border: '1px solid var(--panel-border)',
              background: 'var(--panel-bg)',
              color: 'var(--text)',
              fontSize: 13,
              resize: 'vertical',
              fontFamily: 'inherit',
            }}
          />
        </div>

        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 8,
            padding: '8px 12px',
            fontSize: 13,
            color: '#ef4444',
            marginBottom: 12,
          }}>
            {error}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={!canSubmit || submitting}
          style={{
            width: '100%',
            padding: '12px 16px',
            borderRadius: 10,
            border: 'none',
            background: canSubmit ? '#8b5cf6' : 'var(--panel-border)',
            color: canSubmit ? 'white' : 'var(--text-secondary)',
            fontSize: 14,
            fontWeight: 600,
            cursor: canSubmit ? 'pointer' : 'default',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            opacity: submitting ? 0.7 : 1,
          }}
        >
          {submitting ? 'Submitting...' : (
            <>
              <Send size={16} />
              Submit Rating
            </>
          )}
        </button>
      </div>
    </div>
  );
}
