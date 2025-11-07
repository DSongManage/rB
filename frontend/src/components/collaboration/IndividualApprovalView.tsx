/**
 * IndividualApprovalView Component
 * Interface for individual collaborators to approve a project
 */

import React, { useState } from 'react';
import { CollaborativeProject } from '../../services/collaborationApi';

interface IndividualApprovalViewProps {
  project: CollaborativeProject;
  currentUserId: number;
  onClose: () => void;
  onApprove: (feedback?: string) => void;
}

export function IndividualApprovalView({
  project,
  currentUserId,
  onClose,
  onApprove,
}: IndividualApprovalViewProps) {
  const [approveContent, setApproveContent] = useState(false);
  const [approveRevenue, setApproveRevenue] = useState(false);
  const [feedback, setFeedback] = useState('');

  const currentUserCollab = project.collaborators?.find(c => c.user === currentUserId);
  const hasAlreadyApproved =
    currentUserCollab?.approved_current_version && currentUserCollab?.approved_revenue_split;

  const canApprove = approveContent && approveRevenue;

  // Calculate project stats
  const totalSections = project.sections?.length || 0;
  const completedSections =
    project.sections?.filter(s => {
      if (s.section_type === 'text') {
        return s.content_html && s.content_html.trim() !== '';
      }
      return !!s.media_file;
    }).length || 0;

  const totalRevenue =
    project.collaborators?.reduce((sum, c) => sum + c.revenue_percentage, 0) || 0;
  const revenueSplitsCorrect = Math.abs(totalRevenue - 100) < 0.01;

  const handleApprove = () => {
    if (!canApprove) {
      alert('Please check both approval boxes before proceeding.');
      return;
    }
    onApprove(feedback.trim() || undefined);
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
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--panel)',
          border: '1px solid var(--panel-border)',
          borderRadius: 12,
          padding: 24,
          maxWidth: 600,
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <h2
          style={{
            margin: 0,
            marginBottom: 8,
            fontSize: 22,
            fontWeight: 700,
            color: 'var(--text)',
          }}
        >
          {hasAlreadyApproved ? 'Review Your Approval' : 'Approve Project'}
        </h2>
        <p
          style={{
            margin: 0,
            marginBottom: 24,
            fontSize: 14,
            color: '#94a3b8',
          }}
        >
          {hasAlreadyApproved
            ? "You've already approved this project. Review the details below."
            : 'Review the project details and approve if everything looks good.'}
        </p>

        {/* Project overview */}
        <div
          style={{
            marginBottom: 24,
            padding: 16,
            background: 'var(--bg)',
            border: '1px solid var(--panel-border)',
            borderRadius: 8,
          }}
        >
          <h3
            style={{
              margin: 0,
              marginBottom: 12,
              fontSize: 16,
              fontWeight: 700,
              color: 'var(--text)',
            }}
          >
            {project.title}
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* Content type */}
            <div style={{ fontSize: 13, color: '#94a3b8' }}>
              <span style={{ fontWeight: 600 }}>Type:</span>{' '}
              {project.content_type.charAt(0).toUpperCase() + project.content_type.slice(1)}
            </div>

            {/* Sections */}
            <div style={{ fontSize: 13, color: '#94a3b8' }}>
              <span style={{ fontWeight: 600 }}>Sections:</span> {completedSections} / {totalSections} completed
              {completedSections === totalSections && totalSections > 0 && (
                <span style={{ color: '#10b981', marginLeft: 8 }}>✓</span>
              )}
            </div>

            {/* Collaborators */}
            <div style={{ fontSize: 13, color: '#94a3b8' }}>
              <span style={{ fontWeight: 600 }}>Collaborators:</span>{' '}
              {project.collaborators?.filter(c => c.status === 'accepted').length || 0}
            </div>
          </div>
        </div>

        {/* Revenue split */}
        <div
          style={{
            marginBottom: 24,
            padding: 16,
            background: revenueSplitsCorrect
              ? 'rgba(16, 185, 129, 0.1)'
              : 'rgba(239, 68, 68, 0.1)',
            border: `1px solid ${revenueSplitsCorrect ? '#10b981' : '#ef4444'}`,
            borderRadius: 8,
          }}
        >
          <h3
            style={{
              margin: 0,
              marginBottom: 12,
              fontSize: 14,
              fontWeight: 700,
              color: 'var(--text)',
            }}
          >
            Revenue Split
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {project.collaborators
              ?.filter(c => c.status === 'accepted')
              .map((collab) => {
                const isCurrentUser = collab.user === currentUserId;
                return (
                  <div
                    key={collab.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: 10,
                      background: isCurrentUser ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                      border: isCurrentUser ? '1px solid #3b82f6' : 'none',
                      borderRadius: 6,
                    }}
                  >
                    <div>
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: 'var(--text)',
                        }}
                      >
                        @{collab.username}
                        {isCurrentUser && ' (you)'}
                      </span>
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>
                        {collab.role}
                      </div>
                    </div>
                    <div
                      style={{
                        fontSize: 16,
                        fontWeight: 700,
                        color: isCurrentUser ? '#3b82f6' : '#10b981',
                      }}
                    >
                      {collab.revenue_percentage}%
                    </div>
                  </div>
                );
              })}
          </div>

          <div
            style={{
              marginTop: 12,
              paddingTop: 12,
              borderTop: '1px solid var(--panel-border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
              Total:
            </span>
            <span
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: revenueSplitsCorrect ? '#10b981' : '#ef4444',
              }}
            >
              {totalRevenue.toFixed(1)}%
            </span>
          </div>

          {!revenueSplitsCorrect && (
            <div
              style={{
                marginTop: 12,
                fontSize: 12,
                color: '#ef4444',
                fontWeight: 600,
              }}
            >
              Revenue splits must total 100%
            </div>
          )}
        </div>

        {/* Approval checkboxes */}
        {!hasAlreadyApproved && (
          <div
            style={{
              marginBottom: 24,
              padding: 16,
              background: 'var(--bg)',
              border: '1px solid var(--panel-border)',
              borderRadius: 8,
            }}
          >
            <h3
              style={{
                margin: 0,
                marginBottom: 12,
                fontSize: 14,
                fontWeight: 700,
                color: 'var(--text)',
              }}
            >
              Approval Checklist
            </h3>

            <label
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                marginBottom: 12,
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={approveContent}
                onChange={(e) => setApproveContent(e.target.checked)}
                style={{
                  marginTop: 2,
                  cursor: 'pointer',
                }}
              />
              <div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'var(--text)',
                    marginBottom: 4,
                  }}
                >
                  I approve the current version of the content
                </div>
                <div style={{ fontSize: 11, color: '#94a3b8' }}>
                  I have reviewed all sections and am satisfied with the quality and content.
                </div>
              </div>
            </label>

            <label
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={approveRevenue}
                onChange={(e) => setApproveRevenue(e.target.checked)}
                style={{
                  marginTop: 2,
                  cursor: 'pointer',
                }}
              />
              <div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'var(--text)',
                    marginBottom: 4,
                  }}
                >
                  I approve the revenue split
                </div>
                <div style={{ fontSize: 11, color: '#94a3b8' }}>
                  I agree to the revenue distribution shown above ({currentUserCollab?.revenue_percentage}% for me).
                </div>
              </div>
            </label>
          </div>
        )}

        {/* Optional feedback */}
        {!hasAlreadyApproved && (
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
              Feedback (optional):
            </label>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Any comments or suggestions for the team..."
              style={{
                width: '100%',
                minHeight: 80,
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
        )}

        {/* Warning */}
        {!hasAlreadyApproved && (
          <div
            style={{
              marginBottom: 20,
              padding: 12,
              background: 'rgba(251, 191, 36, 0.1)',
              border: '1px solid #f59e0b',
              borderRadius: 8,
              fontSize: 12,
              color: '#f59e0b',
              lineHeight: 1.5,
            }}
          >
            By approving, you confirm that you're ready for this project to be minted as an NFT.
            This approval cannot be undone.
          </div>
        )}

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
            {hasAlreadyApproved ? 'Close' : 'Cancel'}
          </button>

          {!hasAlreadyApproved && (
            <button
              onClick={handleApprove}
              disabled={!canApprove || !revenueSplitsCorrect}
              style={{
                flex: 1,
                padding: '12px 20px',
                background:
                  !canApprove || !revenueSplitsCorrect
                    ? '#374151'
                    : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                border: 'none',
                borderRadius: 8,
                color: '#fff',
                fontSize: 14,
                fontWeight: 700,
                cursor: !canApprove || !revenueSplitsCorrect ? 'not-allowed' : 'pointer',
                boxShadow:
                  !canApprove || !revenueSplitsCorrect
                    ? 'none'
                    : '0 4px 12px rgba(16, 185, 129, 0.3)',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                if (canApprove && revenueSplitsCorrect) {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 6px 16px rgba(16, 185, 129, 0.4)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow =
                  !canApprove || !revenueSplitsCorrect
                    ? 'none'
                    : '0 4px 12px rgba(16, 185, 129, 0.3)';
              }}
            >
              Approve Project
            </button>
          )}
        </div>

        {/* Already approved message */}
        {hasAlreadyApproved && (
          <div
            style={{
              marginTop: 16,
              padding: 12,
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: 8,
              fontSize: 13,
              color: '#10b981',
              textAlign: 'center',
              fontWeight: 600,
            }}
          >
            You have already approved this project
          </div>
        )}
      </div>
    </div>
  );
}

export default IndividualApprovalView;
