import React, { useState } from 'react';
import {
  CollaborativeProject,
  CollaboratorRole,
  collaborationApi,
} from '../../../services/collaborationApi';
import { TeamOverview } from '../TeamOverview';

interface User {
  id: number;
  username: string;
  display_name?: string;
}

interface TeamTabProps {
  project: CollaborativeProject;
  currentUser: User;
  onProjectUpdate?: (project: CollaborativeProject) => void;
}

export default function TeamTab({
  project,
  currentUser,
  onProjectUpdate,
}: TeamTabProps) {
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteUserId, setInviteUserId] = useState('');
  const [inviteRole, setInviteRole] = useState('');
  const [invitePercentage, setInvitePercentage] = useState(10);
  const [inviteError, setInviteError] = useState('');
  const [inviting, setInviting] = useState(false);

  const isProjectLead = project.created_by === currentUser.id;
  const sections = project.sections || [];
  const collaborators = project.collaborators || [];

  // Calculate remaining percentage available
  const usedPercentage = collaborators.reduce((sum, c) => sum + c.revenue_percentage, 0);
  const availablePercentage = 100 - usedPercentage;

  const handleInvite = async () => {
    const userId = parseInt(inviteUserId.trim(), 10);
    if (!userId || isNaN(userId)) {
      setInviteError('Please enter a valid user ID');
      return;
    }
    if (!inviteRole.trim()) {
      setInviteError('Please enter a role');
      return;
    }
    if (invitePercentage <= 0 || invitePercentage > availablePercentage) {
      setInviteError(`Percentage must be between 1 and ${availablePercentage}%`);
      return;
    }

    setInviting(true);
    setInviteError('');

    try {
      await collaborationApi.inviteCollaborator(project.id, {
        user_id: userId,
        role: inviteRole.trim(),
        revenue_percentage: invitePercentage,
        can_edit_text: true,
        can_edit_images: true,
        can_edit_audio: true,
        can_edit_video: true,
      });

      // Refresh project data
      const updatedProject = await collaborationApi.getCollaborativeProject(project.id);
      onProjectUpdate?.(updatedProject);
      setShowInviteForm(false);
      setInviteUserId('');
      setInviteRole('');
      setInvitePercentage(10);
    } catch (err: any) {
      setInviteError(err.message || 'Failed to invite collaborator');
    } finally {
      setInviting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header with Invite Button */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <h2 style={{ margin: 0, color: 'var(--text)', fontSize: 20 }}>
          Team Members
        </h2>
        {isProjectLead && (
          <button
            onClick={() => setShowInviteForm(!showInviteForm)}
            style={{
              background: showInviteForm
                ? 'transparent'
                : 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
              border: showInviteForm ? '1px solid var(--panel-border)' : 'none',
              borderRadius: 8,
              padding: '10px 20px',
              color: showInviteForm ? '#94a3b8' : '#fff',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            {showInviteForm ? 'Cancel' : '+ Invite Collaborator'}
          </button>
        )}
      </div>

      {/* Invite Form */}
      {showInviteForm && (
        <div style={{
          background: 'var(--panel)',
          border: '1px solid var(--panel-border)',
          borderRadius: 12,
          padding: 24,
        }}>
          <h3 style={{ margin: '0 0 16px', color: 'var(--text)', fontSize: 16 }}>
            Invite New Collaborator
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: '#94a3b8', marginBottom: 6 }}>
                User ID
              </label>
              <input
                type="text"
                value={inviteUserId}
                onChange={(e) => setInviteUserId(e.target.value)}
                placeholder="Enter user ID"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: 'var(--bg)',
                  border: '1px solid var(--panel-border)',
                  borderRadius: 8,
                  color: 'var(--text)',
                  fontSize: 14,
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: '#94a3b8', marginBottom: 6 }}>
                Role
              </label>
              <input
                type="text"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                placeholder="e.g. Illustrator, Editor, Co-Author"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: 'var(--bg)',
                  border: '1px solid var(--panel-border)',
                  borderRadius: 8,
                  color: 'var(--text)',
                  fontSize: 14,
                }}
              />
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <label style={{ display: 'block', fontSize: 12, color: '#94a3b8', marginBottom: 6 }}>
              Revenue Split: {invitePercentage}%
              <span style={{ color: '#64748b', marginLeft: 8 }}>
                (Available: {availablePercentage}%)
              </span>
            </label>
            <input
              type="range"
              min={1}
              max={availablePercentage}
              value={invitePercentage}
              onChange={(e) => setInvitePercentage(Number(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>

          {/* Permissions */}
          <div style={{ marginTop: 16 }}>
            <label style={{ display: 'block', fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>
              Permissions
            </label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {['Text', 'Images', 'Audio', 'Video'].map((perm) => (
                <span
                  key={perm}
                  style={{
                    background: 'rgba(139, 92, 246, 0.1)',
                    color: '#8b5cf6',
                    padding: '4px 10px',
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 500,
                  }}
                >
                  {perm}
                </span>
              ))}
            </div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 6 }}>
              Default: All content types. You can customize permissions after inviting.
            </div>
          </div>

          {inviteError && (
            <div style={{
              marginTop: 16,
              padding: 12,
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid #ef4444',
              borderRadius: 8,
              color: '#ef4444',
              fontSize: 13,
            }}>
              {inviteError}
            </div>
          )}

          <div style={{ marginTop: 20, display: 'flex', gap: 12 }}>
            <button
              onClick={handleInvite}
              disabled={inviting}
              style={{
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                border: 'none',
                borderRadius: 8,
                padding: '10px 24px',
                color: '#fff',
                fontWeight: 600,
                cursor: inviting ? 'not-allowed' : 'pointer',
                fontSize: 14,
                opacity: inviting ? 0.7 : 1,
              }}
            >
              {inviting ? 'Inviting...' : 'Send Invitation'}
            </button>
            <button
              onClick={() => setShowInviteForm(false)}
              style={{
                background: 'transparent',
                border: '1px solid var(--panel-border)',
                borderRadius: 8,
                padding: '10px 24px',
                color: '#94a3b8',
                cursor: 'pointer',
                fontSize: 14,
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Team Overview Component */}
      <TeamOverview
        collaborators={collaborators}
        sections={sections}
        projectCreatorId={project.created_by}
      />

      {/* Permission Matrix */}
      <div style={{
        background: 'var(--panel)',
        border: '1px solid var(--panel-border)',
        borderRadius: 12,
        padding: 24,
      }}>
        <h3 style={{ margin: '0 0 16px', color: 'var(--text)', fontSize: 16 }}>
          Permission Matrix
        </h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: 13,
          }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--panel-border)' }}>
                <th style={{ textAlign: 'left', padding: '12px 8px', color: '#94a3b8', fontWeight: 600 }}>
                  Collaborator
                </th>
                <th style={{ textAlign: 'center', padding: '12px 8px', color: '#94a3b8', fontWeight: 600 }}>
                  Text
                </th>
                <th style={{ textAlign: 'center', padding: '12px 8px', color: '#94a3b8', fontWeight: 600 }}>
                  Images
                </th>
                <th style={{ textAlign: 'center', padding: '12px 8px', color: '#94a3b8', fontWeight: 600 }}>
                  Audio
                </th>
                <th style={{ textAlign: 'center', padding: '12px 8px', color: '#94a3b8', fontWeight: 600 }}>
                  Video
                </th>
                <th style={{ textAlign: 'center', padding: '12px 8px', color: '#94a3b8', fontWeight: 600 }}>
                  Invite Others
                </th>
              </tr>
            </thead>
            <tbody>
              {collaborators.filter(c => c.status === 'accepted').map((collab) => (
                <tr
                  key={collab.id}
                  style={{
                    borderBottom: '1px solid var(--panel-border)',
                    background: collab.user === currentUser.id ? 'rgba(59, 130, 246, 0.05)' : 'transparent',
                  }}
                >
                  <td style={{ padding: '12px 8px', color: 'var(--text)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        background: collab.is_lead
                          ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
                          : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff',
                        fontSize: 11,
                        fontWeight: 600,
                      }}>
                        {collab.username.charAt(0).toUpperCase()}
                      </div>
                      <span>
                        @{collab.username}
                        {collab.user === currentUser.id && (
                          <span style={{ color: '#94a3b8', marginLeft: 4 }}>(you)</span>
                        )}
                      </span>
                    </div>
                  </td>
                  <td style={{ textAlign: 'center', padding: '12px 8px' }}>
                    <PermissionBadge allowed={collab.can_edit?.includes('text') ?? collab.can_edit_text} />
                  </td>
                  <td style={{ textAlign: 'center', padding: '12px 8px' }}>
                    <PermissionBadge allowed={collab.can_edit?.includes('image') ?? collab.can_edit_images} />
                  </td>
                  <td style={{ textAlign: 'center', padding: '12px 8px' }}>
                    <PermissionBadge allowed={collab.can_edit?.includes('audio') ?? collab.can_edit_audio} />
                  </td>
                  <td style={{ textAlign: 'center', padding: '12px 8px' }}>
                    <PermissionBadge allowed={collab.can_edit?.includes('video') ?? collab.can_edit_video} />
                  </td>
                  <td style={{ textAlign: 'center', padding: '12px 8px' }}>
                    <PermissionBadge allowed={collab.can_invite_others || collab.is_lead} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Counter-proposals / History (if any) */}
      {collaborators.some(c => c.proposed_percentage !== undefined) && (
        <div style={{
          background: 'var(--panel)',
          border: '1px solid var(--panel-border)',
          borderRadius: 12,
          padding: 24,
        }}>
          <h3 style={{ margin: '0 0 16px', color: 'var(--text)', fontSize: 16 }}>
            Counter-Proposals
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {collaborators
              .filter(c => c.proposed_percentage !== undefined)
              .map((collab) => (
                <div
                  key={collab.id}
                  style={{
                    padding: 16,
                    background: 'var(--bg)',
                    borderRadius: 8,
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 14, color: 'var(--text)', fontWeight: 600 }}>
                        @{collab.username}
                      </span>
                      <span style={{ fontSize: 12, color: '#94a3b8' }}>
                        proposes
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 13, color: '#94a3b8', textDecoration: 'line-through' }}>
                        {collab.revenue_percentage}%
                      </span>
                      <span style={{ fontSize: 16, color: '#f59e0b', fontWeight: 700 }}>
                        {collab.proposed_percentage}%
                      </span>
                    </div>
                  </div>
                  {collab.counter_message && (
                    <div style={{
                      marginTop: 8,
                      fontSize: 13,
                      color: '#94a3b8',
                      fontStyle: 'italic',
                    }}>
                      "{collab.counter_message}"
                    </div>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PermissionBadge({ allowed }: { allowed?: boolean }) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 24,
      height: 24,
      borderRadius: 4,
      background: allowed ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
      color: allowed ? '#10b981' : '#ef4444',
      fontSize: 12,
    }}>
      {allowed ? '✓' : '×'}
    </span>
  );
}
