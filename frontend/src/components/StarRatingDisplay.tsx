/**
 * StarRatingDisplay - Compact star rating display for cards
 * Shows numeric rating with visual filled/empty star representation
 */
import React, { memo } from 'react';
import { Star } from 'lucide-react';

interface StarRatingDisplayProps {
  rating: number | null | undefined;
  count?: number;
  size?: number;
  showCount?: boolean;
}

function StarRatingDisplayComponent({
  rating,
  count = 0,
  size = 12,
  showCount = true,
}: StarRatingDisplayProps) {
  // No rating yet
  if (rating == null || count === 0) {
    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 2,
        color: '#64748b',
        fontSize: size,
      }}>
        <Star size={size} />
        <span>--</span>
      </span>
    );
  }

  const ratingNum = Number(rating);
  const fullStars = Math.floor(ratingNum);
  const hasPartial = ratingNum % 1 >= 0.25;
  const emptyStars = 5 - fullStars - (hasPartial ? 1 : 0);

  // Format count for display
  const formatCount = (n: number) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return `${n}`;
  };

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 3,
    }}>
      {/* Numeric rating */}
      <span style={{
        fontWeight: 600,
        color: '#fbbf24',
        fontSize: size,
      }}>
        {ratingNum.toFixed(1)}
      </span>

      {/* Visual stars */}
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 1,
      }}>
        {/* Full stars */}
        {Array.from({ length: fullStars }).map((_, i) => (
          <Star
            key={`full-${i}`}
            size={size}
            fill="#fbbf24"
            color="#fbbf24"
            strokeWidth={0}
          />
        ))}

        {/* Partial star (half-filled effect) */}
        {hasPartial && (
          <span style={{ position: 'relative', display: 'inline-flex' }}>
            <Star size={size} color="#475569" strokeWidth={1.5} />
            <span style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: '50%',
              overflow: 'hidden',
            }}>
              <Star size={size} fill="#fbbf24" color="#fbbf24" strokeWidth={0} />
            </span>
          </span>
        )}

        {/* Empty stars */}
        {Array.from({ length: emptyStars }).map((_, i) => (
          <Star
            key={`empty-${i}`}
            size={size}
            color="#475569"
            strokeWidth={1.5}
          />
        ))}
      </span>

      {/* Rating count */}
      {showCount && count > 0 && (
        <span style={{
          color: '#64748b',
          fontSize: size - 1,
        }}>
          ({formatCount(count)})
        </span>
      )}
    </span>
  );
}

export const StarRatingDisplay = memo(StarRatingDisplayComponent);
