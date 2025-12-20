/**
 * CommentThread Component
 * Displays threaded comments with replies, reactions, and actions
 */

import React, { useState } from 'react';
import { ProjectComment, CollaboratorRole } from '../../services/collaborationApi';
import { getTimeAgo } from '../../services/activityService';
import CommentComposer from './CommentComposer';
import CommentReactions from './CommentReactions';

interface CommentThreadProps {
  comment: ProjectComment;
  projectId: number;
  currentUserId: number;
  collaborators: CollaboratorRole[];
  depth?: number;
  maxDepth?: number;
  onReply: (parentId: number, content: string, mentions: number[], attachments?: File[]) => Promise<void>;
  onEdit: (commentId: number, content: string) => Promise<ProjectComment | void>;
  onDelete: (commentId: number) => Promise<ProjectComment | void>;
  onResolve: (commentId: number) => Promise<ProjectComment | void>;
  onUnresolve: (commentId: number) => Promise<ProjectComment | void>;
  onReaction: (commentId: number, emoji: string) => Promise<void>;
  onRemoveReaction: (commentId: number, reactionId: number) => Promise<void>;
}

export function CommentThread({
  comment,
  projectId,
  currentUserId,
  collaborators,
  depth = 0,
  maxDepth = 3,
  onReply,
  onEdit,
  onDelete,
  onResolve,
  onUnresolve,
  onReaction,
  onRemoveReaction,
}: CommentThreadProps) {
  const [showReplyComposer, setShowReplyComposer] = useState(false);
  const [showEditComposer, setShowEditComposer] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showEditHistory, setShowEditHistory] = useState(false);

  const isAuthor = comment.author === currentUserId;
  const canReply = depth < maxDepth;

  // Handle reply
  const handleReply = async (content: string, mentions: number[], attachments?: File[]) => {
    await onReply(comment.id, content, mentions, attachments);
    setShowReplyComposer(false);
  };

  // Handle edit
  const handleEdit = async (content: string) => {
    await onEdit(comment.id, content);
    setShowEditComposer(false);
  };

  // Handle delete
  const handleDelete = async () => {
    if (confirm('Are you sure you want to delete this comment?')) {
      await onDelete(comment.id);
    }
    setShowMenu(false);
  };

  // Handle resolve/unresolve
  const handleResolve = async () => {
    if (comment.resolved) {
      await onUnresolve(comment.id);
    } else {
      await onResolve(comment.id);
    }
    setShowMenu(false);
  };

  return (
    <div
      style={{
        display: 'flex',
        gap: 12,
        opacity: comment.resolved ? 0.6 : 1,
        transition: 'opacity 0.2s',
      }}
    >
      {/* Indent line for replies */}
      {depth > 0 && (
        <div
          style={{
            width: 2,
            background: '#334155',
            flexShrink: 0,
            marginLeft: 16,
          }}
        />
      )}

      {/* Comment content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            background: 'var(--bg)',
            border: `1px solid ${comment.resolved ? '#10b981' : 'var(--panel-border)'}`,
            borderRadius: 8,
            padding: 12,
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 8,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {/* Avatar */}
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: comment.author_avatar
                    ? `url(${comment.author_avatar}) center/cover`
                    : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                {!comment.author_avatar && comment.author_username.charAt(0).toUpperCase()}
              </div>

              {/* Author & timestamp */}
              <div>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'var(--text)',
                  }}
                >
                  @{comment.author_username}
                </span>
                {comment.edited && (
                  <span
                    style={{
                      marginLeft: 6,
                      fontSize: 11,
                      color: '#64748b',
                      cursor: comment.edit_history ? 'pointer' : 'default',
                    }}
                    onClick={() => comment.edit_history && setShowEditHistory(!showEditHistory)}
                    title={comment.edit_history ? 'Click to see edit history' : undefined}
                  >
                    (edited)
                  </span>
                )}
              </div>

              <span style={{ fontSize: 11, color: '#64748b' }}>•</span>
              <span style={{ fontSize: 11, color: '#64748b' }}>
                {getTimeAgo(comment.created_at)}
              </span>

              {/* Section indicator */}
              {comment.section_title && (
                <>
                  <span style={{ fontSize: 11, color: '#64748b' }}>•</span>
                  <span
                    style={{
                      fontSize: 10,
                      color: '#94a3b8',
                      background: 'rgba(59, 130, 246, 0.1)',
                      padding: '2px 6px',
                      borderRadius: 4,
                    }}
                  >
                    {comment.section_title}
                  </span>
                </>
              )}

              {/* Resolved badge */}
              {comment.resolved && (
                <span
                  style={{
                    fontSize: 10,
                    color: '#10b981',
                    background: 'rgba(16, 185, 129, 0.1)',
                    padding: '2px 6px',
                    borderRadius: 4,
                    fontWeight: 600,
                  }}
                  title={
                    comment.resolved_by_username
                      ? `Resolved by @${comment.resolved_by_username}`
                      : 'Resolved'
                  }
                >
                  ✓ Resolved
                </span>
              )}
            </div>

            {/* Menu button */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowMenu(!showMenu)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  fontSize: 18,
                  padding: '2px 6px',
                  lineHeight: 1,
                }}
              >
                ⋮
              </button>

              {/* Dropdown menu */}
              {showMenu && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: 4,
                    background: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: 8,
                    boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)',
                    minWidth: 150,
                    zIndex: 100,
                  }}
                >
                  {isAuthor && (
                    <>
                      <button
                        onClick={() => {
                          setShowEditComposer(true);
                          setShowMenu(false);
                        }}
                        style={{
                          width: '100%',
                          background: 'transparent',
                          border: 'none',
                          color: '#e5e7eb',
                          padding: '8px 12px',
                          textAlign: 'left',
                          cursor: 'pointer',
                          fontSize: 13,
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#334155';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent';
                        }}
                      >
                        ✏️ Edit
                      </button>
                      <button
                        onClick={handleDelete}
                        style={{
                          width: '100%',
                          background: 'transparent',
                          border: 'none',
                          color: '#ef4444',
                          padding: '8px 12px',
                          textAlign: 'left',
                          cursor: 'pointer',
                          fontSize: 13,
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#334155';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent';
                        }}
                      >
                        🗑️ Delete
                      </button>
                    </>
                  )}
                  <button
                    onClick={handleResolve}
                    style={{
                      width: '100%',
                      background: 'transparent',
                      border: 'none',
                      color: comment.resolved ? '#94a3b8' : '#10b981',
                      padding: '8px 12px',
                      textAlign: 'left',
                      cursor: 'pointer',
                      fontSize: 13,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#334155';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    {comment.resolved ? '↩️ Unresolve' : '✓ Resolve'}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Edit history */}
          {showEditHistory && comment.edit_history && comment.edit_history.length > 0 && (
            <div
              style={{
                marginBottom: 8,
                padding: 8,
                background: 'rgba(100, 116, 139, 0.1)',
                border: '1px solid #334155',
                borderRadius: 6,
                fontSize: 11,
                color: '#94a3b8',
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Edit History:</div>
              {comment.edit_history.map((edit) => (
                <div key={edit.edited_at} style={{ marginBottom: 4 }}>
                  <span style={{ color: '#64748b' }}>
                    {new Date(edit.edited_at).toLocaleString()}:
                  </span>{' '}
                  {edit.content}
                </div>
              ))}
            </div>
          )}

          {/* Content */}
          {showEditComposer ? (
            <CommentComposer
              projectId={projectId}
              collaborators={collaborators}
              onSubmit={async (content) => {
                await handleEdit(content);
              }}
              onCancel={() => setShowEditComposer(false)}
              initialValue={comment.content}
              submitButtonText="Save"
              compact={true}
            />
          ) : (
            <div
              style={{
                fontSize: 13,
                color: '#cbd5e1',
                lineHeight: 1.6,
                marginBottom: 8,
                whiteSpace: 'pre-wrap',
              }}
            >
              {comment.content}
            </div>
          )}

          {/* Attachments */}
          {comment.attachments && comment.attachments.length > 0 && (
            <div
              style={{
                marginTop: 8,
                marginBottom: 8,
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              {comment.attachments.map((attachment) => (
                <a
                  key={attachment.id}
                  href={attachment.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 10px',
                    background: 'rgba(59, 130, 246, 0.1)',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    borderRadius: 6,
                    fontSize: 12,
                    color: '#3b82f6',
                    textDecoration: 'none',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(59, 130, 246, 0.2)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)';
                  }}
                >
                  <span>📎</span>
                  <span style={{ flex: 1 }}>{attachment.filename}</span>
                  <span style={{ fontSize: 11, color: '#94a3b8' }}>
                    {(attachment.file_size / 1024).toFixed(1)} KB
                  </span>
                </a>
              ))}
            </div>
          )}

          {/* Reactions */}
          <CommentReactions
            comment={comment}
            currentUserId={currentUserId}
            onReaction={(emoji) => onReaction(comment.id, emoji)}
            onRemoveReaction={(reactionId) => onRemoveReaction(comment.id, reactionId)}
          />

          {/* Actions */}
          {!showEditComposer && (
            <div
              style={{
                marginTop: 8,
                display: 'flex',
                gap: 12,
                fontSize: 12,
              }}
            >
              {canReply && (
                <button
                  onClick={() => setShowReplyComposer(!showReplyComposer)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#3b82f6',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 600,
                    padding: 0,
                  }}
                >
                  Reply
                </button>
              )}
            </div>
          )}
        </div>

        {/* Reply composer */}
        {showReplyComposer && (
          <div style={{ marginTop: 12 }}>
            <CommentComposer
              projectId={projectId}
              parentCommentId={comment.id}
              collaborators={collaborators}
              placeholder={`Reply to @${comment.author_username}...`}
              onSubmit={handleReply}
              onCancel={() => setShowReplyComposer(false)}
              submitButtonText="Reply"
              compact={true}
              autoFocus={true}
            />
          </div>
        )}

        {/* Replies */}
        {comment.replies && comment.replies.length > 0 && (
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {comment.replies.map((reply) => (
              <CommentThread
                key={reply.id}
                comment={reply}
                projectId={projectId}
                currentUserId={currentUserId}
                collaborators={collaborators}
                depth={depth + 1}
                maxDepth={maxDepth}
                onReply={onReply}
                onEdit={onEdit}
                onDelete={onDelete}
                onResolve={onResolve}
                onUnresolve={onUnresolve}
                onReaction={onReaction}
                onRemoveReaction={onRemoveReaction}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default CommentThread;
