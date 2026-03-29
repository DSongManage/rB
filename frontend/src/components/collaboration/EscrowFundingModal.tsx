/**
 * EscrowFundingModal Component
 *
 * Modal for project owner to fund escrow for a collaborator.
 * Shows contract details and confirms funding action.
 */

import React, { useState } from 'react';
import { X, DollarSign, Shield, Lock, AlertTriangle } from 'lucide-react';
import { collaborationApi } from '../../services/collaborationApi';

interface EscrowFundingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFunded: () => void;
  projectId: number;
  collaborator: {
    id: number;
    username: string;
    display_name?: string;
    effective_role_name?: string;
    contract_type: string;
    total_contract_amount: string;
    escrow_funded_amount: string;
    tasks_total: number;
  };
}

export function EscrowFundingModal({
  isOpen,
  onClose,
  onFunded,
  projectId,
  collaborator,
}: EscrowFundingModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const totalAmount = parseFloat(collaborator.total_contract_amount) || 0;
  const alreadyFunded = parseFloat(collaborator.escrow_funded_amount) || 0;
  const amountToFund = totalAmount - alreadyFunded;
  const displayName = collaborator.display_name || collaborator.username;
  const roleName = collaborator.effective_role_name || 'Collaborator';

  const handleFund = async () => {
    setLoading(true);
    setError('');
    try {
      await collaborationApi.fundEscrow(projectId, collaborator.id);
      onFunded();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to fund escrow');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.7)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#1e293b', borderRadius: 16, padding: 24,
          width: '100%', maxWidth: 440,
          border: '1px solid #334155',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', marginBottom: 20,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Shield size={20} style={{ color: '#8b5cf6' }} />
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#e2e8f0' }}>
              Fund Escrow
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#64748b', padding: 4,
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Contract details */}
        <div style={{
          background: '#0f172a', borderRadius: 12,
          padding: 16, marginBottom: 16,
        }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            marginBottom: 12,
          }}>
            <span style={{ color: '#94a3b8', fontSize: 13 }}>Collaborator</span>
            <span style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 500 }}>
              @{collaborator.username}
            </span>
          </div>
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            marginBottom: 12,
          }}>
            <span style={{ color: '#94a3b8', fontSize: 13 }}>Role</span>
            <span style={{ color: '#e2e8f0', fontSize: 13 }}>{roleName}</span>
          </div>
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            marginBottom: 12,
          }}>
            <span style={{ color: '#94a3b8', fontSize: 13 }}>Contract Type</span>
            <span style={{
              color: '#8b5cf6', fontSize: 13, fontWeight: 500,
              textTransform: 'capitalize',
            }}>
              {collaborator.contract_type.replace('_', ' ')}
            </span>
          </div>
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            marginBottom: 12,
          }}>
            <span style={{ color: '#94a3b8', fontSize: 13 }}>Milestones</span>
            <span style={{ color: '#e2e8f0', fontSize: 13 }}>
              {collaborator.tasks_total} tasks
            </span>
          </div>
          <div style={{
            borderTop: '1px solid #334155', paddingTop: 12,
            display: 'flex', justifyContent: 'space-between',
          }}>
            <span style={{ color: '#e2e8f0', fontSize: 14, fontWeight: 600 }}>
              Total Contract
            </span>
            <span style={{
              color: '#10b981', fontSize: 18, fontWeight: 700,
              display: 'flex', alignItems: 'center', gap: 2,
            }}>
              <DollarSign size={16} />
              {totalAmount.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Info notice */}
        <div style={{
          background: '#1e3a5f', borderRadius: 8,
          padding: 12, marginBottom: 16,
          display: 'flex', gap: 10,
          fontSize: 12, color: '#93c5fd', lineHeight: 1.5,
        }}>
          <Lock size={16} style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <strong>Funds are locked in escrow.</strong> They will be released to{' '}
            {displayName} as milestones are completed and signed off.
            The collaborator can see that funds are secured before starting work.
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            background: '#7f1d1d30', borderRadius: 8,
            padding: 10, marginBottom: 16,
            display: 'flex', gap: 8, alignItems: 'center',
            fontSize: 12, color: '#f87171',
          }}>
            <AlertTriangle size={14} />
            {error}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1, padding: '10px 16px', borderRadius: 8,
              background: '#334155', border: 'none',
              color: '#e2e8f0', fontSize: 13, fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleFund}
            disabled={loading || amountToFund <= 0}
            style={{
              flex: 1, padding: '10px 16px', borderRadius: 8,
              background: amountToFund <= 0
                ? '#334155'
                : 'linear-gradient(135deg, #8b5cf6, #6366f1)',
              border: 'none',
              color: '#fff', fontSize: 13, fontWeight: 600,
              cursor: loading || amountToFund <= 0 ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading
              ? 'Funding...'
              : amountToFund <= 0
              ? 'Already Funded'
              : `Fund $${amountToFund.toFixed(2)}`}
          </button>
        </div>
      </div>
    </div>
  );
}
