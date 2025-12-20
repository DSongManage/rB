/**
 * RatingForm Component
 *
 * Modern form for submitting content ratings with dark theme.
 */

import React, { useState } from 'react';
import { Send } from 'lucide-react';
import StarRating from './StarRating';

interface RatingFormProps {
  onSubmit: (rating: number, reviewText?: string) => Promise<void>;
  initialRating?: number;
  initialReviewText?: string;
  isSubmitting?: boolean;
  showReviewText?: boolean;
  submitLabel?: string;
  className?: string;
}

export function RatingForm({
  onSubmit,
  initialRating = 0,
  initialReviewText = '',
  isSubmitting = false,
  showReviewText = true,
  submitLabel = 'Submit Rating',
  className = '',
}: RatingFormProps) {
  const [rating, setRating] = useState(initialRating);
  const [reviewText, setReviewText] = useState(initialReviewText);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (rating === 0) {
      setError('Please select a rating');
      return;
    }

    try {
      await onSubmit(rating, reviewText.trim() || undefined);
      setRating(0);
      setReviewText('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit rating');
    }
  };

  return (
    <form onSubmit={handleSubmit} className={className}>
      <div style={{ marginBottom: 20 }}>
        <label style={{
          display: 'block',
          fontSize: 13,
          fontWeight: 500,
          color: '#94a3b8',
          marginBottom: 12,
        }}>
          Your Rating
        </label>
        <StarRating
          rating={rating}
          onChange={setRating}
          size="xl"
          readonly={isSubmitting}
        />
      </div>

      {showReviewText && (
        <div style={{ marginBottom: 16 }}>
          <label style={{
            display: 'block',
            fontSize: 13,
            fontWeight: 500,
            color: '#94a3b8',
            marginBottom: 8,
          }}>
            Review (optional)
          </label>
          <textarea
            value={reviewText}
            onChange={e => setReviewText(e.target.value)}
            placeholder="Share your thoughts..."
            rows={3}
            maxLength={2000}
            disabled={isSubmitting}
            style={{
              width: '100%',
              padding: '12px 14px',
              background: '#0f172a',
              border: '1px solid #334155',
              borderRadius: 10,
              color: '#f1f5f9',
              fontSize: 14,
              resize: 'none',
              outline: 'none',
              transition: 'border-color 0.2s',
            }}
            onFocus={(e) => e.target.style.borderColor = '#8b5cf6'}
            onBlur={(e) => e.target.style.borderColor = '#334155'}
          />
          <p style={{
            fontSize: 11,
            color: '#64748b',
            marginTop: 6,
            textAlign: 'right',
          }}>
            {reviewText.length}/2000
          </p>
        </div>
      )}

      {error && (
        <p style={{
          fontSize: 13,
          color: '#ef4444',
          marginBottom: 12,
          padding: '8px 12px',
          background: 'rgba(239, 68, 68, 0.1)',
          borderRadius: 6,
        }}>
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isSubmitting || rating === 0}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          padding: '12px 20px',
          background: rating === 0 ? '#334155' : 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
          border: 'none',
          borderRadius: 10,
          color: rating === 0 ? '#64748b' : '#fff',
          fontSize: 14,
          fontWeight: 600,
          cursor: isSubmitting || rating === 0 ? 'not-allowed' : 'pointer',
          opacity: isSubmitting ? 0.7 : 1,
          transition: 'all 0.2s ease',
        }}
      >
        <Send size={16} />
        {isSubmitting ? 'Submitting...' : submitLabel}
      </button>
    </form>
  );
}

export default RatingForm;
