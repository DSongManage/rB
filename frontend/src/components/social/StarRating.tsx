/**
 * StarRating Component
 *
 * Modern star rating display and input component with dark theme.
 */

import React, { useState } from 'react';
import { Star } from 'lucide-react';

interface StarRatingProps {
  rating: number;
  maxRating?: number;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  readonly?: boolean;
  onChange?: (rating: number) => void;
  showValue?: boolean;
  className?: string;
}

export function StarRating({
  rating,
  maxRating = 5,
  size = 'md',
  readonly = false,
  onChange,
  showValue = false,
  className = '',
}: StarRatingProps) {
  const [hoverRating, setHoverRating] = useState(0);

  const sizeConfig = {
    sm: { star: 14, gap: 2 },
    md: { star: 20, gap: 4 },
    lg: { star: 24, gap: 4 },
    xl: { star: 32, gap: 6 },
  };

  const config = sizeConfig[size];
  const displayRating = hoverRating || rating;

  const handleClick = (value: number) => {
    if (!readonly && onChange) {
      onChange(value);
    }
  };

  const handleMouseEnter = (value: number) => {
    if (!readonly) {
      setHoverRating(value);
    }
  };

  const handleMouseLeave = () => {
    if (!readonly) {
      setHoverRating(0);
    }
  };

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: config.gap,
      }}
      className={className}
    >
      {Array.from({ length: maxRating }, (_, i) => i + 1).map(value => {
        const isFilled = value <= displayRating;
        const isPartial = value > displayRating && value - 1 < displayRating;

        return (
          <button
            key={value}
            type="button"
            onClick={() => handleClick(value)}
            onMouseEnter={() => handleMouseEnter(value)}
            onMouseLeave={handleMouseLeave}
            disabled={readonly}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: readonly ? 'default' : 'pointer',
              transition: 'transform 0.15s ease',
              transform: !readonly && hoverRating === value ? 'scale(1.2)' : 'scale(1)',
            }}
            aria-label={`${value} star${value !== 1 ? 's' : ''}`}
          >
            <Star
              size={config.star}
              fill={isFilled ? '#fbbf24' : 'transparent'}
              color={isFilled || isPartial ? '#fbbf24' : '#475569'}
              strokeWidth={1.5}
            />
          </button>
        );
      })}
      {showValue && rating > 0 && (
        <span style={{
          marginLeft: 8,
          fontWeight: 600,
          color: '#fbbf24',
          fontSize: size === 'sm' ? 12 : size === 'md' ? 14 : size === 'lg' ? 16 : 20,
        }}>
          {rating.toFixed(1)}
        </span>
      )}
    </div>
  );
}

export default StarRating;
