/**
 * TeamOverview Component
 *
 * Dashboard-style view showing all collaborators' status
 * on a collaborative project. Adapts display for work-for-hire
 * vs revenue-share contracts.
 */

import React from 'react';
import { CollaboratorRole, ProjectSection } from '../../services/collaborationApi';
import { Users, Check, DollarSign } from 'lucide-react';

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
  // Check if any non-owner collaborator uses revenue share (not pure work-for-hire)
  const hasRevenueSharing = collaborators.some(
    c => c.contract_type !== 'work_for_hire' && c.revenue_percentage > 0 && c.user !== projectCreatorId
  );

  return (
    <div
      data-tour="approval-workflow"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--panel-border-strong)',
        borderRadius: 12,
        padding: 20,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
        <Users size={20} style={{ color: '#8b5cf6' }} />
        <h3 style={{ margin: 0, color: 'var(--text)', fontSize: 18, fontWeight: 600 }}>
          Team Overview
        </h3>
        <span style={{
          background: 'var(--bg-secondary)',
          color: 'var(--text-muted)',
          padding: '2px 10px',
          borderRadius: 12,
          fontSize: 13,
          fontWeight: 500,
        }}>
          {collaborators.filter(c => c.status === 'accepted').length} active
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {collaborators
          .filter(c => c.status === 'accepted')
          .map((collaborator) => {
            const isOwner = collaborator.user === projectCreatorId;
            const isLead = collaborator.is_lead;
            const isEscrow = collaborator.contract_type === 'work_for_hire' || collaborator.contract_type === 'hybrid';

            return (
              <div
                key={collaborator.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: 14,
                  background: 'var(--bg-secondary)',
                  borderRadius: 10,
                  borderLeft: `3px solid ${isOwner ? '#f59e0b' : '#8b5cf6'}`,
                }}
              >
                {/* Avatar */}
                <div style={{
                  width: 40, height: 40, borderRadius: '50%',
                  background: `linear-gradient(135deg, ${isOwner ? '#f59e0b' : '#3b82f6'} 0%, ${isOwner ? '#d97706' : '#2563eb'} 100%)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontWeight: 700, fontSize: 15, flexShrink: 0,
                }}>
                  {collaborator.username.charAt(0).toUpperCase()}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: 'var(--text)', fontWeight: 600, fontSize: 15 }}>
                      @{collaborator.username}
                    </span>
                    {isOwner && (
                      <span style={{
                        background: '#f59e0b', color: '#000',
                        padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700,
                      }}>
                        OWNER
                      </span>
                    )}
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 2 }}>
                    {collaborator.role}
                    {/* Show contract info instead of equity % for escrow contracts */}
                    {isEscrow && !isOwner && (
                      <span style={{ color: '#8b5cf6', marginLeft: 8 }}>
                        {collaborator.contract_type === 'work_for_hire' ? 'Work for Hire' : 'Hybrid'}
                        {collaborator.total_contract_amount && ` · $${parseFloat(collaborator.total_contract_amount).toFixed(2)}`}
                      </span>
                    )}
                    {/* Only show revenue % when there's meaningful revenue sharing */}
                    {hasRevenueSharing && (
                      <>
                        <span style={{ color: 'var(--subtle)', margin: '0 6px' }}>·</span>
                        <span style={{ color: '#10b981' }}>{collaborator.revenue_percentage}%</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Escrow status for work-for-hire collaborators */}
                {isEscrow && !isOwner && (
                  <div style={{
                    padding: '6px 12px', borderRadius: 6, fontSize: 13, fontWeight: 500,
                    background: parseFloat(collaborator.escrow_funded_amount || '0') >= parseFloat(collaborator.total_contract_amount || '0')
                      ? '#10b98120' : '#f59e0b20',
                    color: parseFloat(collaborator.escrow_funded_amount || '0') >= parseFloat(collaborator.total_contract_amount || '0')
                      ? '#10b981' : '#f59e0b',
                    whiteSpace: 'nowrap',
                  }}>
                    {parseFloat(collaborator.escrow_funded_amount || '0') >= parseFloat(collaborator.total_contract_amount || '0')
                      ? `Escrow Funded`
                      : `Awaiting Funding`}
                  </div>
                )}

                {/* Approval status — only for revenue share projects */}
                {hasRevenueSharing && (
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}
                    title={`Content: ${collaborator.approved_current_version ? 'Approved' : 'Pending'}, Revenue: ${collaborator.approved_revenue_split ? 'Approved' : 'Pending'}`}
                  >
                    <div style={{
                      width: 26, height: 26, borderRadius: 4,
                      background: collaborator.approved_current_version ? '#10b98120' : 'var(--bg-secondary)',
                      color: collaborator.approved_current_version ? '#10b981' : 'var(--text-muted)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13,
                    }}>
                      {collaborator.approved_current_version ? <Check size={13} /> : '○'}
                    </div>
                    <div style={{
                      width: 26, height: 26, borderRadius: 4,
                      background: collaborator.approved_revenue_split ? '#10b98120' : 'var(--bg-secondary)',
                      color: collaborator.approved_revenue_split ? '#10b981' : 'var(--text-muted)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13,
                    }}>
                      {collaborator.approved_revenue_split ? <DollarSign size={13} /> : '○'}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

        {/* Pending invites */}
        {collaborators.filter(c => c.status === 'invited').length > 0 && (
          <>
            <div style={{ borderTop: '1px solid var(--border)', margin: '8px 0', paddingTop: 12 }}>
              <span style={{ color: 'var(--text-muted)', fontSize: 13, fontWeight: 600 }}>
                PENDING INVITES
              </span>
            </div>
            {collaborators
              .filter(c => c.status === 'invited')
              .map((collaborator) => (
                <div key={collaborator.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: 14,
                  background: 'var(--bg-secondary)', borderRadius: 10,
                  borderLeft: '3px solid #f59e0b', opacity: 0.7,
                }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: '50%',
                    background: 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--text-muted)', fontWeight: 700, fontSize: 15, flexShrink: 0,
                  }}>
                    {collaborator.username.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: 'var(--text-muted)', fontWeight: 500, fontSize: 15 }}>
                      @{collaborator.username}
                    </div>
                    <div style={{ color: 'var(--subtle)', fontSize: 13 }}>
                      {collaborator.role}
                      {collaborator.contract_type === 'work_for_hire' && collaborator.total_contract_amount && (
                        <span style={{ color: '#8b5cf6', marginLeft: 8 }}>
                          Work for Hire · ${parseFloat(collaborator.total_contract_amount).toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>
                  {(collaborator.proposed_percentage != null &&
                   Math.abs(Number(collaborator.proposed_percentage) - Number(collaborator.revenue_percentage)) > 0.001) ||
                   collaborator.proposed_total_amount != null ||
                   (collaborator.proposed_tasks && collaborator.proposed_tasks.length > 0) ? (
                    <span style={{
                      background: '#f9731620', color: '#f97316',
                      padding: '6px 12px', borderRadius: 6, fontSize: 13, fontWeight: 600,
                    }}>
                      Counter-proposal received
                    </span>
                  ) : (
                    <span style={{
                      background: '#f59e0b20', color: '#f59e0b',
                      padding: '6px 12px', borderRadius: 6, fontSize: 13, fontWeight: 500,
                    }}>
                      Awaiting response
                    </span>
                  )}
                </div>
              ))}
          </>
        )}
      </div>

      {/* Legend footer — only for revenue share projects */}
      {hasRevenueSharing && (
        <div style={{
          marginTop: 16, paddingTop: 16,
          borderTop: '1px solid var(--border)',
          display: 'flex', gap: 16, flexWrap: 'wrap',
        }}>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Check size={14} style={{ color: '#10b981' }} /> Content Approved
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <DollarSign size={14} style={{ color: '#10b981' }} /> Revenue Approved
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span>○</span> Pending
          </div>
        </div>
      )}
    </div>
  );
}

export default TeamOverview;
