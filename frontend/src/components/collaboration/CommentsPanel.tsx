/**
 * CommentsPanel Component
 * Collapsible panel for project comments - to be embedded in ContentTab
 */

import React, { useState } from 'react';
import { MessageSquare, ChevronDown, ChevronUp, Eye, EyeOff } from 'lucide-react';
import { CollaborativeProject, ProjectComment, CollaboratorRole } from '../../services/collaborationApi';
import { useComments } from '../../hooks/useComments';
import { CommentThread } from './CommentThread';
import CommentComposer from './CommentComposer';

interface User {
  id: number;
  username: string;
  display_name?: string;
}

interface CommentsPanelProps {
  project: CollaborativeProject;
  currentUser: User;
  defaultExpanded?: boolean;
}

export function CommentsPanel({
  project,
  currentUser,
  defaultExpanded = false,
}: CommentsPanelProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [showResolved, setShowResolved] = useState(false);

  // Comments hook
  const {
    comments,
    unresolvedCount,
    totalCount,
    isLoading,
    addComment,
    updateComment,
    deleteComment,
    resolveComment,
    unresolveComment,
    addReaction,
    removeReaction,
  } = useComments({
    projectId: project.id,
    includeResolved: showResolved,
    pollingInterval: 30000,
  });

  const handleAddComment = async (content: string, mentions: number[]) => {
    try {
      await addComment(content, mentions);
    } catch (err) {
      console.error('Failed to add comment:', err);
    }
  };

  return (
    <div
      style={{
        background: 'var(--panel)',
        border: '1px solid var(--panel-border)',
        borderRadius: 12,
        overflow: 'hidden',
      }}
    >
      {/* Header - always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          borderBottom: isExpanded ? '1px solid var(--panel-border)' : 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <MessageSquare size={20} style={{ color: '#06b6d4' }} />
          <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>
            Comments
          </span>
          {unresolvedCount > 0 && (
            <span
              style={{
                background: '#ef4444',
                color: '#fff',
                fontSize: 11,
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: 10,
              }}
            >
              {unresolvedCount}
            </span>
          )}
          <span style={{ fontSize: 13, color: '#64748b' }}>
            ({totalCount} total)
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {isExpanded ? (
            <ChevronUp size={20} style={{ color: '#94a3b8' }} />
          ) : (
            <ChevronDown size={20} style={{ color: '#94a3b8' }} />
          )}
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div style={{ padding: 20 }}>
          {/* Comment Composer */}
          <div style={{ marginBottom: 20 }}>
            <CommentComposer
              projectId={project.id}
              onSubmit={handleAddComment}
              collaborators={project.collaborators || []}
              placeholder="Add a comment about the content..."
            />
          </div>

          {/* Show resolved toggle */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 16,
              paddingBottom: 12,
              borderBottom: '1px solid var(--panel-border)',
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
              {showResolved ? 'All Comments' : 'Unresolved Comments'}
            </span>
            <button
              onClick={() => setShowResolved(!showResolved)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                background: 'transparent',
                border: '1px solid var(--panel-border)',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 12,
                color: '#94a3b8',
              }}
            >
              {showResolved ? (
                <>
                  <EyeOff size={14} />
                  Hide resolved
                </>
              ) : (
                <>
                  <Eye size={14} />
                  Show resolved
                </>
              )}
            </button>
          </div>

          {/* Comments list */}
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: 20, color: '#94a3b8' }}>
              Loading comments...
            </div>
          ) : comments.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {comments.map((comment) => (
                <CommentThread
                  key={comment.id}
                  comment={comment}
                  projectId={project.id}
                  currentUserId={currentUser.id}
                  collaborators={project.collaborators || []}
                  onReply={async (parentId, content, mentions) => {
                    await addComment(content, mentions, undefined, parentId);
                  }}
                  onEdit={async (commentId, content) => {
                    await updateComment(commentId, content);
                  }}
                  onDelete={async (commentId) => {
                    await deleteComment(commentId);
                  }}
                  onResolve={async (commentId) => {
                    await resolveComment(commentId);
                  }}
                  onUnresolve={async (commentId) => {
                    await unresolveComment(commentId);
                  }}
                  onReaction={async (commentId, emoji) => {
                    await addReaction(commentId, emoji);
                  }}
                  onRemoveReaction={async (commentId, reactionId) => {
                    await removeReaction(commentId, reactionId);
                  }}
                />
              ))}
            </div>
          ) : (
            <div
              style={{
                textAlign: 'center',
                padding: 32,
                color: '#64748b',
              }}
            >
              <MessageSquare
                size={32}
                style={{ color: '#475569', marginBottom: 12 }}
              />
              <div style={{ fontSize: 14, fontWeight: 500 }}>
                {showResolved ? 'No comments yet' : 'No unresolved comments'}
              </div>
              <div style={{ fontSize: 13, marginTop: 4 }}>
                {showResolved
                  ? 'Start the conversation about this content!'
                  : 'All comments have been resolved'}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default CommentsPanel;
