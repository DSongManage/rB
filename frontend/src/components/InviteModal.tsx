import React, { useState } from 'react';

type InviteModalProps = {
  open: boolean;
  onClose: () => void;
  recipient: {
    id: number;
    username: string;
    display_name?: string;
    avatar_url?: string;
    status?: string;
    status_category?: 'green'|'yellow'|'red';
    roles?: string[];
    genres?: string[];
  };
};

const DEFAULT_PITCH = `Hi! I'd love to collaborate with you on an upcoming project.

**Project Vision:**
[Describe your project idea here]

**Your Role:**
[What you'd like them to contribute]

**Timeline:**
[Expected timeline]

**Compensation:**
[Revenue split details below]

Looking forward to creating something amazing together!`;

export default function InviteModal({ open, onClose, recipient }: InviteModalProps) {
  const [message, setMessage] = useState(DEFAULT_PITCH);
  const [equityPercent, setEquityPercent] = useState(50);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  if (!open) return null;

  const statusColors = {
    green: { bg: '#10b981', text: '#fff' },
    yellow: { bg: '#f59e0b', text: '#000' },
    red: { bg: '#ef4444', text: '#fff' },
  };
  const statusColor = statusColors[recipient.status_category || 'green'];

  async function fetchCsrf() {
    try {
      const res = await fetch('/api/auth/csrf/', { credentials: 'include' });
      const data = await res.json();
      return data?.csrfToken || '';
    } catch {
      return '';
    }
  }

  const handleSend = async () => {
    setSuccessMsg('');
    setErrorMsg('');
    setSending(true);

    try {
      const csrf = await fetchCsrf();
      const res = await fetch('/api/invite/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrf,
          'X-Requested-With': 'XMLHttpRequest',
        },
        credentials: 'include',
        body: JSON.stringify({
          message,
          equity_percent: equityPercent,
          collaborators: [recipient.id],
          attachments: '', // TODO: Add IPFS upload for files
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setSuccessMsg(`✅ Invite sent to @${recipient.username}!`);
        setTimeout(() => {
          onClose();
          setMessage(DEFAULT_PITCH);
          setEquityPercent(50);
          setSuccessMsg('');
        }, 2000);
      } else {
        const error = await res.text();
        setErrorMsg(`Failed to send invite: ${error}`);
      }
    } catch (err: any) {
      setErrorMsg(`Error: ${err.message || 'Unknown error'}`);
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.85)',
      display: 'grid',
      placeItems: 'center',
      zIndex: 1000,
      padding: 20,
    }}>
      <div style={{
        background: '#0f172a',
        border: '1px solid #334155',
        borderRadius: 16,
        width: '100%',
        maxWidth: 900,
        maxHeight: '90vh',
        overflow: 'auto',
        boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)',
      }}>
        {/* Header */}
        <div style={{
          padding: 24,
          borderBottom: '1px solid #334155',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
        }}>
          <div style={{
            width: 64,
            height: 64,
            borderRadius: 12,
            background: recipient.avatar_url ? `url(${recipient.avatar_url})` : '#1e293b',
            backgroundSize: 'cover',
            display: 'grid',
            placeItems: 'center',
            color: '#f59e0b',
            fontWeight: 700,
            fontSize: 24,
            border: '2px solid #334155',
          }}>
            {!recipient.avatar_url && recipient.username.slice(0, 1).toUpperCase()}
          </div>

          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
              <span style={{ color: '#f8fafc', fontWeight: 600, fontSize: 20 }}>@{recipient.username}</span>
              {recipient.status && (
                <div style={{
                  background: statusColor.bg,
                  color: statusColor.text,
                  fontSize: 9,
                  fontWeight: 700,
                  padding: '4px 8px',
                  borderRadius: 4,
                  textTransform: 'uppercase',
                  letterSpacing: 0.8,
                }}>
                  {recipient.status_category}
                </div>
              )}
            </div>
            {recipient.display_name && (
              <div style={{ color: '#cbd5e1', fontSize: 14, marginBottom: 8 }}>{recipient.display_name}</div>
            )}
            {/* Capabilities badges */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {recipient.roles?.map((r, i) => (
                <span key={`r-${i}`} style={{
                  background: 'rgba(245,158,11,0.15)',
                  color: '#f59e0b',
                  fontSize: 10,
                  fontWeight: 600,
                  padding: '2px 6px',
                  borderRadius: 3,
                  border: '1px solid rgba(245,158,11,0.4)',
                }}>
                  {r}
                </span>
              ))}
              {recipient.genres?.map((g, i) => (
                <span key={`g-${i}`} style={{
                  background: 'rgba(59,130,246,0.15)',
                  color: '#3b82f6',
                  fontSize: 10,
                  fontWeight: 600,
                  padding: '2px 6px',
                  borderRadius: 3,
                  border: '1px solid rgba(59,130,246,0.4)',
                }}>
                  {g}
                </span>
              ))}
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              fontSize: 24,
              cursor: 'pointer',
              padding: 8,
            }}
          >
            ×
          </button>
        </div>

        {/* Form */}
        <div style={{ padding: 24, display: 'grid', gap: 20 }}>
          <div>
            <label style={{ display: 'block', color: '#cbd5e1', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
              Project Pitch
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Describe your project and what you're looking for..."
              style={{
                width: '100%',
                minHeight: 200,
                background: '#1e293b',
                border: '1px solid #334155',
                borderRadius: 8,
                padding: 12,
                color: '#f8fafc',
                fontSize: 14,
                fontFamily: 'inherit',
                resize: 'vertical',
              }}
            />
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
              {message.length}/1000 characters
            </div>
          </div>

          {/* Equity Slider */}
          <div>
            <label style={{ display: 'block', color: '#cbd5e1', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
              Revenue Split for @{recipient.username}: {equityPercent}%
            </label>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={equityPercent}
              onChange={(e) => setEquityPercent(parseInt(e.target.value))}
              style={{ width: '100%' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748b', marginTop: 4 }}>
              <span>You keep: {100 - equityPercent}%</span>
              <span>They get: {equityPercent}%</span>
            </div>
          </div>

          {/* Preview Pane */}
          <div style={{
            background: '#1e293b',
            border: '1px solid #334155',
            borderRadius: 8,
            padding: 16,
          }}>
            <div style={{ color: '#94a3b8', fontSize: 12, fontWeight: 600, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Preview
            </div>
            <div style={{ color: '#cbd5e1', fontSize: 13, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
              {message || '(Your pitch will appear here)'}
            </div>
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #334155' }}>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>Revenue Split</div>
              <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                <div style={{
                  flex: 100 - equityPercent,
                  background: '#334155',
                  height: 32,
                  borderRadius: 6,
                  display: 'grid',
                  placeItems: 'center',
                  color: '#cbd5e1',
                  fontSize: 12,
                  fontWeight: 600,
                }}>
                  You: {100 - equityPercent}%
                </div>
                <div style={{
                  flex: equityPercent,
                  background: '#f59e0b',
                  height: 32,
                  borderRadius: 6,
                  display: 'grid',
                  placeItems: 'center',
                  color: '#000',
                  fontSize: 12,
                  fontWeight: 600,
                }}>
                  @{recipient.username}: {equityPercent}%
                </div>
              </div>
            </div>
          </div>

          {/* Success/Error Messages */}
          {successMsg && (
            <div style={{
              background: 'rgba(16,185,129,0.1)',
              border: '1px solid #10b981',
              color: '#10b981',
              padding: 12,
              borderRadius: 8,
              fontSize: 13,
            }}>
              {successMsg}
            </div>
          )}
          {errorMsg && (
            <div style={{
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid #ef4444',
              color: '#ef4444',
              padding: 12,
              borderRadius: 8,
              fontSize: 13,
            }}>
              {errorMsg}
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: '1px solid #334155',
                color: '#cbd5e1',
                padding: '10px 20px',
                borderRadius: 8,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSend}
              disabled={sending || !message.trim() || message.length > 1000}
              style={{
                background: sending ? '#64748b' : '#f59e0b',
                color: '#000',
                border: 'none',
                padding: '10px 24px',
                borderRadius: 8,
                fontWeight: 700,
                cursor: sending ? 'not-allowed' : 'pointer',
                opacity: (!message.trim() || message.length > 1000) ? 0.5 : 1,
              }}
            >
              {sending ? 'Sending...' : 'Send Invite'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

