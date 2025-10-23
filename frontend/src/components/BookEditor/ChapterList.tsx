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
    const text = ch.content_html.replace(/<[^>]*>/g, '');
    return sum + text.split(/\s+/).filter(w => w.length > 0).length;
  }, 0);

  return (
    <div style={{
      width: 280,
      background: 'var(--panel)',
      border: '1px solid var(--panel-border)',
      borderRadius: 12,
      padding: 16,
      height: '70vh',
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: 16 }}>Chapters</div>
        <div style={{ fontSize: 12, color: '#94a3b8' }}>{chapters.length} • {totalWords} words</div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {chapters.length === 0 && (
          <div style={{ color: '#94a3b8', fontSize: 14, textAlign: 'center', marginTop: 20 }}>
            No chapters yet. Click "Add Chapter" to start writing.
          </div>
        )}
        {chapters.map((chapter) => (
          <button
            key={chapter.id}
            onClick={() => onSelectChapter(chapter.id)}
            style={{
              background: selectedChapterId === chapter.id ? 'rgba(245,158,11,0.15)' : chapter.is_published ? 'rgba(100,100,100,0.1)' : 'transparent',
              border: selectedChapterId === chapter.id ? '1px solid rgba(245,158,11,0.5)' : '1px solid var(--panel-border)',
              borderRadius: 8,
              padding: 12,
              textAlign: 'left',
              cursor: 'pointer',
              transition: 'all 0.2s',
              opacity: chapter.is_published ? 0.6 : 1,
              position: 'relative',
            }}
          >
            <div style={{ 
              fontWeight: selectedChapterId === chapter.id ? 700 : 500, 
              color: selectedChapterId === chapter.id ? '#f59e0b' : chapter.is_published ? '#94a3b8' : 'var(--text)',
              fontSize: 14,
              marginBottom: 4,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}>
              <span>{chapter.order + 1}. {chapter.title || 'Untitled Chapter'}</span>
              {chapter.is_published && (
                <span style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: '#10b981',
                  background: 'rgba(16, 185, 129, 0.1)',
                  padding: '2px 6px',
                  borderRadius: 4,
                  textTransform: 'uppercase',
                }}>
                  Minted
                </span>
              )}
            </div>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>
              {chapter.content_html.replace(/<[^>]*>/g, '').split(/\s+/).filter(w => w.length > 0).length} words
            </div>
          </button>
        ))}
      </div>

      <button
        onClick={onAddChapter}
        style={{
          background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
          border: 'none',
          borderRadius: 8,
          padding: '12px 16px',
          color: '#fff',
          fontWeight: 700,
          cursor: 'pointer',
          fontSize: 14,
        }}
      >
        + Add Chapter
      </button>
    </div>
  );
}

