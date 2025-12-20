/**
 * FollowButton Component
 *
 * A toggle button for following/unfollowing users with optimistic updates.
 */

import React, { useState, useEffect } from 'react';
import { UserPlus, UserCheck, Loader2 } from 'lucide-react';
import { followUser, unfollowUser, getFollowStatus } from '../../services/socialApi';

interface FollowButtonProps {
  username: string;
  initialFollowing?: boolean;
  initialFollowerCount?: number;
  onFollowChange?: (following: boolean, followerCount: number) => void;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'primary' | 'outline';
  showCount?: boolean;
  disabled?: boolean;
}

export function FollowButton({
  username,
  initialFollowing,
  initialFollowerCount,
  onFollowChange,
  size = 'md',
  variant = 'primary',
  showCount = false,
  disabled = false,
}: FollowButtonProps) {
  const [following, setFollowing] = useState(initialFollowing ?? false);
  const [followerCount, setFollowerCount] = useState(initialFollowerCount ?? 0);
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(initialFollowing !== undefined);

  // Fetch initial follow status if not provided
  useEffect(() => {
    if (initialized) return;

    const fetchStatus = async () => {
      try {
        const status = await getFollowStatus(username);
        setFollowing(status.following);
        setFollowerCount(status.follower_count);
        setInitialized(true);
      } catch (error) {
        // User might not be logged in - that's okay
        setInitialized(true);
      }
    };

    fetchStatus();
  }, [username, initialized]);

  // Update state when props change
  useEffect(() => {
    if (initialFollowing !== undefined) {
      setFollowing(initialFollowing);
    }
  }, [initialFollowing]);

  useEffect(() => {
    if (initialFollowerCount !== undefined) {
      setFollowerCount(initialFollowerCount);
    }
  }, [initialFollowerCount]);

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (loading || disabled) return;

    setLoading(true);

    // Optimistic update
    const newFollowing = !following;
    const newCount = newFollowing ? followerCount + 1 : followerCount - 1;
    setFollowing(newFollowing);
    setFollowerCount(Math.max(0, newCount));

    try {
      const result = newFollowing
        ? await followUser(username)
        : await unfollowUser(username);

      // Update with actual server values
      setFollowing(result.following);
      setFollowerCount(result.follower_count);
      onFollowChange?.(result.following, result.follower_count);
    } catch (error) {
      // Revert on error
      setFollowing(!newFollowing);
      setFollowerCount(followerCount);
      console.error('Failed to update follow status:', error);
    } finally {
      setLoading(false);
    }
  };

  // Size configurations
  const sizeConfig = {
    sm: { padding: '6px 12px', fontSize: 12, iconSize: 14, gap: 4 },
    md: { padding: '8px 16px', fontSize: 14, iconSize: 16, gap: 6 },
    lg: { padding: '10px 20px', fontSize: 16, iconSize: 18, gap: 8 },
  };

  const config = sizeConfig[size];

  // Style based on following state and variant
  const baseStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: config.gap,
    padding: config.padding,
    fontSize: config.fontSize,
    fontWeight: 600,
    borderRadius: 8,
    cursor: disabled || loading ? 'not-allowed' : 'pointer',
    transition: 'all 0.2s ease',
    border: 'none',
    opacity: disabled ? 0.5 : 1,
  };

  const getStyle = (): React.CSSProperties => {
    if (following) {
      // Following state - show as outline/secondary
      return {
        ...baseStyle,
        background: 'transparent',
        border: '1px solid #334155',
        color: '#94a3b8',
      };
    }

    if (variant === 'outline') {
      return {
        ...baseStyle,
        background: 'transparent',
        border: '1px solid #f59e0b',
        color: '#f59e0b',
      };
    }

    // Primary follow button
    return {
      ...baseStyle,
      background: '#f59e0b',
      color: '#111',
    };
  };

  const Icon = loading ? Loader2 : following ? UserCheck : UserPlus;

  return (
    <button
      onClick={handleClick}
      disabled={disabled || loading}
      style={getStyle()}
      onMouseEnter={(e) => {
        if (!disabled && !loading) {
          if (following) {
            e.currentTarget.style.borderColor = '#ef4444';
            e.currentTarget.style.color = '#ef4444';
          } else {
            e.currentTarget.style.transform = 'translateY(-1px)';
            if (variant !== 'outline') {
              e.currentTarget.style.background = '#fbbf24';
            }
          }
        }
      }}
      onMouseLeave={(e) => {
        if (following) {
          e.currentTarget.style.borderColor = '#334155';
          e.currentTarget.style.color = '#94a3b8';
        } else {
          e.currentTarget.style.transform = 'translateY(0)';
          if (variant !== 'outline') {
            e.currentTarget.style.background = '#f59e0b';
          }
        }
      }}
    >
      <Icon
        size={config.iconSize}
        style={loading ? { animation: 'spin 1s linear infinite' } : undefined}
      />
      <span>{following ? 'Following' : 'Follow'}</span>
      {showCount && (
        <span style={{
          background: 'rgba(0,0,0,0.2)',
          padding: '2px 6px',
          borderRadius: 4,
          fontSize: config.fontSize - 2,
        }}>
          {followerCount.toLocaleString()}
        </span>
      )}
    </button>
  );
}

export default FollowButton;
