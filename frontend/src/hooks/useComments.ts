/**
 * useComments Hook
 * Manages comments with real-time updates, threading, and optimistic updates
 */

import { useState, useCallback, useEffect } from 'react';
import {
  ProjectComment,
  collaborationApi,
  CreateCommentData,
} from '../services/collaborationApi';

interface UseCommentsOptions {
  projectId: number;
  sectionId?: number;
  includeResolved?: boolean;
  pollingInterval?: number; // Auto-refresh interval in ms
}

interface UseCommentsReturn {
  comments: ProjectComment[];
  commentsBySection: { [sectionId: string]: ProjectComment[] };
  unresolvedCount: number;
  totalCount: number;
  isLoading: boolean;
  error: Error | null;

  // Actions
  refresh: () => Promise<void>;
  addComment: (
    content: string,
    mentions: number[],
    attachments?: File[],
    parentCommentId?: number,
    sectionId?: number
  ) => Promise<ProjectComment>;
  updateComment: (commentId: number, content: string) => Promise<ProjectComment>;
  deleteComment: (commentId: number) => Promise<void>;
  resolveComment: (commentId: number) => Promise<ProjectComment>;
  unresolveComment: (commentId: number) => Promise<ProjectComment>;
  addReaction: (commentId: number, emoji: string) => Promise<void>;
  removeReaction: (commentId: number, reactionId: number) => Promise<void>;

  // Utilities
  getCommentById: (commentId: number) => ProjectComment | undefined;
  getReplies: (parentCommentId: number) => ProjectComment[];
}

/**
 * Build threaded comment structure
 */
function buildCommentTree(flatComments: ProjectComment[]): ProjectComment[] {
  const commentMap = new Map<number, ProjectComment>();
  const rootComments: ProjectComment[] = [];

  // First pass: create map and initialize replies arrays
  flatComments.forEach((comment) => {
    commentMap.set(comment.id, { ...comment, replies: [] });
  });

  // Second pass: build tree structure
  flatComments.forEach((comment) => {
    const commentWithReplies = commentMap.get(comment.id)!;

    if (comment.parent_comment) {
      // Add to parent's replies
      const parent = commentMap.get(comment.parent_comment);
      if (parent) {
        parent.replies!.push(commentWithReplies);
      } else {
        // Parent not found, treat as root
        rootComments.push(commentWithReplies);
      }
    } else {
      // Root comment
      rootComments.push(commentWithReplies);
    }
  });

  return rootComments;
}

/**
 * Group comments by section
 */
function groupCommentsBySection(comments: ProjectComment[]): {
  [sectionId: string]: ProjectComment[];
} {
  const grouped: { [sectionId: string]: ProjectComment[] } = {
    general: [], // Comments without a section
  };

  comments.forEach((comment) => {
    if (comment.section) {
      const key = comment.section.toString();
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(comment);
    } else {
      grouped.general.push(comment);
    }
  });

  return grouped;
}

/**
 * Custom hook for managing comments
 */
export function useComments(options: UseCommentsOptions): UseCommentsReturn {
  const {
    projectId,
    sectionId,
    includeResolved = false,
    pollingInterval = 0, // 0 means no polling
  } = options;

  // State
  const [flatComments, setFlatComments] = useState<ProjectComment[]>([]);
  const [comments, setComments] = useState<ProjectComment[]>([]);
  const [commentsBySection, setCommentsBySection] = useState<{
    [sectionId: string]: ProjectComment[];
  }>({});
  const [unresolvedCount, setUnresolvedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Process flat comments into tree structure
  useEffect(() => {
    const tree = buildCommentTree(flatComments);
    const grouped = groupCommentsBySection(flatComments);

    setComments(tree);
    setCommentsBySection(grouped);
    setUnresolvedCount(flatComments.filter((c) => !c.resolved).length);
    setTotalCount(flatComments.length);
  }, [flatComments]);

  // Refresh comments from API
  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      let fetchedComments: ProjectComment[];

      if (sectionId) {
        // Get comments for specific section
        fetchedComments = await collaborationApi.getComments(projectId, sectionId);
      } else {
        // Get all comments
        fetchedComments = await collaborationApi.getComments(projectId);
      }

      // Filter out resolved comments if needed
      if (!includeResolved) {
        fetchedComments = fetchedComments.filter((c) => !c.resolved);
      }

      setFlatComments(fetchedComments);
    } catch (err) {
      setError(err as Error);
      console.error('Failed to fetch comments:', err);
    } finally {
      setIsLoading(false);
    }
  }, [projectId, sectionId, includeResolved]);

  // Add comment with optimistic update
  const addComment = useCallback(
    async (
      content: string,
      mentions: number[],
      attachments?: File[],
      parentCommentId?: number,
      commentSectionId?: number
    ): Promise<ProjectComment> => {
      const data: CreateCommentData = {
        project: projectId,
        content,
        mentions,
        attachments,
        parent_comment: parentCommentId,
        section: commentSectionId || sectionId,
      };

      try {
        const newComment = await collaborationApi.addComment(data);

        // Optimistic update
        setFlatComments((prev) => [...prev, newComment]);

        return newComment;
      } catch (err) {
        setError(err as Error);
        console.error('Failed to add comment:', err);
        throw err;
      }
    },
    [projectId, sectionId]
  );

  // Update comment
  const updateComment = useCallback(
    async (commentId: number, content: string): Promise<ProjectComment> => {
      try {
        const updatedComment = await collaborationApi.updateComment(commentId, content);

        // Update in state
        setFlatComments((prev) =>
          prev.map((c) => (c.id === commentId ? updatedComment : c))
        );

        return updatedComment;
      } catch (err) {
        setError(err as Error);
        console.error('Failed to update comment:', err);
        throw err;
      }
    },
    []
  );

  // Delete comment with optimistic update
  const deleteComment = useCallback(async (commentId: number): Promise<void> => {
    try {
      // Optimistic update
      setFlatComments((prev) => prev.filter((c) => c.id !== commentId));

      await collaborationApi.deleteComment(commentId);
    } catch (err) {
      setError(err as Error);
      console.error('Failed to delete comment:', err);
      // Revert optimistic update
      await refresh();
      throw err;
    }
  }, [refresh]);

  // Resolve comment
  const resolveComment = useCallback(
    async (commentId: number): Promise<ProjectComment> => {
      try {
        const resolved = await collaborationApi.resolveComment(commentId);

        // Update in state
        setFlatComments((prev) =>
          prev.map((c) => (c.id === commentId ? resolved : c))
        );

        return resolved;
      } catch (err) {
        setError(err as Error);
        console.error('Failed to resolve comment:', err);
        throw err;
      }
    },
    []
  );

  // Unresolve comment
  const unresolveComment = useCallback(
    async (commentId: number): Promise<ProjectComment> => {
      try {
        const unresolved = await collaborationApi.unresolveComment(commentId);

        // Update in state
        setFlatComments((prev) =>
          prev.map((c) => (c.id === commentId ? unresolved : c))
        );

        return unresolved;
      } catch (err) {
        setError(err as Error);
        console.error('Failed to unresolve comment:', err);
        throw err;
      }
    },
    []
  );

  // Add reaction
  const addReaction = useCallback(async (commentId: number, emoji: string): Promise<void> => {
    try {
      const reaction = await collaborationApi.addReaction(commentId, emoji);

      // Update in state
      setFlatComments((prev) =>
        prev.map((c) => {
          if (c.id === commentId) {
            return {
              ...c,
              reactions: [...(c.reactions || []), reaction],
            };
          }
          return c;
        })
      );
    } catch (err) {
      setError(err as Error);
      console.error('Failed to add reaction:', err);
      throw err;
    }
  }, []);

  // Remove reaction
  const removeReaction = useCallback(
    async (commentId: number, reactionId: number): Promise<void> => {
      try {
        await collaborationApi.removeReaction(commentId, reactionId);

        // Update in state
        setFlatComments((prev) =>
          prev.map((c) => {
            if (c.id === commentId) {
              return {
                ...c,
                reactions: (c.reactions || []).filter((r) => r.id !== reactionId),
              };
            }
            return c;
          })
        );
      } catch (err) {
        setError(err as Error);
        console.error('Failed to remove reaction:', err);
        throw err;
      }
    },
    []
  );

  // Get comment by ID
  const getCommentById = useCallback(
    (commentId: number): ProjectComment | undefined => {
      return flatComments.find((c) => c.id === commentId);
    },
    [flatComments]
  );

  // Get replies for a comment
  const getReplies = useCallback(
    (parentCommentId: number): ProjectComment[] => {
      return flatComments.filter((c) => c.parent_comment === parentCommentId);
    },
    [flatComments]
  );

  // Initial load
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Polling for real-time updates
  useEffect(() => {
    if (pollingInterval <= 0) return;

    const interval = setInterval(() => {
      refresh();
    }, pollingInterval);

    return () => clearInterval(interval);
  }, [pollingInterval, refresh]);

  return {
    comments,
    commentsBySection,
    unresolvedCount,
    totalCount,
    isLoading,
    error,

    refresh,
    addComment,
    updateComment,
    deleteComment,
    resolveComment,
    unresolveComment,
    addReaction,
    removeReaction,

    getCommentById,
    getReplies,
  };
}

export default useComments;
