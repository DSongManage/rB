/**
 * ReviewItem Component
 *
 * Modern creator review with verification badge and response - dark theme.
 */

import React, { useState } from 'react';
import { BadgeCheck, ShoppingBag, Users, MessageSquare, Send } from 'lucide-react';
import { Link } from 'react-router-dom';
import StarRating from './StarRating';
import { CreatorReview } from '../../services/socialApi';

interface ReviewItemProps {
  review: CreatorReview;
  isCreator?: boolean;
  onRespond?: (reviewId: number, responseText: string) => Promise<void>;
}

export function ReviewItem({
  review,
  isCreator = false,
  onRespond,
}: ReviewItemProps) {
  const [showResponseForm, setShowResponseForm] = useState(false);
  const [responseText, setResponseText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const timeAgo = (date: string) => {
    const now = new Date();
    const then = new Date(date);
    const diff = Math.floor((now.getTime() - then.getTime()) / 1000);

    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`;
    return then.toLocaleDateString();
  };

  const handleSubmitResponse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!responseText.trim() || !onRespond) return;

    setIsSubmitting(true);
    try {
      await onRespond(review.id, responseText);
      setShowResponseForm(false);
      setResponseText('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const VerificationBadge = () => {
    const Icon = review.verification_type === 'purchase' ? ShoppingBag : Users;
    const bgColor = review.verification_type === 'purchase'
      ? 'rgba(16, 185, 129, 0.15)'
      : 'rgba(59, 130, 246, 0.15)';
    const borderColor = review.verification_type === 'purchase'
      ? 'rgba(16, 185, 129, 0.3)'
      : 'rgba(59, 130, 246, 0.3)';
    const textColor = review.verification_type === 'purchase' ? '#10b981' : '#60a5fa';

    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '3px 8px',
        borderRadius: 6,
        background: bgColor,
        border: `1px solid ${borderColor}`,
        fontSize: 11,
        fontWeight: 600,
        color: textColor,
      }}>
        <BadgeCheck size={12} />
        <Icon size={12} />
        {review.verification_display}
      </span>
    );
  };

  return (
    <div style={{
      padding: '20px 0',
      borderBottom: '1px solid #1e293b',
    }}>
      <div style={{ display: 'flex', gap: 14 }}>
        {review.reviewer_avatar ? (
          <img
            src={review.reviewer_avatar}
            alt={review.reviewer_username}
            style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              objectFit: 'cover',
              flexShrink: 0,
            }}
          />
        ) : (
          <div style={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: 18,
            fontWeight: 600,
            flexShrink: 0,
          }}>
            {review.reviewer_username.charAt(0).toUpperCase()}
          </div>
        )}

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flexWrap: 'wrap',
            marginBottom: 6,
          }}>
            <Link
              to={`/profile/${review.reviewer_username}`}
              style={{
                fontWeight: 600,
                color: '#f1f5f9',
                textDecoration: 'none',
                fontSize: 14,
              }}
            >
              @{review.reviewer_username}
            </Link>
            <VerificationBadge />
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 8,
          }}>
            <StarRating rating={review.rating} size="sm" readonly />
            <span style={{ fontSize: 12, color: '#64748b' }}>
              {timeAgo(review.created_at)}
            </span>
          </div>

          {review.review_text && (
            <p style={{
              color: '#cbd5e1',
              fontSize: 14,
              lineHeight: 1.6,
              margin: 0,
            }}>
              {review.review_text}
            </p>
          )}

          {/* Creator Response */}
          {review.response_text && (
            <div style={{
              marginTop: 16,
              background: 'rgba(139, 92, 246, 0.1)',
              borderRadius: 10,
              padding: 14,
              borderLeft: '3px solid #8b5cf6',
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 13,
                fontWeight: 600,
                color: '#a78bfa',
                marginBottom: 8,
              }}>
                <MessageSquare size={14} />
                Response from @{review.creator_username}
              </div>
              <p style={{
                color: '#c4b5fd',
                fontSize: 14,
                lineHeight: 1.5,
                margin: 0,
              }}>
                {review.response_text}
              </p>
              {review.response_at && (
                <span style={{
                  fontSize: 11,
                  color: '#64748b',
                  marginTop: 8,
                  display: 'block',
                }}>
                  {timeAgo(review.response_at)}
                </span>
              )}
            </div>
          )}

          {/* Response Form (for creator) */}
          {isCreator && !review.response_text && (
            <div style={{ marginTop: 14 }}>
              {showResponseForm ? (
                <form onSubmit={handleSubmitResponse}>
                  <textarea
                    value={responseText}
                    onChange={e => setResponseText(e.target.value)}
                    placeholder="Write your response..."
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
                    }}
                  />
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <button
                      type="submit"
                      disabled={isSubmitting || !responseText.trim()}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '8px 16px',
                        background: responseText.trim() ? '#8b5cf6' : '#334155',
                        border: 'none',
                        borderRadius: 8,
                        color: responseText.trim() ? '#fff' : '#64748b',
                        fontSize: 13,
                        fontWeight: 500,
                        cursor: isSubmitting || !responseText.trim() ? 'not-allowed' : 'pointer',
                      }}
                    >
                      <Send size={14} />
                      {isSubmitting ? 'Posting...' : 'Post Response'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowResponseForm(false);
                        setResponseText('');
                      }}
                      style={{
                        padding: '8px 16px',
                        background: '#334155',
                        border: 'none',
                        borderRadius: 8,
                        color: '#94a3b8',
                        fontSize: 13,
                        fontWeight: 500,
                        cursor: 'pointer',
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  onClick={() => setShowResponseForm(true)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    background: 'transparent',
                    border: 'none',
                    padding: '6px 0',
                    color: '#8b5cf6',
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  <MessageSquare size={14} />
                  Respond to this review
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ReviewItem;
