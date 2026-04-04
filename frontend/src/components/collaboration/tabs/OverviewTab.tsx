import React, { useRef, useState } from 'react';
import { CollaborativeProject, CollaboratorRole, collaborationApi } from '../../../services/collaborationApi';
import RevenueSplitChart from '../RevenueSplitChart';
import { EscrowStatusBar } from '../EscrowStatusBar';
import { MilestoneTimeline } from '../MilestoneTimeline';
import { EscrowFundingModal } from '../EscrowFundingModal';
import { FileText, MessageSquare, Users, Rocket, BookOpen, Loader2, Upload, ImageIcon, Trash2, Shield, DollarSign, Check } from 'lucide-react';

interface User {
  id: number;
  username: string;
  display_name?: string;
}

interface OverviewTabProps {
  project: CollaborativeProject;
  currentUser: User;
  onProjectUpdate?: (project: CollaborativeProject) => void;
}

export default function OverviewTab({
  project,
  currentUser,
  onProjectUpdate,
}: OverviewTabProps) {
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [description, setDescription] = useState(project.description || '');
  const [readingDirection, setReadingDirection] = useState<'ltr' | 'rtl'>(project.reading_direction || 'ltr');
  const [savingReadingDirection, setSavingReadingDirection] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [fundingModalRole, setFundingModalRole] = useState<CollaboratorRole | null>(null);

  const isProjectLead = project.created_by === currentUser.id;
  const collaborators = project.collaborators || [];
  const escrowCollaborators = collaborators.filter(c => c.contract_type && c.contract_type !== 'revenue_share');

  // Handle reading direction change
  const handleReadingDirectionChange = async (newDirection: 'ltr' | 'rtl') => {
    if (newDirection === readingDirection || savingReadingDirection) return;

    setSavingReadingDirection(true);
    try {
      const updated = await collaborationApi.updateCollaborativeProject(project.id, {
        reading_direction: newDirection,
      } as any);
      setReadingDirection(newDirection);
      if (onProjectUpdate) {
        onProjectUpdate({ ...project, reading_direction: newDirection });
      }
    } catch (err) {
      console.error('Failed to update reading direction:', err);
      // Revert on error
      setReadingDirection(readingDirection);
    } finally {
      setSavingReadingDirection(false);
    }
  };
  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingCover(true);
    try {
      const updated = await collaborationApi.uploadCoverImage(project.id, file);
      onProjectUpdate?.(updated);
    } catch (err) {
      console.error('Failed to upload cover image:', err);
    } finally {
      setUploadingCover(false);
      if (coverInputRef.current) coverInputRef.current.value = '';
    }
  };

  const handleCoverRemove = async () => {
    setUploadingCover(true);
    try {
      const updated = await collaborationApi.uploadCoverImage(project.id, null);
      onProjectUpdate?.(updated);
    } catch (err) {
      console.error('Failed to remove cover image:', err);
    } finally {
      setUploadingCover(false);
    }
  };

  const acceptedCollaborators = project.collaborators?.filter(c => c.status === 'accepted') || [];

  // Check if collaborator is fully ready (approved + warranty acknowledged)
  const isCollaboratorReady = (c: CollaboratorRole) =>
    c.approved_current_version &&
    c.approved_revenue_split &&
    c.warranty_of_originality_acknowledged !== false;

  const totalApproved = acceptedCollaborators.filter(isCollaboratorReady).length;

  // Use can_mint_status for accurate "ready to mint" status
  const canMint = project.can_mint_status?.can_mint ?? false;
  const mintBlockers = project.can_mint_status?.blockers ?? [];

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(12, 1fr)',
      gap: 20,
    }}>
      {/* Cover Art */}
      <div style={{
        gridColumn: project.content_type === 'art' && project.is_solo ? 'span 12' : 'span 6',
        background: 'var(--panel)',
        border: '1px solid var(--panel-border)',
        borderRadius: 12,
        padding: 24,
      }}>
        <h3 style={{ margin: '0 0 4px', color: 'var(--text)', fontSize: 18, fontWeight: 600 }}>
          {project.content_type === 'art' ? 'Cover Image' : 'Cover Art'}
        </h3>
        <p style={{ margin: '0 0 16px', color: 'var(--text-muted)', fontSize: 14 }}>
          This image represents your project in the marketplace
        </p>
        <input
          ref={coverInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          style={{ display: 'none' }}
          onChange={handleCoverUpload}
        />
        {project.cover_image ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <img
              src={project.cover_image}
              alt={project.content_type === 'art' ? 'Artwork' : 'Cover art'}
              style={{
                maxWidth: 320,
                maxHeight: 400,
                borderRadius: 8,
                border: '1px solid var(--panel-border)',
                objectFit: 'contain',
              }}
            />
            {isProjectLead && (
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => coverInputRef.current?.click()}
                  disabled={uploadingCover}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    background: 'transparent',
                    border: '1px solid var(--panel-border)',
                    borderRadius: 6,
                    padding: '6px 14px',
                    color: 'var(--text-muted)',
                    cursor: uploadingCover ? 'wait' : 'pointer',
                    fontSize: 14,
                  }}
                >
                  {uploadingCover ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Upload size={14} />}
                  Replace
                </button>
                <button
                  onClick={handleCoverRemove}
                  disabled={uploadingCover}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    background: 'transparent',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: 6,
                    padding: '6px 14px',
                    color: '#ef4444',
                    cursor: uploadingCover ? 'wait' : 'pointer',
                    fontSize: 14,
                  }}
                >
                  <Trash2 size={14} />
                  Remove
                </button>
              </div>
            )}
          </div>
        ) : (
          <div
            onClick={isProjectLead && !uploadingCover ? () => coverInputRef.current?.click() : undefined}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 12,
              padding: 20,
              border: '2px dashed var(--panel-border)',
              borderRadius: 8,
              cursor: isProjectLead ? 'pointer' : 'default',
              transition: 'border-color 0.2s ease',
            }}
          >
            {uploadingCover ? (
              <Loader2 size={32} style={{ color: 'var(--subtle)', animation: 'spin 1s linear infinite' }} />
            ) : (
              <ImageIcon size={32} style={{ color: 'var(--subtle)' }} />
            )}
            <span style={{ fontSize: 14, color: 'var(--subtle)' }}>
              {isProjectLead
                ? (project.content_type === 'art' ? 'Click to upload a cover image' : 'Click to upload cover art')
                : (project.content_type === 'art' ? 'No cover image uploaded' : 'No cover art uploaded')}
            </span>
            {isProjectLead && (
              <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>
                PNG, JPEG, or WebP
              </span>
            )}
          </div>
        )}

        {project.content_type === 'art' && project.is_solo && (
          <div style={{
            marginTop: 16,
            padding: '10px 14px',
            background: 'rgba(245, 158, 11, 0.08)',
            border: '1px solid rgba(245, 158, 11, 0.25)',
            borderRadius: 8,
            fontSize: 14,
            color: '#f59e0b',
          }}>
            Upload your artwork in the <strong>Gallery</strong> tab
          </div>
        )}
      </div>

      {/* Proposal Summary - Full width (hidden for solo art projects) */}
      {!(project.content_type === 'art' && project.is_solo) && <div style={{
        gridColumn: 'span 12',
        background: 'var(--panel)',
        border: '1px solid var(--panel-border)',
        borderRadius: 12,
        padding: 24,
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 16,
        }}>
          <h3 style={{ margin: 0, color: 'var(--text)', fontSize: 18, fontWeight: 600 }}>
            Project Proposal
          </h3>
          {isProjectLead && !isEditingDescription && (
            <button
              onClick={() => setIsEditingDescription(true)}
              style={{
                background: 'transparent',
                border: '1px solid var(--panel-border)',
                borderRadius: 6,
                padding: '6px 12px',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: 13,
              }}
            >
              Edit
            </button>
          )}
        </div>

        {isEditingDescription ? (
          <div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your project proposal, goals, and expectations..."
              style={{
                width: '100%',
                minHeight: 120,
                padding: 12,
                background: 'var(--bg)',
                border: '1px solid var(--panel-border)',
                borderRadius: 8,
                color: 'var(--text)',
                fontSize: 14,
                lineHeight: 1.6,
                resize: 'vertical',
              }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button
                onClick={() => {
                  // TODO: Save description via API
                  setIsEditingDescription(false);
                }}
                style={{
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  border: 'none',
                  borderRadius: 6,
                  padding: '8px 16px',
                  color: '#fff',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: 14,
                }}
              >
                Save
              </button>
              <button
                onClick={() => {
                  setDescription(project.description || '');
                  setIsEditingDescription(false);
                }}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--panel-border)',
                  borderRadius: 6,
                  padding: '8px 16px',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: 14,
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <p style={{
            color: project.description ? '#94a3b8' : 'var(--subtle)',
            fontSize: 14,
            margin: 0,
            lineHeight: 1.7,
            fontStyle: project.description ? 'normal' : 'italic',
          }}>
            {project.description || 'No description provided. Click Edit to add one.'}
          </p>
        )}

        <div style={{
          display: 'flex',
          gap: 24,
          marginTop: 20,
          paddingTop: 16,
          borderTop: '1px solid var(--panel-border)',
        }}>
          <div>
            <div style={{ fontSize: 13, color: 'var(--subtle)', marginBottom: 4 }}>Created by</div>
            <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 600 }}>
              @{project.created_by_username}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 13, color: 'var(--subtle)', marginBottom: 4 }}>Created on</div>
            <div style={{ fontSize: 14, color: 'var(--text)' }}>
              {new Date(project.created_at).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 13, color: 'var(--subtle)', marginBottom: 4 }}>Content Type</div>
            <div style={{ fontSize: 14, color: 'var(--text)' }}>
              {project.content_type.charAt(0).toUpperCase() + project.content_type.slice(1)}
            </div>
          </div>

          {/* Reading Direction - only for comic projects */}
          {project.content_type === 'comic' && (
            <div>
              <div style={{ fontSize: 13, color: 'var(--subtle)', marginBottom: 4 }}>Reading Direction</div>
              {isProjectLead ? (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button
                    onClick={() => handleReadingDirectionChange('ltr')}
                    disabled={savingReadingDirection}
                    style={{
                      padding: '6px 12px',
                      background: readingDirection === 'ltr'
                        ? 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)'
                        : 'var(--bg)',
                      border: readingDirection === 'ltr'
                        ? '1px solid #8b5cf6'
                        : '1px solid var(--panel-border)',
                      borderRadius: 6,
                      color: readingDirection === 'ltr' ? '#fff' : '#94a3b8',
                      fontSize: 13,
                      fontWeight: readingDirection === 'ltr' ? 600 : 400,
                      cursor: savingReadingDirection ? 'wait' : 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    LTR (Western)
                  </button>
                  <button
                    onClick={() => handleReadingDirectionChange('rtl')}
                    disabled={savingReadingDirection}
                    style={{
                      padding: '6px 12px',
                      background: readingDirection === 'rtl'
                        ? 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)'
                        : 'var(--bg)',
                      border: readingDirection === 'rtl'
                        ? '1px solid #8b5cf6'
                        : '1px solid var(--panel-border)',
                      borderRadius: 6,
                      color: readingDirection === 'rtl' ? '#fff' : '#94a3b8',
                      fontSize: 13,
                      fontWeight: readingDirection === 'rtl' ? 600 : 400,
                      cursor: savingReadingDirection ? 'wait' : 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    RTL (Manga)
                  </button>
                  {savingReadingDirection && (
                    <Loader2 size={14} style={{ color: '#8b5cf6', animation: 'spin 1s linear infinite' }} />
                  )}
                </div>
              ) : (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 14,
                  color: 'var(--text)',
                }}>
                  <BookOpen size={14} style={{ color: '#8b5cf6' }} />
                  {readingDirection === 'rtl' ? 'Right-to-Left (Manga)' : 'Left-to-Right (Western)'}
                </div>
              )}
            </div>
          )}
        </div>
      </div>}

      {/* Project Complete banner */}
      {escrowCollaborators.length > 0 &&
       escrowCollaborators.every(c => c.tasks_total > 0 && c.tasks_signed_off === c.tasks_total) && (
        <div style={{
          gridColumn: 'span 12',
          padding: '20px 24px',
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(139, 92, 246, 0.08) 100%)',
          border: '1px solid rgba(16, 185, 129, 0.25)',
          borderRadius: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 16,
        }}>
          <div style={{
            width: 48, height: 48, borderRadius: '50%',
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Check size={24} style={{ color: '#fff' }} />
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#10b981' }}>
              Project Complete
            </div>
            <div style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 2 }}>
              All milestones signed off and escrow fully released. This project is ready to publish.
            </div>
          </div>
        </div>
      )}

      {/* Escrow Contracts Section */}
      {escrowCollaborators.length > 0 && (
        <div style={{
          gridColumn: 'span 12',
          background: 'var(--panel)',
          border: '1px solid var(--panel-border)',
          borderRadius: 12,
          padding: 24,
        }}>
          <h3 style={{ margin: '0 0 20px', color: 'var(--text)', fontSize: 18, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Shield size={20} style={{ color: '#8b5cf6' }} /> Escrow Contracts
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {escrowCollaborators.map((collab) => (
              <div key={collab.id}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  alignItems: 'center', marginBottom: 8,
                }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
                    @{collab.username} — {collab.effective_role_name || collab.role}
                  </span>
                  <span style={{
                    fontSize: 13, padding: '3px 8px', borderRadius: 6,
                    background: '#8b5cf620', color: '#a78bfa', fontWeight: 600,
                    textTransform: 'capitalize',
                  }}>
                    {collab.contract_type?.replace('_', ' ')}
                  </span>
                </div>

                {collab.escrow_funding_deadline && parseFloat(collab.escrow_funded_amount) < parseFloat(collab.total_contract_amount) && (
                  <div style={{
                    marginBottom: 8, padding: 8, borderRadius: 6,
                    background: 'rgba(245, 158, 11, 0.08)', fontSize: 13, color: '#f59e0b',
                  }}>
                    Start date: {new Date(collab.escrow_funding_deadline).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                    {' — '}escrow must be funded by this date
                  </div>
                )}

                <EscrowStatusBar
                  contractType={collab.contract_type as 'work_for_hire' | 'hybrid'}
                  totalAmount={collab.total_contract_amount}
                  fundedAmount={collab.escrow_funded_amount}
                  releasedAmount={collab.escrow_released_amount}
                  remaining={collab.escrow_remaining}
                  trustPhase={collab.trust_phase}
                  trustPagesCompleted={collab.trust_pages_completed}
                  fundedAt={collab.escrow_funded_at}
                />

                {/* Fund Escrow button (owner only, unfunded) */}
                {isProjectLead && parseFloat(collab.escrow_funded_amount) < parseFloat(collab.total_contract_amount) && (
                  <button
                    onClick={() => setFundingModalRole(collab)}
                    style={{
                      marginTop: 8, width: '100%', padding: '10px 16px',
                      borderRadius: 8, border: 'none', cursor: 'pointer',
                      background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
                      color: '#fff', fontSize: 14, fontWeight: 600,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    }}
                  >
                    <DollarSign size={14} /> Fund Escrow
                  </button>
                )}

                {/* Milestone Timeline */}
                {collab.contract_tasks && collab.contract_tasks.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <MilestoneTimeline
                      tasks={collab.contract_tasks}
                      trustPhase={collab.trust_phase}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Escrow Funding Modal */}
      {fundingModalRole && (
        <EscrowFundingModal
          isOpen={true}
          onClose={() => setFundingModalRole(null)}
          onFunded={async () => {
            const updatedProject = await collaborationApi.getCollaborativeProject(project.id);
            onProjectUpdate?.(updatedProject);
          }}
          projectId={project.id}
          collaborator={fundingModalRole}
        />
      )}

      {/* Revenue Split Chart - Left side (hidden for solo projects and pure work-for-hire) */}
      {!project.is_solo && project.collaborators?.some(c => c.contract_type !== 'work_for_hire' && c.revenue_percentage > 0 && c.role !== 'Project Lead') && (
        <div style={{
          gridColumn: 'span 6',
          background: 'var(--panel)',
          border: '1px solid var(--panel-border)',
          borderRadius: 12,
          padding: 24,
        }}>
          <h3 style={{ margin: '0 0 20px', color: 'var(--text)', fontSize: 18, fontWeight: 600 }}>
            Revenue Split
          </h3>
          {project.collaborators && project.collaborators.length > 0 ? (
            <RevenueSplitChart
              collaborators={project.collaborators.map(c => ({
                id: c.id,
                username: c.username,
                role: c.role,
                revenue_percentage: c.revenue_percentage,
              }))}
              size={180}
            />
          ) : (
            <div style={{ color: 'var(--subtle)', fontSize: 14 }}>
              No collaborators yet.
            </div>
          )}

          {/* Total check */}
          {project.collaborators && (
            <div style={{
              marginTop: 20,
              padding: 12,
              background: 'var(--bg)',
              borderRadius: 8,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>Total</span>
              <span style={{
                fontSize: 16,
                fontWeight: 700,
                color: project.collaborators.reduce((sum, c) => sum + Number(c.revenue_percentage), 0) === 100
                  ? '#10b981'
                  : '#ef4444',
              }}>
                {project.collaborators.reduce((sum, c) => sum + Number(c.revenue_percentage), 0).toFixed(2)}%
              </span>
            </div>
          )}
        </div>
      )}

      {/* Approval Progress (hidden for solo projects and pure work-for-hire where escrow is the approval) */}
      {!project.is_solo && project.collaborators?.some(c => c.contract_type !== 'work_for_hire' && c.role !== 'Project Lead') && (
        <div style={{
          gridColumn: project.collaborators?.some(c => c.contract_type !== 'work_for_hire' && c.revenue_percentage > 0 && c.role !== 'Project Lead') ? 'span 6' : 'span 12',
          background: 'var(--panel)',
          border: '1px solid var(--panel-border)',
          borderRadius: 12,
          padding: 24,
        }}>
          <h3 style={{ margin: '0 0 20px', color: 'var(--text)', fontSize: 18, fontWeight: 600 }}>
            Approval Progress
          </h3>

          {/* Progress bar */}
          <div style={{ marginBottom: 20 }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: 8,
            }}>
              <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>
                {totalApproved} of {acceptedCollaborators.length} approved
              </span>
              <span style={{
                fontSize: 14,
                fontWeight: 600,
                color: project.is_fully_approved ? '#10b981' : '#f59e0b',
              }}>
                {acceptedCollaborators.length > 0
                  ? Math.round((totalApproved / acceptedCollaborators.length) * 100)
                  : 0}%
              </span>
            </div>
            <div style={{
              height: 8,
              background: 'var(--bg)',
              borderRadius: 4,
              overflow: 'hidden',
            }}>
              <div style={{
                height: '100%',
                width: acceptedCollaborators.length > 0
                  ? `${(totalApproved / acceptedCollaborators.length) * 100}%`
                  : '0%',
                background: project.is_fully_approved
                  ? 'linear-gradient(90deg, #10b981 0%, #059669 100%)'
                  : 'linear-gradient(90deg, #f59e0b 0%, #d97706 100%)',
                borderRadius: 4,
                transition: 'width 0.3s ease',
              }} />
            </div>
          </div>

          {/* Collaborator approval status */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {acceptedCollaborators.map(collab => {
              const hasApproved = isCollaboratorReady(collab);
              return (
                <div
                  key={collab.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    background: hasApproved ? 'rgba(16, 185, 129, 0.1)' : 'var(--bg)',
                    border: `1px solid ${hasApproved ? 'rgba(16, 185, 129, 0.2)' : 'var(--panel-border)'}`,
                    borderRadius: 8,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      background: hasApproved
                        ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                        : 'linear-gradient(135deg, var(--subtle) 0%, var(--text-dim) 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontSize: 13,
                      fontWeight: 600,
                    }}>
                      {hasApproved ? '✓' : collab.username.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
                        @{collab.username}
                        {collab.user === currentUser.id && (
                          <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> (you)</span>
                        )}
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                        {collab.role}
                      </div>
                    </div>
                  </div>
                  <div style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: hasApproved ? '#10b981' : '#f59e0b',
                    background: hasApproved ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                    padding: '4px 8px',
                    borderRadius: 4,
                  }}>
                    {hasApproved ? 'Approved' : 'Pending'}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Mint readiness badge */}
          {canMint ? (
            <div style={{
              marginTop: 16,
              padding: 12,
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid #10b981',
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}>
              <span style={{ fontSize: 18 }}>&#10003;</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#10b981' }}>
                Fully Approved - Ready to Mint!
              </span>
            </div>
          ) : mintBlockers.length > 0 && (
            <div style={{
              marginTop: 16,
              padding: 12,
              background: 'rgba(245, 158, 11, 0.1)',
              border: '1px solid #f59e0b',
              borderRadius: 8,
            }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#f59e0b', marginBottom: 8 }}>
                Not ready to mint:
              </div>
              <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: 'var(--text-muted)' }}>
                {mintBlockers.slice(0, 3).map((blocker, i) => (
                  <li key={i}>{blocker}</li>
                ))}
                {mintBlockers.length > 3 && (
                  <li>...and {mintBlockers.length - 3} more</li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Quick Stats removed — sections/comments/progress were always 0 for comics */}
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--panel)',
      border: '1px solid var(--panel-border)',
      borderRadius: 12,
      padding: 16,
      display: 'flex',
      alignItems: 'center',
      gap: 12,
    }}>
      <div style={{
        width: 40,
        height: 40,
        borderRadius: 8,
        background: 'var(--bg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--text-muted)',
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>
          {value}
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          {label}
        </div>
      </div>
    </div>
  );
}
