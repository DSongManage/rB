/**
 * MintingWorkflow Component
 * Democratic approval and minting workflow for collaborative projects
 */

import React, { useState, useEffect } from 'react';
import { CollaborativeProject } from '../../services/collaborationApi';
import ApprovalRequestModal from './ApprovalRequestModal';
import IndividualApprovalView from './IndividualApprovalView';
import MintingProgressModal from './MintingProgressModal';

interface MintingWorkflowProps {
  project: CollaborativeProject;
  currentUserId: number;
  onApprovalRequest?: () => void;
  onApprove?: () => void;
  onMint?: () => Promise<void>;
}

interface ChecklistItem {
  id: string;
  label: string;
  checked: boolean;
  required: boolean;
}

export function MintingWorkflow({
  project,
  currentUserId,
  onApprovalRequest,
  onApprove,
  onMint,
}: MintingWorkflowProps) {
  const [showApprovalRequestModal, setShowApprovalRequestModal] = useState(false);
  const [showApprovalView, setShowApprovalView] = useState(false);
  const [showMintingProgress, setShowMintingProgress] = useState(false);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);

  const isProjectCreator = project.created_by === currentUserId;
  const acceptedCollaborators = project.collaborators?.filter(c => c.status === 'accepted') || [];
  const approvedCollaborators = acceptedCollaborators.filter(
    c => c.approved_current_version && c.approved_revenue_split
  );
  const pendingCollaborators = acceptedCollaborators.filter(
    c => !c.approved_current_version || !c.approved_revenue_split
  );

  const currentUserRole = acceptedCollaborators.find(c => c.user === currentUserId);
  const hasUserApproved = currentUserRole?.approved_current_version && currentUserRole?.approved_revenue_split;

  const approvalProgress = acceptedCollaborators.length > 0
    ? approvedCollaborators.length / acceptedCollaborators.length
    : 0;

  // Build checklist
  useEffect(() => {
    const items: ChecklistItem[] = [];

    // Check sections
    const hasContent = project.sections && project.sections.length > 0;
    const allSectionsComplete = project.sections?.every(s => {
      if (s.section_type === 'text') {
        return s.content_html && s.content_html.trim() !== '';
      }
      return !!s.media_file;
    }) ?? false;

    items.push({
      id: 'sections',
      label: 'All sections completed',
      checked: hasContent && allSectionsComplete,
      required: true,
    });

    // Check revenue splits
    const totalRevenue = project.collaborators?.reduce((sum, c) => sum + c.revenue_percentage, 0) || 0;
    const revenueSplitsCorrect = Math.abs(totalRevenue - 100) < 0.01;

    items.push({
      id: 'revenue',
      label: 'Revenue splits agreed (totals 100%)',
      checked: revenueSplitsCorrect,
      required: true,
    });

    // Check collaborators
    const allCollaboratorsAccepted = project.collaborators?.every(c => c.status === 'accepted') ?? true;

    items.push({
      id: 'collaborators',
      label: 'All collaborators invited/accepted',
      checked: allCollaboratorsAccepted,
      required: true,
    });

    // Check approvals
    const allApproved = project.is_fully_approved;

    items.push({
      id: 'approvals',
      label: 'Approval from all collaborators',
      checked: allApproved,
      required: true,
    });

    setChecklist(items);
  }, [project]);

  const allRequiredChecked = checklist.filter(i => i.required).every(i => i.checked);
  const canRequestApproval = checklist.slice(0, 3).every(i => i.checked) && !hasUserApproved;
  const canMint = allRequiredChecked && project.is_fully_approved;
  const canForceMint = isProjectCreator && checklist.slice(0, 3).every(i => i.checked);

  // Handle minting
  const handleMint = async () => {
    if (!canMint) return;

    const confirmed = confirm(
      'Are you sure you want to mint this project as an NFT? This action cannot be undone.'
    );

    if (!confirmed) return;

    setShowMintingProgress(true);
    try {
      if (onMint) {
        await onMint();
      }
    } catch (error) {
      console.error('Minting failed:', error);
    }
  };

  // Handle force mint (creator only)
  const handleForceMint = async () => {
    if (!canForceMint) return;

    const confirmed = confirm(
      `WARNING: Force minting will proceed without approval from all collaborators.\n\n` +
      `${pendingCollaborators.length} collaborator(s) haven't approved yet.\n\n` +
      `Are you sure you want to continue?`
    );

    if (!confirmed) return;

    setShowMintingProgress(true);
    try {
      if (onMint) {
        await onMint();
      }
    } catch (error) {
      console.error('Force minting failed:', error);
    }
  };

  return (
    <div
      style={{
        background: 'var(--panel)',
        border: '1px solid var(--panel-border)',
        borderRadius: 12,
        padding: 24,
      }}
    >
      <h2
        style={{
          margin: 0,
          marginBottom: 20,
          fontSize: 20,
          fontWeight: 700,
          color: 'var(--text)',
        }}
      >
        Ready to Mint?
      </h2>

      {/* Pre-mint checklist */}
      <div style={{ marginBottom: 24 }}>
        <h3
          style={{
            margin: 0,
            marginBottom: 12,
            fontSize: 14,
            fontWeight: 700,
            color: 'var(--text)',
          }}
        >
          Pre-mint Checklist:
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {checklist.map((item) => (
            <div
              key={item.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: 10,
                background: item.checked ? 'rgba(16, 185, 129, 0.1)' : 'rgba(100, 116, 139, 0.1)',
                border: `1px solid ${item.checked ? '#10b981' : '#334155'}`,
                borderRadius: 8,
              }}
            >
              <span style={{ fontSize: 16 }}>
                {item.checked ? '✅' : '⏳'}
              </span>
              <span
                style={{
                  fontSize: 13,
                  color: item.checked ? '#10b981' : '#94a3b8',
                  fontWeight: 600,
                }}
              >
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Approval progress */}
      <div style={{ marginBottom: 24 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 8,
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
            Approval Progress:
          </span>
          <span
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: project.is_fully_approved ? '#10b981' : '#f59e0b',
            }}
          >
            {approvedCollaborators.length} / {acceptedCollaborators.length}
          </span>
        </div>

        {/* Progress bar */}
        <div
          style={{
            height: 8,
            background: '#1e293b',
            borderRadius: 4,
            overflow: 'hidden',
            marginBottom: 12,
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${approvalProgress * 100}%`,
              background: project.is_fully_approved
                ? 'linear-gradient(90deg, #10b981 0%, #059669 100%)'
                : 'linear-gradient(90deg, #f59e0b 0%, #d97706 100%)',
              transition: 'width 0.3s',
            }}
          />
        </div>

        {/* Collaborator approval list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {acceptedCollaborators.map((collab) => {
            const approved = collab.approved_current_version && collab.approved_revenue_split;
            const isCurrentUser = collab.user === currentUserId;

            return (
              <div
                key={collab.id}
                style={{
                  padding: 10,
                  background: approved ? 'rgba(16, 185, 129, 0.1)' : 'rgba(251, 191, 36, 0.1)',
                  border: `1px solid ${approved ? 'rgba(16, 185, 129, 0.3)' : 'rgba(251, 191, 36, 0.3)'}`,
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <span style={{ fontSize: 16 }}>
                  {approved ? '✅' : '⏳'}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                    @{collab.username}
                    {isCurrentUser && ' (you)'}
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>
                    {collab.role}
                  </div>
                </div>
                {!approved && isCurrentUser && (
                  <button
                    onClick={() => setShowApprovalView(true)}
                    style={{
                      padding: '4px 12px',
                      background: '#3b82f6',
                      border: 'none',
                      borderRadius: 6,
                      color: '#fff',
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Approve
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Warning */}
      <div
        style={{
          marginBottom: 24,
          padding: 12,
          background: 'rgba(251, 191, 36, 0.1)',
          border: '1px solid #f59e0b',
          borderRadius: 8,
          fontSize: 12,
          color: '#f59e0b',
          lineHeight: 1.5,
        }}
      >
        ⚠️ <strong>Note:</strong> Once minting starts, content cannot be changed. Make sure everything is perfect!
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Request approval button */}
        {canRequestApproval && (
          <button
            onClick={() => setShowApprovalRequestModal(true)}
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
            }}
          >
            📨 Request Approval
          </button>
        )}

        {/* Approve button (if not approved) */}
        {!hasUserApproved && checklist.slice(0, 3).every(i => i.checked) && (
          <button
            onClick={() => setShowApprovalView(true)}
            style={{
              width: '100%',
              padding: '12px 20px',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              border: 'none',
              borderRadius: 8,
              color: '#fff',
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
            }}
          >
            ✓ Approve Project
          </button>
        )}

        {/* Mint button */}
        {canMint && (
          <button
            onClick={handleMint}
            style={{
              width: '100%',
              padding: '16px 20px',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              border: 'none',
              borderRadius: 8,
              color: '#fff',
              fontSize: 16,
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 6px 16px rgba(16, 185, 129, 0.4)',
            }}
          >
            🚀 Mint NFT
          </button>
        )}

        {/* Force mint button (creator only) */}
        {!canMint && canForceMint && isProjectCreator && pendingCollaborators.length > 0 && (
          <button
            onClick={handleForceMint}
            style={{
              width: '100%',
              padding: '12px 20px',
              background: 'transparent',
              border: '1px solid #ef4444',
              borderRadius: 8,
              color: '#ef4444',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            ⚠️ Force Mint (Creator Override)
          </button>
        )}
      </div>

      {/* Modals */}
      {showApprovalRequestModal && (
        <ApprovalRequestModal
          project={project}
          pendingCollaborators={pendingCollaborators}
          onClose={() => setShowApprovalRequestModal(false)}
          onSubmit={() => {
            setShowApprovalRequestModal(false);
            if (onApprovalRequest) onApprovalRequest();
          }}
        />
      )}

      {showApprovalView && (
        <IndividualApprovalView
          project={project}
          currentUserId={currentUserId}
          onClose={() => setShowApprovalView(false)}
          onApprove={() => {
            setShowApprovalView(false);
            if (onApprove) onApprove();
          }}
        />
      )}

      {showMintingProgress && (
        <MintingProgressModal
          project={project}
          onClose={() => setShowMintingProgress(false)}
        />
      )}
    </div>
  );
}

export default MintingWorkflow;
