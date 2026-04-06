import React, { useState } from 'react';
import { X, Clock, RefreshCw, DollarSign, Check, AlertTriangle, Flag } from 'lucide-react';
import { collaborationApi } from '../../services/collaborationApi';

type ActionType = 'deadline' | 'final_rejection' | 'scope_change';

interface MilestoneActionModalProps {
  type: ActionType;
  projectId: number;
  taskId: number;
  taskTitle: string;
  onClose: () => void;
  onActionTaken: () => void;
}

const actionConfigs = {
  deadline: {
    title: 'Deadline Passed',
    subtitle: 'Choose how to proceed with this milestone:',
    icon: Clock,
    iconColor: '#f59e0b',
    actions: [
      { key: 'extend', label: 'Extend Deadline', description: 'Give the artist more time to deliver', icon: Clock, style: 'primary' as const },
      { key: 'refund', label: 'Refund to Wallet', description: 'Reclaim funds from escrow', icon: DollarSign, style: 'danger' as const },
    ],
  },
  final_rejection: {
    title: 'Final Rejection',
    subtitle: 'Revision limit reached. Choose how to proceed:',
    icon: AlertTriangle,
    iconColor: '#ef4444',
    actions: [
      { key: 'accept_as_is', label: 'Accept As-Is', description: 'Release payment despite issues', icon: Check, style: 'primary' as const },
      { key: 'cancel', label: 'Cancel & Refund', description: 'Cancel this milestone and refund', icon: DollarSign, style: 'danger' as const },
    ],
  },
  scope_change: {
    title: 'Flag Scope Change',
    subtitle: 'Report that the work required exceeds the original brief. This pauses the deadline timer.',
    icon: Flag,
    iconColor: '#8b5cf6',
    actions: [],
  },
};

export default function MilestoneActionModal({
  type,
  projectId,
  taskId,
  taskTitle,
  onClose,
  onActionTaken,
}: MilestoneActionModalProps) {
  const [selectedAction, setSelectedAction] = useState<string | null>(null);
  const [extensionDays, setExtensionDays] = useState(7);
  const [scopeDescription, setScopeDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const config = actionConfigs[type];

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');

    try {
      if (type === 'deadline') {
        await collaborationApi.deadlineAction(projectId, taskId, {
          action: selectedAction as 'extend' | 'reassign' | 'refund',
          extension_days: selectedAction === 'extend' ? extensionDays : undefined,
        });
      } else if (type === 'final_rejection') {
        await collaborationApi.finalRejectionAction(projectId, taskId, {
          action: selectedAction as 'accept_as_is' | 'cancel' | 'reassign',
        });
      } else if (type === 'scope_change') {
        await collaborationApi.createScopeChange(projectId, taskId, {
          description: scopeDescription,
        });
      }
      onActionTaken();
    } catch (err: any) {
      setError(err.message || 'Action failed');
      setSubmitting(false);
    }
  };

  const IconComponent = config.icon;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000,
        padding: 16,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        background: 'var(--bg)',
        borderRadius: 16,
        padding: 24,
        maxWidth: 420,
        width: '100%',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <IconComponent size={22} color={config.iconColor} />
            <h3 style={{ margin: 0, fontSize: 18, color: 'var(--text)' }}>{config.title}</h3>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
          >
            <X size={20} />
          </button>
        </div>

        <div style={{
          background: 'var(--panel-bg)',
          borderRadius: 10,
          padding: 12,
          marginBottom: 16,
          border: '1px solid var(--panel-border)',
        }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{taskTitle}</div>
        </div>

        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 16px' }}>{config.subtitle}</p>

        {/* Action buttons for deadline / final_rejection */}
        {config.actions.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {config.actions.map((action) => {
              const ActionIcon = action.icon;
              const isSelected = selectedAction === action.key;
              return (
                <button
                  key={action.key}
                  onClick={() => setSelectedAction(action.key)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '14px 16px',
                    borderRadius: 10,
                    border: `2px solid ${isSelected
                      ? (action.style === 'danger' ? '#ef4444' : '#8b5cf6')
                      : 'var(--panel-border)'}`,
                    background: isSelected
                      ? (action.style === 'danger' ? 'rgba(239,68,68,0.08)' : 'rgba(139,92,246,0.08)')
                      : 'var(--panel-bg)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    width: '100%',
                  }}
                >
                  <ActionIcon size={20} color={isSelected
                    ? (action.style === 'danger' ? '#ef4444' : '#8b5cf6')
                    : 'var(--text-secondary)'
                  } />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{action.label}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{action.description}</div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Extension days input */}
        {type === 'deadline' && selectedAction === 'extend' && (
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
              Extension (days)
            </label>
            <input
              type="number"
              min={1}
              max={30}
              value={extensionDays}
              onChange={(e) => setExtensionDays(parseInt(e.target.value) || 7)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 8,
                border: '1px solid var(--panel-border)',
                background: 'var(--panel-bg)',
                color: 'var(--text)',
                fontSize: 14,
              }}
            />
          </div>
        )}

        {/* Scope change description */}
        {type === 'scope_change' && (
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
              Describe the scope change
            </label>
            <textarea
              value={scopeDescription}
              onChange={(e) => setScopeDescription(e.target.value)}
              placeholder="e.g., The brief says simple backgrounds but reference images show detailed cityscapes..."
              style={{
                width: '100%',
                minHeight: 80,
                padding: 10,
                borderRadius: 8,
                border: '1px solid var(--panel-border)',
                background: 'var(--panel-bg)',
                color: 'var(--text)',
                fontSize: 13,
                resize: 'vertical',
                fontFamily: 'inherit',
              }}
            />
          </div>
        )}

        {error && (
          <div style={{
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 8,
            padding: '8px 12px',
            fontSize: 13,
            color: '#ef4444',
            marginBottom: 12,
          }}>
            {error}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={submitting || (config.actions.length > 0 && !selectedAction) || (type === 'scope_change' && !scopeDescription.trim())}
          style={{
            width: '100%',
            padding: '12px 16px',
            borderRadius: 10,
            border: 'none',
            background: (config.actions.length > 0 && !selectedAction) || (type === 'scope_change' && !scopeDescription.trim())
              ? 'var(--panel-border)'
              : (selectedAction === 'refund' || selectedAction === 'cancel' ? '#ef4444' : '#8b5cf6'),
            color: 'white',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            opacity: submitting ? 0.7 : 1,
          }}
        >
          {submitting ? 'Processing...' : 'Confirm'}
        </button>
      </div>
    </div>
  );
}
