/**
 * DelistApprovals Component
 *
 * Displays pending delist requests for collaborative content
 * that require the user's approval.
 */

import React, { useState, useEffect } from 'react';
import {
  CheckCircle,
  XCircle,
  Loader,
  AlertTriangle,
  Clock,
  Users,
  MessageSquare
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

interface PendingRequest {
  id: number;
  chapter: {
    id: number;
    title: string;
    book_project: string;
  };
  requested_by: {
    username: string;
  };
  reason: string;
  created_at: string;
  approvals_count: number;
  total_collaborators: number;
  user_has_responded: boolean;
  user_approved: boolean | null;
  user_response_note: string | null;
}

const DelistApprovals: React.FC = () => {
  const [requests, setRequests] = useState<PendingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [showResponseModal, setShowResponseModal] = useState<PendingRequest | null>(null);
  const [responseNote, setResponseNote] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchPendingRequests();
  }, []);

  const fetchPendingRequests = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/delist-approvals/pending/`, {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        setRequests(data.pending_requests || []);
      }
    } catch (error) {
      console.error('Error fetching pending requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRespond = async (requestId: number, approved: boolean) => {
    setActionLoading(requestId);
    setMessage(null);

    try {
      const csrfToken = await getFreshCsrfToken();
      const response = await fetch(`${API_URL}/api/delist-approvals/${requestId}/respond/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrfToken,
          'X-Requested-With': 'XMLHttpRequest',
        },
        credentials: 'include',
        body: JSON.stringify({
          approved,
          response_note: responseNote
        })
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({
          type: 'success',
          text: approved ? 'Approved successfully' : 'Rejected successfully'
        });
        setShowResponseModal(null);
        setResponseNote('');
        fetchPendingRequests();
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to respond' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to respond to request' });
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div style={{
        padding: 32,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 16
      }}>
        <Loader size={32} style={{ animation: 'spin 1s linear infinite' }} />
        <p style={{ color: '#94a3b8' }}>Loading pending requests...</p>
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div style={{
        padding: 32,
        textAlign: 'center',
        background: '#0f172a',
        border: '1px solid #1e293b',
        borderRadius: 12
      }}>
        <CheckCircle size={48} style={{ color: '#10b981', margin: '0 auto 16px' }} />
        <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
          No Pending Approvals
        </h3>
        <p style={{ color: '#94a3b8', fontSize: 14 }}>
          You have no pending delist requests to review.
        </p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>
          Pending Delist Approvals
        </h2>
        <p style={{ color: '#94a3b8', fontSize: 14 }}>
          Review requests from collaborators to delist content from the marketplace.
        </p>
      </div>

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

      {/* Requests List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {requests.map((request) => (
          <div
            key={request.id}
            style={{
              background: '#0f172a',
              border: '1px solid #1e293b',
              borderRadius: 12,
              padding: 20,
              transition: 'all 0.2s'
            }}
          >
            {/* Request Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>
                  {request.chapter.title}
                </h3>
                <p style={{ color: '#94a3b8', fontSize: 14 }}>
                  {request.chapter.book_project}
                </p>
              </div>
              {request.user_has_responded ? (
                <div style={{
                  padding: '6px 12px',
                  background: request.user_approved ? '#064e3b' : '#7f1d1d',
                  border: `1px solid ${request.user_approved ? '#10b981' : '#ef4444'}`,
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}>
                  {request.user_approved ? <CheckCircle size={14} /> : <XCircle size={14} />}
                  {request.user_approved ? 'Approved' : 'Rejected'}
                </div>
              ) : (
                <div style={{
                  padding: '6px 12px',
                  background: '#422006',
                  border: '1px solid #f59e0b',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}>
                  <Clock size={14} />
                  Awaiting Your Response
                </div>
              )}
            </div>

            {/* Request Details */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
                <span style={{ color: '#94a3b8' }}>Requested by:</span>
                <span style={{ fontWeight: 600 }}>{request.requested_by.username}</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
                <Users size={16} style={{ color: '#94a3b8' }} />
                <span style={{ color: '#94a3b8' }}>Progress:</span>
                <span style={{ fontWeight: 600 }}>
                  {request.approvals_count} / {request.total_collaborators} approved
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
                <Clock size={16} style={{ color: '#94a3b8' }} />
                <span style={{ color: '#94a3b8' }}>
                  {new Date(request.created_at).toLocaleDateString()}
                </span>
              </div>

              {/* Reason */}
              <div style={{
                padding: 12,
                background: '#1e293b',
                border: '1px solid #334155',
                borderRadius: 8,
                fontSize: 14
              }}>
                <div style={{ color: '#94a3b8', marginBottom: 4, fontSize: 12, textTransform: 'uppercase' }}>
                  Reason for Delisting
                </div>
                <div style={{ color: 'white' }}>{request.reason}</div>
              </div>

              {/* User's Previous Response */}
              {request.user_has_responded && request.user_response_note && (
                <div style={{
                  padding: 12,
                  background: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: 8,
                  fontSize: 14
                }}>
                  <div style={{ color: '#94a3b8', marginBottom: 4, fontSize: 12, textTransform: 'uppercase' }}>
                    Your Response Note
                  </div>
                  <div style={{ color: 'white' }}>{request.user_response_note}</div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            {!request.user_has_responded && (
              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  onClick={() => setShowResponseModal(request)}
                  disabled={actionLoading === request.id}
                  style={{
                    flex: 1,
                    padding: '12px 16px',
                    background: '#064e3b',
                    border: '1px solid #10b981',
                    borderRadius: 8,
                    color: 'white',
                    cursor: actionLoading === request.id ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    fontSize: 14,
                    fontWeight: 500
                  }}
                >
                  <CheckCircle size={16} />
                  Approve
                </button>
                <button
                  onClick={() => handleRespond(request.id, false)}
                  disabled={actionLoading === request.id}
                  style={{
                    flex: 1,
                    padding: '12px 16px',
                    background: '#7f1d1d',
                    border: '1px solid #ef4444',
                    borderRadius: 8,
                    color: 'white',
                    cursor: actionLoading === request.id ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    fontSize: 14,
                    fontWeight: 500
                  }}
                >
                  {actionLoading === request.id ? <Loader size={16} /> : <XCircle size={16} />}
                  Reject
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Approval Modal */}
      {showResponseModal && (
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
              <CheckCircle style={{ color: '#10b981' }} />
              Approve Delist Request
            </h2>
            <p style={{ marginBottom: 16, color: '#94a3b8' }}>
              You are approving the request to delist "{showResponseModal.chapter.title}" from the marketplace.
            </p>
            <p style={{ marginBottom: 16, color: '#94a3b8', fontSize: 14 }}>
              If all collaborators approve, the chapter will be hidden from the marketplace but NFT holders will retain access.
            </p>
            <textarea
              value={responseNote}
              onChange={(e) => setResponseNote(e.target.value)}
              placeholder="Optional: Add a note about your decision"
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
                onClick={() => {
                  setShowResponseModal(null);
                  setResponseNote('');
                }}
                disabled={actionLoading !== null}
                style={{
                  padding: '10px 20px',
                  background: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: 8,
                  color: 'white',
                  cursor: actionLoading !== null ? 'not-allowed' : 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleRespond(showResponseModal.id, true)}
                disabled={actionLoading !== null}
                style={{
                  padding: '10px 20px',
                  background: '#064e3b',
                  border: '1px solid #10b981',
                  borderRadius: 8,
                  color: 'white',
                  cursor: actionLoading !== null ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}
              >
                {actionLoading !== null ? <Loader size={16} /> : <CheckCircle size={16} />}
                Approve Delist
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DelistApprovals;
