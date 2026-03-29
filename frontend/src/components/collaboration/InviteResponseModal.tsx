/**
 * InviteResponseModal Component
 *
 * Displays collaboration invite details and allows the recipient to
 * Accept, Decline, or Counter-Propose.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Clock, Handshake, ClipboardList, CalendarClock, AlertTriangle,
  DollarSign, Pencil, Link2, Shield, MessageSquare, ChevronLeft
} from 'lucide-react';
import {
  collaborationApi,
  CollaborativeProject,
  CollaboratorRole
} from '../../services/collaborationApi';

interface InviteResponseModalProps {
  open: boolean;
  onClose: () => void;
  projectId: number;
  notificationMessage?: string;
}

type ModalMode = 'view' | 'counter-propose';

export function InviteResponseModal({
  open,
  onClose,
  projectId,
  notificationMessage
}: InviteResponseModalProps) {
  const navigate = useNavigate();

  // State
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<CollaborativeProject | null>(null);
  const [myRole, setMyRole] = useState<CollaboratorRole | null>(null);
  const [mode, setMode] = useState<ModalMode>('view');
  const [proposedPercentage, setProposedPercentage] = useState(50);
  const [counterMessage, setCounterMessage] = useState('');
  const [proposedTotalAmount, setProposedTotalAmount] = useState('');
  const [proposedTasks, setProposedTasks] = useState<Array<{ task_id: number; title: string; deadline: string; payment_amount: string }>>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Load project details
  useEffect(() => {
    if (!open || !projectId) return;

    const loadProject = async () => {
      setLoading(true);
      setError('');
      try {
        const data = await collaborationApi.getCollaborativeProject(projectId);
        setProject(data);

        // Find current user's role (the one with status='invited')
        const invitedRole = data.collaborators.find(
          (c: CollaboratorRole) => c.status === 'invited'
        );
        if (invitedRole) {
          setMyRole(invitedRole);
          setProposedPercentage(invitedRole.revenue_percentage);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load project details');
      } finally {
        setLoading(false);
      }
    };

    loadProject();
  }, [open, projectId]);

  // Reset state when closed
  useEffect(() => {
    if (!open) {
      setMode('view');
      setCounterMessage('');
      setProposedTotalAmount('');
      setProposedTasks([]);
      setError('');
      setSuccess('');
    }
  }, [open]);

  if (!open) return null;

  const handleAccept = async () => {
    setSubmitting(true);
    setError('');
    try {
      await collaborationApi.acceptInvitation(projectId);
      setSuccess('Invite accepted! Redirecting to project...');
      setTimeout(() => {
        onClose();
        navigate(`/studio/${projectId}`);
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to accept invitation');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDecline = async () => {
    setSubmitting(true);
    setError('');
    try {
      await collaborationApi.declineInvitation(projectId);
      setSuccess('Invite declined.');
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to decline invitation');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCounterPropose = async () => {
    if (!counterMessage.trim()) {
      setError('Please add a message explaining your counter-proposal');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const payload: any = {
        proposed_percentage: proposedPercentage,
        message: counterMessage,
      };

      // Include escrow counter-proposal data
      if (isEscrow && proposedTasks.length > 0) {
        payload.proposed_total_amount = proposedTotalAmount;
        payload.proposed_tasks = proposedTasks.map(t => ({
          task_id: t.task_id,
          deadline: t.deadline ? new Date(t.deadline).toISOString() : undefined,
          payment_amount: t.payment_amount,
        }));
      }

      await collaborationApi.counterProposeInvite(projectId, payload);

      setSuccess('Counter-proposal sent! Waiting for response...');
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to send counter-proposal');
    } finally {
      setSubmitting(false);
    }
  };

  // Get project creator info
  const creator = project?.collaborators.find(
    (c: CollaboratorRole) => c.user === project.created_by
  );

  // Calculate others' share
  const othersPercentage = myRole ? 100 - myRole.revenue_percentage : 0;

  // Escrow / contract type helpers
  const isEscrow = myRole?.contract_type === 'work_for_hire' || myRole?.contract_type === 'hybrid';
  const isWorkForHire = myRole?.contract_type === 'work_for_hire';
  const totalAmount = parseFloat(myRole?.total_contract_amount || '0');
  const hasRevenueSplit = myRole ? myRole.revenue_percentage > 0 : false;

  // Check if there's a pending counter-proposal (user already submitted one)
  const hasCounterProposal = myRole &&
    myRole.proposed_percentage !== null &&
    myRole.proposed_percentage !== undefined &&
    Math.abs(Number(myRole.proposed_percentage) - Number(myRole.revenue_percentage)) > 0.001;

  const contentTypeLabels: Record<string, string> = {
    book: 'Book',
    music: 'Music',
    video: 'Video',
    art: 'Art',
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.9)',
        display: 'grid',
        placeItems: 'center',
        zIndex: 1000,
        padding: 20,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div
        style={{
          background: '#0f172a',
          border: '1px solid #334155',
          borderRadius: 16,
          width: '100%',
          maxWidth: 600,
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: 24,
            borderBottom: '1px solid #334155',
            background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Handshake size={24} style={{ color: '#f59e0b' }} />
              <h2 style={{ margin: 0, color: '#f8fafc', fontSize: 20, fontWeight: 600 }}>
                Collaboration Invite
              </h2>
            </div>
            {creator && (
              <p style={{ margin: 0, color: '#94a3b8', fontSize: 14 }}>
                from <a
                  href={`/profile/${creator.username}`}
                  onClick={(e) => { e.stopPropagation(); onClose(); }}
                  style={{ color: '#f59e0b', textDecoration: 'none', fontWeight: 500 }}
                  onMouseEnter={(e) => { e.currentTarget.style.textDecoration = 'underline'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.textDecoration = 'none'; }}
                >@{creator.username}</a>
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              fontSize: 24,
              cursor: submitting ? 'not-allowed' : 'pointer',
              padding: 4,
            }}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: 24 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
              Loading project details...
            </div>
          ) : error && !project ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#ef4444' }}>
              {error}
            </div>
          ) : project && myRole ? (
            mode === 'view' ? (
              <>
                {/* Project Info */}
                <div style={{ marginBottom: 24 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      marginBottom: 12,
                    }}
                  >
                    <span
                      style={{
                        background: '#f59e0b20',
                        color: '#f59e0b',
                        padding: '4px 12px',
                        borderRadius: 6,
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      {contentTypeLabels[project.content_type] || project.content_type}
                    </span>
                    <span style={{ color: '#64748b', fontSize: 13 }}>
                      {project.status === 'draft' ? 'Draft' : 'Active'}
                    </span>
                  </div>
                  <h3 style={{ margin: 0, color: '#f8fafc', fontSize: 24, fontWeight: 700 }}>
                    {project.title?.replace(/^Collaboration Invite - /, '')}
                  </h3>
                  {project.description && !project.title?.startsWith('Collaboration Invite') && (
                    <p style={{ margin: '8px 0 0', color: '#94a3b8', fontSize: 14, lineHeight: 1.6 }}>
                      {project.description}
                    </p>
                  )}
                </div>

                {/* Your Role */}
                <div
                  style={{
                    background: '#1e293b',
                    borderRadius: 12,
                    padding: 16,
                    marginBottom: 20,
                  }}
                >
                  <div style={{ color: '#94a3b8', fontSize: 12, fontWeight: 600, marginBottom: 8, textTransform: 'uppercase' }}>
                    Your Role
                  </div>
                  <div style={{ color: '#f8fafc', fontSize: 18, fontWeight: 600 }}>
                    {myRole.role || 'Collaborator'}
                  </div>
                </div>

                {/* Escrow Payment Summary - shown prominently for work-for-hire/hybrid */}
                {isEscrow && totalAmount > 0 && (
                  <div
                    style={{
                      background: 'linear-gradient(135deg, #10b98115 0%, #05966915 100%)',
                      border: '1px solid #10b98140',
                      borderRadius: 12,
                      padding: 20,
                      marginBottom: 20,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                      <DollarSign size={20} style={{ color: '#10b981' }} />
                      <span style={{ color: '#10b981', fontSize: 13, fontWeight: 600, textTransform: 'uppercase' }}>
                        {isWorkForHire ? 'Fixed Rate Payment' : 'Upfront Payment + Revenue Share'}
                      </span>
                    </div>
                    <div style={{ color: '#f8fafc', fontSize: 32, fontWeight: 700, marginBottom: 4 }}>
                      ${totalAmount.toFixed(2)} <span style={{ fontSize: 16, color: '#94a3b8', fontWeight: 400 }}>USD</span>
                    </div>
                    <div style={{ color: '#6ee7b7', fontSize: 13, lineHeight: 1.5 }}>
                      {isWorkForHire
                        ? 'This amount will be held in on-chain escrow and released to you as you complete each milestone.'
                        : `$${totalAmount.toFixed(2)} upfront via escrow, plus ${myRole.revenue_percentage}% of ongoing sales revenue.`
                      }
                    </div>
                    {myRole.escrow_funding_deadline && (
                      <div style={{ marginTop: 8, color: '#94a3b8', fontSize: 12 }}>
                        Start date: <span style={{ color: '#f59e0b', fontWeight: 600 }}>
                          {new Date(myRole.escrow_funding_deadline).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                        </span>
                        <span style={{ color: '#64748b' }}> — escrow funded by this date</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Contract Tasks */}
                {myRole.contract_tasks && myRole.contract_tasks.length > 0 && (
                  <div
                    style={{
                      background: '#1e293b',
                      borderRadius: 12,
                      padding: 16,
                      marginBottom: 20,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                      <ClipboardList size={18} style={{ color: '#f59e0b' }} />
                      <span style={{ color: '#94a3b8', fontSize: 12, fontWeight: 600, textTransform: 'uppercase' }}>
                        Your Contract Tasks ({myRole.contract_tasks.length})
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {myRole.contract_tasks.map((task: any, index: number) => (
                        <div
                          key={task.id || index}
                          style={{
                            background: '#0f172a',
                            borderRadius: 8,
                            padding: 14,
                            borderLeft: `3px solid ${isEscrow ? '#10b981' : '#f59e0b'}`,
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div style={{ color: '#f8fafc', fontSize: 14, fontWeight: 600 }}>
                              {task.title}
                            </div>
                            {isEscrow && task.payment_amount && parseFloat(task.payment_amount) > 0 && (
                              <span style={{
                                color: '#10b981', fontSize: 13, fontWeight: 700,
                                background: '#10b98115', padding: '2px 8px', borderRadius: 4,
                                whiteSpace: 'nowrap',
                              }}>
                                ${parseFloat(task.payment_amount).toFixed(2)}
                              </span>
                            )}
                          </div>
                          {task.description && (
                            <div style={{ color: '#94a3b8', fontSize: 13, marginTop: 6, lineHeight: 1.5 }}>
                              {task.description}
                            </div>
                          )}
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                              marginTop: 10,
                              color: '#f59e0b',
                              fontSize: 12,
                              fontWeight: 500,
                            }}
                          >
                            <CalendarClock size={12} />
                            <span>
                              Due: {new Date(task.deadline).toLocaleDateString('en-US', {
                                weekday: 'short',
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div
                      style={{
                        marginTop: 16,
                        padding: 12,
                        background: 'rgba(245, 158, 11, 0.1)',
                        borderRadius: 8,
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 10,
                      }}
                    >
                      <AlertTriangle size={16} style={{ color: '#f59e0b', flexShrink: 0, marginTop: 1 }} />
                      <div style={{ color: '#f59e0b', fontSize: 12, lineHeight: 1.5 }}>
                        <strong>Contract Terms:</strong> By accepting, you commit to completing these tasks
                        by their deadlines. Tasks become binding and can only be changed via mutual agreement.
                        Missing deadlines may affect the collaboration.
                      </div>
                    </div>
                  </div>
                )}

                {/* Pitch Message */}
                {notificationMessage && (
                  <div
                    style={{
                      background: '#1e293b',
                      borderRadius: 12,
                      padding: 16,
                      marginBottom: 20,
                      borderLeft: '3px solid #3b82f6',
                    }}
                  >
                    <div style={{ color: '#94a3b8', fontSize: 12, fontWeight: 600, marginBottom: 8, textTransform: 'uppercase' }}>
                      Message from @{creator?.username}
                    </div>
                    <div style={{ color: '#cbd5e1', fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                      {notificationMessage}
                    </div>
                  </div>
                )}

                {/* Revenue Split - only shown when there is a revenue share */}
                {hasRevenueSplit && (
                  <div
                    style={{
                      background: '#1e293b',
                      borderRadius: 12,
                      padding: 16,
                      marginBottom: 20,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                      <DollarSign size={18} style={{ color: '#f59e0b' }} />
                      <span style={{ color: '#94a3b8', fontSize: 12, fontWeight: 600, textTransform: 'uppercase' }}>
                        Revenue Split
                      </span>
                    </div>

                    {/* Split bar */}
                    <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
                      <div
                        style={{
                          flex: myRole.revenue_percentage,
                          background: '#f59e0b',
                          height: 40,
                          borderRadius: '8px 0 0 8px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#000',
                          fontWeight: 700,
                          fontSize: 14,
                          minWidth: 60,
                        }}
                      >
                        You: {myRole.revenue_percentage}%
                      </div>
                      <div
                        style={{
                          flex: othersPercentage,
                          background: '#334155',
                          height: 40,
                          borderRadius: '0 8px 8px 0',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#cbd5e1',
                          fontWeight: 600,
                          fontSize: 14,
                          minWidth: 60,
                        }}
                      >
                        Others: {othersPercentage}%
                      </div>
                    </div>
                  </div>
                )}

                {/* Permissions */}
                <div
                  style={{
                    background: '#1e293b',
                    borderRadius: 12,
                    padding: 16,
                    marginBottom: 20,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <Pencil size={18} style={{ color: '#f59e0b' }} />
                    <span style={{ color: '#94a3b8', fontSize: 12, fontWeight: 600, textTransform: 'uppercase' }}>
                      Your Permissions
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {[
                      { key: 'can_edit_text', label: 'Text', value: myRole.can_edit_text },
                      { key: 'can_edit_images', label: 'Images', value: myRole.can_edit_images },
                    ].map((perm) => (
                      <span
                        key={perm.key}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '6px 12px',
                          borderRadius: 6,
                          background: perm.value ? '#10b98120' : '#64748b20',
                          color: perm.value ? '#10b981' : '#64748b',
                          fontSize: 13,
                          fontWeight: 500,
                        }}
                      >
                        {perm.value ? '✓' : '✗'} {perm.label}
                      </span>
                    ))}
                  </div>
                </div>

                {/* On-Chain Notice - context-aware messaging */}
                <div
                  style={{
                    background: 'linear-gradient(135deg, #7c3aed20 0%, #3b82f620 100%)',
                    border: '1px solid #7c3aed40',
                    borderRadius: 12,
                    padding: 16,
                    marginBottom: 24,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <Shield size={18} style={{ color: '#a78bfa' }} />
                    <span style={{ color: '#a78bfa', fontSize: 13, fontWeight: 600 }}>
                      {isEscrow ? 'Escrow Protection' : 'On-Chain Agreement'}
                    </span>
                  </div>
                  <p style={{ margin: 0, color: '#c4b5fd', fontSize: 13, lineHeight: 1.6 }}>
                    {isWorkForHire
                      ? `By accepting, you agree to deliver the milestones above for $${totalAmount.toFixed(2)}. The full amount will be held in on-chain escrow and released to you automatically as each milestone is completed and approved.`
                      : isEscrow
                        ? `By accepting, you agree to the upfront payment of $${totalAmount.toFixed(2)} (held in on-chain escrow) plus ${myRole.revenue_percentage}% revenue share on sales. Escrow funds are released as milestones are completed. Revenue splits are enforced via smart contract.`
                        : 'By accepting, you agree to the revenue split above. When this project is minted as an NFT, the split will be enforced via smart contract. USDC payments will be distributed automatically.'
                    }
                  </p>
                </div>

                {/* Error/Success Messages */}
                {error && (
                  <div
                    style={{
                      background: '#ef444420',
                      border: '1px solid #ef4444',
                      color: '#fca5a5',
                      padding: 12,
                      borderRadius: 8,
                      fontSize: 13,
                      marginBottom: 16,
                    }}
                  >
                    {error}
                  </div>
                )}
                {success && (
                  <div
                    style={{
                      background: '#10b98120',
                      border: '1px solid #10b981',
                      color: '#6ee7b7',
                      padding: 12,
                      borderRadius: 8,
                      fontSize: 13,
                      marginBottom: 16,
                    }}
                  >
                    {success}
                  </div>
                )}

                {/* Action Buttons */}
                {hasCounterProposal ? (
                  /* Pending Counter-Proposal State */
                  <div style={{
                    background: 'linear-gradient(135deg, #f59e0b10 0%, #fbbf2410 100%)',
                    border: '1px solid #f59e0b40',
                    borderRadius: 12,
                    padding: 20,
                    textAlign: 'center',
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 10,
                      marginBottom: 12,
                    }}>
                      <Clock size={22} style={{ color: '#f59e0b' }} />
                      <span style={{ color: '#f59e0b', fontSize: 16, fontWeight: 600 }}>
                        Counter-Proposal Pending
                      </span>
                    </div>
                    <p style={{ margin: 0, color: '#fbbf24', fontSize: 14, lineHeight: 1.6 }}>
                      You proposed <strong>{myRole?.proposed_percentage}%</strong> revenue split
                      (original offer: {myRole?.revenue_percentage}%).
                    </p>
                    <p style={{ margin: '8px 0 0', color: '#94a3b8', fontSize: 13 }}>
                      Waiting for @{creator?.username} to respond to your counter-proposal.
                    </p>

                    {/* Still allow declining while waiting */}
                    <button
                      onClick={handleDecline}
                      disabled={submitting}
                      style={{
                        marginTop: 16,
                        padding: '10px 24px',
                        borderRadius: 8,
                        border: '1px solid #ef4444',
                        background: 'transparent',
                        color: '#ef4444',
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: submitting ? 'not-allowed' : 'pointer',
                        opacity: submitting ? 0.6 : 1,
                      }}
                    >
                      Withdraw & Decline
                    </button>
                  </div>
                ) : (
                  /* Normal Action Buttons */
                  <div style={{ display: 'flex', gap: 12 }}>
                    <button
                      onClick={handleDecline}
                      disabled={submitting}
                      style={{
                        flex: 1,
                        padding: '14px 20px',
                        borderRadius: 10,
                        border: '1px solid #ef4444',
                        background: 'transparent',
                        color: '#ef4444',
                        fontSize: 14,
                        fontWeight: 600,
                        cursor: submitting ? 'not-allowed' : 'pointer',
                        opacity: submitting ? 0.6 : 1,
                      }}
                    >
                      Decline
                    </button>
                    <button
                      onClick={() => {
                        // Initialize proposed tasks from existing tasks
                        if (myRole?.contract_tasks?.length) {
                          setProposedTasks(myRole.contract_tasks.map((t: any) => ({
                            task_id: t.id,
                            title: t.title,
                            deadline: t.deadline ? new Date(t.deadline).toISOString().slice(0, 16) : '',
                            payment_amount: t.payment_amount || '0',
                          })));
                        }
                        if (isEscrow && totalAmount > 0) {
                          setProposedTotalAmount(totalAmount.toString());
                        }
                        setMode('counter-propose');
                      }}
                      disabled={submitting}
                      style={{
                        flex: 1,
                        padding: '14px 20px',
                        borderRadius: 10,
                        border: '1px solid #3b82f6',
                        background: 'transparent',
                        color: '#3b82f6',
                        fontSize: 14,
                        fontWeight: 600,
                        cursor: submitting ? 'not-allowed' : 'pointer',
                        opacity: submitting ? 0.6 : 1,
                      }}
                    >
                      Counter-Propose
                    </button>
                    <button
                      onClick={handleAccept}
                      disabled={submitting}
                      style={{
                        flex: 1.5,
                        padding: '14px 20px',
                        borderRadius: 10,
                        border: 'none',
                        background: '#10b981',
                        color: '#fff',
                        fontSize: 14,
                        fontWeight: 700,
                        cursor: submitting ? 'not-allowed' : 'pointer',
                        opacity: submitting ? 0.6 : 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                      }}
                    >
                      {submitting ? 'Processing...' : 'Accept Invite'}
                    </button>
                  </div>
                )}
              </>
            ) : (
              /* Counter-Propose Mode */
              <>
                <button
                  onClick={() => setMode('view')}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#94a3b8',
                    fontSize: 14,
                    cursor: 'pointer',
                    padding: 0,
                    marginBottom: 16,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <ChevronLeft size={16} /> Back to invite
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
                  <MessageSquare size={24} style={{ color: '#3b82f6' }} />
                  <h3 style={{ margin: 0, color: '#f8fafc', fontSize: 20, fontWeight: 600 }}>
                    Propose Different Terms
                  </h3>
                </div>

                {/* Escrow: Proposed Total Amount */}
                {isEscrow && (
                  <div style={{ marginBottom: 20 }}>
                    <label style={{ display: 'block', color: '#94a3b8', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
                      <DollarSign size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /> Your Proposed Rate (USD)
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <input
                        type="number"
                        min="1"
                        step="0.01"
                        value={proposedTotalAmount}
                        onChange={(e) => setProposedTotalAmount(e.target.value)}
                        style={{
                          flex: 1,
                          background: '#1e293b', border: '1px solid #334155',
                          borderRadius: 6, padding: 10, color: '#f8fafc', fontSize: 15, fontWeight: 600,
                        }}
                      />
                      {totalAmount > 0 && parseFloat(proposedTotalAmount) !== totalAmount && (
                        <span style={{
                          fontSize: 12, color: parseFloat(proposedTotalAmount) > totalAmount ? '#10b981' : '#f59e0b',
                        }}>
                          Original: ${totalAmount.toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Escrow: Editable Tasks (deadlines + payment amounts) */}
                {isEscrow && proposedTasks.length > 0 && (
                  <div style={{
                    marginBottom: 20,
                    background: '#1e293b',
                    borderRadius: 12,
                    padding: 16,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                      <ClipboardList size={16} style={{ color: '#3b82f6' }} />
                      <span style={{ color: '#94a3b8', fontSize: 12, fontWeight: 600, textTransform: 'uppercase' }}>
                        Adjust Tasks & Schedule
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {proposedTasks.map((task, idx) => (
                        <div key={task.task_id} style={{
                          background: '#0f172a', borderRadius: 8, padding: 14,
                          borderLeft: '3px solid #3b82f6',
                        }}>
                          <div style={{ color: '#f8fafc', fontSize: 13, fontWeight: 600, marginBottom: 10 }}>
                            {task.title}
                          </div>
                          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                            <div style={{ flex: 1, minWidth: 180 }}>
                              <label style={{ display: 'block', color: '#64748b', fontSize: 11, marginBottom: 4 }}>
                                Deadline
                              </label>
                              <input
                                type="datetime-local"
                                value={task.deadline}
                                onChange={(e) => {
                                  const updated = [...proposedTasks];
                                  updated[idx] = { ...updated[idx], deadline: e.target.value };
                                  setProposedTasks(updated);
                                }}
                                style={{
                                  width: '100%', boxSizing: 'border-box',
                                  background: '#1e293b', border: '1px solid #334155',
                                  borderRadius: 6, padding: 8, color: '#f8fafc', fontSize: 12,
                                }}
                              />
                            </div>
                            <div style={{ width: 120 }}>
                              <label style={{ display: 'block', color: '#64748b', fontSize: 11, marginBottom: 4 }}>
                                Payment ($)
                              </label>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={task.payment_amount}
                                onChange={(e) => {
                                  const updated = [...proposedTasks];
                                  updated[idx] = { ...updated[idx], payment_amount: e.target.value };
                                  setProposedTasks(updated);
                                }}
                                style={{
                                  width: '100%', boxSizing: 'border-box',
                                  background: '#1e293b', border: '1px solid #334155',
                                  borderRadius: 6, padding: 8, color: '#f8fafc', fontSize: 12,
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    {/* Task payment total */}
                    <div style={{
                      marginTop: 12, padding: 10,
                      background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.2)',
                      borderRadius: 8, display: 'flex', justifyContent: 'space-between',
                      fontSize: 12,
                    }}>
                      <span style={{ color: '#93c5fd' }}>
                        Task total: ${proposedTasks.reduce((s, t) => s + (parseFloat(t.payment_amount) || 0), 0).toFixed(2)}
                      </span>
                      <span style={{ color: '#64748b' }}>
                        Proposed rate: ${parseFloat(proposedTotalAmount || '0').toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Revenue Split - only show if relevant */}
                {!isWorkForHire && (
                  <div style={{ marginBottom: 20 }}>
                    <label style={{ display: 'block', color: '#94a3b8', fontSize: 13, fontWeight: 600, marginBottom: 12 }}>
                      Suggested Revenue Split: {proposedPercentage}% for you
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={95}
                      step={5}
                      value={proposedPercentage}
                      onChange={(e) => setProposedPercentage(parseInt(e.target.value))}
                      style={{ width: '100%', marginBottom: 8 }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#64748b' }}>
                      <span>Current offer: {myRole.revenue_percentage}%</span>
                      <span>Proposing: {proposedPercentage}%</span>
                    </div>
                  </div>
                )}

                {/* Message */}
                <div style={{ marginBottom: 24 }}>
                  <label style={{ display: 'block', color: '#94a3b8', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
                    Message to @{creator?.username}
                  </label>
                  <textarea
                    value={counterMessage}
                    onChange={(e) => setCounterMessage(e.target.value)}
                    placeholder={isEscrow
                      ? "Explain your proposed rate, schedule changes, or other terms..."
                      : "Explain why you'd like a different split..."
                    }
                    style={{
                      width: '100%',
                      minHeight: 100,
                      background: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: 8,
                      padding: 12,
                      color: '#f8fafc',
                      fontSize: 14,
                      resize: 'vertical',
                    }}
                  />
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                    {counterMessage.length}/500 characters
                  </div>
                </div>

                {/* Error/Success */}
                {error && (
                  <div
                    style={{
                      background: '#ef444420',
                      border: '1px solid #ef4444',
                      color: '#fca5a5',
                      padding: 12,
                      borderRadius: 8,
                      fontSize: 13,
                      marginBottom: 16,
                    }}
                  >
                    {error}
                  </div>
                )}
                {success && (
                  <div
                    style={{
                      background: '#10b98120',
                      border: '1px solid #10b981',
                      color: '#6ee7b7',
                      padding: 12,
                      borderRadius: 8,
                      fontSize: 13,
                      marginBottom: 16,
                    }}
                  >
                    {success}
                  </div>
                )}

                {/* Actions */}
                <div style={{ display: 'flex', gap: 12 }}>
                  <button
                    onClick={() => setMode('view')}
                    disabled={submitting}
                    style={{
                      flex: 1,
                      padding: '14px 20px',
                      borderRadius: 10,
                      border: '1px solid #334155',
                      background: 'transparent',
                      color: '#cbd5e1',
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: submitting ? 'not-allowed' : 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCounterPropose}
                    disabled={submitting || !counterMessage.trim() || counterMessage.length > 500}
                    style={{
                      flex: 2,
                      padding: '14px 20px',
                      borderRadius: 10,
                      border: 'none',
                      background: '#3b82f6',
                      color: '#fff',
                      fontSize: 14,
                      fontWeight: 700,
                      cursor:
                        submitting || !counterMessage.trim() || counterMessage.length > 500
                          ? 'not-allowed'
                          : 'pointer',
                      opacity:
                        submitting || !counterMessage.trim() || counterMessage.length > 500
                          ? 0.6
                          : 1,
                    }}
                  >
                    {submitting ? 'Sending...' : 'Send Counter-Offer'}
                  </button>
                </div>
              </>
            )
          ) : (
            <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
              No invite found for this project.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default InviteResponseModal;
