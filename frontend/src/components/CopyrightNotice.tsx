import React from 'react';
import { Shield } from 'lucide-react';

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

  // Footer-like styling - no nested boxes
  return (
    <div style={{
      marginTop: 24,
      paddingTop: 16,
      borderTop: '1px solid #334155',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        marginBottom: 8,
      }}>
        <Shield size={14} style={{ color: '#a78bfa' }} />
        <span style={{
          fontSize: 11,
          fontWeight: 600,
          color: '#a78bfa',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}>
          Copyright
        </span>
      </div>
      <p style={{
        color: '#94a3b8',
        fontSize: 13,
        margin: '0 0 4px 0',
      }}>
        {copyrightLine}
      </p>
      <p style={{
        color: '#64748b',
        fontSize: 11,
        margin: 0,
        fontStyle: 'italic',
      }}>
        {blockchainMessage}
      </p>
    </div>
  );
}
