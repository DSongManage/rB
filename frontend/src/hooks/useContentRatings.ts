/**
 * useContentRatings Hook
 *
 * Manages ratings for content.
 * Includes deduplication to prevent infinite loops and rate limiting.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  ContentRating,
  getContentRatings,
  getMyRating,
  submitRating,
} from '../services/socialApi';

interface UseContentRatingsReturn {
  ratings: ContentRating[];
  myRating: ContentRating | null;
  isLoading: boolean;
  isSubmitting: boolean;
  error: string | null;
  hasMore: boolean;
  totalCount: number;
  averageRating: number | null;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  submitMyRating: (rating: number, reviewText?: string) => Promise<void>;
}

interface UseContentRatingsOptions {
  initialAverageRating?: number | null;
  initialRatingCount?: number;
}

export function useContentRatings(
  contentId: number,
  options: UseContentRatingsOptions = {}
): UseContentRatingsReturn {
  const [ratings, setRatings] = useState<ContentRating[]>([]);
  const [myRating, setMyRating] = useState<ContentRating | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(options.initialRatingCount ?? 0);
  const [averageRating, setAverageRating] = useState<number | null>(
    options.initialAverageRating ?? null
  );

  // Refs to prevent duplicate fetches and infinite loops
  const fetchingRatings = useRef(false);
  const fetchingMyRating = useRef(false);
  const initialLoadDone = useRef(false);

  const fetchRatings = useCallback(async (pageNum: number, append: boolean = false) => {
    if (fetchingRatings.current) return;
    fetchingRatings.current = true;

    setIsLoading(true);
    setError(null);

    try {
      const response = await getContentRatings(contentId, pageNum);
      setRatings(prev => {
        const newRatings = append ? [...prev, ...response.results] : response.results;
        // Calculate average from the new ratings
        if (newRatings.length > 0) {
          const avg = newRatings.reduce((sum, r) => sum + r.rating, 0) / newRatings.length;
          setAverageRating(Math.round(avg * 10) / 10);
        }
        return newRatings;
      });
      setHasMore(response.next !== null);
      setTotalCount(response.count);
      setPage(pageNum);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load ratings';
      if (!message.includes('throttle')) {
        setError(message);
      }
    } finally {
      setIsLoading(false);
      fetchingRatings.current = false;
    }
  }, [contentId]); // Only depend on contentId!

  const fetchMyRating = useCallback(async () => {
    if (fetchingMyRating.current) return;
    fetchingMyRating.current = true;

    try {
      const rating = await getMyRating(contentId);
      setMyRating(rating);
    } catch (err) {
      // Silently fail - user might not be authenticated
    } finally {
      fetchingMyRating.current = false;
    }
  }, [contentId]);

  const refresh = useCallback(async () => {
    await Promise.all([
      fetchRatings(1, false),
      fetchMyRating(),
    ]);
  }, [fetchRatings, fetchMyRating]);

  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore || fetchingRatings.current) return;
    await fetchRatings(page + 1, true);
  }, [fetchRatings, isLoading, hasMore, page]);

  const submitMyRating = useCallback(async (rating: number, reviewText?: string): Promise<void> => {
    setIsSubmitting(true);
    setError(null);

    try {
      const newRating = await submitRating(contentId, rating, reviewText);
      setMyRating(newRating);

      // Update ratings list
      setRatings(prev => {
        const existing = prev.findIndex(r => r.id === newRating.id);
        if (existing >= 0) {
          return prev.map(r => (r.id === newRating.id ? newRating : r));
        } else {
          return [newRating, ...prev];
        }
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit rating');
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  }, [contentId]);

  // Initial load - only once per contentId
  useEffect(() => {
    if (!initialLoadDone.current) {
      initialLoadDone.current = true;
      fetchRatings(1, false);
      fetchMyRating();
    }
  }, [contentId]);

  // Reset when contentId changes
  useEffect(() => {
    return () => {
      initialLoadDone.current = false;
    };
  }, [contentId]);

  // Sync with options (but don't trigger fetches)
  useEffect(() => {
    if (options.initialAverageRating !== undefined && averageRating === null) {
      setAverageRating(options.initialAverageRating);
    }
    if (options.initialRatingCount !== undefined && totalCount === 0) {
      setTotalCount(options.initialRatingCount);
    }
  }, [options.initialAverageRating, options.initialRatingCount]);

  return {
    ratings,
    myRating,
    isLoading,
    isSubmitting,
    error,
    hasMore,
    totalCount,
    averageRating,
    loadMore,
    refresh,
    submitMyRating,
  };
}

export default useContentRatings;
