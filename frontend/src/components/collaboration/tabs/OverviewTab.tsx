import React, { useState } from 'react';
import { CollaborativeProject, CollaboratorRole, collaborationApi } from '../../../services/collaborationApi';
import RevenueSplitChart from '../RevenueSplitChart';
import { FileText, MessageSquare, Users, Rocket, BookOpen, Loader2 } from 'lucide-react';

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

  const isProjectLead = project.created_by === currentUser.id;

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
      {/* Proposal Summary - Full width */}
      <div style={{
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
                color: '#94a3b8',
                cursor: 'pointer',
                fontSize: 12,
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
                  fontSize: 13,
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
                  color: '#94a3b8',
                  cursor: 'pointer',
                  fontSize: 13,
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <p style={{
            color: project.description ? '#94a3b8' : '#64748b',
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
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Created by</div>
            <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600 }}>
              @{project.created_by_username}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Created on</div>
            <div style={{ fontSize: 13, color: 'var(--text)' }}>
              {new Date(project.created_at).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Content Type</div>
            <div style={{ fontSize: 13, color: 'var(--text)' }}>
              {project.content_type.charAt(0).toUpperCase() + project.content_type.slice(1)}
            </div>
          </div>

          {/* Reading Direction - only for comic projects */}
          {project.content_type === 'comic' && (
            <div>
              <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Reading Direction</div>
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
                      fontSize: 12,
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
                      fontSize: 12,
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
                  fontSize: 13,
                  color: 'var(--text)',
                }}>
                  <BookOpen size={14} style={{ color: '#8b5cf6' }} />
                  {readingDirection === 'rtl' ? 'Right-to-Left (Manga)' : 'Left-to-Right (Western)'}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Revenue Split Chart - Left side (hidden for solo projects) */}
      {!project.is_solo && (
        <div style={{
          gridColumn: 'span 6',
          background: 'var(--panel)',
          border: '1px solid var(--panel-border)',
          borderRadius: 12,
          padding: 24,
        }}>
          <h3 style={{ margin: '0 0 20px', color: 'var(--text)', fontSize: 16, fontWeight: 600 }}>
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
            <div style={{ color: '#64748b', fontSize: 14 }}>
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
              <span style={{ fontSize: 13, color: '#94a3b8' }}>Total</span>
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

      {/* Approval Progress - Right side (hidden for solo projects) */}
      {!project.is_solo && (
        <div style={{
          gridColumn: 'span 6',
          background: 'var(--panel)',
          border: '1px solid var(--panel-border)',
          borderRadius: 12,
          padding: 24,
        }}>
          <h3 style={{ margin: '0 0 20px', color: 'var(--text)', fontSize: 16, fontWeight: 600 }}>
            Approval Progress
          </h3>

          {/* Progress bar */}
          <div style={{ marginBottom: 20 }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: 8,
            }}>
              <span style={{ fontSize: 13, color: '#94a3b8' }}>
                {totalApproved} of {acceptedCollaborators.length} approved
              </span>
              <span style={{
                fontSize: 13,
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
                        : 'linear-gradient(135deg, #64748b 0%, #475569 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontSize: 12,
                      fontWeight: 600,
                    }}>
                      {hasApproved ? '✓' : collab.username.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                        @{collab.username}
                        {collab.user === currentUser.id && (
                          <span style={{ color: '#94a3b8', fontWeight: 400 }}> (you)</span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>
                        {collab.role}
                      </div>
                    </div>
                  </div>
                  <div style={{
                    fontSize: 11,
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
              <div style={{ fontSize: 13, fontWeight: 600, color: '#f59e0b', marginBottom: 8 }}>
                Not ready to mint:
              </div>
              <ul style={{ margin: 0, paddingLeft: 20, fontSize: 12, color: '#94a3b8' }}>
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

      {/* Quick Stats - Full width (hidden for solo projects) */}
      {!project.is_solo && (
        <div style={{
          gridColumn: 'span 12',
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
        }}>
          <StatCard
            label="Sections"
            value={project.sections?.length || 0}
            icon={<FileText size={20} />}
          />
          <StatCard
            label="Comments"
            value={project.recent_comments?.length || 0}
            icon={<MessageSquare size={20} />}
          />
          <StatCard
            label="Team Members"
            value={project.collaborators?.length || 0}
            icon={<Users size={20} />}
          />
          <StatCard
            label="Progress"
            value={`${project.progress_percentage || 0}%`}
            icon={<Rocket size={20} />}
          />
        </div>
      )}
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
        color: '#94a3b8',
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>
          {value}
        </div>
        <div style={{ fontSize: 12, color: '#94a3b8' }}>
          {label}
        </div>
      </div>
    </div>
  );
}
