import React from 'react';
import { ArrowLeft, Settings, List } from 'lucide-react';

interface ReaderHeaderProps {
  title: string;
  chapterTitle?: string;
  onBack: () => void;
  onToggleSettings: () => void;
  onToggleTOC: () => void;
  visible: boolean;
}

export function ReaderHeader({
  title,
  chapterTitle,
  onBack,
  onToggleSettings,
  onToggleTOC,
  visible,
}: ReaderHeaderProps) {
  return (
    <header
      className={`reader-header ${visible ? 'visible' : 'hidden'}`}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: '60px',
        background: 'var(--reader-bg)',
        borderBottom: '1px solid var(--reader-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        zIndex: 100,
        transition: 'transform 0.3s ease, opacity 0.3s ease',
        transform: visible ? 'translateY(0)' : 'translateY(-100%)',
        opacity: visible ? 1 : 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button
          onClick={onBack}
          className="reader-icon-button"
          aria-label="Go back"
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--reader-text)',
            cursor: 'pointer',
            padding: '8px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ArrowLeft size={24} />
        </button>

        <div style={{ overflow: 'hidden' }}>
          <h1
            style={{
              fontSize: '16px',
              fontWeight: 600,
              color: 'var(--reader-text)',
              margin: 0,
              whiteSpace: 'nowrap',
              textOverflow: 'ellipsis',
              overflow: 'hidden',
              maxWidth: '200px',
            }}
          >
            {title}
          </h1>
          {chapterTitle && (
            <p
              style={{
                fontSize: '12px',
                color: 'var(--reader-secondary)',
                margin: 0,
                whiteSpace: 'nowrap',
                textOverflow: 'ellipsis',
                overflow: 'hidden',
                maxWidth: '200px',
              }}
            >
              {chapterTitle}
            </p>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button
          onClick={onToggleTOC}
          className="reader-icon-button"
          aria-label="Table of Contents"
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--reader-text)',
            cursor: 'pointer',
            padding: '8px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <List size={24} />
        </button>

        <button
          onClick={onToggleSettings}
          className="reader-icon-button"
          aria-label="Settings"
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--reader-text)',
            cursor: 'pointer',
            padding: '8px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Settings size={24} />
        </button>
      </div>
    </header>
  );
}

export default ReaderHeader;
