import React from 'react';

interface CopyrightPreviewProps {
  authorName: string;
  year?: number;
}

/**
 * CopyrightPreview - Displays the copyright notice that will be associated with published content.
 *
 * Shows the copyright line and blockchain timestamp message that will be part of
 * the published work's metadata.
 */
export default function CopyrightPreview({ authorName, year }: CopyrightPreviewProps) {
  const currentYear = year || new Date().getFullYear();

  const copyrightLine = `(C) ${currentYear} ${authorName}. All Rights Reserved.`;
  const blockchainMessage = `Every work published on renaissBlock is timestamped on the blockchain - creating an immutable record of your authorship. No registration required.`;

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

      <div style={{
        fontSize: 11,
        color: '#64748b',
        marginTop: 8,
        textAlign: 'center',
      }}>
        This notice will be associated with your published work
      </div>
    </div>
  );
}
