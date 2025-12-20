import React, { forwardRef } from 'react';
import { sanitizeHtml } from '../../utils/sanitize';

interface ReaderContentProps {
  htmlContent: string;
  cssVars: Record<string, string>;
}

export const ReaderContent = forwardRef<HTMLDivElement, ReaderContentProps>(
  ({ htmlContent, cssVars }, ref) => {
    return (
      <div
        ref={ref}
        className="reader-content-container"
        style={{
          position: 'fixed',
          top: '60px',
          left: 0,
          right: 0,
          bottom: '50px',
          overflow: 'hidden',
          padding: '20px 24px',
          boxSizing: 'border-box',
          background: 'var(--reader-bg)',
          ...cssVars,
        }}
      >
        <div
          className="reader-content"
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(htmlContent) }}
          style={{
            height: '100%',
            columnWidth: '100vw',
            columnGap: '48px',
            columnFill: 'auto',
            fontFamily: 'var(--reader-font-family)',
            fontSize: 'var(--reader-font-size)',
            lineHeight: 'var(--reader-line-height)',
            color: 'var(--reader-text)',
            textAlign: 'justify',
            hyphens: 'auto',
            wordBreak: 'break-word',
            overflowX: 'hidden',
            overflowY: 'hidden',
          }}
        />
      </div>
    );
  }
);

ReaderContent.displayName = 'ReaderContent';

export default ReaderContent;
