import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { libraryApi, type FullContent } from '../services/libraryApi';
import { KindleReader } from '../components/reader';
import DOMPurify from 'dompurify';

export function ReaderPage() {
  const { contentId } = useParams<{ contentId: string }>();
  const navigate = useNavigate();
  const [content, setContent] = useState<FullContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load content');
        console.error('Content load error:', err);
      } finally {
        setLoading(false);
      }
    };

    loadContent();

    // Cleanup on unmount
    return () => {
      if (progressUpdateTimer.current) {
        clearTimeout(progressUpdateTimer.current);
      }
    };
  }, [contentId]);

  // Handle page changes for progress tracking
  const handlePageChange = useCallback(
    (page: number, totalPages: number) => {
      if (!contentId) return;

      const progress = totalPages > 1 ? ((page + 1) / totalPages) * 100 : 100;

      // Debounce API calls
      if (progressUpdateTimer.current) {
        clearTimeout(progressUpdateTimer.current);
      }

      progressUpdateTimer.current = setTimeout(() => {
        libraryApi
          .updateProgress(
            parseInt(contentId),
            progress,
            JSON.stringify({ page, totalPages })
          )
          .catch((err) => console.error('Failed to update progress:', err));
      }, 2000);
    },
    [contentId]
  );

  // Handle back navigation
  const handleBack = useCallback(() => {
    navigate('/');
  }, [navigate]);

  if (loading) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0a0f1a',
          color: '#94a3b8',
          fontSize: 16,
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: 40,
              height: 40,
              border: '3px solid #1f2937',
              borderTopColor: '#f59e0b',
              borderRadius: '50%',
              margin: '0 auto 16px',
              animation: 'spin 1s linear infinite',
            }}
          />
          Loading content...
        </div>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (error || !content) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0a0f1a',
          padding: 24,
        }}
      >
        <div
          style={{
            maxWidth: 400,
            background: '#ef444420',
            border: '1px solid #ef4444',
            borderRadius: 12,
            padding: 24,
            textAlign: 'center',
          }}
        >
          <div
            style={{
              fontSize: 18,
              fontWeight: 600,
              color: '#fca5a5',
              marginBottom: 8,
            }}
          >
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

  // Sanitize the HTML content
  const sanitizedContent = DOMPurify.sanitize(content.content_html, {
    ALLOWED_TAGS: [
      'p',
      'br',
      'strong',
      'em',
      'u',
      'i',
      'b',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'ul',
      'ol',
      'li',
      'blockquote',
      'pre',
      'code',
      'a',
      'img',
      'div',
      'span',
    ],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'id'],
    FORBID_TAGS: [
      'script',
      'style',
      'iframe',
      'object',
      'embed',
      'form',
      'input',
    ],
    FORBID_ATTR: ['onerror', 'onclick', 'onload', 'onmouseover'],
    ALLOW_DATA_ATTR: false,
  });

  return (
    <KindleReader
      contentId={contentId || ''}
      title={content.title}
      htmlContent={sanitizedContent}
      onBack={handleBack}
    />
  );
}
