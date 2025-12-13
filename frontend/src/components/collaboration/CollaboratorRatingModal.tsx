/**
 * CollaboratorRatingModal Component
 *
 * Modal for rating collaborators after project completion.
 * Rates quality, deadlines, communication, and willingness to collaborate again.
 */

import React, { useState } from 'react';

interface RatingData {
  quality_score: number;
  deadline_score: number;
  communication_score: number;
  would_collab_again: number;
  private_note: string;
  public_feedback: string;
}

interface CollaboratorRatingModalProps {
  open: boolean;
  onClose: () => void;
  collaboratorUsername: string;
  collaboratorRole: string;
  projectTitle: string;
  onSubmit: (rating: RatingData) => Promise<void>;
}

export function CollaboratorRatingModal({
  open,
  onClose,
  collaboratorUsername,
  collaboratorRole,
  projectTitle,
  onSubmit,
}: CollaboratorRatingModalProps) {
  const [qualityScore, setQualityScore] = useState(0);
  const [deadlineScore, setDeadlineScore] = useState(0);
  const [communicationScore, setCommunicationScore] = useState(0);
  const [wouldCollabAgain, setWouldCollabAgain] = useState(0);
  const [privateNote, setPrivateNote] = useState('');
  const [publicFeedback, setPublicFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  const handleSubmit = async () => {
    // Validate all scores are set
    if (qualityScore === 0 || deadlineScore === 0 || communicationScore === 0 || wouldCollabAgain === 0) {
      setError('Please rate all categories');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      await onSubmit({
        quality_score: qualityScore,
        deadline_score: deadlineScore,
        communication_score: communicationScore,
        would_collab_again: wouldCollabAgain,
        private_note: privateNote,
        public_feedback: publicFeedback,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to submit rating');
    } finally {
      setSubmitting(false);
    }
  };

  // Star rating component
  const StarRating = ({
    value,
    onChange,
    label,
    description,
  }: {
    value: number;
    onChange: (val: number) => void;
    label: string;
    description: string;
  }) => (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <div>
          <div style={{ color: '#f8fafc', fontSize: 14, fontWeight: 600 }}>{label}</div>
          <div style={{ color: '#64748b', fontSize: 12 }}>{description}</div>
        </div>
        <div style={{ color: '#f59e0b', fontSize: 13, fontWeight: 600 }}>
          {value > 0 ? `${value}/5` : '—'}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            onClick={() => onChange(star)}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: 28,
              cursor: 'pointer',
              padding: 4,
              transition: 'transform 0.1s',
              transform: value >= star ? 'scale(1.1)' : 'scale(1)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = value >= star ? 'scale(1.1)' : 'scale(1)';
            }}
          >
            {value >= star ? '⭐' : '☆'}
          </button>
        ))}
      </div>
    </div>
  );

  // Calculate average score
  const avgScore =
    qualityScore > 0 && deadlineScore > 0 && communicationScore > 0 && wouldCollabAgain > 0
      ? ((qualityScore + deadlineScore + communicationScore + wouldCollabAgain) / 4).toFixed(1)
      : null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.9)',
        display: 'grid',
        placeItems: 'center',
        zIndex: 1000,
        padding: 20,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div
        style={{
          background: '#0f172a',
          border: '1px solid #334155',
          borderRadius: 16,
          width: '100%',
          maxWidth: 500,
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: 20,
            borderBottom: '1px solid #334155',
            background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 24 }}>⭐</span>
                <h2 style={{ margin: 0, color: '#f8fafc', fontSize: 18, fontWeight: 600 }}>
                  Rate Collaborator
                </h2>
              </div>
              <div style={{ color: '#94a3b8', fontSize: 13 }}>
                How was working with{' '}
                <span style={{ color: '#f59e0b' }}>@{collaboratorUsername}</span>?
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={submitting}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                fontSize: 24,
                cursor: submitting ? 'not-allowed' : 'pointer',
                padding: 4,
              }}
            >
              ×
            </button>
          </div>

          {/* Collaborator info */}
          <div
            style={{
              marginTop: 16,
              padding: 12,
              background: '#0f172a',
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontWeight: 700,
                fontSize: 16,
              }}
            >
              {collaboratorUsername.charAt(0).toUpperCase()}
            </div>
            <div>
              <div style={{ color: '#f8fafc', fontWeight: 600, fontSize: 14 }}>
                @{collaboratorUsername}
              </div>
              <div style={{ color: '#64748b', fontSize: 12 }}>
                {collaboratorRole} on "{projectTitle}"
              </div>
            </div>
            {avgScore && (
              <div
                style={{
                  marginLeft: 'auto',
                  background: '#f59e0b20',
                  color: '#f59e0b',
                  padding: '6px 12px',
                  borderRadius: 8,
                  fontWeight: 700,
                  fontSize: 14,
                }}
              >
                {avgScore} avg
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: 20 }}>
          {/* Star ratings */}
          <StarRating
            value={qualityScore}
            onChange={setQualityScore}
            label="Quality of Work"
            description="How was the quality of their contributions?"
          />

          <StarRating
            value={deadlineScore}
            onChange={setDeadlineScore}
            label="Meeting Deadlines"
            description="Did they deliver on time?"
          />

          <StarRating
            value={communicationScore}
            onChange={setCommunicationScore}
            label="Communication"
            description="Were they responsive and clear?"
          />

          <StarRating
            value={wouldCollabAgain}
            onChange={setWouldCollabAgain}
            label="Would Collaborate Again"
            description="Would you work with them again?"
          />

          {/* Public feedback */}
          <div style={{ marginBottom: 20 }}>
            <label
              style={{
                display: 'block',
                color: '#f8fafc',
                fontSize: 14,
                fontWeight: 600,
                marginBottom: 4,
              }}
            >
              Public Feedback
            </label>
            <div style={{ color: '#64748b', fontSize: 12, marginBottom: 8 }}>
              This will be visible on their profile
            </div>
            <textarea
              value={publicFeedback}
              onChange={(e) => setPublicFeedback(e.target.value)}
              placeholder="Share your experience working with this collaborator..."
              style={{
                width: '100%',
                minHeight: 80,
                background: '#1e293b',
                border: '1px solid #334155',
                borderRadius: 8,
                padding: 12,
                color: '#f8fafc',
                fontSize: 14,
                resize: 'vertical',
              }}
            />
          </div>

          {/* Private note */}
          <div style={{ marginBottom: 20 }}>
            <label
              style={{
                display: 'block',
                color: '#f8fafc',
                fontSize: 14,
                fontWeight: 600,
                marginBottom: 4,
              }}
            >
              Private Note (Optional)
            </label>
            <div style={{ color: '#64748b', fontSize: 12, marginBottom: 8 }}>
              Only visible to @{collaboratorUsername}
            </div>
            <textarea
              value={privateNote}
              onChange={(e) => setPrivateNote(e.target.value)}
              placeholder="Any private feedback or suggestions..."
              style={{
                width: '100%',
                minHeight: 60,
                background: '#1e293b',
                border: '1px solid #334155',
                borderRadius: 8,
                padding: 12,
                color: '#f8fafc',
                fontSize: 14,
                resize: 'vertical',
              }}
            />
          </div>

          {/* Error */}
          {error && (
            <div
              style={{
                background: '#ef444420',
                border: '1px solid #ef4444',
                color: '#fca5a5',
                padding: 12,
                borderRadius: 8,
                fontSize: 13,
                marginBottom: 16,
              }}
            >
              {error}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={onClose}
              disabled={submitting}
              style={{
                flex: 1,
                padding: '14px 20px',
                borderRadius: 10,
                border: '1px solid #334155',
                background: 'transparent',
                color: '#94a3b8',
                fontSize: 14,
                fontWeight: 600,
                cursor: submitting ? 'not-allowed' : 'pointer',
              }}
            >
              Skip for Now
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              style={{
                flex: 2,
                padding: '14px 20px',
                borderRadius: 10,
                border: 'none',
                background: '#f59e0b',
                color: '#000',
                fontSize: 14,
                fontWeight: 700,
                cursor: submitting ? 'not-allowed' : 'pointer',
                opacity: submitting ? 0.6 : 1,
              }}
            >
              {submitting ? 'Submitting...' : 'Submit Rating'}
            </button>
          </div>

          {/* Privacy note */}
          <div
            style={{
              marginTop: 16,
              padding: 12,
              background: '#1e293b',
              borderRadius: 8,
              fontSize: 12,
              color: '#64748b',
              textAlign: 'center',
            }}
          >
            Ratings help build trust in the community. Your rating will contribute to their reputation score.
          </div>
        </div>
      </div>
    </div>
  );
}

export default CollaboratorRatingModal;
