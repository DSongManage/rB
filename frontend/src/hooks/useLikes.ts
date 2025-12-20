/**
 * useLikes Hook
 *
 * Manages like state for content with optimistic updates.
 * Includes debouncing to prevent rate limiting.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { toggleLike, getLikeStatus } from '../services/socialApi';

interface UseLikesOptions {
  initialLiked?: boolean;
  initialCount?: number;
}

interface UseLikesReturn {
  liked: boolean;
  likeCount: number;
  isLoading: boolean;
  error: string | null;
  toggle: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function useLikes(
  contentId: number,
  options: UseLikesOptions = {}
): UseLikesReturn {
  const [liked, setLiked] = useState(options.initialLiked ?? false);
  const [likeCount, setLikeCount] = useState(options.initialCount ?? 0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs to prevent race conditions and duplicate requests
  const pendingRequest = useRef<boolean>(false);
  const lastToggleTime = useRef<number>(0);
  const DEBOUNCE_MS = 500; // Minimum time between toggles (allows responsive unlike)

  const refresh = useCallback(async () => {
    try {
      const status = await getLikeStatus(contentId);
      setLiked(status.liked);
      setLikeCount(status.like_count);
      setError(null);
    } catch (err) {
      // Silently fail on refresh - user might not be authenticated
      console.error('Failed to get like status:', err);
    }
  }, [contentId]);

  const toggle = useCallback(async () => {
    // Prevent duplicate requests using ref (synchronous check)
    if (pendingRequest.current) return;

    // Debounce - prevent rapid clicks
    const now = Date.now();
    if (now - lastToggleTime.current < DEBOUNCE_MS) {
      return;
    }
    lastToggleTime.current = now;
    pendingRequest.current = true;

    // Optimistic update
    const previousLiked = liked;
    const previousCount = likeCount;
    setLiked(!liked);
    setLikeCount(liked ? likeCount - 1 : likeCount + 1);
    setError(null);
    setIsLoading(true);

    try {
      const result = await toggleLike(contentId);
      setLiked(result.liked);
      setLikeCount(result.like_count);
    } catch (err) {
      // Rollback on error
      setLiked(previousLiked);
      setLikeCount(previousCount);
      const message = err instanceof Error ? err.message : 'Failed to toggle like';
      // Don't show throttle errors to user - just silently fail
      if (!message.includes('throttle')) {
        setError(message);
      }
    } finally {
      setIsLoading(false);
      pendingRequest.current = false;
    }
  }, [contentId, liked, likeCount]);

  // Sync with options when they change
  useEffect(() => {
    if (options.initialLiked !== undefined) {
      setLiked(options.initialLiked);
    }
    if (options.initialCount !== undefined) {
      setLikeCount(options.initialCount);
    }
  }, [options.initialLiked, options.initialCount]);

  return {
    liked,
    likeCount,
    isLoading,
    error,
    toggle,
    refresh,
  };
}

export default useLikes;
