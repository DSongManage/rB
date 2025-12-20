/**
 * ProjectPreview Component
 * Comprehensive preview system for collaborative projects before minting
 */

import React, { useState, useEffect } from 'react';
import { CollaborativeProject } from '../../services/collaborationApi';
import BookPreview from './BookPreview';
import MusicPreview from './MusicPreview';
import VideoPreview from './VideoPreview';
import ArtPreview from './ArtPreview';
import ApprovalStatus from './ApprovalStatus';
import PreviewExport from './PreviewExport';

interface ProjectPreviewProps {
  project: CollaborativeProject;
  currentUserId: number;
  onApprove?: () => void;
  onRequestReapproval?: () => void;
  onMint?: () => void;
  embedded?: boolean; // If embedded in another component vs standalone page
}

export function ProjectPreview({
  project,
  currentUserId,
  onApprove,
  onRequestReapproval,
  onMint,
  embedded = false,
}: ProjectPreviewProps) {
  const [showApprovalPanel, setShowApprovalPanel] = useState(true);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Validate project is ready for minting
  useEffect(() => {
    validateProject();
  }, [project]);

  const validateProject = () => {
    const errors: string[] = [];

    // Check if all sections are complete
    if (!project.sections || project.sections.length === 0) {
      errors.push('Project has no content sections');
    }

    // Check for empty sections
    const emptySections = project.sections?.filter(s => {
      if (s.section_type === 'text') {
        return !s.content_html || s.content_html.trim() === '';
      }
      return !s.media_file;
    });

    if (emptySections && emptySections.length > 0) {
      errors.push(`${emptySections.length} section(s) are incomplete`);
    }

    // Check all collaborators have approved
    const acceptedCollaborators = project.collaborators?.filter(c => c.status === 'accepted') || [];
    const approvedCollaborators = acceptedCollaborators.filter(
      c => c.approved_current_version && c.approved_revenue_split
    );

    if (approvedCollaborators.length < acceptedCollaborators.length) {
      const pending = acceptedCollaborators.length - approvedCollaborators.length;
      errors.push(`${pending} collaborator(s) haven't approved yet`);
    }

    // Check revenue splits total 100%
    const totalRevenue = project.collaborators?.reduce((sum, c) => sum + c.revenue_percentage, 0) || 0;
    if (Math.abs(totalRevenue - 100) > 0.01) {
      errors.push(`Revenue split totals ${totalRevenue}% (must be 100%)`);
    }

    // Check project has title
    if (!project.title || project.title.trim() === '') {
      errors.push('Project title is required');
    }

    setValidationErrors(errors);
  };

  const isReadyForMint = validationErrors.length === 0 && project.is_fully_approved;

  // Find current user's approval status
  const currentUserRole = project.collaborators?.find(c => c.user === currentUserId);
  const hasUserApproved = Boolean(currentUserRole?.approved_current_version && currentUserRole?.approved_revenue_split);

  // Render content preview based on type
  const renderContentPreview = () => {
    switch (project.content_type) {
      case 'book':
        return <BookPreview project={project} />;
      case 'music':
        return <MusicPreview project={project} />;
      case 'video':
        return <VideoPreview project={project} />;
      case 'art':
        return <ArtPreview project={project} />;
      default:
        return (
          <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
            Unsupported content type: {project.content_type}
          </div>
        );
    }
  };

  return (
    <div
      style={{
        width: '100%',
        height: embedded ? 'auto' : '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg)',
      }}
    >
      {/* Header */}
      {!embedded && (
        <div
          style={{
            padding: '16px 24px',
            background: 'var(--panel)',
            borderBottom: '1px solid var(--panel-border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: 'var(--text)' }}>
              Preview: {project.title}
            </h1>
            <div style={{ marginTop: 4, fontSize: 14, color: '#94a3b8' }}>
              {project.content_type.charAt(0).toUpperCase() + project.content_type.slice(1)} Project
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            {/* Status badge */}
            <div
              style={{
                padding: '6px 12px',
                background: isReadyForMint ? 'rgba(16, 185, 129, 0.1)' : 'rgba(251, 191, 36, 0.1)',
                border: `1px solid ${isReadyForMint ? '#10b981' : '#f59e0b'}`,
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                color: isReadyForMint ? '#10b981' : '#f59e0b',
              }}
            >
              {isReadyForMint ? '✓ Ready to Mint' : '⏳ Pending Approval'}
            </div>

            {/* Toggle approval panel */}
            <button
              onClick={() => setShowApprovalPanel(!showApprovalPanel)}
              style={{
                background: 'transparent',
                border: '1px solid var(--panel-border)',
                borderRadius: 8,
                padding: '8px 16px',
                color: 'var(--text)',
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              {showApprovalPanel ? 'Hide' : 'Show'} Approvals
            </button>
          </div>
        </div>
      )}

      {/* Main content area */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          overflow: 'hidden',
        }}
      >
        {/* Left: Preview content */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: embedded ? 0 : 24,
          }}
        >
          {/* Validation errors */}
          {validationErrors.length > 0 && (
            <div
              style={{
                marginBottom: 24,
                padding: 16,
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid #ef4444',
                borderRadius: 12,
              }}
            >
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: '#ef4444',
                  marginBottom: 8,
                }}
              >
                ⚠️ Issues preventing minting:
              </div>
              <ul style={{ margin: 0, paddingLeft: 20, color: '#f87171' }}>
                {validationErrors.map((error) => (
                  <li key={error} style={{ marginBottom: 4, fontSize: 13 }}>
                    {error}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Content preview */}
          {renderContentPreview()}

          {/* Export options */}
          {!embedded && (
            <div style={{ marginTop: 24 }}>
              <PreviewExport project={project} />
            </div>
          )}
        </div>

        {/* Right: Approval status panel */}
        {showApprovalPanel && (
          <div
            style={{
              width: embedded ? 300 : 380,
              borderLeft: '1px solid var(--panel-border)',
              background: 'var(--panel)',
              overflowY: 'auto',
              padding: 24,
            }}
          >
            <ApprovalStatus
              project={project}
              currentUserId={currentUserId}
              hasUserApproved={hasUserApproved}
              isReadyForMint={isReadyForMint}
              validationErrors={validationErrors}
              onApprove={onApprove}
              onRequestReapproval={onRequestReapproval}
              onMint={onMint}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default ProjectPreview;
