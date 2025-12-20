/**
 * useCreatorReviews Hook
 *
 * Manages creator reviews (Yelp-style).
 * Includes deduplication to prevent rate limiting.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  CreatorReview,
  getCreatorReviews,
  canReviewCreator,
  submitCreatorReview,
  respondToReview,
} from '../services/socialApi';

interface UseCreatorReviewsReturn {
  reviews: CreatorReview[];
  isLoading: boolean;
  isSubmitting: boolean;
  error: string | null;
  hasMore: boolean;
  totalCount: number;
  canReview: boolean;
  verificationTypeIfCanReview: 'purchase' | 'collaboration' | null;
  canReviewReason: string | null;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  submitReview: (rating: number, reviewText?: string) => Promise<void>;
  respondTo: (reviewId: number, responseText: string) => Promise<void>;
  checkCanReview: (userId: number) => Promise<void>;
}

export function useCreatorReviews(
  creatorUsername: string,
  creatorUserId?: number
): UseCreatorReviewsReturn {
  const [reviews, setReviews] = useState<CreatorReview[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [canReview, setCanReview] = useState(false);
  const [verificationTypeIfCanReview, setVerificationTypeIfCanReview] = useState<
    'purchase' | 'collaboration' | null
  >(null);
  const [canReviewReason, setCanReviewReason] = useState<string | null>(null);

  // Refs to prevent duplicate fetches
  const fetchingRef = useRef(false);
  const eligibilityCheckedRef = useRef(false);
  const initialLoadDone = useRef(false);

  const fetchReviews = useCallback(
    async (pageNum: number, append: boolean = false) => {
      if (fetchingRef.current) return;
      fetchingRef.current = true;

      setIsLoading(true);
      setError(null);

      try {
        const response = await getCreatorReviews(creatorUsername, pageNum);
        setReviews(prev =>
          append ? [...prev, ...response.results] : response.results
        );
        setHasMore(response.next !== null);
        setTotalCount(response.count);
        setPage(pageNum);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load reviews';
        if (!message.includes('throttle')) {
          setError(message);
        }
      } finally {
        setIsLoading(false);
        fetchingRef.current = false;
      }
    },
    [creatorUsername]
  );

  const checkCanReview = useCallback(async (userId: number) => {
    if (eligibilityCheckedRef.current) return;
    eligibilityCheckedRef.current = true;

    try {
      const result = await canReviewCreator(userId);
      setCanReview(result.can_review);
      setVerificationTypeIfCanReview(result.verification_type);
      setCanReviewReason(result.reason);
    } catch (err) {
      // Silently fail - user might not be authenticated
      setCanReview(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    fetchingRef.current = false; // Allow refresh
    eligibilityCheckedRef.current = false;
    await fetchReviews(1, false);
    if (creatorUserId) {
      await checkCanReview(creatorUserId);
    }
  }, [fetchReviews, creatorUserId, checkCanReview]);

  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore || fetchingRef.current) return;
    await fetchReviews(page + 1, true);
  }, [fetchReviews, isLoading, hasMore, page]);

  const submitReview = useCallback(
    async (rating: number, reviewText?: string): Promise<void> => {
      if (!creatorUserId) {
        throw new Error('Creator user ID is required');
      }

      setIsSubmitting(true);
      setError(null);

      try {
        const newReview = await submitCreatorReview(creatorUserId, rating, reviewText);
        setReviews(prev => [newReview, ...prev]);
        setTotalCount(prev => prev + 1);
        setCanReview(false);
        setCanReviewReason('You have already reviewed this creator');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to submit review');
        throw err;
      } finally {
        setIsSubmitting(false);
      }
    },
    [creatorUserId]
  );

  const respondTo = useCallback(
    async (reviewId: number, responseText: string): Promise<void> => {
      setIsSubmitting(true);
      setError(null);

      try {
        const updatedReview = await respondToReview(reviewId, responseText);
        setReviews(prev =>
          prev.map(r => (r.id === reviewId ? updatedReview : r))
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to respond to review');
        throw err;
      } finally {
        setIsSubmitting(false);
      }
    },
    []
  );

  // Initial load - only once
  useEffect(() => {
    if (!initialLoadDone.current) {
      initialLoadDone.current = true;
      fetchReviews(1, false);
    }
  }, [creatorUsername]);

  // Reset on username change
  useEffect(() => {
    return () => {
      initialLoadDone.current = false;
      eligibilityCheckedRef.current = false;
    };
  }, [creatorUsername]);

  // Check review eligibility when userId is available - only once
  useEffect(() => {
    if (creatorUserId && !eligibilityCheckedRef.current) {
      checkCanReview(creatorUserId);
    }
  }, [creatorUserId, checkCanReview]);

  return {
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
    refresh,
    submitReview,
    respondTo,
    checkCanReview,
  };
}

export default useCreatorReviews;
