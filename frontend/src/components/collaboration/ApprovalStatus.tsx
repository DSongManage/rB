/**
 * ApprovalStatus Component
 * Shows approval status and minting readiness for collaborative projects
 */

import React from 'react';
import { CollaborativeProject } from '../../services/collaborationApi';
import { getTimeAgo } from '../../services/activityService';

interface ApprovalStatusProps {
  project: CollaborativeProject;
  currentUserId: number;
  hasUserApproved: boolean;
  isReadyForMint: boolean;
  validationErrors: string[];
  onApprove?: () => void;
  onRequestReapproval?: () => void;
  onMint?: () => void;
}

export function ApprovalStatus({
  project,
  currentUserId,
  hasUserApproved,
  isReadyForMint,
  validationErrors,
  onApprove,
  onRequestReapproval,
  onMint,
}: ApprovalStatusProps) {
  const acceptedCollaborators = project.collaborators?.filter(c => c.status === 'accepted') || [];
  const approvedCollaborators = acceptedCollaborators.filter(
    c => c.approved_current_version && c.approved_revenue_split
  );
  const pendingCollaborators = acceptedCollaborators.filter(
    c => !c.approved_current_version || !c.approved_revenue_split
  );

  return (
    <div>
      <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 20 }}>
        Approval Status
      </h2>

      {/* Progress indicator */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
            Progress
          </span>
          <span style={{ fontSize: 14, fontWeight: 600, color: isReadyForMint ? '#10b981' : '#f59e0b' }}>
            {approvedCollaborators.length} / {acceptedCollaborators.length}
          </span>
        </div>
        <div
          style={{
            height: 8,
            background: '#1e293b',
            borderRadius: 4,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${(approvedCollaborators.length / acceptedCollaborators.length) * 100}%`,
              background: isReadyForMint
                ? 'linear-gradient(90deg, #10b981 0%, #059669 100%)'
                : 'linear-gradient(90deg, #f59e0b 0%, #d97706 100%)',
              transition: 'width 0.3s',
            }}
          />
        </div>
      </div>

      {/* Approved collaborators */}
      {approvedCollaborators.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#10b981', marginBottom: 12 }}>
            ✅ Approved ({approvedCollaborators.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {approvedCollaborators.map((collab) => (
              <div
                key={collab.id}
                style={{
                  padding: 12,
                  background: 'rgba(16, 185, 129, 0.1)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  borderRadius: 8,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontSize: 11,
                      fontWeight: 700,
                    }}
                  >
                    {collab.username.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                      @{collab.username}
                      {collab.user === currentUserId && ' (you)'}
                    </div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>
                      {collab.role}
                    </div>
                  </div>
                </div>
                {collab.accepted_at && (
                  <div style={{ fontSize: 10, color: '#10b981', marginTop: 4 }}>
                    Approved {getTimeAgo(collab.accepted_at)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending collaborators */}
      {pendingCollaborators.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#f59e0b', marginBottom: 12 }}>
            ⏳ Pending ({pendingCollaborators.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pendingCollaborators.map((collab) => (
              <div
                key={collab.id}
                style={{
                  padding: 12,
                  background: 'rgba(251, 191, 36, 0.1)',
                  border: '1px solid rgba(251, 191, 36, 0.3)',
                  borderRadius: 8,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontSize: 11,
                      fontWeight: 700,
                    }}
                  >
                    {collab.username.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                      @{collab.username}
                      {collab.user === currentUserId && ' (you)'}
                    </div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>
                      {collab.role}
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: 10, color: '#f59e0b', marginTop: 4 }}>
                  Review pending
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Validation errors */}
      {validationErrors.length > 0 && (
        <div
          style={{
            marginBottom: 20,
            padding: 12,
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid #ef4444',
            borderRadius: 8,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 700, color: '#ef4444', marginBottom: 8 }}>
            Issues to resolve:
          </div>
          <ul style={{ margin: 0, paddingLeft: 20, color: '#ef4444', fontSize: 12 }}>
            {validationErrors.map((error) => (
              <li key={error} style={{ marginBottom: 4 }}>
                {error}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* User hasn't approved yet */}
        {!hasUserApproved && onApprove && (
          <button
            onClick={onApprove}
            style={{
              width: '100%',
              padding: '12px 20px',
              background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
              border: 'none',
              borderRadius: 8,
              color: '#fff',
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 6px 16px rgba(59, 130, 246, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.3)';
            }}
          >
            ✓ Approve Project
          </button>
        )}

        {/* Request re-approval */}
        {hasUserApproved && onRequestReapproval && (
          <button
            onClick={onRequestReapproval}
            style={{
              width: '100%',
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
              e.currentTarget.style.background = 'var(--panel)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            Request Re-approval
          </button>
        )}

        {/* Mint button (only when ready) */}
        {isReadyForMint && onMint && (
          <button
            onClick={onMint}
            disabled={validationErrors.length > 0}
            style={{
              width: '100%',
              padding: '16px 20px',
              background: validationErrors.length > 0
                ? '#374151'
                : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              border: 'none',
              borderRadius: 8,
              color: '#fff',
              fontSize: 16,
              fontWeight: 700,
              cursor: validationErrors.length > 0 ? 'not-allowed' : 'pointer',
              boxShadow: validationErrors.length > 0 ? 'none' : '0 4px 12px rgba(16, 185, 129, 0.3)',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              if (validationErrors.length === 0) {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 16px rgba(16, 185, 129, 0.4)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = validationErrors.length > 0 ? 'none' : '0 4px 12px rgba(16, 185, 129, 0.3)';
            }}
          >
            🚀 Mint NFT
          </button>
        )}
      </div>

      {/* Info text */}
      <div
        style={{
          marginTop: 20,
          padding: 12,
          background: 'rgba(59, 130, 246, 0.1)',
          border: '1px solid rgba(59, 130, 246, 0.3)',
          borderRadius: 8,
          fontSize: 12,
          color: '#94a3b8',
          lineHeight: 1.5,
        }}
      >
        {isReadyForMint ? (
          <>
            ✅ All collaborators have approved! This project is ready to be minted as an NFT.
          </>
        ) : (
          <>
            ℹ️ All collaborators must approve the current version and revenue split before minting.
          </>
        )}
      </div>
    </div>
  );
}

export default ApprovalStatus;
