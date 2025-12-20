/**
 * Shared layout component for legal pages.
 * Renders markdown content with consistent styling.
 */

import React from 'react';

interface LegalPageLayoutProps {
  title: string;
  lastUpdated?: string;
  children: React.ReactNode;
}

export function LegalPageLayout({ title, lastUpdated, children }: LegalPageLayoutProps) {
  return (
    <div className="legal-page" style={{
      maxWidth: 800,
      margin: '40px auto',
      padding: '0 20px',
    }}>
      <header style={{ marginBottom: 32 }}>
        <h1 style={{
          fontSize: 28,
          fontWeight: 700,
          color: 'var(--text, #e5e7eb)',
          marginBottom: 8,
        }}>
          {title}
        </h1>
        {lastUpdated && (
          <p style={{
            fontSize: 14,
            color: 'var(--text-muted, #94a3b8)',
          }}>
            Last Updated: {lastUpdated}
          </p>
        )}
      </header>

      <div className="legal-content" style={{
        color: 'var(--text-secondary, #cbd5e1)',
        lineHeight: 1.7,
        fontSize: 15,
      }}>
        {children}
      </div>

      <style>{`
        .legal-content h2 {
          font-size: 20px;
          font-weight: 600;
          color: var(--text, #e5e7eb);
          margin: 32px 0 16px 0;
          padding-bottom: 8px;
          border-bottom: 1px solid var(--border, #334155);
        }

        .legal-content h3 {
          font-size: 16px;
          font-weight: 600;
          color: var(--text, #e5e7eb);
          margin: 24px 0 12px 0;
        }

        .legal-content p {
          margin: 16px 0;
        }

        .legal-content ul, .legal-content ol {
          margin: 16px 0;
          padding-left: 24px;
        }

        .legal-content li {
          margin: 8px 0;
        }

        .legal-content strong {
          color: var(--text, #e5e7eb);
          font-weight: 600;
        }

        .legal-content a {
          color: var(--accent, #f59e0b);
          text-decoration: none;
        }

        .legal-content a:hover {
          text-decoration: underline;
        }

        .legal-content table {
          width: 100%;
          border-collapse: collapse;
          margin: 16px 0;
        }

        .legal-content th, .legal-content td {
          padding: 12px;
          border: 1px solid var(--border, #334155);
          text-align: left;
        }

        .legal-content th {
          background: var(--bg-secondary, #1e293b);
          font-weight: 600;
          color: var(--text, #e5e7eb);
        }

        .legal-content blockquote {
          border-left: 3px solid var(--accent, #f59e0b);
          padding-left: 16px;
          margin: 16px 0;
          color: var(--text-muted, #94a3b8);
          font-style: italic;
        }

        .legal-content hr {
          border: none;
          border-top: 1px solid var(--border, #334155);
          margin: 32px 0;
        }

        .legal-content code {
          background: var(--bg-secondary, #1e293b);
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 13px;
        }
      `}</style>
    </div>
  );
}

export default LegalPageLayout;
