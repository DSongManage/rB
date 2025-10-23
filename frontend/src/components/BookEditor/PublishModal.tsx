import React, { useState } from 'react';
import { BookProject, Chapter } from '../../services/bookApi';

interface PublishModalProps {
  open: boolean;
  onClose: () => void;
  project: BookProject | null;
  currentChapter: Chapter | null;
  onPublish: (type: 'chapter' | 'book') => void;
}

export default function PublishModal({ open, onClose, project, currentChapter, onPublish }: PublishModalProps) {
  const [publishType, setPublishType] = useState<'chapter' | 'book'>('book');

  if (!open || !project) return null;

  const totalWords = project.chapters.reduce((sum, ch) => {
    const text = ch.content_html.replace(/<[^>]*>/g, '');
    return sum + text.split(/\s+/).filter(w => w.length > 0).length;
  }, 0);

  const currentChapterWords = currentChapter 
    ? currentChapter.content_html.replace(/<[^>]*>/g, '').split(/\s+/).filter(w => w.length > 0).length
    : 0;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--panel)',
          border: '1px solid var(--panel-border)',
          borderRadius: 16,
          padding: 32,
          maxWidth: 500,
          width: '90%',
          maxHeight: '80vh',
          overflowY: 'auto',
        }}
      >
        <h2 style={{ color: 'var(--text)', marginBottom: 24, fontSize: 24, fontWeight: 700 }}>
          Publish Your Work
        </h2>

        <div style={{ marginBottom: 24 }}>
          <div style={{ color: '#94a3b8', fontSize: 14, marginBottom: 16 }}>
            Choose how you want to publish:
          </div>

          {/* Publish Chapter Option */}
          {currentChapter && (
            <label
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
                padding: 16,
                background: publishType === 'chapter' ? 'rgba(245,158,11,0.1)' : 'var(--bg)',
                border: publishType === 'chapter' ? '2px solid #f59e0b' : '1px solid var(--panel-border)',
                borderRadius: 12,
                cursor: 'pointer',
                marginBottom: 12,
              }}
            >
              <input
                type="radio"
                name="publishType"
                value="chapter"
                checked={publishType === 'chapter'}
                onChange={() => setPublishType('chapter')}
                style={{ marginTop: 4 }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
                  Publish This Chapter
                </div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>
                  {currentChapter.title || 'Untitled Chapter'} • {currentChapterWords} words
                </div>
                <div style={{ fontSize: 12, color: '#94a3b8' }}>
                  Mint this chapter as a standalone NFT. Readers can collect individual chapters.
                </div>
              </div>
            </label>
          )}

          {/* Publish Book Option */}
          <label
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
              padding: 16,
              background: publishType === 'book' ? 'rgba(245,158,11,0.1)' : 'var(--bg)',
              border: publishType === 'book' ? '2px solid #f59e0b' : '1px solid var(--panel-border)',
              borderRadius: 12,
              cursor: 'pointer',
            }}
          >
            <input
              type="radio"
              name="publishType"
              value="book"
              checked={publishType === 'book'}
              onChange={() => setPublishType('book')}
              style={{ marginTop: 4 }}
            />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
                Publish Entire Book
              </div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>
                {project.title} • {project.chapters.length} chapters • {totalWords} words
              </div>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>
                Combine all chapters into one complete book NFT. Perfect for finished works.
              </div>
            </div>
          </label>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: '1px solid var(--panel-border)',
              borderRadius: 8,
              padding: '10px 20px',
              color: 'var(--text)',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => onPublish(publishType)}
            style={{
              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              border: 'none',
              borderRadius: 8,
              padding: '10px 20px',
              color: '#fff',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Continue to Mint
          </button>
        </div>
      </div>
    </div>
  );
}

