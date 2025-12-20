/**
 * Creator Agreement Modal - shown before first publish.
 * User must accept all terms before they can publish content.
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { X, FileText, DollarSign, Users, Shield } from 'lucide-react';
import { acceptLegalDocument, getCreatorAgreementStatus } from '../../services/legalApi';

interface CreatorAgreementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccept: () => void;
}

export function CreatorAgreementModal({ isOpen, onClose, onAccept }: CreatorAgreementModalProps) {
  const [hasScrolled, setHasScrolled] = useState(false);
  const [checkboxes, setCheckboxes] = useState({
    ownRights: false,
    feeStructure: false,
    contentPolicy: false,
    collaborationTerms: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const allChecked = Object.values(checkboxes).every(Boolean);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    const scrollPercentage = (target.scrollTop + target.clientHeight) / target.scrollHeight;
    if (scrollPercentage > 0.9) {
      setHasScrolled(true);
    }
  };

  const handleAccept = async () => {
    if (!allChecked) return;

    setLoading(true);
    setError('');

    try {
      await acceptLegalDocument('creator_agreement');
      onAccept();
    } catch (err) {
      setError('Failed to record acceptance. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(0, 0, 0, 0.8)',
      padding: 20,
    }}>
      <div style={{
        background: 'var(--bg, #0f172a)',
        borderRadius: 12,
        border: '1px solid var(--border, #334155)',
        maxWidth: 600,
        width: '100%',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--border, #334155)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div>
            <h2 style={{
              fontSize: 20,
              fontWeight: 700,
              color: 'var(--text, #e5e7eb)',
              margin: 0,
            }}>
              Creator Agreement
            </h2>
            <p style={{
              fontSize: 14,
              color: 'var(--text-muted, #94a3b8)',
              margin: '4px 0 0 0',
            }}>
              Please review and accept before publishing
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              padding: 8,
              cursor: 'pointer',
              color: 'var(--text-muted, #94a3b8)',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div
          onScroll={handleScroll}
          style={{
            padding: 24,
            overflowY: 'auto',
            flex: 1,
          }}
        >
          {/* Key Points Summary */}
          <div style={{
            display: 'grid',
            gap: 16,
            marginBottom: 24,
          }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <FileText size={20} style={{ color: 'var(--accent, #f59e0b)', flexShrink: 0, marginTop: 2 }} />
              <div>
                <div style={{ fontWeight: 600, color: 'var(--text, #e5e7eb)', marginBottom: 4 }}>
                  You Retain Ownership
                </div>
                <div style={{ fontSize: 14, color: 'var(--text-muted, #94a3b8)' }}>
                  You keep full ownership of your content. We only get a license to display and
                  distribute it on the platform.
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <DollarSign size={20} style={{ color: 'var(--accent, #f59e0b)', flexShrink: 0, marginTop: 2 }} />
              <div>
                <div style={{ fontWeight: 600, color: 'var(--text, #e5e7eb)', marginBottom: 4 }}>
                  Platform Fees
                </div>
                <div style={{ fontSize: 14, color: 'var(--text-muted, #94a3b8)' }}>
                  15% for sales under $10, 12% for $10-$50, 10% for over $50.
                  Fees may change with 30 days' notice.
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <Users size={20} style={{ color: 'var(--accent, #f59e0b)', flexShrink: 0, marginTop: 2 }} />
              <div>
                <div style={{ fontWeight: 600, color: 'var(--text, #e5e7eb)', marginBottom: 4 }}>
                  Collaboration Terms
                </div>
                <div style={{ fontSize: 14, color: 'var(--text-muted, #94a3b8)' }}>
                  Revenue splits are binding once published. Changes require unanimous consent
                  from all collaborators.
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <Shield size={20} style={{ color: 'var(--accent, #f59e0b)', flexShrink: 0, marginTop: 2 }} />
              <div>
                <div style={{ fontWeight: 600, color: 'var(--text, #e5e7eb)', marginBottom: 4 }}>
                  Content Responsibility
                </div>
                <div style={{ fontSize: 14, color: 'var(--text-muted, #94a3b8)' }}>
                  You must have rights to publish your content and comply with our Content Policy.
                </div>
              </div>
            </div>
          </div>

          <p style={{
            fontSize: 14,
            color: 'var(--text-muted, #94a3b8)',
            marginBottom: 24,
          }}>
            Read the full{' '}
            <Link
              to="/legal/creator-agreement"
              target="_blank"
              style={{ color: 'var(--accent, #f59e0b)' }}
            >
              Creator Agreement
            </Link>
            {' '}for complete details.
          </p>

          {/* Checkboxes */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            padding: 16,
            background: 'var(--bg-secondary, #1e293b)',
            borderRadius: 8,
          }}>
            <label style={{ display: 'flex', gap: 12, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={checkboxes.ownRights}
                onChange={(e) => setCheckboxes(prev => ({ ...prev, ownRights: e.target.checked }))}
                style={{ marginTop: 2 }}
              />
              <span style={{ fontSize: 14, color: 'var(--text, #e5e7eb)' }}>
                I own or have rights to the content I publish
              </span>
            </label>

            <label style={{ display: 'flex', gap: 12, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={checkboxes.feeStructure}
                onChange={(e) => setCheckboxes(prev => ({ ...prev, feeStructure: e.target.checked }))}
                style={{ marginTop: 2 }}
              />
              <span style={{ fontSize: 14, color: 'var(--text, #e5e7eb)' }}>
                I understand the fee structure (15% / 12% / 10%)
              </span>
            </label>

            <label style={{ display: 'flex', gap: 12, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={checkboxes.contentPolicy}
                onChange={(e) => setCheckboxes(prev => ({ ...prev, contentPolicy: e.target.checked }))}
                style={{ marginTop: 2 }}
              />
              <span style={{ fontSize: 14, color: 'var(--text, #e5e7eb)' }}>
                I agree to the{' '}
                <Link
                  to="/legal/content-policy"
                  target="_blank"
                  style={{ color: 'var(--accent, #f59e0b)' }}
                  onClick={(e) => e.stopPropagation()}
                >
                  Content Policy
                </Link>
              </span>
            </label>

            <label style={{ display: 'flex', gap: 12, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={checkboxes.collaborationTerms}
                onChange={(e) => setCheckboxes(prev => ({ ...prev, collaborationTerms: e.target.checked }))}
                style={{ marginTop: 2 }}
              />
              <span style={{ fontSize: 14, color: 'var(--text, #e5e7eb)' }}>
                I accept the collaboration terms
              </span>
            </label>
          </div>

          {error && (
            <p style={{
              marginTop: 16,
              fontSize: 14,
              color: '#ef4444',
            }}>
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid var(--border, #334155)',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 12,
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              borderRadius: 8,
              border: '1px solid var(--border, #334155)',
              background: 'transparent',
              color: 'var(--text, #e5e7eb)',
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleAccept}
            disabled={!allChecked || loading}
            style={{
              padding: '10px 20px',
              borderRadius: 8,
              border: 'none',
              background: allChecked ? 'var(--accent, #f59e0b)' : 'var(--bg-secondary, #1e293b)',
              color: allChecked ? '#000' : 'var(--text-muted, #94a3b8)',
              fontSize: 14,
              fontWeight: 600,
              cursor: allChecked && !loading ? 'pointer' : 'not-allowed',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Accepting...' : 'Accept & Continue'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default CreatorAgreementModal;
