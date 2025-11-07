/**
 * EditingIndicator Component
 * Shows when users are currently editing a section
 */

import React from 'react';
import { CurrentlyEditing, getTimeAgo } from '../../services/activityService';

interface EditingIndicatorProps {
  sectionId: number;
  currentlyEditing: CurrentlyEditing[];
  currentUserId?: number; // To exclude current user from display
}

/**
 * Show editing indicator for a specific section
 */
export function EditingIndicator({
  sectionId,
  currentlyEditing,
  currentUserId,
}: EditingIndicatorProps) {
  // Filter editors for this section (excluding current user)
  const editors = currentlyEditing.filter(
    e => e.section_id === sectionId && e.user_id !== currentUserId
  );

  if (editors.length === 0) {
    return null;
  }

  const editor = editors[0]; // Show first editor
  const othersCount = editors.length - 1;

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 12px',
        background: 'rgba(251, 191, 36, 0.1)',
        border: '1px solid #f59e0b',
        borderRadius: 8,
        fontSize: 12,
        color: '#f59e0b',
        fontWeight: 600,
      }}
      role="status"
      aria-live="polite"
    >
      <span
        style={{
          display: 'inline-block',
          animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        }}
      >
        ⏳
      </span>
      <span>
        @{editor.username} is editing
        {othersCount > 0 && ` +${othersCount} other${othersCount > 1 ? 's' : ''}`}
      </span>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}

/**
 * Show available to edit indicator
 */
interface AvailableToEditProps {
  canEdit: boolean;
}

export function AvailableToEdit({ canEdit }: AvailableToEditProps) {
  if (!canEdit) {
    return (
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 12px',
          background: 'rgba(100, 116, 139, 0.1)',
          border: '1px solid #64748b',
          borderRadius: 8,
          fontSize: 12,
          color: '#64748b',
          fontWeight: 600,
        }}
      >
        🔒 Read only
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 12px',
        background: 'rgba(16, 185, 129, 0.1)',
        border: '1px solid #10b981',
        borderRadius: 8,
        fontSize: 12,
        color: '#10b981',
        fontWeight: 600,
      }}
    >
      ✏️ Available to edit
    </div>
  );
}

/**
 * Section Header with Editing Indicator
 * Combines section info with real-time editing status
 */
interface SectionHeaderWithStatusProps {
  sectionNumber: number;
  sectionTitle: string;
  sectionId: number;
  currentlyEditing: CurrentlyEditing[];
  currentUserId?: number;
  canEdit: boolean;
}

export function SectionHeaderWithStatus({
  sectionNumber,
  sectionTitle,
  sectionId,
  currentlyEditing,
  currentUserId,
  canEdit,
}: SectionHeaderWithStatusProps) {
  const editors = currentlyEditing.filter(
    e => e.section_id === sectionId && e.user_id !== currentUserId
  );

  const isBeingEdited = editors.length > 0;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
        flexWrap: 'wrap',
        gap: 12,
      }}
    >
      {/* Section Title */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <h4
          style={{
            margin: 0,
            fontSize: 16,
            fontWeight: 700,
            color: 'var(--text)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          Section {sectionNumber}: {sectionTitle}
        </h4>
      </div>

      {/* Status Indicators */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {isBeingEdited ? (
          <EditingIndicator
            sectionId={sectionId}
            currentlyEditing={currentlyEditing}
            currentUserId={currentUserId}
          />
        ) : (
          <AvailableToEdit canEdit={canEdit} />
        )}
      </div>
    </div>
  );
}

/**
 * Typing indicator with animated dots
 */
interface TypingIndicatorProps {
  username: string;
}

export function TypingIndicator({ username }: TypingIndicatorProps) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '4px 10px',
        background: 'rgba(59, 130, 246, 0.1)',
        border: '1px solid #3b82f6',
        borderRadius: 12,
        fontSize: 11,
        color: '#3b82f6',
        fontWeight: 600,
      }}
      role="status"
      aria-live="polite"
    >
      <span>@{username} is typing</span>
      <span
        style={{
          display: 'inline-flex',
          gap: 2,
        }}
      >
        <span
          style={{
            width: 4,
            height: 4,
            borderRadius: '50%',
            background: '#3b82f6',
            animation: 'dot1 1.4s infinite',
          }}
        />
        <span
          style={{
            width: 4,
            height: 4,
            borderRadius: '50%',
            background: '#3b82f6',
            animation: 'dot2 1.4s infinite',
          }}
        />
        <span
          style={{
            width: 4,
            height: 4,
            borderRadius: '50%',
            background: '#3b82f6',
            animation: 'dot3 1.4s infinite',
          }}
        />
      </span>

      <style>{`
        @keyframes dot1 {
          0%, 60%, 100% { opacity: 0.3; transform: translateY(0); }
          30% { opacity: 1; transform: translateY(-4px); }
        }
        @keyframes dot2 {
          0%, 60%, 100% { opacity: 0.3; transform: translateY(0); }
          40% { opacity: 1; transform: translateY(-4px); }
        }
        @keyframes dot3 {
          0%, 60%, 100% { opacity: 0.3; transform: translateY(0); }
          50% { opacity: 1; transform: translateY(-4px); }
        }
      `}</style>
    </div>
  );
}

/**
 * List of all currently editing users
 */
interface CurrentlyEditingListProps {
  currentlyEditing: CurrentlyEditing[];
  currentUserId?: number;
}

export function CurrentlyEditingList({
  currentlyEditing,
  currentUserId,
}: CurrentlyEditingListProps) {
  // Filter out current user
  const editors = currentlyEditing.filter(e => e.user_id !== currentUserId);

  if (editors.length === 0) {
    return (
      <div
        style={{
          padding: 16,
          textAlign: 'center',
          color: '#64748b',
          fontSize: 12,
        }}
      >
        No one is currently editing
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      {editors.map((editor, index) => (
        <div
          key={`${editor.user_id}-${editor.section_id}-${index}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '8px 12px',
            background: 'rgba(251, 191, 36, 0.05)',
            border: '1px solid rgba(251, 191, 36, 0.2)',
            borderRadius: 8,
          }}
        >
          <span
            style={{
              fontSize: 16,
              animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
            }}
          >
            ⏳
          </span>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--text)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              @{editor.username}
            </div>
            <div
              style={{
                fontSize: 11,
                color: '#94a3b8',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              Editing: {editor.section_title}
            </div>
          </div>

          <div
            style={{
              fontSize: 10,
              color: '#64748b',
            }}
          >
            {getTimeAgo(editor.started_at)}
          </div>
        </div>
      ))}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}

export default EditingIndicator;
