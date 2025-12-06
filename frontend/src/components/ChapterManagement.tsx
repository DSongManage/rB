/**
 * ChapterManagement Component
 *
 * Manages chapter removal and delisting with two-tier policy:
 * - Remove completely (permanent delete) if zero sales
 * - Delist from marketplace (hide but preserve access) if has sales
 */

import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Trash2,
  EyeOff,
  Eye,
  Loader,
  CheckCircle,
  XCircle,
  Info
} from 'lucide-react';
import { API_URL } from '../config';

/**
 * Get fresh CSRF token from API
 */
async function getFreshCsrfToken(): Promise<string> {
  try {
    const response = await fetch(`${API_URL}/api/auth/csrf/`, {
      credentials: 'include',
    });
    const data = await response.json();
    return data?.csrfToken || '';
  } catch (error) {
    console.error('Failed to fetch CSRF token:', error);
    return '';
  }
}

interface Chapter {
  id: number;
  title: string;
  order: number;
  is_published: boolean;
}

interface RemovalStatus {
  chapter_id: number;
  title: string;
  is_listed: boolean;
  delisted_at: string | null;
  delisted_by: string | null;
  delisted_reason: string;
  purchase_count: number;
  has_sales: boolean;
  can_remove_completely: boolean;
  can_delist: boolean;
  is_collaborative: boolean;
  pending_delist_request: {
    id: number;
    requested_by: string;
    reason: string;
    created_at: string;
    approvals_count: number;
    total_collaborators: number;
    status: string;
  } | null;
}

interface ChapterManagementProps {
  chapter: Chapter;
  onStatusChange?: () => void;
}

const ChapterManagement: React.FC<ChapterManagementProps> = ({ chapter, onStatusChange }) => {
  const [status, setStatus] = useState<RemovalStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [showDelistModal, setShowDelistModal] = useState(false);
  const [reason, setReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchRemovalStatus();
  }, [chapter.id]);

  const fetchRemovalStatus = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/chapters/${chapter.id}/removal-status/`, {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        setStatus(data);
      } else if (response.status === 404) {
        // Chapter was deleted, don't show error
        console.log('[ChapterManagement] Chapter no longer exists');
      }
    } catch (error) {
      console.error('Error fetching removal status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async () => {
    if (!status?.can_remove_completely) return;

    setActionLoading(true);
    setMessage(null);

    try {
      const csrfToken = await getFreshCsrfToken();
      const response = await fetch(`${API_URL}/api/chapters/${chapter.id}/remove/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrfToken,
          'X-Requested-With': 'XMLHttpRequest',
        },
        credentials: 'include',
        body: JSON.stringify({ reason })
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: 'success', text: data.message });
        setShowRemoveModal(false);

        // Chapter was deleted - wait a moment then trigger navigation
        setTimeout(() => {
          if (onStatusChange) {
            onStatusChange();
          }
        }, 500);
      } else {
        setMessage({ type: 'error', text: data.error });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to remove chapter' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelist = async () => {
    if (!status?.can_delist || !reason.trim()) return;

    setActionLoading(true);
    setMessage(null);

    try {
      const csrfToken = await getFreshCsrfToken();
      const response = await fetch(`${API_URL}/api/chapters/${chapter.id}/delist/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrfToken,
          'X-Requested-With': 'XMLHttpRequest',
        },
        credentials: 'include',
        body: JSON.stringify({ reason })
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: 'success', text: data.message });
        setShowDelistModal(false);
        setReason('');
        fetchRemovalStatus();
        onStatusChange?.();
      } else {
        setMessage({ type: 'error', text: data.error });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to delist chapter' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleRelist = async () => {
    setActionLoading(true);
    setMessage(null);

    try {
      const csrfToken = await getFreshCsrfToken();
      const response = await fetch(`${API_URL}/api/chapters/${chapter.id}/relist/`, {
        method: 'POST',
        headers: {
          'X-CSRFToken': csrfToken,
          'X-Requested-With': 'XMLHttpRequest',
        },
        credentials: 'include'
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: 'success', text: data.message });
        fetchRemovalStatus();
        onStatusChange?.();
      } else {
        setMessage({ type: 'error', text: data.error });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to relist chapter' });
    } finally {
      setActionLoading(false);
    }
  };

  if (loading || !status) {
    return (
      <div style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} />
        <span>Loading status...</span>
      </div>
    );
  }

  return (
    <div style={{ padding: 16, background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8 }}>
      {/* Status Messages */}
      {message && (
        <div style={{
          padding: 12,
          marginBottom: 16,
          borderRadius: 8,
          background: message.type === 'success' ? '#064e3b' : '#7f1d1d',
          border: `1px solid ${message.type === 'success' ? '#10b981' : '#ef4444'}`,
          display: 'flex',
          alignItems: 'center',
          gap: 8
        }}>
          {message.type === 'success' ? <CheckCircle size={20} /> : <XCircle size={20} />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Chapter Status */}
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
          Chapter Removal Management
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: '#94a3b8' }}>Status:</span>
            {status.is_listed ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#10b981' }}>
                <Eye size={16} /> Listed on marketplace
              </span>
            ) : (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#f59e0b' }}>
                <EyeOff size={16} /> Delisted from marketplace
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: '#94a3b8' }}>NFTs sold:</span>
            <span style={{ fontWeight: 600 }}>{status.purchase_count}</span>
          </div>
          {status.is_collaborative && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Info size={16} style={{ color: '#3b82f6' }} />
              <span style={{ color: '#94a3b8' }}>Collaborative content (requires unanimous approval)</span>
            </div>
          )}
        </div>
      </div>

      {/* Delisted Info */}
      {!status.is_listed && status.delisted_at && (
        <div style={{
          padding: 12,
          marginBottom: 16,
          background: '#1e293b',
          border: '1px solid #334155',
          borderRadius: 8
        }}>
          <div style={{ fontSize: 14, marginBottom: 4 }}>
            <strong>Delisted by:</strong> {status.delisted_by}
          </div>
          <div style={{ fontSize: 14, marginBottom: 4 }}>
            <strong>Date:</strong> {new Date(status.delisted_at).toLocaleDateString()}
          </div>
          {status.delisted_reason && (
            <div style={{ fontSize: 14 }}>
              <strong>Reason:</strong> {status.delisted_reason}
            </div>
          )}
        </div>
      )}

      {/* Pending Delist Request */}
      {status.pending_delist_request && (
        <div style={{
          padding: 12,
          marginBottom: 16,
          background: '#422006',
          border: '1px solid #f59e0b',
          borderRadius: 8
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <AlertTriangle size={16} style={{ color: '#f59e0b' }} />
            <strong>Pending Delist Request</strong>
          </div>
          <div style={{ fontSize: 14, color: '#94a3b8' }}>
            <div>Requested by: <strong>{status.pending_delist_request.requested_by}</strong></div>
            <div>Approvals: {status.pending_delist_request.approvals_count} / {status.pending_delist_request.total_collaborators}</div>
            <div>Reason: {status.pending_delist_request.reason}</div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: 12 }}>
        {/* Remove Completely Button */}
        {status.can_remove_completely && status.is_listed && (
          <button
            onClick={() => setShowRemoveModal(true)}
            disabled={actionLoading}
            style={{
              padding: '10px 16px',
              background: '#7f1d1d',
              border: '1px solid #ef4444',
              borderRadius: 8,
              color: 'white',
              cursor: actionLoading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 14,
              fontWeight: 500
            }}
          >
            <Trash2 size={16} />
            Remove Permanently
          </button>
        )}

        {/* Delist Button */}
        {status.has_sales && status.can_delist && status.is_listed && !status.pending_delist_request && (
          <button
            onClick={() => setShowDelistModal(true)}
            disabled={actionLoading}
            style={{
              padding: '10px 16px',
              background: '#422006',
              border: '1px solid #f59e0b',
              borderRadius: 8,
              color: 'white',
              cursor: actionLoading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 14,
              fontWeight: 500
            }}
          >
            <EyeOff size={16} />
            Delist from Marketplace
          </button>
        )}

        {/* Relist Button */}
        {!status.is_listed && status.can_delist && (
          <button
            onClick={handleRelist}
            disabled={actionLoading}
            style={{
              padding: '10px 16px',
              background: '#064e3b',
              border: '1px solid #10b981',
              borderRadius: 8,
              color: 'white',
              cursor: actionLoading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 14,
              fontWeight: 500
            }}
          >
            {actionLoading ? <Loader size={16} /> : <Eye size={16} />}
            Relist on Marketplace
          </button>
        )}
      </div>

      {/* Remove Modal */}
      {showRemoveModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          display: 'grid',
          placeItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: '#0f172a',
            border: '1px solid #1e293b',
            borderRadius: 16,
            padding: 24,
            maxWidth: 500,
            width: '90%'
          }}>
            <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle style={{ color: '#ef4444' }} />
              Permanently Remove Chapter
            </h2>
            <p style={{ marginBottom: 16, color: '#94a3b8' }}>
              This will <strong>permanently delete</strong> this chapter from the database.
              This action cannot be undone.
            </p>
            <p style={{ marginBottom: 16, color: '#94a3b8' }}>
              Are you sure you want to remove "{chapter.title}"?
            </p>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Optional: Reason for removal (for audit logs)"
              style={{
                width: '100%',
                minHeight: 80,
                padding: 12,
                background: '#1e293b',
                border: '1px solid #334155',
                borderRadius: 8,
                color: 'white',
                marginBottom: 16,
                resize: 'vertical'
              }}
            />
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowRemoveModal(false)}
                disabled={actionLoading}
                style={{
                  padding: '10px 20px',
                  background: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: 8,
                  color: 'white',
                  cursor: actionLoading ? 'not-allowed' : 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleRemove}
                disabled={actionLoading}
                style={{
                  padding: '10px 20px',
                  background: '#7f1d1d',
                  border: '1px solid #ef4444',
                  borderRadius: 8,
                  color: 'white',
                  cursor: actionLoading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}
              >
                {actionLoading ? <Loader size={16} /> : <Trash2 size={16} />}
                Remove Permanently
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delist Modal */}
      {showDelistModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          display: 'grid',
          placeItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: '#0f172a',
            border: '1px solid #1e293b',
            borderRadius: 16,
            padding: 24,
            maxWidth: 500,
            width: '90%'
          }}>
            <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <EyeOff style={{ color: '#f59e0b' }} />
              Delist from Marketplace
            </h2>
            <p style={{ marginBottom: 16, color: '#94a3b8' }}>
              This will <strong>hide</strong> this chapter from the marketplace, but NFT holders
              will still have access to their purchased content.
            </p>
            {status.is_collaborative && (
              <p style={{ marginBottom: 16, color: '#f59e0b', fontSize: 14 }}>
                This is collaborative content. All collaborators must approve before delisting.
              </p>
            )}
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason for delisting (required) *"
              required
              style={{
                width: '100%',
                minHeight: 80,
                padding: 12,
                background: '#1e293b',
                border: `1px solid ${!reason.trim() ? '#ef4444' : '#334155'}`,
                borderRadius: 8,
                color: 'white',
                marginBottom: 16,
                resize: 'vertical'
              }}
            />
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowDelistModal(false);
                  setReason('');
                }}
                disabled={actionLoading}
                style={{
                  padding: '10px 20px',
                  background: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: 8,
                  color: 'white',
                  cursor: actionLoading ? 'not-allowed' : 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDelist}
                disabled={actionLoading || !reason.trim()}
                style={{
                  padding: '10px 20px',
                  background: '#422006',
                  border: '1px solid #f59e0b',
                  borderRadius: 8,
                  color: 'white',
                  cursor: (actionLoading || !reason.trim()) ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  opacity: !reason.trim() ? 0.5 : 1
                }}
              >
                {actionLoading ? <Loader size={16} /> : <EyeOff size={16} />}
                {status.is_collaborative ? 'Request Delist Approval' : 'Delist Now'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChapterManagement;
