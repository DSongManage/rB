import React from 'react';
import { X, BookOpen } from 'lucide-react';
import { Chapter } from '../../types/reader';

interface TableOfContentsProps {
  chapters: Chapter[];
  currentChapterId?: string;
  onSelectChapter: (chapter: Chapter) => void;
  onClose: () => void;
  visible: boolean;
}

export function TableOfContents({
  chapters,
  currentChapterId,
  onSelectChapter,
  onClose,
  visible,
}: TableOfContentsProps) {
  if (!visible) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="reader-toc-backdrop"
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          zIndex: 200,
          animation: 'fadeIn 0.2s ease',
        }}
      />

      {/* TOC Panel */}
      <div
        className="reader-toc-panel"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          width: '300px',
          maxWidth: '80vw',
          background: 'var(--reader-bg)',
          borderRight: '1px solid var(--reader-border)',
          zIndex: 201,
          display: 'flex',
          flexDirection: 'column',
          animation: 'slideRight 0.3s ease',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '20px',
            borderBottom: '1px solid var(--reader-border)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BookOpen size={20} color="var(--reader-text)" />
            <h2
              style={{
                fontSize: '18px',
                fontWeight: 600,
                color: 'var(--reader-text)',
                margin: 0,
              }}
            >
              Contents
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--reader-text)',
              cursor: 'pointer',
              padding: '8px',
            }}
            aria-label="Close table of contents"
          >
            <X size={24} />
          </button>
        </div>

        {/* Chapter List */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '12px',
          }}
        >
          {chapters.length === 0 ? (
            <p
              style={{
                color: 'var(--reader-secondary)',
                fontSize: '14px',
                textAlign: 'center',
                padding: '20px',
              }}
            >
              No chapters detected
            </p>
          ) : (
            <ul
              style={{
                listStyle: 'none',
                margin: 0,
                padding: 0,
              }}
            >
              {chapters.map((chapter) => (
                <li key={chapter.id}>
                  <button
                    onClick={() => {
                      onSelectChapter(chapter);
                      onClose();
                    }}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      paddingLeft: `${16 + (chapter.level - 1) * 16}px`,
                      border: 'none',
                      borderRadius: '8px',
                      background:
                        currentChapterId === chapter.id
                          ? 'var(--reader-border)'
                          : 'transparent',
                      color:
                        currentChapterId === chapter.id
                          ? 'var(--reader-text)'
                          : 'var(--reader-secondary)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontSize: chapter.level === 1 ? '15px' : '14px',
                      fontWeight: chapter.level === 1 ? 500 : 400,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      transition: 'background 0.2s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (currentChapterId !== chapter.id) {
                        e.currentTarget.style.background =
                          'var(--reader-border)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (currentChapterId !== chapter.id) {
                        e.currentTarget.style.background = 'transparent';
                      }
                    }}
                  >
                    {chapter.level === 1 && (
                      <span
                        style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          background:
                            currentChapterId === chapter.id
                              ? 'var(--reader-text)'
                              : 'var(--reader-secondary)',
                          flexShrink: 0,
                        }}
                      />
                    )}
                    <span
                      style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {chapter.title}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}

export default TableOfContents;
