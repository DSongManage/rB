/**
 * CreatorReviewsSection Component
 *
 * Modern reviews section for creator profiles - dark theme.
 */

import React, { useState } from 'react';
import { Star, ShoppingBag, Users, Sparkles } from 'lucide-react';
import ReviewItem from './ReviewItem';
import RatingForm from './RatingForm';
import StarRating from './StarRating';
import { useCreatorReviews } from '../../hooks/useCreatorReviews';

interface CreatorReviewsSectionProps {
  creatorUsername: string;
  creatorUserId: number;
  averageRating?: number | null;
  reviewCount?: number;
  isOwnProfile?: boolean;
  isAuthenticated?: boolean;
  onAuthRequired?: () => void;
}

export function CreatorReviewsSection({
  creatorUsername,
  creatorUserId,
  averageRating: initialAverageRating,
  reviewCount: initialReviewCount,
  isOwnProfile = false,
  isAuthenticated = false,
  onAuthRequired,
}: CreatorReviewsSectionProps) {
  const [showForm, setShowForm] = useState(false);

  const {
    reviews,
    isLoading,
    isSubmitting,
    error,
    hasMore,
    totalCount,
    canReview,
    verificationTypeIfCanReview,
    canReviewReason,
    loadMore,
    submitReview,
    respondTo,
  } = useCreatorReviews(creatorUsername, creatorUserId);

  const averageRating = initialAverageRating ?? (
    reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : null
  );
  const displayCount = initialReviewCount ?? totalCount;

  const handleSubmit = async (rating: number, reviewText?: string) => {
    if (!isAuthenticated) {
      onAuthRequired?.();
      return;
    }
    await submitReview(rating, reviewText);
    setShowForm(false);
  };

  const VerificationInfo = () => {
    if (!canReview || !verificationTypeIfCanReview) return null;

    const Icon = verificationTypeIfCanReview === 'purchase' ? ShoppingBag : Users;
    const bgColor = verificationTypeIfCanReview === 'purchase'
      ? 'rgba(16, 185, 129, 0.1)'
      : 'rgba(59, 130, 246, 0.1)';
    const borderColor = verificationTypeIfCanReview === 'purchase'
      ? 'rgba(16, 185, 129, 0.2)'
      : 'rgba(59, 130, 246, 0.2)';
    const textColor = verificationTypeIfCanReview === 'purchase' ? '#10b981' : '#60a5fa';
    const text = verificationTypeIfCanReview === 'purchase'
      ? 'You purchased from this creator'
      : 'You collaborated with this creator';

    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '10px 14px',
        background: bgColor,
        border: `1px solid ${borderColor}`,
        borderRadius: 10,
        marginBottom: 16,
      }}>
        <Icon size={18} color={textColor} />
        <span style={{ fontSize: 13, color: textColor, fontWeight: 500 }}>
          {text} - your review will be verified!
        </span>
      </div>
    );
  };

  return (
    <div style={{
      background: '#0f172a',
      borderRadius: 16,
      border: '1px solid #1e293b',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '20px 24px',
        borderBottom: '1px solid #1e293b',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Star size={20} fill="#f59e0b" color="#f59e0b" />
          <h3 style={{
            margin: 0,
            fontSize: 18,
            fontWeight: 700,
            color: '#f1f5f9',
          }}>
            Creator Reviews
          </h3>
          {displayCount > 0 && (
            <span style={{
              background: '#1e293b',
              color: '#94a3b8',
              padding: '4px 10px',
              borderRadius: 12,
              fontSize: 13,
              fontWeight: 500,
            }}>
              {displayCount}
            </span>
          )}
        </div>

        {/* Average Rating */}
        {averageRating !== null && averageRating > 0 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'rgba(245, 158, 11, 0.1)',
            padding: '8px 14px',
            borderRadius: 10,
            border: '1px solid rgba(245, 158, 11, 0.2)',
          }}>
            <Star size={18} fill="#f59e0b" color="#f59e0b" />
            <span style={{
              fontSize: 18,
              fontWeight: 700,
              color: '#f59e0b',
            }}>
              {averageRating.toFixed(1)}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{ padding: '20px 24px' }}>
        {/* Summary Stats */}
        {displayCount > 0 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            padding: '16px 20px',
            background: '#1e293b',
            borderRadius: 12,
            marginBottom: 24,
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{
                fontSize: 36,
                fontWeight: 700,
                color: '#f59e0b',
                lineHeight: 1,
              }}>
                {averageRating?.toFixed(1) || '-'}
              </div>
              <div style={{ marginTop: 4 }}>
                <StarRating rating={averageRating || 0} size="sm" readonly />
              </div>
              <div style={{
                fontSize: 12,
                color: '#64748b',
                marginTop: 4,
              }}>
                {displayCount} {displayCount === 1 ? 'review' : 'reviews'}
              </div>
            </div>
          </div>
        )}

        {/* Write Review (only if eligible) */}
        {isAuthenticated && canReview && !isOwnProfile && (
          <div style={{ marginBottom: 24 }}>
            {showForm ? (
              <div style={{
                background: '#1e293b',
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
                    <Sparkles size={18} color="#f59e0b" />
                    <h4 style={{
                      margin: 0,
                      fontSize: 16,
                      fontWeight: 600,
                      color: '#f1f5f9',
                    }}>
                      Write a Review
                    </h4>
                  </div>
                  <button
                    onClick={() => setShowForm(false)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#64748b',
                      fontSize: 13,
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                </div>
                <VerificationInfo />
                <RatingForm
                  onSubmit={handleSubmit}
                  isSubmitting={isSubmitting}
                  submitLabel="Submit Review"
                />
              </div>
            ) : (
              <button
                onClick={() => setShowForm(true)}
                style={{
                  width: '100%',
                  padding: '14px 20px',
                  background: 'transparent',
                  border: '2px dashed #334155',
                  borderRadius: 12,
                  color: '#94a3b8',
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
                  e.currentTarget.style.borderColor = '#f59e0b';
                  e.currentTarget.style.color = '#fbbf24';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#334155';
                  e.currentTarget.style.color = '#94a3b8';
                }}
              >
                <Star size={18} />
                Write a Review
              </button>
            )}
          </div>
        )}

        {/* Eligibility Message */}
        {isAuthenticated && !canReview && !isOwnProfile && canReviewReason && (
          <div style={{
            marginBottom: 24,
            padding: '14px 16px',
            background: '#1e293b',
            borderRadius: 10,
            fontSize: 14,
            color: '#94a3b8',
          }}>
            {canReviewReason}
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

        {/* Reviews List */}
        {isLoading && reviews.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '32px 0',
            color: '#64748b',
            fontSize: 14,
          }}>
            Loading reviews...
          </div>
        ) : reviews.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '32px 0',
            color: '#64748b',
            fontSize: 14,
          }}>
            No reviews yet.
            {canReview && ' Be the first to leave a review!'}
          </div>
        ) : (
          <>
            <div>
              {reviews.map((review, index) => (
                <div
                  key={review.id}
                  style={{
                    borderBottom: index === reviews.length - 1 ? 'none' : undefined,
                  }}
                >
                  <ReviewItem
                    review={review}
                    isCreator={isOwnProfile}
                    onRespond={isOwnProfile ? respondTo : undefined}
                  />
                </div>
              ))}
            </div>

            {hasMore && (
              <button
                onClick={loadMore}
                disabled={isLoading}
                style={{
                  width: '100%',
                  marginTop: 16,
                  padding: '12px',
                  background: 'transparent',
                  border: '1px solid #334155',
                  borderRadius: 10,
                  color: '#f59e0b',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  opacity: isLoading ? 0.6 : 1,
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(245, 158, 11, 0.1)';
                  e.currentTarget.style.borderColor = '#f59e0b';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.borderColor = '#334155';
                }}
              >
                {isLoading ? 'Loading...' : 'Load More Reviews'}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default CreatorReviewsSection;
