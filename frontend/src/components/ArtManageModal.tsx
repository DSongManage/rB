import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../config';
import { Eye, ExternalLink, Users, AlertTriangle } from 'lucide-react';

interface Collaborator {
  username: string;
  role: string;
  revenue_percentage: number;
}

interface ArtManageModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: {
    id: number;
    title: string;
    teaser_link: string;
    content_type: string;
    is_collaborative: boolean;
    source_project_id?: number | null;
    collaborators?: Collaborator[];
  };
  onUnpublished: () => void;
}

export function ArtManageModal({ isOpen, onClose, item, onUnpublished }: ArtManageModalProps) {
  const navigate = useNavigate();
  const [showConfirm, setShowConfirm] = useState(false);
  const [unpublishing, setUnpublishing] = useState(false);
  const [requestingUnpublish, setRequestingUnpublish] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  if (!isOpen) return null;

  const handleView = () => {
    navigate(`/reader/${item.id}`);
    onClose();
  };

  const handleUnpublish = async () => {
    setUnpublishing(true);
    setError('');

    try {
      const response = await fetch(`${API_URL}/api/content/${item.id}/unpublish/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (response.ok) {
        setSuccess('Content unpublished successfully');
        setTimeout(() => {
          onUnpublished();
          onClose();
        }, 1500);
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to unpublish content');
      }
    } catch (err) {
      console.error('Unpublish error:', err);
      setError('Network error. Please try again.');
    } finally {
      setUnpublishing(false);
    }
  };

  const handleRequestUnpublish = async () => {
    if (!item.source_project_id) {
      setError('Project not found');
      return;
    }

    setRequestingUnpublish(true);
    setError('');

    try {
      const response = await fetch(
        `${API_URL}/api/collaborative-projects/${item.source_project_id}/proposals/`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            proposal_type: 'unpublish_content',
            title: `Unpublish "${item.title}"`,
            description: 'Request to remove this content from the marketplace. All collaborators must approve.',
            voting_threshold: 'unanimous',
            proposal_data: {
              content_id: item.id,
              content_title: item.title,
            },
          }),
        }
      );

      if (response.ok) {
        setSuccess('Unpublish request sent to collaborators');
        setTimeout(() => {
          onClose();
        }, 2000);
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to create proposal');
      }
    } catch (err) {
      console.error('Request unpublish error:', err);
      setError('Network error. Please try again.');
    } finally {
      setRequestingUnpublish(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.85)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#0f172a',
          border: '1px solid #334155',
          borderRadius: '16px',
          maxWidth: '500px',
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px',
            borderBottom: '1px solid #334155',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
            Manage Content
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              fontSize: '24px',
              cursor: 'pointer',
              padding: '0',
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {/* Content Preview */}
        <div style={{ padding: '20px' }}>
          {/* Art Preview */}
          <div
            style={{
              width: '100%',
              paddingTop: '56.25%',
              background: item.teaser_link
                ? `url(${item.teaser_link})`
                : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              borderRadius: '12px',
              marginBottom: '16px',
              position: 'relative',
            }}
          />

          {/* Title and Type */}
          <h3
            style={{
              fontSize: '20px',
              fontWeight: 600,
              color: '#f8fafc',
              margin: '0 0 8px 0',
            }}
          >
            {item.title}
          </h3>
          <div
            style={{
              display: 'inline-block',
              background: '#1e293b',
              padding: '4px 10px',
              borderRadius: '6px',
              fontSize: '12px',
              color: '#94a3b8',
              textTransform: 'capitalize',
              marginBottom: '20px',
            }}
          >
            {item.content_type}
          </div>

          {/* Collaborative Info */}
          {item.is_collaborative && item.collaborators && item.collaborators.length > 0 && (
            <div
              style={{
                background: '#1e293b',
                borderRadius: '10px',
                padding: '16px',
                marginBottom: '20px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '12px',
                  color: '#f59e0b',
                  fontSize: '13px',
                  fontWeight: 600,
                }}
              >
                <Users size={16} />
                Collaborative Content
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {item.collaborators.map((collab) => (
                  <div
                    key={collab.username}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: '13px',
                    }}
                  >
                    <span style={{ color: '#e2e8f0' }}>@{collab.username}</span>
                    <span style={{ color: '#64748b' }}>
                      {collab.role} • {collab.revenue_percentage}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div
              style={{
                background: '#10b98120',
                border: '1px solid #10b981',
                color: '#10b981',
                padding: '12px',
                borderRadius: '8px',
                fontSize: '14px',
                marginBottom: '16px',
                textAlign: 'center',
              }}
            >
              {success}
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div
              style={{
                background: '#ef444420',
                border: '1px solid #ef4444',
                color: '#fca5a5',
                padding: '12px',
                borderRadius: '8px',
                fontSize: '14px',
                marginBottom: '16px',
              }}
            >
              {error}
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* View Button */}
            <button
              onClick={handleView}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                border: 'none',
                color: '#000',
                padding: '14px 20px',
                borderRadius: '10px',
                fontSize: '15px',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'transform 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
            >
              <Eye size={18} />
              View Content
            </button>

            {/* Unpublish Section */}
            {!showConfirm ? (
              <button
                onClick={() => setShowConfirm(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  background: 'transparent',
                  border: '1px solid #ef4444',
                  color: '#ef4444',
                  padding: '14px 20px',
                  borderRadius: '10px',
                  fontSize: '15px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#ef444420';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <ExternalLink size={18} />
                Unpublish
              </button>
            ) : (
              <div
                style={{
                  background: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '10px',
                  padding: '16px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                    marginBottom: '16px',
                  }}
                >
                  <AlertTriangle size={20} style={{ color: '#f59e0b', flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <div style={{ color: '#f8fafc', fontSize: '14px', fontWeight: 600, marginBottom: 4 }}>
                      {item.is_collaborative
                        ? 'Request Unpublish Approval'
                        : 'Confirm Unpublish'}
                    </div>
                    <div style={{ color: '#94a3b8', fontSize: '13px', lineHeight: 1.5 }}>
                      {item.is_collaborative
                        ? 'This will create a proposal that requires unanimous approval from all collaborators.'
                        : 'This will remove your content from the marketplace. This action can be undone by republishing.'}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    onClick={() => setShowConfirm(false)}
                    disabled={unpublishing || requestingUnpublish}
                    style={{
                      flex: 1,
                      padding: '12px',
                      borderRadius: '8px',
                      border: '1px solid #334155',
                      background: 'transparent',
                      color: '#94a3b8',
                      fontSize: '14px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={item.is_collaborative ? handleRequestUnpublish : handleUnpublish}
                    disabled={unpublishing || requestingUnpublish}
                    style={{
                      flex: 2,
                      padding: '12px',
                      borderRadius: '8px',
                      border: 'none',
                      background: '#ef4444',
                      color: '#fff',
                      fontSize: '14px',
                      fontWeight: 700,
                      cursor: unpublishing || requestingUnpublish ? 'not-allowed' : 'pointer',
                      opacity: unpublishing || requestingUnpublish ? 0.6 : 1,
                    }}
                  >
                    {unpublishing || requestingUnpublish
                      ? 'Processing...'
                      : item.is_collaborative
                      ? 'Request Unpublish'
                      : 'Confirm Unpublish'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ArtManageModal;
