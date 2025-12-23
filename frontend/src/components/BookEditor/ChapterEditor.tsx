import React, { useEffect, useState, useRef, useMemo } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { Chapter } from '../../services/bookApi';
import ChapterManagement from '../ChapterManagement';

interface ChapterEditorProps {
  chapter: Chapter | null;
  onUpdateChapter: (chapterId: number, title: string, content: string, synopsis?: string) => void;
  saving: boolean;
  lastSaved: Date | null;
  showManagement?: boolean;
  onManagementChange?: () => void;
}

export default function ChapterEditor({
  chapter,
  onUpdateChapter,
  saving,
  lastSaved,
  showManagement,
  onManagementChange
}: ChapterEditorProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [synopsis, setSynopsis] = useState('');
  const [showManagementPanel, setShowManagementPanel] = useState(false);
  const [showSynopsis, setShowSynopsis] = useState(false);

  // Track whether we're syncing from props to avoid triggering save
  const isSyncingFromProps = useRef(false);
  // Track the last loaded chapter ID to only sync when chapter actually changes
  const lastLoadedChapterId = useRef<number | null>(null);

  // Update local state only when chapter ID changes (not on every re-render)
  useEffect(() => {
    if (chapter && chapter.id !== lastLoadedChapterId.current) {
      isSyncingFromProps.current = true;
      lastLoadedChapterId.current = chapter.id;
      setTitle(chapter.title);
      setContent(chapter.content_html || '');
      setSynopsis(chapter.synopsis || '');
      // Reset sync flag after state updates are processed
      requestAnimationFrame(() => {
        isSyncingFromProps.current = false;
      });
    } else if (!chapter) {
      lastLoadedChapterId.current = null;
      setTitle('');
      setContent('');
      setSynopsis('');
    }
  }, [chapter?.id, chapter?.title, chapter?.content_html, chapter?.synopsis]);

  // Debounced save - only trigger if user made changes (not syncing from props)
  useEffect(() => {
    if (!chapter || isSyncingFromProps.current) return;

    const timer = setTimeout(() => {
      // Double-check we're not syncing and there are actual changes
      if (!isSyncingFromProps.current && (title !== chapter.title || content !== chapter.content_html || synopsis !== chapter.synopsis)) {
        onUpdateChapter(chapter.id, title, content, synopsis);
      }
    }, 3000); // 3 second debounce

    return () => clearTimeout(timer);
  }, [title, content, synopsis, chapter, onUpdateChapter]);

  // Memoize word count calculation - must be before any early returns to follow Rules of Hooks
  const wordCount = useMemo(() => {
    return content.replace(/<[^>]*>/g, '').split(/\s+/).filter(w => w.length > 0).length;
  }, [content]);

  if (!chapter) {
    return (
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#94a3b8',
        fontSize: 16,
        background: 'var(--panel)',
        border: '1px solid var(--panel-border)',
        borderRadius: 12,
        minHeight: 0,
      }}>
        Select a chapter to start editing
      </div>
    );
  }

  const isMinted = chapter.is_published;

  return (
    <div style={{
      flex: 1,
      background: 'var(--panel)',
      border: '1px solid var(--panel-border)',
      borderRadius: 12,
      padding: 24,
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
      minHeight: 0, // Critical: allows flex to work properly
      overflow: 'hidden',
    }}>
      {/* Header with title and status - Fixed height */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
        {isMinted && (
          <div style={{
            background: 'rgba(16, 185, 129, 0.08)',
            border: '1px solid rgba(16, 185, 129, 0.2)',
            borderRadius: 8,
            padding: '8px 12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: '#10b981', fontSize: 12 }}>✓</span>
              <span style={{ color: '#10b981', fontSize: 12, fontWeight: 500 }}>
                Minted • Read-only
              </span>
            </div>
            {showManagement && (
              <button
                onClick={() => setShowManagementPanel(!showManagementPanel)}
                style={{
                  background: 'transparent',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  borderRadius: 4,
                  padding: '3px 8px',
                  color: '#10b981',
                  fontSize: 10,
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                {showManagementPanel ? 'Hide' : 'Manage'}
              </button>
            )}
          </div>
        )}
        {/* Management panel - collapsible */}
        {showManagementPanel && showManagement && chapter && (
          <ChapterManagement
            chapter={chapter}
            onStatusChange={() => {
              setShowManagementPanel(false);
              onManagementChange?.();
            }}
          />
        )}
        <input
          type="text"
          value={title}
          onChange={(e) => !isMinted && setTitle(e.target.value)}
          placeholder="Chapter Title"
          disabled={isMinted}
          style={{
            background: isMinted ? 'rgba(100,100,100,0.05)' : 'var(--bg)',
            border: '1px solid var(--panel-border)',
            borderRadius: 8,
            padding: '10px 14px',
            color: isMinted ? '#64748b' : 'var(--text)',
            fontSize: 16,
            fontWeight: 600,
            outline: 'none',
            cursor: isMinted ? 'not-allowed' : 'text',
          }}
        />
        {/* Synopsis toggle and field */}
        <div>
          <button
            onClick={() => setShowSynopsis(!showSynopsis)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              fontSize: 12,
              cursor: 'pointer',
              padding: '4px 0',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <span style={{ fontSize: 10, transform: showSynopsis ? 'rotate(90deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>
              ▶
            </span>
            Synopsis {synopsis ? `(${synopsis.split(/\s+/).filter(w => w).length} words)` : '(optional)'}
          </button>
          {showSynopsis && (
            <div style={{ marginTop: 8 }}>
              <textarea
                value={synopsis}
                onChange={(e) => !isMinted && setSynopsis(e.target.value)}
                placeholder="Brief summary of this chapter (optional, max 150 words)..."
                disabled={isMinted}
                maxLength={1000}
                style={{
                  width: '100%',
                  minHeight: 80,
                  background: isMinted ? 'rgba(100,100,100,0.05)' : 'var(--bg)',
                  border: '1px solid var(--panel-border)',
                  borderRadius: 8,
                  padding: '10px 14px',
                  color: isMinted ? '#64748b' : 'var(--text)',
                  fontSize: 13,
                  resize: 'vertical',
                  cursor: isMinted ? 'not-allowed' : 'text',
                  outline: 'none',
                }}
              />
              <div style={{ fontSize: 10, color: '#64748b', marginTop: 4 }}>
                {synopsis.split(/\s+/).filter(w => w).length}/150 words recommended
              </div>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 11, color: '#64748b' }}>
            {wordCount.toLocaleString()} words
          </div>
          <div style={{ fontSize: 11, color: saving ? '#f59e0b' : '#64748b' }}>
            {isMinted ? '' : saving ? 'Saving...' : lastSaved ? `Saved ${formatTimeAgo(lastSaved)}` : 'Not saved'}
          </div>
        </div>
      </div>

      {/* Editor - Takes remaining space, scrolls internally */}
      <div style={{
        flex: 1,
        minHeight: 0, // Critical for flex overflow
        display: 'flex',
        flexDirection: 'column',
      }}>
        <ReactQuill
          value={content}
          onChange={(value) => !isMinted && setContent(value)}
          readOnly={isMinted}
          theme="snow"
          style={{
            flex: 1,
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

