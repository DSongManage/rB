/**
 * CommentComposer Component
 * Rich text composer for adding comments with @mentions and file attachments
 */

import React, { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { CollaboratorRole } from '../../services/collaborationApi';

interface CommentComposerProps {
  projectId: number;
  sectionId?: number;
  parentCommentId?: number;
  collaborators: CollaboratorRole[];
  placeholder?: string;
  autoFocus?: boolean;
  onSubmit: (content: string, mentions: number[], attachments?: File[]) => Promise<void>;
  onCancel?: () => void;
  initialValue?: string;
  submitButtonText?: string;
  compact?: boolean;
}

interface MentionSuggestion {
  userId: number;
  username: string;
  displayName: string;
  avatar?: string;
}

export function CommentComposer({
  projectId,
  sectionId,
  parentCommentId,
  collaborators,
  placeholder = 'Add a comment...',
  autoFocus = false,
  onSubmit,
  onCancel,
  initialValue = '',
  submitButtonText = 'Comment',
  compact = false,
}: CommentComposerProps) {
  const [content, setContent] = useState(initialValue);
  const [mentions, setMentions] = useState<number[]>([]);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // @mention autocomplete
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionSuggestions, setMentionSuggestions] = useState<MentionSuggestion[]>([]);
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
  const [mentionStart, setMentionStart] = useState<number | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Convert collaborators to mention suggestions
  const allSuggestions: MentionSuggestion[] = collaborators
    .filter(c => c.status === 'accepted')
    .map(c => ({
      userId: c.user,
      username: c.username,
      displayName: c.display_name || c.username,
      avatar: undefined, // Add avatar support if available
    }));

  // Handle content change and detect @mentions
  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setContent(newContent);

    const cursorPosition = e.target.selectionStart;
    const textBeforeCursor = newContent.slice(0, cursorPosition);

    // Check if we're typing an @mention
    const lastAtSymbol = textBeforeCursor.lastIndexOf('@');
    if (lastAtSymbol !== -1) {
      const textAfterAt = textBeforeCursor.slice(lastAtSymbol + 1);

      // Check if there's a space after @ (which ends the mention)
      if (!textAfterAt.includes(' ') && !textAfterAt.includes('\n')) {
        const query = textAfterAt.toLowerCase();
        setMentionQuery(query);
        setMentionStart(lastAtSymbol);

        // Filter suggestions
        const filtered = allSuggestions.filter(
          s =>
            s.username.toLowerCase().includes(query) ||
            s.displayName.toLowerCase().includes(query)
        );

        setMentionSuggestions(filtered);
        setShowMentions(filtered.length > 0);
        setSelectedMentionIndex(0);
        return;
      }
    }

    // Hide mentions if not in mention mode
    setShowMentions(false);
  };

  // Handle keyboard navigation in mention dropdown
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (showMentions) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedMentionIndex(prev =>
          prev < mentionSuggestions.length - 1 ? prev + 1 : prev
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedMentionIndex(prev => (prev > 0 ? prev - 1 : prev));
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        if (mentionSuggestions[selectedMentionIndex]) {
          insertMention(mentionSuggestions[selectedMentionIndex]);
        }
      } else if (e.key === 'Escape') {
        setShowMentions(false);
      }
    } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      // Cmd+Enter or Ctrl+Enter to submit
      e.preventDefault();
      handleSubmit();
    }
  };

  // Insert mention into text
  const insertMention = (suggestion: MentionSuggestion) => {
    if (mentionStart === null) return;

    const beforeMention = content.slice(0, mentionStart);
    const afterCursor = content.slice(textareaRef.current?.selectionStart || content.length);
    const newContent = `${beforeMention}@${suggestion.username} ${afterCursor}`;

    setContent(newContent);
    setShowMentions(false);

    // Add to mentions list
    if (!mentions.includes(suggestion.userId)) {
      setMentions([...mentions, suggestion.userId]);
    }

    // Move cursor after mention
    setTimeout(() => {
      const newPosition = mentionStart + suggestion.username.length + 2;
      textareaRef.current?.setSelectionRange(newPosition, newPosition);
      textareaRef.current?.focus();
    }, 0);
  };

  // Handle file attachment
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setAttachments([...attachments, ...newFiles]);
    }
  };

  // Remove attachment
  const removeAttachment = (index: number) => {
    setAttachments(attachments.filter((_, i) => i !== index));
  };

  // Submit comment
  const handleSubmit = async () => {
    if (!content.trim() && attachments.length === 0) return;

    setIsSubmitting(true);
    try {
      await onSubmit(content, mentions, attachments.length > 0 ? attachments : undefined);

      // Clear form
      setContent('');
      setMentions([]);
      setAttachments([]);
    } catch (error) {
      console.error('Failed to submit comment:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Auto-focus
  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [autoFocus]);

  return (
    <div
      style={{
        background: 'var(--panel)',
        border: '1px solid var(--panel-border)',
        borderRadius: compact ? 8 : 12,
        padding: compact ? 12 : 16,
        position: 'relative',
      }}
    >
      {/* Textarea */}
      <div style={{ position: 'relative' }}>
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleContentChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          style={{
            width: '100%',
            minHeight: compact ? 60 : 80,
            maxHeight: 200,
            background: 'var(--bg)',
            border: '1px solid var(--panel-border)',
            borderRadius: 8,
            padding: 10,
            color: 'var(--text)',
            fontSize: compact ? 12 : 13,
            lineHeight: 1.5,
            resize: 'vertical',
            outline: 'none',
            fontFamily: 'inherit',
          }}
        />

        {/* @mention autocomplete dropdown */}
        {showMentions && (
          <div
            style={{
              position: 'absolute',
              bottom: '100%',
              left: 0,
              marginBottom: 4,
              minWidth: 200,
              maxWidth: 300,
              background: '#1e293b',
              border: '1px solid #334155',
              borderRadius: 8,
              boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)',
              maxHeight: 200,
              overflowY: 'auto',
              zIndex: 1000,
            }}
          >
            {mentionSuggestions.map((suggestion, index) => (
              <div
                key={suggestion.userId}
                onClick={() => insertMention(suggestion)}
                style={{
                  padding: '8px 12px',
                  cursor: 'pointer',
                  background: index === selectedMentionIndex ? '#334155' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  transition: 'background 0.2s',
                }}
                onMouseEnter={() => setSelectedMentionIndex(index)}
              >
                {/* Avatar placeholder */}
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  {suggestion.username.charAt(0).toUpperCase()}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: '#e5e7eb',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    @{suggestion.username}
                  </div>
                  {suggestion.displayName !== suggestion.username && (
                    <div
                      style={{
                        fontSize: 11,
                        color: '#94a3b8',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {suggestion.displayName}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Attachments */}
      {attachments.length > 0 && (
        <div
          style={{
            marginTop: 8,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          {attachments.map((file, index) => (
            <div
              key={index}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 10px',
                background: 'var(--bg)',
                border: '1px solid var(--panel-border)',
                borderRadius: 6,
                fontSize: 12,
              }}
            >
              <span>📎</span>
              <span
                style={{
                  flex: 1,
                  color: 'var(--text)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {file.name}
              </span>
              <span style={{ color: '#64748b', fontSize: 11 }}>
                {(file.size / 1024).toFixed(1)} KB
              </span>
              <button
                onClick={() => removeAttachment(index)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#ef4444',
                  cursor: 'pointer',
                  fontSize: 16,
                  padding: 0,
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div
        style={{
          marginTop: 12,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 8,
        }}
      >
        {/* Left actions */}
        <div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            style={{ display: 'none' }}
            onChange={handleFileSelect}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isSubmitting}
            style={{
              background: 'transparent',
              border: '1px solid var(--panel-border)',
              borderRadius: 6,
              padding: compact ? '4px 10px' : '6px 12px',
              color: '#94a3b8',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              fontSize: compact ? 11 : 12,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            📎 Attach
          </button>
        </div>

        {/* Right actions */}
        <div style={{ display: 'flex', gap: 8 }}>
          {onCancel && (
            <button
              onClick={onCancel}
              disabled={isSubmitting}
              style={{
                background: 'transparent',
                border: '1px solid var(--panel-border)',
                borderRadius: 6,
                padding: compact ? '4px 12px' : '6px 16px',
                color: '#94a3b8',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                fontSize: compact ? 11 : 12,
                fontWeight: 600,
              }}
            >
              Cancel
            </button>
          )}
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || (!content.trim() && attachments.length === 0)}
            style={{
              background: isSubmitting || (!content.trim() && attachments.length === 0)
                ? '#374151'
                : '#3b82f6',
              border: 'none',
              borderRadius: 6,
              padding: compact ? '4px 12px' : '6px 16px',
              color: '#fff',
              cursor: isSubmitting || (!content.trim() && attachments.length === 0)
                ? 'not-allowed'
                : 'pointer',
              fontSize: compact ? 11 : 12,
              fontWeight: 700,
            }}
          >
            {isSubmitting ? 'Posting...' : submitButtonText}
          </button>
        </div>
      </div>

      {/* Hint */}
      {!compact && (
        <div
          style={{
            marginTop: 8,
            fontSize: 10,
            color: '#64748b',
          }}
        >
          Tip: Use @ to mention collaborators • {navigator.platform.includes('Mac') ? 'Cmd' : 'Ctrl'}+Enter to submit
        </div>
      )}
    </div>
  );
}

export default CommentComposer;
