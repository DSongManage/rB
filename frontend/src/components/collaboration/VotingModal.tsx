/**
 * VotingModal Component
 *
 * Modal for casting votes on proposals with optional comments.
 */

import React, { useState } from 'react';
import { Proposal } from './ProposalCard';

interface VotingModalProps {
  open: boolean;
  onClose: () => void;
  proposal: Proposal;
  onSubmitVote: (proposalId: number, vote: 'approve' | 'reject' | 'abstain', comment: string) => Promise<void>;
}

export function VotingModal({
  open,
  onClose,
  proposal,
  onSubmitVote,
}: VotingModalProps) {
  const [selectedVote, setSelectedVote] = useState<'approve' | 'reject' | 'abstain' | null>(null);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  const handleSubmit = async () => {
    if (!selectedVote) {
      setError('Please select a vote');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      await onSubmitVote(proposal.id, selectedVote, comment);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to submit vote');
    } finally {
      setSubmitting(false);
    }
  };

  // Get proposal type info for display
  const getProposalTypeInfo = (type: string) => {
    switch (type) {
      case 'revenue_split':
        return { icon: '💰', label: 'Revenue Split Change' };
      case 'new_member':
        return { icon: '👤', label: 'Invite New Collaborator' };
      case 'remove_member':
        return { icon: '🚫', label: 'Remove Collaborator' };
      case 'deadline_extension':
        return { icon: '⏰', label: 'Deadline Extension' };
      case 'project_change':
        return { icon: '📝', label: 'Project Change' };
      case 'exit_collaborator':
        return { icon: '🚪', label: 'Exit Request' };
      case 'unpublish_content':
        return { icon: '📤', label: 'Unpublish Content' };
      default:
        return { icon: '📋', label: type };
    }
  };

  const typeInfo = getProposalTypeInfo(proposal.proposal_type);

  // Render proposal data details
  const renderProposalDetails = () => {
    const data = proposal.proposal_data;

    if (proposal.proposal_type === 'revenue_split' && data.splits) {
      return (
        <div style={{ marginBottom: 20 }}>
          <div style={{ color: '#94a3b8', fontSize: 12, fontWeight: 600, marginBottom: 8 }}>
            PROPOSED REVENUE SPLITS
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {data.splits.map((split: { username: string; old_percentage?: number; percentage: number; change?: number }) => (
              <div
                key={split.username}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px 12px',
                  background: '#1e293b',
                  borderRadius: 6,
                }}
              >
                <span style={{ color: '#e2e8f0', fontSize: 13 }}>
                  @{split.username}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {split.old_percentage !== undefined && (
                    <>
                      <span style={{ color: '#64748b', fontSize: 12 }}>
                        {split.old_percentage}%
                      </span>
                      <span style={{ color: '#64748b' }}>→</span>
                    </>
                  )}
                  <span
                    style={{
                      color:
                        (split.change ?? 0) > 0
                          ? '#10b981'
                          : (split.change ?? 0) < 0
                          ? '#ef4444'
                          : '#e2e8f0',
                      fontWeight: 600,
                      fontSize: 13,
                    }}
                  >
                    {split.percentage}%
                    {split.change !== undefined && split.change !== 0 && (
                      <span style={{ fontSize: 11, marginLeft: 4 }}>
                        ({split.change > 0 ? '+' : ''}{split.change}%)
                      </span>
                    )}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (proposal.proposal_type === 'new_member' && data.invitee) {
      return (
        <div
          style={{
            background: '#1e293b',
            borderRadius: 8,
            padding: 16,
            marginBottom: 20,
          }}
        >
          <div style={{ color: '#94a3b8', fontSize: 12, fontWeight: 600, marginBottom: 8 }}>
            NEW COLLABORATOR
          </div>
          <div style={{ color: '#f8fafc', fontSize: 14, fontWeight: 500 }}>
            @{data.invitee.username}
          </div>
          <div style={{ color: '#94a3b8', fontSize: 13, marginTop: 4 }}>
            Role: {data.invitee.role} • {data.invitee.revenue_percentage}% revenue
          </div>
        </div>
      );
    }

    if (proposal.proposal_type === 'remove_member' && data.user_to_remove) {
      return (
        <div
          style={{
            background: '#ef444420',
            border: '1px solid #ef444440',
            borderRadius: 8,
            padding: 16,
            marginBottom: 20,
          }}
        >
          <div style={{ color: '#fca5a5', fontSize: 12, fontWeight: 600, marginBottom: 8 }}>
            COLLABORATOR TO REMOVE
          </div>
          <div style={{ color: '#fca5a5', fontSize: 14, fontWeight: 500 }}>
            @{data.user_to_remove.username}
          </div>
          <div style={{ color: '#f87171', fontSize: 13, marginTop: 4 }}>
            Reason: {data.reason || 'Not specified'}
          </div>
        </div>
      );
    }

    if (proposal.proposal_type === 'deadline_extension' && data.extension) {
      return (
        <div
          style={{
            background: '#1e293b',
            borderRadius: 8,
            padding: 16,
            marginBottom: 20,
          }}
        >
          <div style={{ color: '#94a3b8', fontSize: 12, fontWeight: 600, marginBottom: 8 }}>
            DEADLINE EXTENSION REQUEST
          </div>
          <div style={{ color: '#f8fafc', fontSize: 14 }}>
            Extend by: <span style={{ color: '#f59e0b', fontWeight: 600 }}>{data.extension.days} days</span>
          </div>
          {data.extension.reason && (
            <div style={{ color: '#94a3b8', fontSize: 13, marginTop: 8 }}>
              "{data.extension.reason}"
            </div>
          )}
        </div>
      );
    }

    return null;
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
          maxWidth: 500,
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: 20,
            borderBottom: '1px solid #334155',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 24 }}>{typeInfo.icon}</span>
              <span style={{ color: '#94a3b8', fontSize: 12, fontWeight: 600 }}>
                {typeInfo.label}
              </span>
            </div>
            <h2 style={{ margin: 0, color: '#f8fafc', fontSize: 18, fontWeight: 600 }}>
              {proposal.title}
            </h2>
            <div style={{ color: '#64748b', fontSize: 12, marginTop: 4 }}>
              Proposed by @{proposal.proposer_username}
            </div>
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
        <div style={{ padding: 20 }}>
          {/* Description */}
          {proposal.description && (
            <div
              style={{
                background: '#1e293b',
                borderRadius: 8,
                padding: 16,
                marginBottom: 20,
              }}
            >
              <p style={{ margin: 0, color: '#cbd5e1', fontSize: 14, lineHeight: 1.6 }}>
                {proposal.description}
              </p>
            </div>
          )}

          {/* Proposal-specific details */}
          {renderProposalDetails()}

          {/* Current votes */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ color: '#94a3b8', fontSize: 12, fontWeight: 600, marginBottom: 8 }}>
              CURRENT VOTES ({proposal.vote_counts.total}/{proposal.total_voters})
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <div
                style={{
                  flex: 1,
                  padding: 12,
                  background: '#10b98120',
                  borderRadius: 8,
                  textAlign: 'center',
                }}
              >
                <div style={{ color: '#10b981', fontSize: 20, fontWeight: 700 }}>
                  {proposal.vote_counts.approve}
                </div>
                <div style={{ color: '#10b981', fontSize: 11 }}>Approve</div>
              </div>
              <div
                style={{
                  flex: 1,
                  padding: 12,
                  background: '#64748b20',
                  borderRadius: 8,
                  textAlign: 'center',
                }}
              >
                <div style={{ color: '#94a3b8', fontSize: 20, fontWeight: 700 }}>
                  {proposal.vote_counts.abstain}
                </div>
                <div style={{ color: '#64748b', fontSize: 11 }}>Abstain</div>
              </div>
              <div
                style={{
                  flex: 1,
                  padding: 12,
                  background: '#ef444420',
                  borderRadius: 8,
                  textAlign: 'center',
                }}
              >
                <div style={{ color: '#ef4444', fontSize: 20, fontWeight: 700 }}>
                  {proposal.vote_counts.reject}
                </div>
                <div style={{ color: '#ef4444', fontSize: 11 }}>Reject</div>
              </div>
            </div>
          </div>

          {/* Vote selection */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ color: '#94a3b8', fontSize: 12, fontWeight: 600, marginBottom: 12 }}>
              CAST YOUR VOTE
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['approve', 'reject', 'abstain'] as const).map((vote) => (
                <button
                  key={vote}
                  onClick={() => setSelectedVote(vote)}
                  style={{
                    flex: 1,
                    padding: '14px 16px',
                    borderRadius: 10,
                    border:
                      selectedVote === vote
                        ? `2px solid ${
                            vote === 'approve'
                              ? '#10b981'
                              : vote === 'reject'
                              ? '#ef4444'
                              : '#64748b'
                          }`
                        : '2px solid #334155',
                    background:
                      selectedVote === vote
                        ? vote === 'approve'
                          ? '#10b98120'
                          : vote === 'reject'
                          ? '#ef444420'
                          : '#64748b20'
                        : 'transparent',
                    color:
                      selectedVote === vote
                        ? vote === 'approve'
                          ? '#10b981'
                          : vote === 'reject'
                          ? '#ef4444'
                          : '#94a3b8'
                        : '#94a3b8',
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  {vote === 'approve' && '✓ '}
                  {vote === 'reject' && '✗ '}
                  {vote === 'abstain' && '— '}
                  {vote.charAt(0).toUpperCase() + vote.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Comment */}
          <div style={{ marginBottom: 20 }}>
            <label
              style={{
                display: 'block',
                color: '#94a3b8',
                fontSize: 12,
                fontWeight: 600,
                marginBottom: 8,
              }}
            >
              COMMENT (OPTIONAL)
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Explain your vote..."
              style={{
                width: '100%',
                minHeight: 80,
                background: '#1e293b',
                border: '1px solid #334155',
                borderRadius: 8,
                padding: 12,
                color: '#f8fafc',
                fontSize: 14,
                resize: 'vertical',
              }}
            />
          </div>

          {/* Error */}
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

          {/* Actions */}
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={onClose}
              disabled={submitting}
              style={{
                flex: 1,
                padding: '14px 20px',
                borderRadius: 10,
                border: '1px solid #334155',
                background: 'transparent',
                color: '#94a3b8',
                fontSize: 14,
                fontWeight: 600,
                cursor: submitting ? 'not-allowed' : 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || !selectedVote}
              style={{
                flex: 2,
                padding: '14px 20px',
                borderRadius: 10,
                border: 'none',
                background:
                  !selectedVote
                    ? '#334155'
                    : selectedVote === 'approve'
                    ? '#10b981'
                    : selectedVote === 'reject'
                    ? '#ef4444'
                    : '#64748b',
                color: '#fff',
                fontSize: 14,
                fontWeight: 700,
                cursor: submitting || !selectedVote ? 'not-allowed' : 'pointer',
                opacity: submitting ? 0.6 : 1,
              }}
            >
              {submitting ? 'Submitting...' : 'Submit Vote'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default VotingModal;
