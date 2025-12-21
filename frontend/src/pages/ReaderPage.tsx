import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { libraryApi, type FullContent } from '../services/libraryApi';
import { KindleReader } from '../components/reader';
import { ArrowLeft, ZoomIn, ZoomOut, Maximize2, Download } from 'lucide-react';
import DOMPurify from 'dompurify';

// Art Viewer Component for displaying images
function ArtViewer({
  title,
  imageUrl,
  creator,
  onBack
}: {
  title: string;
  imageUrl: string;
  creator: string;
  onBack: () => void;
}) {
  const [zoom, setZoom] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.25, 0.5));
  const handleResetZoom = () => setZoom(1);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.fullscreenElement) {
        onBack();
      } else if (e.key === '+' || e.key === '=') {
        handleZoomIn();
      } else if (e.key === '-') {
        handleZoomOut();
      } else if (e.key === '0') {
        handleResetZoom();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onBack]);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        inset: 0,
        background: '#0a0f1a',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 20px',
          background: '#111827',
          borderBottom: '1px solid #1f2937',
          zIndex: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button
            onClick={onBack}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: 8,
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <div style={{ color: '#f8fafc', fontSize: 16, fontWeight: 600 }}>{title}</div>
            <div style={{ color: '#64748b', fontSize: 13 }}>by {creator}</div>
          </div>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={handleZoomOut}
            disabled={zoom <= 0.5}
            style={{
              background: '#1f2937',
              border: 'none',
              color: zoom <= 0.5 ? '#475569' : '#94a3b8',
              cursor: zoom <= 0.5 ? 'not-allowed' : 'pointer',
              padding: 8,
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
            }}
            title="Zoom out (-)"
          >
            <ZoomOut size={18} />
          </button>
          <span
            style={{
              color: '#94a3b8',
              fontSize: 13,
              minWidth: 50,
              textAlign: 'center',
              cursor: 'pointer',
            }}
            onClick={handleResetZoom}
            title="Reset zoom (0)"
          >
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={handleZoomIn}
            disabled={zoom >= 3}
            style={{
              background: '#1f2937',
              border: 'none',
              color: zoom >= 3 ? '#475569' : '#94a3b8',
              cursor: zoom >= 3 ? 'not-allowed' : 'pointer',
              padding: 8,
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
            }}
            title="Zoom in (+)"
          >
            <ZoomIn size={18} />
          </button>
          <div style={{ width: 1, height: 24, background: '#334155', margin: '0 8px' }} />
          <button
            onClick={toggleFullscreen}
            style={{
              background: '#1f2937',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: 8,
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
            }}
            title="Toggle fullscreen"
          >
            <Maximize2 size={18} />
          </button>
          <a
            href={imageUrl}
            download
            target="_blank"
            rel="noopener noreferrer"
            style={{
              background: '#1f2937',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: 8,
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              textDecoration: 'none',
            }}
            title="Download"
          >
            <Download size={18} />
          </a>
        </div>
      </div>

      {/* Image Container */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}
      >
        <img
          src={imageUrl}
          alt={title}
          style={{
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain',
            transform: `scale(${zoom})`,
            transition: 'transform 0.2s ease',
            borderRadius: 8,
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          }}
          draggable={false}
        />
      </div>

      {/* Footer hint */}
      <div
        style={{
          padding: '8px 20px',
          background: '#111827',
          borderTop: '1px solid #1f2937',
          textAlign: 'center',
          color: '#64748b',
          fontSize: 12,
        }}
      >
        Press <kbd style={{ background: '#1f2937', padding: '2px 6px', borderRadius: 4, marginInline: 4 }}>+</kbd> /
        <kbd style={{ background: '#1f2937', padding: '2px 6px', borderRadius: 4, marginInline: 4 }}>-</kbd> to zoom,
        <kbd style={{ background: '#1f2937', padding: '2px 6px', borderRadius: 4, marginInline: 4 }}>0</kbd> to reset,
        <kbd style={{ background: '#1f2937', padding: '2px 6px', borderRadius: 4, marginInline: 4 }}>Esc</kbd> to go back
      </div>
    </div>
  );
}

// Media Placeholder for music/film (to be implemented)
function MediaPlaceholder({
  title,
  contentType,
  creator,
  onBack
}: {
  title: string;
  contentType: string;
  creator: string;
  onBack: () => void;
}) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#0a0f1a',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <button
        onClick={onBack}
        style={{
          position: 'absolute',
          top: 20,
          left: 20,
          background: '#1f2937',
          border: 'none',
          color: '#94a3b8',
          cursor: 'pointer',
          padding: '8px 16px',
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <ArrowLeft size={18} />
        Back
      </button>

      <div
        style={{
          textAlign: 'center',
          maxWidth: 400,
        }}
      >
        <div
          style={{
            width: 80,
            height: 80,
            background: '#1f2937',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 24px',
            fontSize: 32,
          }}
        >
          {contentType === 'music' ? '🎵' : '🎬'}
        </div>
        <h2 style={{ color: '#f8fafc', fontSize: 24, marginBottom: 8 }}>{title}</h2>
        <p style={{ color: '#64748b', marginBottom: 4 }}>by {creator}</p>
        <p style={{ color: '#94a3b8', marginTop: 16 }}>
          {contentType === 'music' ? 'Music' : 'Film'} playback coming soon
        </p>
      </div>
    </div>
  );
}

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

  // Handle page changes for progress tracking (for books)
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
    navigate(-1);
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

  // Render different viewers based on content type
  if (content.content_type === 'art') {
    // Art viewer - display the image
    if (content.teaser_link) {
      return (
        <ArtViewer
          title={content.title}
          imageUrl={content.teaser_link}
          creator={content.creator}
          onBack={handleBack}
        />
      );
    } else {
      // No image available
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
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🎨</div>
            <div style={{ color: '#f8fafc', fontSize: 20, fontWeight: 600, marginBottom: 8 }}>
              {content.title}
            </div>
            <div style={{ color: '#94a3b8', marginBottom: 24 }}>
              Image not available
            </div>
            <button
              onClick={handleBack}
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
              Go Back
            </button>
          </div>
        </div>
      );
    }
  }

  // Music/Film placeholder
  if (content.content_type === 'music' || content.content_type === 'film') {
    return (
      <MediaPlaceholder
        title={content.title}
        contentType={content.content_type}
        creator={content.creator}
        onBack={handleBack}
      />
    );
  }

  // Default: Book reader (KindleReader)
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
