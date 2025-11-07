/**
 * MintingProgressModal Component
 * Shows minting progress with multi-stage status updates
 */

import React, { useState, useEffect } from 'react';
import { CollaborativeProject } from '../../services/collaborationApi';

interface MintingProgressModalProps {
  project: CollaborativeProject;
  onClose: () => void;
  onComplete?: (nftId: string) => void;
}

type MintingStage =
  | 'validating'
  | 'uploading'
  | 'creating_contract'
  | 'minting'
  | 'finalizing'
  | 'completed'
  | 'error';

interface StageInfo {
  label: string;
  description: string;
  icon: string;
}

const STAGES: Record<MintingStage, StageInfo> = {
  validating: {
    label: 'Validating Project',
    description: 'Checking project data and approvals...',
    icon: '🔍',
  },
  uploading: {
    label: 'Uploading to IPFS',
    description: 'Storing content on decentralized storage...',
    icon: '☁️',
  },
  creating_contract: {
    label: 'Creating Smart Contract',
    description: 'Deploying NFT contract on blockchain...',
    icon: '📜',
  },
  minting: {
    label: 'Minting NFT',
    description: 'Creating your unique NFT token...',
    icon: '✨',
  },
  finalizing: {
    label: 'Finalizing',
    description: 'Completing the process and updating records...',
    icon: '🎯',
  },
  completed: {
    label: 'Minting Complete!',
    description: 'Your NFT has been successfully created.',
    icon: '🎉',
  },
  error: {
    label: 'Minting Failed',
    description: 'An error occurred during the minting process.',
    icon: '❌',
  },
};

export function MintingProgressModal({
  project,
  onClose,
  onComplete,
}: MintingProgressModalProps) {
  const [currentStage, setCurrentStage] = useState<MintingStage>('validating');
  const [error, setError] = useState<string | null>(null);
  const [nftData, setNftData] = useState<{
    id: string;
    tokenId: string;
    contractAddress: string;
    ipfsHash: string;
  } | null>(null);

  const stageOrder: MintingStage[] = [
    'validating',
    'uploading',
    'creating_contract',
    'minting',
    'finalizing',
  ];

  const currentStageIndex = stageOrder.indexOf(currentStage);
  const progress = currentStage === 'completed' ? 100 : ((currentStageIndex + 1) / stageOrder.length) * 100;

  // Simulate minting process
  useEffect(() => {
    if (currentStage === 'error' || currentStage === 'completed') {
      return;
    }

    const timer = setTimeout(() => {
      const currentIndex = stageOrder.indexOf(currentStage);
      if (currentIndex < stageOrder.length - 1) {
        setCurrentStage(stageOrder[currentIndex + 1]);
      } else {
        // Completed!
        setCurrentStage('completed');
        setNftData({
          id: `nft-${project.id}`,
          tokenId: `${Math.floor(Math.random() * 10000)}`,
          contractAddress: '0x' + Array(40).fill(0).map(() =>
            Math.floor(Math.random() * 16).toString(16)
          ).join(''),
          ipfsHash: 'Qm' + Array(44).fill(0).map(() =>
            'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)]
          ).join(''),
        });
        if (onComplete) {
          onComplete(`nft-${project.id}`);
        }
      }
    }, 2000 + Math.random() * 1000); // 2-3 seconds per stage

    return () => clearTimeout(timer);
  }, [currentStage]);

  const handleClose = () => {
    if (currentStage !== 'completed' && currentStage !== 'error') {
      const confirmed = confirm(
        'Minting is still in progress. Are you sure you want to close this window?'
      );
      if (!confirmed) return;
    }
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleClose();
        }
      }}
    >
      <div
        style={{
          background: 'var(--panel)',
          border: '1px solid var(--panel-border)',
          borderRadius: 12,
          padding: 32,
          maxWidth: 500,
          width: '90%',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>
            {STAGES[currentStage].icon}
          </div>
          <h2
            style={{
              margin: 0,
              marginBottom: 8,
              fontSize: 24,
              fontWeight: 700,
              color: 'var(--text)',
            }}
          >
            {STAGES[currentStage].label}
          </h2>
          <p
            style={{
              margin: 0,
              fontSize: 14,
              color: '#94a3b8',
            }}
          >
            {STAGES[currentStage].description}
          </p>
        </div>

        {/* Progress bar */}
        {currentStage !== 'completed' && currentStage !== 'error' && (
          <div style={{ marginBottom: 32 }}>
            <div
              style={{
                height: 8,
                background: '#1e293b',
                borderRadius: 4,
                overflow: 'hidden',
                marginBottom: 8,
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${progress}%`,
                  background: 'linear-gradient(90deg, #3b82f6 0%, #2563eb 100%)',
                  transition: 'width 0.5s ease',
                }}
              />
            </div>
            <div
              style={{
                fontSize: 12,
                color: '#94a3b8',
                textAlign: 'center',
              }}
            >
              {Math.round(progress)}% complete
            </div>
          </div>
        )}

        {/* Stage list */}
        <div style={{ marginBottom: 24 }}>
          {stageOrder.map((stage, index) => {
            const isCompleted = index < currentStageIndex;
            const isCurrent = stage === currentStage;
            const isPending = index > currentStageIndex;

            return (
              <div
                key={stage}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: 12,
                  marginBottom: 8,
                  background: isCurrent
                    ? 'rgba(59, 130, 246, 0.1)'
                    : isCompleted
                    ? 'rgba(16, 185, 129, 0.1)'
                    : 'transparent',
                  border: `1px solid ${
                    isCurrent
                      ? '#3b82f6'
                      : isCompleted
                      ? '#10b981'
                      : 'var(--panel-border)'
                  }`,
                  borderRadius: 8,
                  opacity: isPending ? 0.5 : 1,
                  transition: 'all 0.3s',
                }}
              >
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    background: isCompleted
                      ? '#10b981'
                      : isCurrent
                      ? '#3b82f6'
                      : '#334155',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontSize: 12,
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {isCompleted ? '✓' : index + 1}
                </div>
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: 'var(--text)',
                    }}
                  >
                    {STAGES[stage].label}
                  </div>
                </div>
                {isCurrent && (
                  <div
                    style={{
                      fontSize: 16,
                      animation: 'spin 1s linear infinite',
                    }}
                  >
                    ⏳
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Error message */}
        {currentStage === 'error' && error && (
          <div
            style={{
              marginBottom: 24,
              padding: 16,
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid #ef4444',
              borderRadius: 8,
              fontSize: 13,
              color: '#ef4444',
              lineHeight: 1.5,
            }}
          >
            {error}
          </div>
        )}

        {/* Success details */}
        {currentStage === 'completed' && nftData && (
          <div
            style={{
              marginBottom: 24,
              padding: 16,
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: 8,
            }}
          >
            <h3
              style={{
                margin: 0,
                marginBottom: 12,
                fontSize: 14,
                fontWeight: 700,
                color: '#10b981',
              }}
            >
              NFT Details
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 12 }}>
                <span style={{ color: '#94a3b8' }}>Token ID:</span>{' '}
                <span
                  style={{
                    color: 'var(--text)',
                    fontFamily: 'monospace',
                    fontWeight: 600,
                  }}
                >
                  {nftData.tokenId}
                </span>
              </div>
              <div style={{ fontSize: 12 }}>
                <span style={{ color: '#94a3b8' }}>Contract:</span>{' '}
                <span
                  style={{
                    color: 'var(--text)',
                    fontFamily: 'monospace',
                    fontSize: 10,
                    wordBreak: 'break-all',
                  }}
                >
                  {nftData.contractAddress}
                </span>
              </div>
              <div style={{ fontSize: 12 }}>
                <span style={{ color: '#94a3b8' }}>IPFS:</span>{' '}
                <span
                  style={{
                    color: 'var(--text)',
                    fontFamily: 'monospace',
                    fontSize: 10,
                    wordBreak: 'break-all',
                  }}
                >
                  {nftData.ipfsHash}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        {currentStage === 'completed' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <button
              onClick={() => {
                // TODO: Navigate to NFT view
                alert('Navigate to NFT view');
              }}
              style={{
                width: '100%',
                padding: '14px 20px',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                border: 'none',
                borderRadius: 8,
                color: '#fff',
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 6px 16px rgba(16, 185, 129, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.3)';
              }}
            >
              View NFT
            </button>
            <button
              onClick={onClose}
              style={{
                width: '100%',
                padding: '12px 20px',
                background: 'transparent',
                border: '1px solid var(--panel-border)',
                borderRadius: 8,
                color: 'var(--text)',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--bg)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              Close
            </button>
          </div>
        )}

        {currentStage === 'error' && (
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={() => {
                setCurrentStage('validating');
                setError(null);
              }}
              style={{
                flex: 1,
                padding: '12px 20px',
                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                border: 'none',
                borderRadius: 8,
                color: '#fff',
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
              }}
            >
              Retry
            </button>
            <button
              onClick={onClose}
              style={{
                flex: 1,
                padding: '12px 20px',
                background: 'transparent',
                border: '1px solid var(--panel-border)',
                borderRadius: 8,
                color: 'var(--text)',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Close
            </button>
          </div>
        )}

        {/* Progress indicator */}
        {currentStage !== 'completed' && currentStage !== 'error' && (
          <div
            style={{
              marginTop: 16,
              padding: 12,
              background: 'rgba(59, 130, 246, 0.1)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              borderRadius: 8,
              fontSize: 12,
              color: '#94a3b8',
              textAlign: 'center',
              lineHeight: 1.5,
            }}
          >
            This process may take a few minutes. Please don't close this window.
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default MintingProgressModal;
