import React from 'react';
import { Chapter } from '../../services/bookApi';

interface ChapterListProps {
  chapters: Chapter[];
  selectedChapterId: number | null;
  onSelectChapter: (chapterId: number) => void;
  onAddChapter: () => void;
}

export default function ChapterList({ chapters, selectedChapterId, onSelectChapter, onAddChapter }: ChapterListProps) {
  const totalWords = chapters.reduce((sum, ch) => {
    const text = (ch.content_html || '').replace(/<[^>]*>/g, '');
    return sum + text.split(/\s+/).filter(w => w.length > 0).length;
  }, 0);

  return (
    <div style={{
      background: 'var(--panel)',
      border: '1px solid var(--panel-border)',
      borderRadius: 12,
      padding: 16,
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      minHeight: 0,
      overflow: 'hidden',
    }}>
      {/* Header with Add button */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexShrink: 0,
      }}>
        <div>
          <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: 15 }}>Chapters</div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{chapters.length} chapters • {totalWords} words</div>
        </div>
        <button
          onClick={onAddChapter}
          style={{
            background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
            border: 'none',
            borderRadius: 8,
            padding: '8px 14px',
            minHeight: 36,
            color: '#fff',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: 13,
          }}
        >
          + Add
        </button>
      </div>

      {/* Scrollable chapter list */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        minHeight: 0,
        scrollbarWidth: 'thin',
        scrollbarColor: 'rgba(255,255,255,0.2) transparent',
      }}>
        {chapters.length === 0 && (
          <div style={{
            color: '#64748b',
            fontSize: 13,
            textAlign: 'center',
            padding: '24px 12px',
            background: 'rgba(255,255,255,0.02)',
            borderRadius: 8,
            border: '1px dashed var(--panel-border)',
          }}>
            No chapters yet.<br />
            <span style={{ fontSize: 12 }}>Click "+ Add" to start writing.</span>
          </div>
        )}
        {chapters.map((chapter) => (
          <button
            key={chapter.id}
            onClick={() => onSelectChapter(chapter.id)}
            style={{
              background: selectedChapterId === chapter.id
                ? 'rgba(245,158,11,0.12)'
                : 'transparent',
              border: 'none',
              borderLeft: selectedChapterId === chapter.id
                ? '3px solid #f59e0b'
                : '3px solid transparent',
              borderRadius: 0,
              padding: '12px 12px',
              minHeight: 52,
              textAlign: 'left',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              flexShrink: 0,
            }}
          >
            <div style={{
              fontWeight: selectedChapterId === chapter.id ? 600 : 400,
              color: selectedChapterId === chapter.id ? '#f59e0b' : 'var(--text)',
              fontSize: 14,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}>
              <span style={{
                color: '#64748b',
                fontSize: 12,
                minWidth: 20,
              }}>{chapter.order + 1}.</span>
              <span style={{ flex: 1, lineHeight: 1.3 }}>{chapter.title || 'Untitled'}</span>
              {chapter.is_published && (
                <span style={{
                  fontSize: 9,
                  fontWeight: 600,
                  color: '#10b981',
                  background: 'rgba(16, 185, 129, 0.15)',
                  padding: '2px 5px',
                  borderRadius: 3,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}>
                  Minted
                </span>
              )}
            </div>
            <div style={{
              fontSize: 11,
              color: '#64748b',
              marginTop: 4,
              marginLeft: 28,
            }}>
              {(chapter.content_html || '').replace(/<[^>]*>/g, '').split(/\s+/).filter(w => w.length > 0).length} words
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

