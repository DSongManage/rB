/**
 * TeamOverview Component
 *
 * Dashboard-style view showing all collaborators' status,
 * deadlines, and progress on a collaborative project.
 */

import React from 'react';
import { CollaboratorRole, ProjectSection } from '../../services/collaborationApi';
import { Users, XCircle, CheckCircle, AlertTriangle, Clock, FileText, DollarSign, Check } from 'lucide-react';

interface TeamOverviewProps {
  collaborators: CollaboratorRole[];
  sections: ProjectSection[];
  projectCreatorId: number;
}

export function TeamOverview({
  collaborators,
  sections,
  projectCreatorId,
}: TeamOverviewProps) {
  // Calculate section completion for each collaborator
  const getCollaboratorProgress = (collaborator: CollaboratorRole) => {
    const assignedSections = sections.filter(
      (s) => s.owner === collaborator.user
    );
    const completedSections = assignedSections.filter(
      (s) => s.content_html && s.content_html.trim().length > 0
    );
    return {
      assigned: assignedSections.length,
      completed: completedSections.length,
    };
  };

  // Check deadline status
  const getDeadlineStatus = (collaborator: CollaboratorRole) => {
    if (!collaborator.delivery_deadline) return null;

    const deadline = new Date(collaborator.delivery_deadline);
    const now = new Date();
    const daysRemaining = Math.ceil(
      (deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysRemaining < 0) {
      return { status: 'overdue', days: Math.abs(daysRemaining), color: '#ef4444' };
    } else if (daysRemaining <= 3) {
      return { status: 'soon', days: daysRemaining, color: '#f59e0b' };
    } else {
      return { status: 'ok', days: daysRemaining, color: '#10b981' };
    }
  };

  // Get collaborator status badge
  const getStatusBadge = (collaborator: CollaboratorRole): {
    icon: React.ReactNode;
    text: string;
    color: string;
    bg: string;
  } => {
    const progress = getCollaboratorProgress(collaborator);
    const deadline = getDeadlineStatus(collaborator);

    // Overdue
    if (deadline?.status === 'overdue') {
      return {
        icon: <XCircle size={14} />,
        text: `${deadline.days}d overdue`,
        color: '#ef4444',
        bg: '#ef444420',
      };
    }

    // All sections complete
    if (progress.assigned > 0 && progress.completed === progress.assigned) {
      return {
        icon: <CheckCircle size={14} />,
        text: `${progress.completed}/${progress.assigned} complete`,
        color: '#10b981',
        bg: '#10b98120',
      };
    }

    // Has pending sections
    if (progress.assigned > 0) {
      const remaining = progress.assigned - progress.completed;
      if (deadline?.status === 'soon') {
        return {
          icon: <AlertTriangle size={14} />,
          text: `${remaining} section${remaining > 1 ? 's' : ''} due in ${deadline.days}d`,
          color: '#f59e0b',
          bg: '#f59e0b20',
        };
      }
      return {
        icon: <Clock size={14} />,
        text: `${progress.completed}/${progress.assigned} sections`,
        color: '#3b82f6',
        bg: '#3b82f620',
      };
    }

    // No sections assigned
    return {
      icon: <FileText size={14} />,
      text: 'No sections assigned',
      color: '#64748b',
      bg: '#64748b20',
    };
  };

  return (
    <div
      style={{
        background: '#0f172a',
        border: '1px solid #1e293b',
        borderRadius: 12,
        padding: 20,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 20,
        }}
      >
        <Users size={20} style={{ color: '#8b5cf6' }} />
        <h3 style={{ margin: 0, color: '#f8fafc', fontSize: 16, fontWeight: 600 }}>
          Team Overview
        </h3>
        <span
          style={{
            background: '#334155',
            color: '#94a3b8',
            padding: '2px 10px',
            borderRadius: 12,
            fontSize: 12,
            fontWeight: 500,
          }}
        >
          {collaborators.filter((c) => c.status === 'accepted').length} active
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {collaborators
          .filter((c) => c.status === 'accepted')
          .map((collaborator) => {
            const progress = getCollaboratorProgress(collaborator);
            const statusBadge = getStatusBadge(collaborator);
            const isOwner = collaborator.user === projectCreatorId;
            const isLead = collaborator.is_lead;

            return (
              <div
                key={collaborator.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: 12,
                  background: '#1e293b',
                  borderRadius: 10,
                  borderLeft: `3px solid ${statusBadge.color}`,
                }}
              >
                {/* Avatar placeholder */}
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    background: `linear-gradient(135deg, ${
                      isOwner ? '#f59e0b' : '#3b82f6'
                    } 0%, ${isOwner ? '#d97706' : '#2563eb'} 100%)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: 14,
                    flexShrink: 0,
                  }}
                >
                  {collaborator.username.charAt(0).toUpperCase()}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span
                      style={{
                        color: '#f8fafc',
                        fontWeight: 600,
                        fontSize: 14,
                      }}
                    >
                      @{collaborator.username}
                    </span>
                    {isOwner && (
                      <span
                        style={{
                          background: '#f59e0b',
                          color: '#000',
                          padding: '2px 8px',
                          borderRadius: 4,
                          fontSize: 10,
                          fontWeight: 700,
                        }}
                      >
                        OWNER
                      </span>
                    )}
                    {isLead && !isOwner && (
                      <span
                        style={{
                          background: '#8b5cf6',
                          color: '#fff',
                          padding: '2px 8px',
                          borderRadius: 4,
                          fontSize: 10,
                          fontWeight: 700,
                        }}
                      >
                        LEAD
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      color: '#94a3b8',
                      fontSize: 12,
                      marginTop: 2,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <span>{collaborator.role}</span>
                    <span style={{ color: '#64748b' }}>•</span>
                    <span style={{ color: '#10b981' }}>
                      {collaborator.revenue_percentage}%
                    </span>
                  </div>
                </div>

                {/* Progress bar for sections */}
                {progress.assigned > 0 && (
                  <div style={{ width: 80 }}>
                    <div
                      style={{
                        height: 6,
                        background: '#334155',
                        borderRadius: 3,
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${(progress.completed / progress.assigned) * 100}%`,
                          height: '100%',
                          background:
                            progress.completed === progress.assigned
                              ? '#10b981'
                              : '#3b82f6',
                          transition: 'width 0.3s ease',
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Status badge */}
                <div
                  style={{
                    background: statusBadge.bg,
                    color: statusBadge.color,
                    padding: '6px 12px',
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 500,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    whiteSpace: 'nowrap',
                  }}
                >
                  <span>{statusBadge.icon}</span>
                  {statusBadge.text}
                </div>

                {/* Approval status */}
                <div
                  style={{
                    display: 'flex',
                    gap: 4,
                    flexShrink: 0,
                  }}
                  title={`Content: ${
                    collaborator.approved_current_version ? 'Approved' : 'Pending'
                  }, Revenue: ${collaborator.approved_revenue_split ? 'Approved' : 'Pending'}`}
                >
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 4,
                      background: collaborator.approved_current_version
                        ? '#10b98120'
                        : '#64748b20',
                      color: collaborator.approved_current_version
                        ? '#10b981'
                        : '#64748b',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 12,
                    }}
                  >
                    {collaborator.approved_current_version ? <Check size={12} /> : '○'}
                  </div>
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 4,
                      background: collaborator.approved_revenue_split
                        ? '#10b98120'
                        : '#64748b20',
                      color: collaborator.approved_revenue_split
                        ? '#10b981'
                        : '#64748b',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 12,
                    }}
                  >
                    {collaborator.approved_revenue_split ? <DollarSign size={12} /> : '○'}
                  </div>
                </div>
              </div>
            );
          })}

        {/* Pending invites */}
        {collaborators.filter((c) => c.status === 'invited').length > 0 && (
          <>
            <div
              style={{
                borderTop: '1px solid #334155',
                margin: '8px 0',
                paddingTop: 12,
              }}
            >
              <span style={{ color: '#64748b', fontSize: 12, fontWeight: 600 }}>
                PENDING INVITES
              </span>
            </div>
            {collaborators
              .filter((c) => c.status === 'invited')
              .map((collaborator) => (
                <div
                  key={collaborator.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: 12,
                    background: '#1e293b',
                    borderRadius: 10,
                    borderLeft: '3px solid #f59e0b',
                    opacity: 0.7,
                  }}
                >
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: '50%',
                      background: '#334155',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#94a3b8',
                      fontWeight: 700,
                      fontSize: 14,
                      flexShrink: 0,
                    }}
                  >
                    {collaborator.username.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: '#94a3b8', fontWeight: 500, fontSize: 14 }}>
                      @{collaborator.username}
                    </div>
                    <div style={{ color: '#64748b', fontSize: 12 }}>
                      {collaborator.role} • {collaborator.revenue_percentage}%
                    </div>
                  </div>
                  <span
                    style={{
                      background: '#f59e0b20',
                      color: '#f59e0b',
                      padding: '6px 12px',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 500,
                    }}
                  >
                    Awaiting response
                  </span>
                </div>
              ))}
          </>
        )}
      </div>

      {/* Summary footer */}
      <div
        style={{
          marginTop: 16,
          paddingTop: 16,
          borderTop: '1px solid #334155',
          display: 'flex',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ fontSize: 12, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
          <Check size={14} style={{ color: '#10b981' }} /> Content Approved
        </div>
        <div style={{ fontSize: 12, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
          <DollarSign size={14} style={{ color: '#10b981' }} /> Revenue Approved
        </div>
        <div style={{ fontSize: 12, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
          <span>○</span> Pending
        </div>
      </div>
    </div>
  );
}

export default TeamOverview;
