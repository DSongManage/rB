import React, { useState } from 'react';
import { CollaborativeProject } from '../../../services/collaborationApi';
import { useActivity } from '../../../hooks/useActivity';
import { useComments } from '../../../hooks/useComments';
import { ActivityFeed } from '../ActivityFeed';
import { CommentThread } from '../CommentThread';
import CommentComposer from '../CommentComposer';

interface User {
  id: number;
  username: string;
  display_name?: string;
}

interface ActivityTabProps {
  project: CollaborativeProject;
  currentUser: User;
}

export default function ActivityTab({
  project,
  currentUser,
}: ActivityTabProps) {
  const [activeView, setActiveView] = useState<'activity' | 'comments'>('activity');
  const [showResolvedComments, setShowResolvedComments] = useState(false);

  // Activity tracking
  const {
    activities,
    onlineUsers,
    isPolling,
  } = useActivity({
    projectId: project.id,
    autoStart: true,
  });

  // Comments
  const {
    comments,
    unresolvedCount,
    totalCount,
    isLoading: commentsLoading,
    addComment,
    updateComment,
    deleteComment,
    resolveComment,
    unresolveComment,
    addReaction,
    removeReaction,
    refresh: refreshComments,
  } = useComments({
    projectId: project.id,
    includeResolved: showResolvedComments,
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* View Toggle */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div style={{
          display: 'flex',
          gap: 4,
          background: 'var(--panel)',
          padding: 4,
          borderRadius: 8,
          border: '1px solid var(--panel-border)',
        }}>
          <button
            onClick={() => setActiveView('activity')}
            style={{
              padding: '8px 16px',
              background: activeView === 'activity' ? 'var(--bg)' : 'transparent',
              border: activeView === 'activity' ? '1px solid var(--panel-border)' : '1px solid transparent',
              borderRadius: 6,
              color: activeView === 'activity' ? 'var(--text)' : '#94a3b8',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: activeView === 'activity' ? 600 : 500,
            }}
          >
            Activity Feed
          </button>
          <button
            onClick={() => setActiveView('comments')}
            style={{
              padding: '8px 16px',
              background: activeView === 'comments' ? 'var(--bg)' : 'transparent',
              border: activeView === 'comments' ? '1px solid var(--panel-border)' : '1px solid transparent',
              borderRadius: 6,
              color: activeView === 'comments' ? 'var(--text)' : '#94a3b8',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: activeView === 'comments' ? 600 : 500,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            Comments
            {unresolvedCount > 0 && (
              <span style={{
                background: '#ef4444',
                color: '#fff',
                fontSize: 10,
                fontWeight: 700,
                padding: '2px 6px',
                borderRadius: 10,
              }}>
                {unresolvedCount}
              </span>
            )}
          </button>
        </div>

        {/* Online Status */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <div style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: isPolling ? '#10b981' : '#64748b',
          }} />
          <span style={{ fontSize: 12, color: '#94a3b8' }}>
            {onlineUsers.length} online
          </span>
        </div>
      </div>

      {/* Activity View */}
      {activeView === 'activity' && (
        <div style={{
          background: 'var(--panel)',
          border: '1px solid var(--panel-border)',
          borderRadius: 12,
          padding: 24,
        }}>
          <h3 style={{ margin: '0 0 20px', color: 'var(--text)', fontSize: 16 }}>
            Recent Activity
          </h3>
          {activities.length > 0 ? (
            <ActivityFeed activities={activities} maxItems={50} />
          ) : (
            <div style={{
              textAlign: 'center',
              padding: 40,
              color: '#64748b',
              fontSize: 14,
            }}>
              No activity yet. Activity will appear here as collaborators work on the project.
            </div>
          )}
        </div>
      )}

      {/* Comments View */}
      {activeView === 'comments' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Add Comment */}
          <div style={{
            background: 'var(--panel)',
            border: '1px solid var(--panel-border)',
            borderRadius: 12,
            padding: 20,
          }}>
            <h3 style={{ margin: '0 0 16px', color: 'var(--text)', fontSize: 16 }}>
              Add Comment
            </h3>
            <CommentComposer
              projectId={project.id}
              onSubmit={handleAddComment}
              collaborators={project.collaborators || []}
              placeholder="Share your thoughts with the team..."
            />
          </div>

          {/* Comments List */}
          <div style={{
            background: 'var(--panel)',
            border: '1px solid var(--panel-border)',
            borderRadius: 12,
            padding: 20,
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 16,
            }}>
              <h3 style={{ margin: 0, color: 'var(--text)', fontSize: 16 }}>
                Comments ({totalCount})
              </h3>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 12,
                color: '#94a3b8',
                cursor: 'pointer',
              }}>
                <input
                  type="checkbox"
                  checked={showResolvedComments}
                  onChange={(e) => setShowResolvedComments(e.target.checked)}
                />
                Show resolved
              </label>
            </div>

            {commentsLoading ? (
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
              <div style={{
                textAlign: 'center',
                padding: 40,
                color: '#64748b',
                fontSize: 14,
              }}>
                No comments yet. Start the conversation!
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
