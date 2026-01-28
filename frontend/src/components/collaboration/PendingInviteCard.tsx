/**
 * PendingInviteCard Component
 *
 * Displays a summary card for pending collaboration invites
 * with quick Accept/Decline actions.
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Book, Music, Video, Image, FileText, Layers, CheckSquare, Square, Shield } from 'lucide-react';
import {
  collaborationApi,
  CollaborativeProject,
  CollaboratorRole,
} from '../../services/collaborationApi';

interface PendingInviteCardProps {
  project: CollaborativeProject;
  myInvite: CollaboratorRole;
  onAction: () => void; // Called after accept/decline to refresh
  onViewDetails: (projectId: number) => void; // Open full modal
}

export function PendingInviteCard({
  project,
  myInvite,
  onAction,
  onViewDetails,
}: PendingInviteCardProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState<'accept' | 'decline' | null>(null);
  const [error, setError] = useState('');
  const [warrantyAcknowledged, setWarrantyAcknowledged] = useState(false);

  // Get project creator info
  const creator = project.collaborators.find(
    (c) => c.user === project.created_by
  );

  const getContentTypeIcon = (type: string) => {
    const iconProps = { size: 20, strokeWidth: 2 };
    switch (type) {
      case 'book': return <Book {...iconProps} />;
      case 'comic': return <Layers {...iconProps} />;
      case 'music': return <Music {...iconProps} />;
      case 'video': return <Video {...iconProps} />;
      case 'art': return <Image {...iconProps} />;
      default: return <FileText {...iconProps} />;
    }
  };

  const handleAccept = async (e: React.MouseEvent) => {
    e.stopPropagation();

    // Require warranty acknowledgment
    if (!warrantyAcknowledged) {
      setError('Please acknowledge the warranty of originality to accept');
      return;
    }

    setLoading('accept');
    setError('');
    try {
      await collaborationApi.acceptInvitation(project.id, warrantyAcknowledged);
      onAction();
      navigate(`/studio/${project.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to accept');
      setLoading(null);
    }
  };

  const handleDecline = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setLoading('decline');
    setError('');
    try {
      await collaborationApi.declineInvitation(project.id);
      onAction();
    } catch (err: any) {
      setError(err.message || 'Failed to decline');
      setLoading(null);
    }
  };

  return (
    <div
      onClick={() => onViewDetails(project.id)}
      style={{
        background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
        border: '1px solid #f59e0b40',
        borderRadius: 12,
        padding: 16,
        cursor: 'pointer',
        transition: 'all 0.2s',
        position: 'relative',
        overflow: 'hidden',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = '#f59e0b80';
        e.currentTarget.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = '#f59e0b40';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      {/* Pending Badge */}
      <div
        style={{
          position: 'absolute',
          top: 12,
          right: 12,
          background: '#f59e0b',
          color: '#000',
          padding: '4px 10px',
          borderRadius: 20,
          fontSize: 11,
          fontWeight: 700,
          textTransform: 'uppercase',
        }}
      >
        Pending
      </div>

      {/* Project Info */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
        <div
          style={{
            fontSize: 28,
            width: 48,
            height: 48,
            background: '#f59e0b20',
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {getContentTypeIcon(project.content_type)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3
            style={{
              margin: 0,
              color: '#f8fafc',
              fontSize: 16,
              fontWeight: 600,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: 200,
            }}
          >
            {project.title}
          </h3>
          <div style={{ color: '#94a3b8', fontSize: 13, marginTop: 2 }}>
            from <span style={{ color: '#f59e0b' }}>@{creator?.username}</span>
          </div>
        </div>
      </div>

      {/* Role & Split */}
      <div
        style={{
          display: 'flex',
          gap: 16,
          marginBottom: 12,
          padding: '10px 12px',
          background: '#0f172a',
          borderRadius: 8,
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ color: '#64748b', fontSize: 11, textTransform: 'uppercase', marginBottom: 2 }}>
            Your Role
          </div>
          <div style={{ color: '#e2e8f0', fontSize: 14, fontWeight: 500 }}>
            {myInvite.role}
          </div>
        </div>
        <div
          style={{
            width: 1,
            background: '#334155',
          }}
        />
        <div style={{ flex: 1 }}>
          <div style={{ color: '#64748b', fontSize: 11, textTransform: 'uppercase', marginBottom: 2 }}>
            Revenue
          </div>
          <div style={{ color: '#10b981', fontSize: 14, fontWeight: 600 }}>
            {myInvite.revenue_percentage}%
          </div>
        </div>
      </div>

      {/* Warranty of Originality Acknowledgment */}
      <div
        onClick={(e) => {
          e.stopPropagation();
          setWarrantyAcknowledged(!warrantyAcknowledged);
        }}
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 10,
          padding: '10px 12px',
          marginBottom: 12,
          background: warrantyAcknowledged ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.05)',
          border: `1px solid ${warrantyAcknowledged ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.2)'}`,
          borderRadius: 8,
          cursor: 'pointer',
          transition: 'all 0.2s',
        }}
      >
        <div style={{ flexShrink: 0, marginTop: 2 }}>
          {warrantyAcknowledged ? (
            <CheckSquare size={18} style={{ color: '#10b981' }} />
          ) : (
            <Square size={18} style={{ color: '#64748b' }} />
          )}
        </div>
        <div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginBottom: 4,
          }}>
            <Shield size={14} style={{ color: warrantyAcknowledged ? '#10b981' : '#f59e0b' }} />
            <span style={{
              color: warrantyAcknowledged ? '#10b981' : '#f59e0b',
              fontSize: 12,
              fontWeight: 600,
            }}>
              Warranty of Originality
            </span>
          </div>
          <div style={{ color: '#94a3b8', fontSize: 11, lineHeight: 1.4 }}>
            I acknowledge that my contributions will be original work and do not infringe on any third-party rights.
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div
          style={{
            background: '#ef444420',
            color: '#fca5a5',
            padding: 8,
            borderRadius: 6,
            fontSize: 12,
            marginBottom: 12,
          }}
        >
          {error}
        </div>
      )}

      {/* Quick Actions */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={handleDecline}
          disabled={!!loading}
          style={{
            flex: 1,
            padding: '10px 16px',
            borderRadius: 8,
            border: '1px solid #64748b',
            background: 'transparent',
            color: '#94a3b8',
            fontSize: 13,
            fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1,
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            if (!loading) {
              e.currentTarget.style.borderColor = '#ef4444';
              e.currentTarget.style.color = '#ef4444';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = '#64748b';
            e.currentTarget.style.color = '#94a3b8';
          }}
        >
          {loading === 'decline' ? 'Declining...' : 'Decline'}
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onViewDetails(project.id);
          }}
          style={{
            flex: 1,
            padding: '10px 16px',
            borderRadius: 8,
            border: '1px solid #3b82f6',
            background: 'transparent',
            color: '#3b82f6',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#3b82f620';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
          }}
        >
          View Details
        </button>
        <button
          onClick={handleAccept}
          disabled={!!loading}
          style={{
            flex: 1.5,
            padding: '10px 16px',
            borderRadius: 8,
            border: 'none',
            background: '#10b981',
            color: '#fff',
            fontSize: 13,
            fontWeight: 700,
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1,
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            if (!loading) {
              e.currentTarget.style.background = '#059669';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#10b981';
          }}
        >
          {loading === 'accept' ? 'Accepting...' : 'Accept'}
        </button>
      </div>

      {/* Time ago */}
      <div style={{ textAlign: 'center', marginTop: 10, color: '#64748b', fontSize: 11 }}>
        Invited {formatTimeAgo(myInvite.invited_at)}
      </div>
    </div>
  );
}

// Helper function to format time ago
function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
}

export default PendingInviteCard;
