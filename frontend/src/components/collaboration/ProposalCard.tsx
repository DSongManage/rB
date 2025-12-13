/**
 * ProposalCard Component
 *
 * Displays an active proposal with voting status and actions.
 * Used for multi-party decisions in collaborative projects.
 */

import React, { useState } from 'react';

export interface Proposal {
  id: number;
  proposal_type: string;
  title: string;
  description: string;
  proposal_data: Record<string, any>;
  status: 'pending' | 'approved' | 'rejected' | 'expired' | 'cancelled';
  voting_threshold: 'majority' | 'unanimous' | 'owner_decides';
  proposer_username: string;
  expires_at?: string;
  created_at: string;
  votes: ProposalVote[];
  vote_counts: {
    approve: number;
    reject: number;
    abstain: number;
    total: number;
  };
  total_voters: number;
}

export interface ProposalVote {
  id: number;
  voter_id: number;
  voter_username: string;
  vote: 'approve' | 'reject' | 'abstain';
  comment?: string;
  voted_at: string;
}

interface ProposalCardProps {
  proposal: Proposal;
  currentUserId: number;
  onVote: (proposalId: number) => void;
  onViewDetails?: (proposal: Proposal) => void;
}

export function ProposalCard({
  proposal,
  currentUserId,
  onVote,
  onViewDetails,
}: ProposalCardProps) {
  const [expanded, setExpanded] = useState(false);

  // Check if current user has voted
  const myVote = proposal.votes.find((v) => v.voter_id === currentUserId);
  const hasVoted = !!myVote;

  // Calculate vote progress
  const approvePercentage =
    proposal.total_voters > 0
      ? (proposal.vote_counts.approve / proposal.total_voters) * 100
      : 0;
  const rejectPercentage =
    proposal.total_voters > 0
      ? (proposal.vote_counts.reject / proposal.total_voters) * 100
      : 0;

  // Get time remaining
  const getTimeRemaining = () => {
    if (!proposal.expires_at) return null;
    const expires = new Date(proposal.expires_at);
    const now = new Date();
    const diff = expires.getTime() - now.getTime();

    if (diff <= 0) return 'Expired';

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (days > 0) return `${days}d ${hours}h remaining`;
    if (hours > 0) return `${hours}h remaining`;
    return 'Less than 1h remaining';
  };

  // Get proposal type icon and color
  const getProposalTypeInfo = (type: string) => {
    switch (type) {
      case 'revenue_split':
        return { icon: '💰', color: '#10b981', label: 'Revenue Split' };
      case 'new_member':
        return { icon: '👤', color: '#3b82f6', label: 'New Member' };
      case 'remove_member':
        return { icon: '🚫', color: '#ef4444', label: 'Remove Member' };
      case 'deadline_extension':
        return { icon: '⏰', color: '#f59e0b', label: 'Deadline Extension' };
      case 'project_change':
        return { icon: '📝', color: '#8b5cf6', label: 'Project Change' };
      case 'exit_collaborator':
        return { icon: '🚪', color: '#ef4444', label: 'Exit Request' };
      default:
        return { icon: '📋', color: '#64748b', label: type };
    }
  };

  // Get status badge
  const getStatusBadge = () => {
    switch (proposal.status) {
      case 'pending':
        return { text: 'Voting', color: '#f59e0b', bg: '#f59e0b20' };
      case 'approved':
        return { text: 'Approved', color: '#10b981', bg: '#10b98120' };
      case 'rejected':
        return { text: 'Rejected', color: '#ef4444', bg: '#ef444420' };
      case 'expired':
        return { text: 'Expired', color: '#64748b', bg: '#64748b20' };
      case 'cancelled':
        return { text: 'Cancelled', color: '#64748b', bg: '#64748b20' };
      default:
        return { text: proposal.status, color: '#64748b', bg: '#64748b20' };
    }
  };

  const typeInfo = getProposalTypeInfo(proposal.proposal_type);
  const statusBadge = getStatusBadge();
  const timeRemaining = getTimeRemaining();

  return (
    <div
      style={{
        background: '#0f172a',
        border: `1px solid ${proposal.status === 'pending' ? '#f59e0b40' : '#1e293b'}`,
        borderRadius: 12,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: 16,
          borderBottom: '1px solid #1e293b',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12,
        }}
      >
        {/* Type Icon */}
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 10,
            background: `${typeInfo.color}20`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 22,
            flexShrink: 0,
          }}
        >
          {typeInfo.icon}
        </div>

        {/* Title & Meta */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span
              style={{
                color: typeInfo.color,
                fontSize: 11,
                fontWeight: 600,
                textTransform: 'uppercase',
              }}
            >
              {typeInfo.label}
            </span>
            <span
              style={{
                background: statusBadge.bg,
                color: statusBadge.color,
                padding: '2px 8px',
                borderRadius: 4,
                fontSize: 10,
                fontWeight: 600,
              }}
            >
              {statusBadge.text}
            </span>
          </div>
          <h4 style={{ margin: 0, color: '#f8fafc', fontSize: 15, fontWeight: 600 }}>
            {proposal.title}
          </h4>
          <div style={{ color: '#64748b', fontSize: 12, marginTop: 4 }}>
            by @{proposal.proposer_username}
            {timeRemaining && proposal.status === 'pending' && (
              <>
                {' '}
                <span style={{ color: '#f59e0b' }}>• {timeRemaining}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Vote Progress */}
      {proposal.status === 'pending' && (
        <div style={{ padding: '12px 16px', background: '#1e293b40' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ color: '#94a3b8', fontSize: 12 }}>
              Votes: {proposal.vote_counts.total}/{proposal.total_voters}
            </span>
            <span style={{ color: '#64748b', fontSize: 11 }}>
              {proposal.voting_threshold === 'unanimous'
                ? 'Unanimous required'
                : proposal.voting_threshold === 'majority'
                ? 'Majority required'
                : 'Owner decides'}
            </span>
          </div>

          {/* Progress bar */}
          <div
            style={{
              height: 8,
              background: '#334155',
              borderRadius: 4,
              overflow: 'hidden',
              display: 'flex',
            }}
          >
            <div
              style={{
                width: `${approvePercentage}%`,
                background: '#10b981',
                transition: 'width 0.3s',
              }}
            />
            <div
              style={{
                width: `${rejectPercentage}%`,
                background: '#ef4444',
                transition: 'width 0.3s',
              }}
            />
          </div>

          {/* Vote counts */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: 6,
              fontSize: 11,
            }}
          >
            <span style={{ color: '#10b981' }}>
              {proposal.vote_counts.approve} approve
            </span>
            <span style={{ color: '#64748b' }}>
              {proposal.vote_counts.abstain} abstain
            </span>
            <span style={{ color: '#ef4444' }}>
              {proposal.vote_counts.reject} reject
            </span>
          </div>
        </div>
      )}

      {/* Description (expandable) */}
      {proposal.description && (
        <div style={{ padding: '0 16px' }}>
          <button
            onClick={() => setExpanded(!expanded)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#64748b',
              fontSize: 12,
              cursor: 'pointer',
              padding: '8px 0',
              width: '100%',
              textAlign: 'left',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            {expanded ? '▼' : '▶'} Details
          </button>
          {expanded && (
            <p
              style={{
                margin: '0 0 12px',
                color: '#94a3b8',
                fontSize: 13,
                lineHeight: 1.5,
              }}
            >
              {proposal.description}
            </p>
          )}
        </div>
      )}

      {/* Recent votes */}
      {proposal.votes.length > 0 && (
        <div style={{ padding: '8px 16px', borderTop: '1px solid #1e293b' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {proposal.votes.slice(0, 5).map((vote) => (
              <div
                key={vote.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '4px 8px',
                  background:
                    vote.vote === 'approve'
                      ? '#10b98115'
                      : vote.vote === 'reject'
                      ? '#ef444415'
                      : '#64748b15',
                  borderRadius: 4,
                  fontSize: 11,
                }}
              >
                <span
                  style={{
                    color:
                      vote.vote === 'approve'
                        ? '#10b981'
                        : vote.vote === 'reject'
                        ? '#ef4444'
                        : '#64748b',
                  }}
                >
                  {vote.vote === 'approve' ? '✓' : vote.vote === 'reject' ? '✗' : '—'}
                </span>
                <span style={{ color: '#94a3b8' }}>@{vote.voter_username}</span>
              </div>
            ))}
            {proposal.votes.length > 5 && (
              <span style={{ color: '#64748b', fontSize: 11, padding: '4px 8px' }}>
                +{proposal.votes.length - 5} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      {proposal.status === 'pending' && (
        <div
          style={{
            padding: 16,
            borderTop: '1px solid #1e293b',
            display: 'flex',
            gap: 8,
          }}
        >
          {hasVoted ? (
            <div
              style={{
                flex: 1,
                padding: '10px 16px',
                background:
                  myVote.vote === 'approve'
                    ? '#10b98120'
                    : myVote.vote === 'reject'
                    ? '#ef444420'
                    : '#64748b20',
                borderRadius: 8,
                color:
                  myVote.vote === 'approve'
                    ? '#10b981'
                    : myVote.vote === 'reject'
                    ? '#ef4444'
                    : '#94a3b8',
                fontSize: 13,
                fontWeight: 500,
                textAlign: 'center',
              }}
            >
              You voted: {myVote.vote.charAt(0).toUpperCase() + myVote.vote.slice(1)}
            </div>
          ) : (
            <button
              onClick={() => onVote(proposal.id)}
              style={{
                flex: 1,
                padding: '10px 16px',
                borderRadius: 8,
                border: 'none',
                background: '#f59e0b',
                color: '#000',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              Cast Your Vote
            </button>
          )}
          {onViewDetails && (
            <button
              onClick={() => onViewDetails(proposal)}
              style={{
                padding: '10px 16px',
                borderRadius: 8,
                border: '1px solid #334155',
                background: 'transparent',
                color: '#94a3b8',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              View
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default ProposalCard;
