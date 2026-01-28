/**
 * RatingSection Component
 *
 * Modern ratings display with dark theme styling.
 */

import React, { useState, useEffect } from 'react';
import { Star, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import StarRating from './StarRating';
import RatingForm from './RatingForm';
import { useContentRatings } from '../../hooks/useContentRatings';
import { ContentRating } from '../../services/socialApi';

interface RatingSectionProps {
  contentId: number;
  initialAverageRating?: number | null;
  initialRatingCount?: number;
  isAuthenticated?: boolean;
  onAuthRequired?: () => void;
  autoOpen?: boolean; // Auto-open rating form (e.g., after completing a book)
}

function RatingItem({ rating }: { rating: ContentRating }) {
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

  return (
    <div style={{
      padding: '16px 0',
      borderBottom: '1px solid var(--dropdown-hover)',
    }}>
      <div style={{ display: 'flex', gap: 12 }}>
        {rating.user_avatar ? (
          <img
            src={rating.user_avatar}
            alt={rating.username}
            style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              objectFit: 'cover',
              flexShrink: 0,
            }}
          />
        ) : (
          <div style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: 16,
            fontWeight: 600,
            flexShrink: 0,
          }}>
            {rating.username.charAt(0).toUpperCase()}
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 4,
            flexWrap: 'wrap',
          }}>
            <Link
              to={`/profile/${rating.username}`}
              style={{
                fontWeight: 600,
                color: 'var(--text)',
                textDecoration: 'none',
                fontSize: 14,
              }}
            >
              @{rating.username}
            </Link>
            <StarRating rating={rating.rating} size="sm" readonly />
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {timeAgo(rating.created_at)}
            </span>
          </div>
          {rating.review_text && (
            <p style={{
              color: 'var(--text-dim)',
              fontSize: 14,
              lineHeight: 1.6,
              margin: 0,
            }}>
              {rating.review_text}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export function RatingSection({
  contentId,
  initialAverageRating,
  initialRatingCount = 0,
  isAuthenticated = true,
  onAuthRequired,
  autoOpen = false,
}: RatingSectionProps) {
  const [showForm, setShowForm] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const {
    ratings,
    myRating,
    isLoading,
    isSubmitting,
    error,
    averageRating,
    totalCount,
    submitMyRating,
  } = useContentRatings(contentId, {
    initialAverageRating,
    initialRatingCount,
  });

  // Auto-open the rating form when autoOpen is true and user hasn't rated yet
  useEffect(() => {
    if (autoOpen && !myRating && isAuthenticated && !isLoading) {
      setShowForm(true);
    }
  }, [autoOpen, myRating, isAuthenticated, isLoading]);

  const displayedRatings = showAll ? ratings : ratings.slice(0, 3);

  const handleSubmit = async (rating: number, reviewText?: string) => {
    if (!isAuthenticated) {
      onAuthRequired?.();
      return;
    }
    await submitMyRating(rating, reviewText);
    setShowForm(false);
  };

  return (
    <div style={{
      background: 'var(--dropdown-bg)',
      borderRadius: 16,
      border: '1px solid var(--dropdown-hover)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '20px 24px',
        borderBottom: '1px solid var(--dropdown-hover)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Star size={20} fill="#fbbf24" color="#fbbf24" />
          <h3 style={{
            margin: 0,
            fontSize: 18,
            fontWeight: 700,
            color: 'var(--text)',
          }}>
            Ratings & Reviews
          </h3>
        </div>

        {/* Average Rating Badge */}
        {averageRating !== null && averageRating > 0 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'rgba(251, 191, 36, 0.1)',
            padding: '8px 14px',
            borderRadius: 10,
            border: '1px solid rgba(251, 191, 36, 0.2)',
          }}>
            <Star size={18} fill="#fbbf24" color="#fbbf24" />
            <span style={{
              fontSize: 18,
              fontWeight: 700,
              color: '#fbbf24',
            }}>
              {averageRating.toFixed(1)}
            </span>
            <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>
              ({totalCount})
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{ padding: '20px 24px' }}>
        {/* Your Rating Section */}
        {isAuthenticated && !myRating && (
          <div style={{ marginBottom: 24 }}>
            {showForm ? (
              <div style={{
                background: 'var(--dropdown-hover)',
                borderRadius: 12,
                padding: 20,
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 16,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Sparkles size={18} color="#fbbf24" />
                    <h4 style={{
                      margin: 0,
                      fontSize: 16,
                      fontWeight: 600,
                      color: 'var(--text)',
                    }}>
                      Write a Review
                    </h4>
                  </div>
                  <button
                    onClick={() => setShowForm(false)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-muted)',
                      fontSize: 13,
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                </div>
                <RatingForm
                  onSubmit={handleSubmit}
                  isSubmitting={isSubmitting}
                />
              </div>
            ) : (
              <button
                onClick={() => setShowForm(true)}
                style={{
                  width: '100%',
                  padding: '14px 20px',
                  background: 'transparent',
                  border: '2px dashed var(--border)',
                  borderRadius: 12,
                  color: 'var(--text-muted)',
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#8b5cf6';
                  e.currentTarget.style.color = '#a78bfa';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border)';
                  e.currentTarget.style.color = 'var(--text-muted)';
                }}
              >
                <Star size={18} />
                Rate this comic
              </button>
            )}
          </div>
        )}

        {/* Your Existing Rating */}
        {myRating && (
          <div style={{
            marginBottom: 24,
            background: 'rgba(139, 92, 246, 0.1)',
            border: '1px solid rgba(139, 92, 246, 0.2)',
            borderRadius: 12,
            padding: 16,
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              marginBottom: myRating.review_text ? 8 : 0,
            }}>
              <span style={{ fontSize: 13, color: '#a78bfa', fontWeight: 500 }}>
                Your rating:
              </span>
              <StarRating rating={myRating.rating} size="sm" readonly />
            </div>
            {myRating.review_text && (
              <p style={{
                margin: 0,
                fontSize: 14,
                color: '#c4b5fd',
                lineHeight: 1.5,
              }}>
                {myRating.review_text}
              </p>
            )}
          </div>
        )}

        {/* Error Message */}
        {error && (
          <p style={{
            fontSize: 13,
            color: '#ef4444',
            marginBottom: 16,
            padding: '10px 14px',
            background: 'rgba(239, 68, 68, 0.1)',
            borderRadius: 8,
          }}>
            {error}
          </p>
        )}

        {/* Ratings List */}
        {isLoading && ratings.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '32px 0',
            color: 'var(--text-muted)',
            fontSize: 14,
          }}>
            Loading ratings...
          </div>
        ) : ratings.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '32px 0',
            color: 'var(--text-muted)',
            fontSize: 14,
          }}>
            No ratings yet. Be the first to rate!
          </div>
        ) : (
          <>
            <div>
              {displayedRatings.map((rating, index) => (
                <div
                  key={rating.id}
                  style={{
                    borderBottom: index === displayedRatings.length - 1 ? 'none' : undefined,
                  }}
                >
                  <RatingItem rating={rating} />
                </div>
              ))}
            </div>

            {ratings.length > 3 && (
              <button
                onClick={() => setShowAll(!showAll)}
                style={{
                  width: '100%',
                  marginTop: 16,
                  padding: '12px',
                  background: 'transparent',
                  border: 'none',
                  color: '#8b5cf6',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                {showAll ? (
                  <>
                    Show Less <ChevronUp size={18} />
                  </>
                ) : (
                  <>
                    Show All ({ratings.length}) <ChevronDown size={18} />
                  </>
                )}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default RatingSection;
