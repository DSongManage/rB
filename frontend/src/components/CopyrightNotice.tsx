import React from 'react';

interface CopyrightNoticeProps {
  authorName: string;
  year: number;
  compact?: boolean; // For reader footer (smaller styling)
}

/**
 * CopyrightNotice - Displays copyright notice on published content.
 *
 * Used on ContentDetail page and reader footers to show the official
 * copyright associated with published works.
 */
export default function CopyrightNotice({ authorName, year, compact = false }: CopyrightNoticeProps) {
  const copyrightLine = `(C) ${year} ${authorName}. All Rights Reserved.`;
  const blockchainMessage = `This work is officially timestamped and protected on the blockchain.`;

  if (compact) {
    return (
      <div style={{
        textAlign: 'center',
        padding: '12px 16px',
        borderTop: '1px solid var(--panel-border)',
        background: 'rgba(139, 92, 246, 0.05)',
      }}>
        <p style={{
          color: 'var(--text)',
          fontSize: 11,
          fontWeight: 500,
          margin: '0 0 4px 0',
        }}>
          {copyrightLine}
        </p>
        <p style={{
          color: '#94a3b8',
          fontSize: 10,
          margin: 0,
          fontStyle: 'italic',
        }}>
          {blockchainMessage}
        </p>
      </div>
    );
  }

  return (
    <div style={{
      background: 'rgba(139, 92, 246, 0.08)',
      border: '1px solid rgba(139, 92, 246, 0.2)',
      borderRadius: 12,
      padding: 16,
      marginTop: 16,
    }}>
      <div style={{
        fontSize: 12,
        fontWeight: 600,
        color: '#a78bfa',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        marginBottom: 12,
      }}>
        Copyright Notice
      </div>

      <div style={{
        background: 'var(--bg)',
        border: '1px solid var(--panel-border)',
        borderRadius: 8,
        padding: 20,
        textAlign: 'center',
      }}>
        <p style={{
          color: 'var(--text)',
          fontSize: 14,
          fontWeight: 600,
          margin: '0 0 16px 0',
        }}>
          {copyrightLine}
        </p>

        <p style={{
          color: '#94a3b8',
          fontSize: 12,
          lineHeight: 1.6,
          margin: 0,
          fontStyle: 'italic',
        }}>
          {blockchainMessage}
        </p>
      </div>
    </div>
  );
}
