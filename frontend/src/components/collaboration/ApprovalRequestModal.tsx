/**
 * ApprovalRequestModal Component
 * Modal for requesting approval from collaborators
 */

import React, { useState } from 'react';
import { CollaborativeProject, Collaborator } from '../../services/collaborationApi';

interface ApprovalRequestModalProps {
  project: CollaborativeProject;
  pendingCollaborators: Collaborator[];
  onClose: () => void;
  onSubmit: (selectedCollaboratorIds: number[], message: string, deadline: number) => void;
}

export function ApprovalRequestModal({
  project,
  pendingCollaborators,
  onClose,
  onSubmit,
}: ApprovalRequestModalProps) {
  const [selectedCollaborators, setSelectedCollaborators] = useState<Set<number>>(
    new Set(pendingCollaborators.map(c => c.user))
  );
  const [message, setMessage] = useState('');
  const [deadline, setDeadline] = useState(7); // days

  const handleToggleCollaborator = (userId: number) => {
    const newSelected = new Set(selectedCollaborators);
    if (newSelected.has(userId)) {
      newSelected.delete(userId);
    } else {
      newSelected.add(userId);
    }
    setSelectedCollaborators(newSelected);
  };

  const handleSubmit = () => {
    if (selectedCollaborators.size === 0) {
      alert('Please select at least one collaborator to request approval from.');
      return;
    }
    onSubmit(Array.from(selectedCollaborators), message, deadline);
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--panel)',
          border: '1px solid var(--panel-border)',
          borderRadius: 12,
          padding: 24,
          maxWidth: 500,
          width: '90%',
          maxHeight: '80vh',
          overflow: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <h2
          style={{
            margin: 0,
            marginBottom: 20,
            fontSize: 20,
            fontWeight: 700,
            color: 'var(--text)',
          }}
        >
          Request Approval from Team
        </h2>

        {/* Collaborator selection */}
        <div style={{ marginBottom: 20 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--text)',
              marginBottom: 12,
            }}
          >
            Send approval request to:
          </div>

          {pendingCollaborators.length === 0 ? (
            <div
              style={{
                padding: 16,
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: 8,
                fontSize: 13,
                color: '#10b981',
                textAlign: 'center',
              }}
            >
              All collaborators have already approved!
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {pendingCollaborators.map((collab) => (
                <label
                  key={collab.user}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: 12,
                    background: selectedCollaborators.has(collab.user)
                      ? 'rgba(59, 130, 246, 0.1)'
                      : 'var(--bg)',
                    border: `1px solid ${
                      selectedCollaborators.has(collab.user)
                        ? '#3b82f6'
                        : 'var(--panel-border)'
                    }`,
                    borderRadius: 8,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    if (!selectedCollaborators.has(collab.user)) {
                      e.currentTarget.style.background = 'rgba(59, 130, 246, 0.05)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!selectedCollaborators.has(collab.user)) {
                      e.currentTarget.style.background = 'var(--bg)';
                    }
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedCollaborators.has(collab.user)}
                    onChange={() => handleToggleCollaborator(collab.user)}
                    style={{ cursor: 'pointer' }}
                  />
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: 'var(--text)',
                      }}
                    >
                      @{collab.username}
                    </div>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>
                      {collab.role}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Optional message */}
        <div style={{ marginBottom: 20 }}>
          <label
            style={{
              display: 'block',
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--text)',
              marginBottom: 8,
            }}
          >
            Message (optional):
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Hi team! I think we're ready to mint this. Please review and approve if you're satisfied."
            style={{
              width: '100%',
              minHeight: 100,
              padding: 12,
              background: 'var(--bg)',
              border: '1px solid var(--panel-border)',
              borderRadius: 8,
              color: 'var(--text)',
              fontSize: 13,
              fontFamily: 'inherit',
              resize: 'vertical',
              outline: 'none',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = '#3b82f6';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'var(--panel-border)';
            }}
          />
        </div>

        {/* Deadline */}
        <div style={{ marginBottom: 24 }}>
          <label
            style={{
              display: 'block',
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--text)',
              marginBottom: 8,
            }}
          >
            Approval deadline:
          </label>
          <select
            value={deadline}
            onChange={(e) => setDeadline(Number(e.target.value))}
            style={{
              width: '100%',
              padding: 12,
              background: 'var(--bg)',
              border: '1px solid var(--panel-border)',
              borderRadius: 8,
              color: 'var(--text)',
              fontSize: 13,
              cursor: 'pointer',
              outline: 'none',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = '#3b82f6';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'var(--panel-border)';
            }}
          >
            <option value={1}>1 day</option>
            <option value={3}>3 days</option>
            <option value={7}>7 days</option>
            <option value={14}>14 days</option>
            <option value={30}>30 days</option>
          </select>
        </div>

        {/* Info note */}
        <div
          style={{
            marginBottom: 20,
            padding: 12,
            background: 'rgba(59, 130, 246, 0.1)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            borderRadius: 8,
            fontSize: 12,
            color: '#94a3b8',
            lineHeight: 1.5,
          }}
        >
          Selected collaborators will receive a notification and email with your message. They
          can approve anytime before the deadline.
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: '12px 20px',
              background: 'transparent',
              border: '1px solid var(--panel-border)',
              borderRadius: 8,
              color: 'var(--text)',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--bg)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={pendingCollaborators.length === 0 || selectedCollaborators.size === 0}
            style={{
              flex: 1,
              padding: '12px 20px',
              background:
                pendingCollaborators.length === 0 || selectedCollaborators.size === 0
                  ? '#374151'
                  : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
              border: 'none',
              borderRadius: 8,
              color: '#fff',
              fontSize: 14,
              fontWeight: 700,
              cursor:
                pendingCollaborators.length === 0 || selectedCollaborators.size === 0
                  ? 'not-allowed'
                  : 'pointer',
              boxShadow:
                pendingCollaborators.length === 0 || selectedCollaborators.size === 0
                  ? 'none'
                  : '0 4px 12px rgba(59, 130, 246, 0.3)',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              if (pendingCollaborators.length > 0 && selectedCollaborators.size > 0) {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 6px 16px rgba(59, 130, 246, 0.4)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow =
                pendingCollaborators.length === 0 || selectedCollaborators.size === 0
                  ? 'none'
                  : '0 4px 12px rgba(59, 130, 246, 0.3)';
            }}
          >
            Send Approval Request
          </button>
        </div>
      </div>
    </div>
  );
}

export default ApprovalRequestModal;
