import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { libraryApi, type FullContent } from '../services/libraryApi';

export function ReaderPage() {
  const { contentId } = useParams<{ contentId: string }>();
  const navigate = useNavigate();
  const [content, setContent] = useState<FullContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);
  const progressUpdateTimer = useRef<NodeJS.Timeout | null>(null);

  // Load content
  useEffect(() => {
    if (!contentId) return;

    const loadContent = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await libraryApi.getFullContent(parseInt(contentId));
        setContent(data);

        // Load existing progress
        try {
          const progressData = await libraryApi.getProgress(parseInt(contentId));
          setProgress(parseFloat(progressData.progress_percentage.toString()));

          // Restore scroll position if available
          if (progressData.last_position) {
            const position = JSON.parse(progressData.last_position);
            if (position.scroll) {
              setTimeout(() => {
                window.scrollTo({ top: position.scroll });
              }, 100);
            }
          }
        } catch (err) {
          // Progress doesn't exist yet, that's okay
          console.log('No existing progress found');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load content');
        console.error('Content load error:', err);
      } finally {
        setLoading(false);
      }
    };

    loadContent();
  }, [contentId]);

  // Calculate and update progress on scroll
  const updateProgress = useCallback(() => {
    if (!contentRef.current || !contentId) return;

    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const scrollPercent = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
    const newProgress = Math.min(Math.max(scrollPercent, 0), 100);

    setProgress(newProgress);

    // Debounce API calls
    if (progressUpdateTimer.current) {
      clearTimeout(progressUpdateTimer.current);
    }

    progressUpdateTimer.current = setTimeout(() => {
      libraryApi
        .updateProgress(
          parseInt(contentId),
          newProgress,
          JSON.stringify({ scroll: scrollTop })
        )
        .catch((err) => console.error('Failed to update progress:', err));
    }, 2000); // Update every 2 seconds after scrolling stops
  }, [contentId]);

  // Track scroll
  useEffect(() => {
    const handleScroll = () => {
      updateProgress();
    };

    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (progressUpdateTimer.current) {
        clearTimeout(progressUpdateTimer.current);
      }
    };
  }, [updateProgress]);

  if (loading) {
    return (
      <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>
        Loading content...
      </div>
    );
  }

  if (error || !content) {
    return (
      <div
        style={{
          padding: 48,
          maxWidth: 600,
          margin: '0 auto',
        }}
      >
        <div
          style={{
            background: '#ef444420',
            border: '1px solid #ef4444',
            borderRadius: 12,
            padding: 24,
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 600, color: '#fca5a5', marginBottom: 8 }}>
            {error || 'Content not found'}
          </div>
          <div style={{ fontSize: 14, color: '#94a3b8', marginBottom: 16 }}>
            You may not have access to this content.
          </div>
          <button
            onClick={() => navigate('/')}
            style={{
              background: '#f59e0b',
              color: '#111827',
              padding: '10px 20px',
              borderRadius: 8,
              border: 'none',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: 80 }}>
      {/* Progress bar fixed at top */}
      <div
        style={{
          position: 'fixed',
          top: 64,
          left: 0,
          right: 0,
          height: 4,
          background: '#1f2937',
          zIndex: 50,
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${progress}%`,
            background: '#f59e0b',
            transition: 'width 0.1s ease',
          }}
        />
      </div>

      {/* Header */}
      <div
        style={{
          position: 'sticky',
          top: 64,
          background: '#0a0f1a',
          borderBottom: '1px solid #1f2937',
          padding: '16px 24px',
          zIndex: 40,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <button
          onClick={() => navigate('/')}
          style={{
            background: 'transparent',
            border: '1px solid #2a3444',
            color: '#cbd5e1',
            padding: '8px 16px',
            borderRadius: 8,
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: 14,
          }}
        >
          ← Back
        </button>
        <div style={{ fontSize: 14, color: '#94a3b8', fontWeight: 600 }}>
          {Math.round(progress)}% Complete
        </div>
      </div>

      {/* Content */}
      <div
        ref={contentRef}
        style={{
          maxWidth: 800,
          margin: '0 auto',
          padding: '48px 24px',
        }}
      >
        {/* Title */}
        <h1
          style={{
            fontSize: 36,
            fontWeight: 700,
            color: '#e5e7eb',
            marginBottom: 12,
            lineHeight: 1.2,
          }}
        >
          {content.title}
        </h1>

        {/* Creator */}
        <div
          style={{
            fontSize: 16,
            color: '#94a3b8',
            marginBottom: 32,
          }}
        >
          by {content.creator}
        </div>

        {/* HTML Content */}
        <div
          className="content-display"
          style={{
            fontSize: 18,
            lineHeight: 1.8,
            color: '#d1d5db',
          }}
          dangerouslySetInnerHTML={{ __html: content.content_html }}
        />
      </div>
    </div>
  );
}
