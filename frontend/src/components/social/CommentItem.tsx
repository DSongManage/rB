/**
 * CommentItem Component
 *
 * Modern comment with reply, edit, and delete functionality - dark theme.
 */

import React, { useState } from 'react';
import { Reply, Edit2, Trash2, ChevronDown, ChevronUp, Send } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ContentComment } from '../../services/socialApi';

interface CommentItemProps {
  comment: ContentComment;
  onReply: (text: string, parentId: number) => Promise<void>;
  onEdit: (commentId: number, text: string) => Promise<void>;
  onDelete: (commentId: number) => Promise<void>;
  onLoadReplies: (commentId: number) => Promise<ContentComment[]>;
  isAuthenticated?: boolean;
  currentUsername?: string;
  depth?: number;
  maxDepth?: number;
}

export function CommentItem({
  comment,
  onReply,
  onEdit,
  onDelete,
  onLoadReplies,
  isAuthenticated = false,
  currentUsername,
  depth = 0,
  maxDepth = 3,
}: CommentItemProps) {
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [editText, setEditText] = useState(comment.text);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showReplies, setShowReplies] = useState(false);
  const [replies, setReplies] = useState<ContentComment[]>([]);
  const [loadingReplies, setLoadingReplies] = useState(false);

  const timeAgo = (date: string) => {
    const now = new Date();
    const then = new Date(date);
    const diff = Math.floor((now.getTime() - then.getTime()) / 1000);

    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`;
    return then.toLocaleDateString();
  };

  const handleReplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim()) return;

    setIsSubmitting(true);
    try {
      await onReply(replyText, comment.id);
      setReplyText('');
      setShowReplyForm(false);
      await handleLoadReplies();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editText.trim()) return;

    setIsSubmitting(true);
    try {
      await onEdit(comment.id, editText);
      setIsEditing(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this comment?')) return;
    await onDelete(comment.id);
  };

  const handleLoadReplies = async () => {
    if (!showReplies && comment.replies_count > 0) {
      setLoadingReplies(true);
      try {
        const loadedReplies = await onLoadReplies(comment.id);
        setReplies(loadedReplies);
      } finally {
        setLoadingReplies(false);
      }
    }
    setShowReplies(!showReplies);
  };

  const canReply = isAuthenticated && depth < maxDepth;
  const marginLeft = Math.min(depth * 20, 60);

  const buttonStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    background: 'transparent',
    border: 'none',
    padding: '4px 8px',
    borderRadius: 6,
    fontSize: 12,
    color: '#64748b',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  };

  return (
    <div style={{ marginLeft: `${marginLeft}px` }}>
      <div style={{ padding: '12px 0' }}>
        <div style={{ display: 'flex', gap: 12 }}>
          {comment.author_avatar ? (
            <img
              src={comment.author_avatar}
              alt={comment.author_username}
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                objectFit: 'cover',
                flexShrink: 0,
              }}
            />
          ) : (
            <div style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: 14,
              fontWeight: 600,
              flexShrink: 0,
            }}>
              {comment.author_username.charAt(0).toUpperCase()}
            </div>
          )}

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flexWrap: 'wrap',
              marginBottom: 4,
            }}>
              <Link
                to={`/profile/${comment.author_username}`}
                style={{
                  fontWeight: 600,
                  color: '#f1f5f9',
                  textDecoration: 'none',
                  fontSize: 13,
                }}
              >
                @{comment.author_username}
              </Link>
              <span style={{ fontSize: 11, color: '#64748b' }}>
                {timeAgo(comment.created_at)}
              </span>
              {comment.edited && (
                <span style={{ fontSize: 11, color: '#475569' }}>(edited)</span>
              )}
            </div>

            {isEditing ? (
              <form onSubmit={handleEditSubmit} style={{ marginTop: 8 }}>
                <textarea
                  value={editText}
                  onChange={e => setEditText(e.target.value)}
                  rows={2}
                  disabled={isSubmitting}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    background: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: 8,
                    color: '#f1f5f9',
                    fontSize: 13,
                    resize: 'none',
                    outline: 'none',
                  }}
                />
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button
                    type="submit"
                    disabled={isSubmitting || !editText.trim()}
                    style={{
                      padding: '6px 12px',
                      background: '#8b5cf6',
                      border: 'none',
                      borderRadius: 6,
                      color: '#fff',
                      fontSize: 12,
                      fontWeight: 500,
                      cursor: 'pointer',
                      opacity: isSubmitting || !editText.trim() ? 0.5 : 1,
                    }}
                  >
                    {isSubmitting ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditing(false);
                      setEditText(comment.text);
                    }}
                    style={{
                      padding: '6px 12px',
                      background: '#334155',
                      border: 'none',
                      borderRadius: 6,
                      color: '#94a3b8',
                      fontSize: 12,
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <p style={{
                color: '#cbd5e1',
                fontSize: 14,
                lineHeight: 1.6,
                margin: 0,
                whiteSpace: 'pre-wrap',
              }}>
                {comment.text}
              </p>
            )}

            {/* Actions */}
            {!isEditing && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 8 }}>
                {canReply && (
                  <button
                    onClick={() => setShowReplyForm(!showReplyForm)}
                    style={buttonStyle}
                    onMouseEnter={(e) => e.currentTarget.style.color = '#a78bfa'}
                    onMouseLeave={(e) => e.currentTarget.style.color = '#64748b'}
                  >
                    <Reply size={14} />
                    Reply
                  </button>
                )}
                {comment.can_edit && (
                  <button
                    onClick={() => setIsEditing(true)}
                    style={buttonStyle}
                    onMouseEnter={(e) => e.currentTarget.style.color = '#a78bfa'}
                    onMouseLeave={(e) => e.currentTarget.style.color = '#64748b'}
                  >
                    <Edit2 size={14} />
                    Edit
                  </button>
                )}
                {comment.can_delete && (
                  <button
                    onClick={handleDelete}
                    style={buttonStyle}
                    onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                    onMouseLeave={(e) => e.currentTarget.style.color = '#64748b'}
                  >
                    <Trash2 size={14} />
                    Delete
                  </button>
                )}
                {comment.replies_count > 0 && (
                  <button
                    onClick={handleLoadReplies}
                    style={{ ...buttonStyle, color: '#8b5cf6' }}
                  >
                    {showReplies ? (
                      <>
                        <ChevronUp size={14} />
                        Hide replies
                      </>
                    ) : (
                      <>
                        <ChevronDown size={14} />
                        {loadingReplies ? 'Loading...' : `${comment.replies_count} replies`}
                      </>
                    )}
                  </button>
                )}
              </div>
            )}

            {/* Reply Form */}
            {showReplyForm && (
              <form onSubmit={handleReplySubmit} style={{ marginTop: 12 }}>
                <div style={{
                  display: 'flex',
                  gap: 8,
                  alignItems: 'flex-end',
                }}>
                  <textarea
                    value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                    placeholder={`Reply to @${comment.author_username}...`}
                    rows={2}
                    disabled={isSubmitting}
                    style={{
                      flex: 1,
                      padding: '10px 12px',
                      background: '#0f172a',
                      border: '1px solid #334155',
                      borderRadius: 8,
                      color: '#f1f5f9',
                      fontSize: 13,
                      resize: 'none',
                      outline: 'none',
                    }}
                  />
                  <button
                    type="submit"
                    disabled={isSubmitting || !replyText.trim()}
                    style={{
                      padding: '10px 14px',
                      background: replyText.trim() ? '#8b5cf6' : '#334155',
                      border: 'none',
                      borderRadius: 8,
                      color: replyText.trim() ? '#fff' : '#64748b',
                      cursor: isSubmitting || !replyText.trim() ? 'not-allowed' : 'pointer',
                    }}
                  >
                    <Send size={16} />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowReplyForm(false);
                    setReplyText('');
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#64748b',
                    fontSize: 12,
                    cursor: 'pointer',
                    marginTop: 6,
                  }}
                >
                  Cancel
                </button>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* Nested Replies */}
      {showReplies && replies.length > 0 && (
        <div style={{ borderLeft: '2px solid #1e293b', marginLeft: 18 }}>
          {replies.map(reply => (
            <CommentItem
              key={reply.id}
              comment={reply}
              onReply={onReply}
              onEdit={onEdit}
              onDelete={onDelete}
              onLoadReplies={onLoadReplies}
              isAuthenticated={isAuthenticated}
              currentUsername={currentUsername}
              depth={depth + 1}
              maxDepth={maxDepth}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default CommentItem;
