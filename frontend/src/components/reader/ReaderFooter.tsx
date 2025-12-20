import React from 'react';

interface ReaderFooterProps {
  currentPage: number;
  totalPages: number;
  percentComplete: number;
  visible: boolean;
  continuousScroll?: boolean;
}

export function ReaderFooter({
  currentPage,
  totalPages,
  percentComplete,
  visible,
  continuousScroll = false,
}: ReaderFooterProps) {
  return (
    <footer
      className={`reader-footer ${visible ? 'visible' : 'hidden'}`}
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: '50px',
        background: 'var(--reader-bg)',
        borderTop: '1px solid var(--reader-border)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 16px',
        zIndex: 100,
        transition: 'transform 0.3s ease, opacity 0.3s ease',
        transform: visible ? 'translateY(0)' : 'translateY(100%)',
        opacity: visible ? 1 : 0,
      }}
    >
      {/* Progress bar */}
      <div
        style={{
          width: '100%',
          maxWidth: '400px',
          height: '3px',
          background: 'var(--reader-border)',
          borderRadius: '2px',
          marginBottom: '8px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${percentComplete}%`,
            height: '100%',
            background: 'var(--reader-accent, var(--reader-secondary))',
            borderRadius: '2px',
            transition: 'width 0.3s ease',
          }}
        />
      </div>

      {/* Page indicator */}
      <p
        style={{
          fontSize: '12px',
          color: 'var(--reader-secondary)',
          margin: 0,
        }}
      >
        {continuousScroll
          ? `${percentComplete}% complete`
          : `Page ${currentPage + 1} of ${totalPages} (${percentComplete}%)`
        }
      </p>
    </footer>
  );
}

export default ReaderFooter;
