/**
 * CommentReactions Component
 * Displays and manages emoji reactions on comments
 */

import React, { useState, useRef, useEffect } from 'react';
import { ProjectComment, CommentReaction } from '../../services/collaborationApi';

interface CommentReactionsProps {
  comment: ProjectComment;
  currentUserId: number;
  onReaction: (emoji: string) => Promise<void>;
  onRemoveReaction: (reactionId: number) => Promise<void>;
}

const AVAILABLE_EMOJIS = ['👍', '👎', '❤️', '😊', '🎉', '🔥', '👀', '🤔'];

export function CommentReactions({
  comment,
  currentUserId,
  onReaction,
  onRemoveReaction,
}: CommentReactionsProps) {
  const [showPicker, setShowPicker] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Group reactions by emoji
  const groupedReactions: { [emoji: string]: CommentReaction[] } = {};
  if (comment.reactions) {
    comment.reactions.forEach((reaction) => {
      if (!groupedReactions[reaction.emoji]) {
        groupedReactions[reaction.emoji] = [];
      }
      groupedReactions[reaction.emoji].push(reaction);
    });
  }

  // Check if current user has reacted with specific emoji
  const hasUserReacted = (emoji: string): CommentReaction | undefined => {
    return groupedReactions[emoji]?.find(r => r.user_id === currentUserId);
  };

  // Handle emoji click
  const handleEmojiClick = async (emoji: string) => {
    const existingReaction = hasUserReacted(emoji);

    setIsAdding(true);
    try {
      if (existingReaction) {
        // Remove reaction if already exists
        await onRemoveReaction(existingReaction.id);
      } else {
        // Add new reaction
        await onReaction(emoji);
      }
    } catch (error) {
      console.error('Failed to toggle reaction:', error);
    } finally {
      setIsAdding(false);
      setShowPicker(false);
    }
  };

  // Close picker when clicking outside
  useEffect(() => {
    if (!showPicker) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setShowPicker(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showPicker]);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 6,
        marginTop: 8,
      }}
    >
      {/* Existing reactions */}
      {Object.entries(groupedReactions).map(([emoji, reactions]) => {
        const userReaction = hasUserReacted(emoji);
        const hasReacted = !!userReaction;

        return (
          <button
            key={emoji}
            onClick={() => handleEmojiClick(emoji)}
            disabled={isAdding}
            title={reactions.map(r => r.username).join(', ')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 8px',
              background: hasReacted ? 'rgba(59, 130, 246, 0.2)' : 'rgba(100, 116, 139, 0.1)',
              border: `1px solid ${hasReacted ? '#3b82f6' : '#334155'}`,
              borderRadius: 12,
              cursor: isAdding ? 'not-allowed' : 'pointer',
              fontSize: 14,
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              if (!isAdding) {
                e.currentTarget.style.transform = 'scale(1.05)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            <span>{emoji}</span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: hasReacted ? '#3b82f6' : '#94a3b8',
              }}
            >
              {reactions.length}
            </span>
          </button>
        );
      })}

      {/* Add reaction button */}
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => setShowPicker(!showPicker)}
          disabled={isAdding}
          style={{
            padding: '4px 8px',
            background: 'transparent',
            border: '1px solid #334155',
            borderRadius: 12,
            cursor: isAdding ? 'not-allowed' : 'pointer',
            fontSize: 14,
            color: '#94a3b8',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            if (!isAdding) {
              e.currentTarget.style.borderColor = '#3b82f6';
              e.currentTarget.style.color = '#3b82f6';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = '#334155';
            e.currentTarget.style.color = '#94a3b8';
          }}
        >
          +
        </button>

        {/* Emoji picker */}
        {showPicker && (
          <div
            ref={pickerRef}
            style={{
              position: 'absolute',
              bottom: '100%',
              left: 0,
              marginBottom: 4,
              background: '#1e293b',
              border: '1px solid #334155',
              borderRadius: 12,
              padding: 8,
              boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)',
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 4,
              zIndex: 100,
            }}
          >
            {AVAILABLE_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => handleEmojiClick(emoji)}
                disabled={isAdding}
                style={{
                  width: 40,
                  height: 40,
                  padding: 0,
                  background: hasUserReacted(emoji) ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                  border: hasUserReacted(emoji) ? '1px solid #3b82f6' : '1px solid transparent',
                  borderRadius: 8,
                  cursor: isAdding ? 'not-allowed' : 'pointer',
                  fontSize: 20,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  if (!isAdding) {
                    e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)';
                    e.currentTarget.style.transform = 'scale(1.1)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = hasUserReacted(emoji)
                    ? 'rgba(59, 130, 246, 0.2)'
                    : 'transparent';
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default CommentReactions;
