/**
 * useContentComments Hook
 *
 * Manages comments for content with threading support.
 * Includes deduplication to prevent rate limiting.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  ContentComment,
  getContentComments,
  getCommentReplies,
  createComment,
  updateComment,
  deleteComment,
} from '../services/socialApi';

interface UseContentCommentsReturn {
  comments: ContentComment[];
  isLoading: boolean;
  error: string | null;
  hasMore: boolean;
  totalCount: number;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  addComment: (text: string, parentId?: number) => Promise<ContentComment>;
  editComment: (commentId: number, text: string) => Promise<void>;
  removeComment: (commentId: number) => Promise<void>;
  loadReplies: (commentId: number) => Promise<ContentComment[]>;
}

export function useContentComments(contentId: number): UseContentCommentsReturn {
  const [comments, setComments] = useState<ContentComment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  // Refs to prevent duplicate requests
  const fetchingRef = useRef<boolean>(false);
  const initialLoadDone = useRef<boolean>(false);

  const fetchComments = useCallback(async (pageNum: number, append: boolean = false) => {
    // Prevent duplicate fetches
    if (fetchingRef.current) return;
    fetchingRef.current = true;

    setIsLoading(true);
    setError(null);

    try {
      const response = await getContentComments(contentId, pageNum, true);
      setComments(prev =>
        append ? [...prev, ...response.results] : response.results
      );
      setHasMore(response.next !== null);
      setTotalCount(response.count);
      setPage(pageNum);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load comments';
      // Don't show throttle errors
      if (!message.includes('throttle')) {
        setError(message);
      }
    } finally {
      setIsLoading(false);
      fetchingRef.current = false;
    }
  }, [contentId]);

  const refresh = useCallback(async () => {
    await fetchComments(1, false);
  }, [fetchComments]);

  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore || fetchingRef.current) return;
    await fetchComments(page + 1, true);
  }, [fetchComments, isLoading, hasMore, page]);

  const addComment = useCallback(async (text: string, parentId?: number): Promise<ContentComment> => {
    const newComment = await createComment(contentId, text, parentId);

    if (parentId) {
      // This is a reply - update the parent's reply count
      setComments(prev =>
        prev.map(c =>
          c.id === parentId
            ? { ...c, replies_count: c.replies_count + 1 }
            : c
        )
      );
    } else {
      // This is a top-level comment - add to the beginning
      setComments(prev => [newComment, ...prev]);
      setTotalCount(prev => prev + 1);
    }

    return newComment;
  }, [contentId]);

  const editComment = useCallback(async (commentId: number, text: string): Promise<void> => {
    const updated = await updateComment(commentId, text);
    setComments(prev =>
      prev.map(c => (c.id === commentId ? updated : c))
    );
  }, []);

  const removeComment = useCallback(async (commentId: number): Promise<void> => {
    await deleteComment(commentId);
    setComments(prev => prev.filter(c => c.id !== commentId));
    setTotalCount(prev => prev - 1);
  }, []);

  const loadReplies = useCallback(async (commentId: number): Promise<ContentComment[]> => {
    const replies = await getCommentReplies(commentId);
    return replies;
  }, []);

  // Initial load - only once per contentId
  useEffect(() => {
    if (!initialLoadDone.current) {
      initialLoadDone.current = true;
      fetchComments(1, false);
    }
  }, [contentId]); // Only depend on contentId, not fetchComments

  // Reset when contentId changes
  useEffect(() => {
    return () => {
      initialLoadDone.current = false;
    };
  }, [contentId]);

  return {
    comments,
    isLoading,
    error,
    hasMore,
    totalCount,
    loadMore,
    refresh,
    addComment,
    editComment,
    removeComment,
    loadReplies,
  };
}

export default useContentComments;
