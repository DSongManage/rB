import React, { useEffect, useState } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { Chapter } from '../../services/bookApi';

interface ChapterEditorProps {
  chapter: Chapter | null;
  onUpdateChapter: (chapterId: number, title: string, content: string) => void;
  saving: boolean;
  lastSaved: Date | null;
}

export default function ChapterEditor({ chapter, onUpdateChapter, saving, lastSaved }: ChapterEditorProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  // Update local state when chapter changes
  useEffect(() => {
    if (chapter) {
      setTitle(chapter.title);
      setContent(chapter.content_html || '');
    } else {
      setTitle('');
      setContent('');
    }
  }, [chapter]); // Reset when chapter changes

  // Debounced save
  useEffect(() => {
    if (!chapter) return;
    
    const timer = setTimeout(() => {
      if (title !== chapter.title || content !== chapter.content_html) {
        onUpdateChapter(chapter.id, title, content);
      }
    }, 3000); // 3 second debounce

    return () => clearTimeout(timer);
  }, [title, content, chapter?.id]);

  if (!chapter) {
    return (
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#94a3b8',
        fontSize: 16,
      }}>
        Select a chapter to start editing
      </div>
    );
  }

  const wordCount = content.replace(/<[^>]*>/g, '').split(/\s+/).filter(w => w.length > 0).length;
  const isMinted = chapter.is_published;

  return (
    <div style={{
      flex: 1,
      background: 'var(--panel)',
      border: '1px solid var(--panel-border)',
      borderRadius: 12,
      padding: 24,
      height: '70vh',
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
    }}>
      {/* Header with title and status */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {isMinted && (
          <div style={{
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: 8,
            padding: '8px 12px',
            color: '#10b981',
            fontSize: 12,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            <span>✓</span>
            <span>This chapter has been minted and is read-only</span>
          </div>
        )}
        <input
          type="text"
          value={title}
          onChange={(e) => !isMinted && setTitle(e.target.value)}
          placeholder="Chapter Title"
          disabled={isMinted}
          style={{
            background: isMinted ? 'rgba(100,100,100,0.1)' : 'var(--bg)',
            border: '1px solid var(--panel-border)',
            borderRadius: 8,
            padding: '12px 16px',
            color: isMinted ? '#94a3b8' : 'var(--text)',
            fontSize: 18,
            fontWeight: 700,
            outline: 'none',
            cursor: isMinted ? 'not-allowed' : 'text',
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>
            {wordCount} words
          </div>
          <div style={{ fontSize: 12, color: saving ? '#f59e0b' : '#10b981' }}>
            {isMinted ? 'Minted' : saving ? 'Saving...' : lastSaved ? `Saved ${formatTimeAgo(lastSaved)}` : ''}
          </div>
        </div>
      </div>

      {/* Editor */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <ReactQuill
          value={content}
          onChange={(value) => !isMinted && setContent(value)}
          readOnly={isMinted}
          theme="snow"
          style={{ 
            height: '100%', 
            display: 'flex', 
            flexDirection: 'column',
            opacity: isMinted ? 0.6 : 1,
          }}
          modules={{
            toolbar: isMinted ? false : [
              [{ header: [1, 2, 3, false] }],
              ['bold', 'italic', 'underline', 'strike'],
              [{ list: 'ordered' }, { list: 'bullet' }],
              ['blockquote', 'code-block'],
              ['link'],
              ['clean'],
            ],
          }}
        />
      </div>
    </div>
  );
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

