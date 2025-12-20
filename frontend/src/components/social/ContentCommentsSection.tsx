/**
 * ContentCommentsSection Component
 *
 * Modern comment section with dark theme styling.
 */

import React, { useState } from 'react';
import { MessageSquare, Send } from 'lucide-react';
import CommentItem from './CommentItem';
import { useContentComments } from '../../hooks/useContentComments';

interface ContentCommentsSectionProps {
  contentId: number;
  isAuthenticated?: boolean;
  currentUsername?: string;
  onAuthRequired?: () => void;
}

export function ContentCommentsSection({
  contentId,
  isAuthenticated = false,
  currentUsername,
  onAuthRequired,
}: ContentCommentsSectionProps) {
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    comments,
    isLoading,
    error,
    hasMore,
    totalCount,
    loadMore,
    addComment,
    editComment,
    removeComment,
    loadReplies,
  } = useContentComments(contentId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isAuthenticated) {
      onAuthRequired?.();
      return;
    }

    if (!newComment.trim()) return;

    setIsSubmitting(true);
    try {
      await addComment(newComment);
      setNewComment('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReply = async (text: string, parentId: number) => {
    await addComment(text, parentId);
  };

  return (
    <div style={{
      background: '#0f172a',
      borderRadius: 16,
      border: '1px solid #1e293b',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '20px 24px',
        borderBottom: '1px solid #1e293b',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}>
        <MessageSquare size={20} color="#8b5cf6" />
        <h3 style={{
          margin: 0,
          fontSize: 18,
          fontWeight: 700,
          color: '#f1f5f9',
        }}>
          Comments
        </h3>
        {totalCount > 0 && (
          <span style={{
            background: '#1e293b',
            color: '#94a3b8',
            padding: '4px 10px',
            borderRadius: 12,
            fontSize: 13,
            fontWeight: 500,
          }}>
            {totalCount}
          </span>
        )}
      </div>

      {/* Content */}
      <div style={{ padding: '20px 24px' }}>
        {/* New Comment Form */}
        <form onSubmit={handleSubmit} style={{ marginBottom: 24 }}>
          <div style={{
            display: 'flex',
            gap: 12,
            alignItems: 'flex-start',
          }}>
            <div style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: isAuthenticated
                ? 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)'
                : '#334155',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: 16,
              fontWeight: 600,
              flexShrink: 0,
            }}>
              {currentUsername ? currentUsername.charAt(0).toUpperCase() : '?'}
            </div>
            <div style={{ flex: 1 }}>
              <textarea
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
                placeholder={
                  isAuthenticated
                    ? 'Share your thoughts...'
                    : 'Sign in to leave a comment'
                }
                rows={3}
                disabled={!isAuthenticated || isSubmitting}
                onClick={() => {
                  if (!isAuthenticated) {
                    onAuthRequired?.();
                  }
                }}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  background: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: 12,
                  color: '#f1f5f9',
                  fontSize: 14,
                  resize: 'none',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                  cursor: !isAuthenticated ? 'pointer' : 'text',
                }}
                onFocus={(e) => {
                  if (isAuthenticated) {
                    e.target.style.borderColor = '#8b5cf6';
                  }
                }}
                onBlur={(e) => e.target.style.borderColor = '#334155'}
              />
              {isAuthenticated && (
                <div style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  marginTop: 12,
                }}>
                  <button
                    type="submit"
                    disabled={isSubmitting || !newComment.trim()}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '10px 20px',
                      background: newComment.trim()
                        ? 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)'
                        : '#334155',
                      border: 'none',
                      borderRadius: 10,
                      color: newComment.trim() ? '#fff' : '#64748b',
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: isSubmitting || !newComment.trim() ? 'not-allowed' : 'pointer',
                      opacity: isSubmitting ? 0.7 : 1,
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <Send size={16} />
                    {isSubmitting ? 'Posting...' : 'Post Comment'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </form>

        {/* Error Message */}
        {error && (
          <p style={{
            fontSize: 13,
            color: '#ef4444',
            marginBottom: 16,
            padding: '10px 14px',
            background: 'rgba(239, 68, 68, 0.1)',
            borderRadius: 8,
          }}>
            {error}
          </p>
        )}

        {/* Comments List */}
        {isLoading && comments.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '32px 0',
            color: '#64748b',
            fontSize: 14,
          }}>
            Loading comments...
          </div>
        ) : comments.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '32px 0',
            color: '#64748b',
            fontSize: 14,
          }}>
            No comments yet. Be the first to comment!
          </div>
        ) : (
          <>
            <div>
              {comments.map(comment => (
                <div
                  key={comment.id}
                  style={{
                    borderBottom: '1px solid #1e293b',
                  }}
                >
                  <CommentItem
                    comment={comment}
                    onReply={handleReply}
                    onEdit={editComment}
                    onDelete={removeComment}
                    onLoadReplies={loadReplies}
                    isAuthenticated={isAuthenticated}
                    currentUsername={currentUsername}
                  />
                </div>
              ))}
            </div>

            {hasMore && (
              <button
                onClick={loadMore}
                disabled={isLoading}
                style={{
                  width: '100%',
                  marginTop: 16,
                  padding: '12px',
                  background: 'transparent',
                  border: '1px solid #334155',
                  borderRadius: 10,
                  color: '#8b5cf6',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  opacity: isLoading ? 0.6 : 1,
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(139, 92, 246, 0.1)';
                  e.currentTarget.style.borderColor = '#8b5cf6';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.borderColor = '#334155';
                }}
              >
                {isLoading ? 'Loading...' : 'Load More Comments'}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default ContentCommentsSection;
