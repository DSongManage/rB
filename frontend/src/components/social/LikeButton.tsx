/**
 * LikeButton Component
 *
 * Modern like button with thumbs up icon, animated interactions.
 */

import React from 'react';
import { ThumbsUp } from 'lucide-react';
import { useLikes } from '../../hooks/useLikes';

interface LikeButtonProps {
  contentId: number;
  initialLiked?: boolean;
  initialCount?: number;
  size?: 'sm' | 'md' | 'lg';
  showCount?: boolean;
  className?: string;
  onAuthRequired?: () => void;
  isAuthenticated?: boolean;
}

export function LikeButton({
  contentId,
  initialLiked = false,
  initialCount = 0,
  size = 'md',
  showCount = true,
  className = '',
  onAuthRequired,
  isAuthenticated = true,
}: LikeButtonProps) {
  const { liked, likeCount, isLoading, toggle } = useLikes(contentId, {
    initialLiked,
    initialCount,
  });

  const sizeConfig = {
    sm: { icon: 18, padding: '6px 10px', fontSize: 12 },
    md: { icon: 22, padding: '8px 14px', fontSize: 14 },
    lg: { icon: 26, padding: '10px 18px', fontSize: 16 },
  };

  const config = sizeConfig[size];

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isAuthenticated) {
      onAuthRequired?.();
      return;
    }

    await toggle();
  };

  return (
    <button
      onClick={handleClick}
      disabled={isLoading}
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: config.padding,
        background: liked ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255, 255, 255, 0.05)',
        border: `1px solid ${liked ? 'rgba(59, 130, 246, 0.3)' : 'rgba(255, 255, 255, 0.1)'}`,
        borderRadius: 10,
        cursor: isLoading ? 'not-allowed' : 'pointer',
        opacity: isLoading ? 0.6 : 1,
        transition: 'all 0.2s ease',
      }}
      onMouseEnter={(e) => {
        if (!isLoading) {
          e.currentTarget.style.background = liked ? 'rgba(59, 130, 246, 0.25)' : 'rgba(255, 255, 255, 0.1)';
          e.currentTarget.style.transform = 'scale(1.05)';
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = liked ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255, 255, 255, 0.05)';
        e.currentTarget.style.transform = 'scale(1)';
      }}
      aria-label={liked ? 'Unlike' : 'Like'}
    >
      <ThumbsUp
        size={config.icon}
        fill={liked ? '#3b82f6' : 'transparent'}
        color={liked ? '#3b82f6' : '#94a3b8'}
        style={{
          transition: 'all 0.2s ease',
        }}
      />
      {showCount && (
        <span style={{
          fontSize: config.fontSize,
          fontWeight: 600,
          color: liked ? '#3b82f6' : '#cbd5e1',
        }}>
          {likeCount > 0 ? likeCount.toLocaleString() : 'Like'}
        </span>
      )}
    </button>
  );
}

export default LikeButton;
