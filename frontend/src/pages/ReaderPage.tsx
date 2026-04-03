import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { libraryApi, type FullContent, type ComicReaderData, type GalleryImage } from '../services/libraryApi';
import { KindleReader } from '../components/reader';
import { ComicReader } from '../components/reader/ComicReader';
import { ArrowLeft, ZoomIn, ZoomOut, Maximize2, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import DOMPurify from 'dompurify';
import CopyrightNotice from '../components/CopyrightNotice';

// Art Viewer Component for displaying images (supports single image or gallery)
function ArtViewer({
  title,
  imageUrl,
  creator,
  onBack,
  copyrightYear,
  copyrightHolder,
  galleryImages,
}: {
  title: string;
  imageUrl: string;
  creator: string;
  onBack: () => void;
  copyrightYear?: number | null;
  copyrightHolder?: string | null;
  galleryImages?: GalleryImage[];
}) {
  const [zoom, setZoom] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const thumbStripRef = useRef<HTMLDivElement>(null);

  const hasGallery = galleryImages && galleryImages.length > 0;
  const currentImage = hasGallery ? galleryImages[currentIndex] : null;
  const displayUrl = currentImage ? currentImage.media_file : imageUrl;
  const displayTitle = currentImage?.title || title;

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.25, 0.5));
  const handleResetZoom = () => setZoom(1);

  const goNext = useCallback(() => {
    if (hasGallery && currentIndex < galleryImages.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setZoom(1);
    }
  }, [hasGallery, currentIndex, galleryImages?.length]);

  const goPrev = useCallback(() => {
    if (hasGallery && currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      setZoom(1);
    }
  }, [hasGallery, currentIndex]);

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
      } else if (e.key === 'ArrowRight') {
        goNext();
      } else if (e.key === 'ArrowLeft') {
        goPrev();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onBack, goNext, goPrev]);

  // Scroll active thumbnail into view
  useEffect(() => {
    if (thumbStripRef.current) {
      const active = thumbStripRef.current.children[currentIndex] as HTMLElement;
      active?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [currentIndex]);

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
          background: 'var(--chip-bg)',
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
              color: 'var(--text-muted)',
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
            <div style={{ color: '#f8fafc', fontSize: 16, fontWeight: 600 }}>{displayTitle}</div>
            <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>by {creator}</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {hasGallery && (
            <span style={{ color: 'var(--text-muted)', fontSize: 13, marginRight: 8 }}>
              {currentIndex + 1} / {galleryImages.length}
            </span>
          )}
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
              color: 'var(--text-muted)',
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
              color: 'var(--text-muted)',
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
            href={displayUrl}
            download
            target="_blank"
            rel="noopener noreferrer"
            style={{
              background: '#1f2937',
              border: 'none',
              color: 'var(--text-muted)',
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

      {/* Image Container with navigation arrows */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          position: 'relative',
        }}
      >
        {hasGallery && currentIndex > 0 && (
          <button
            onClick={goPrev}
            style={{
              position: 'absolute',
              left: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'rgba(17, 24, 39, 0.8)',
              border: '1px solid var(--border)',
              color: '#f8fafc',
              cursor: 'pointer',
              padding: 12,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              zIndex: 5,
            }}
            title="Previous"
          >
            <ChevronLeft size={24} />
          </button>
        )}
        <img
          src={displayUrl}
          alt={displayTitle}
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
        {hasGallery && currentIndex < galleryImages.length - 1 && (
          <button
            onClick={goNext}
            style={{
              position: 'absolute',
              right: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'rgba(17, 24, 39, 0.8)',
              border: '1px solid var(--border)',
              color: '#f8fafc',
              cursor: 'pointer',
              padding: 12,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              zIndex: 5,
            }}
            title="Next"
          >
            <ChevronRight size={24} />
          </button>
        )}
      </div>

      {/* Thumbnail strip for gallery */}
      {hasGallery && galleryImages.length > 1 && (
        <div
          ref={thumbStripRef}
          style={{
            display: 'flex',
            gap: 8,
            padding: '8px 20px',
            overflowX: 'auto',
            background: 'var(--chip-bg)',
            borderTop: '1px solid #1f2937',
          }}
        >
          {galleryImages.map((img, idx) => (
            <button
              key={img.id}
              onClick={() => { setCurrentIndex(idx); setZoom(1); }}
              style={{
                flex: '0 0 auto',
                width: 60,
                height: 60,
                borderRadius: 6,
                overflow: 'hidden',
                border: idx === currentIndex ? '2px solid #f59e0b' : '2px solid transparent',
                cursor: 'pointer',
                padding: 0,
                background: 'var(--bg-secondary)',
                opacity: idx === currentIndex ? 1 : 0.6,
                transition: 'opacity 0.15s, border-color 0.15s',
              }}
            >
              <img
                src={img.media_file}
                alt={img.title || `Piece ${idx + 1}`}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </button>
          ))}
        </div>
      )}

      {/* Footer with copyright and keyboard hints */}
      <div
        style={{
          background: 'var(--chip-bg)',
          borderTop: '1px solid #1f2937',
        }}
      >
        <CopyrightNotice
          authorName={copyrightHolder || creator}
          year={copyrightYear || new Date().getFullYear()}
          compact
        />
        <div
          style={{
            padding: '8px 20px',
            textAlign: 'center',
            color: 'var(--text-muted)',
            fontSize: 12,
          }}
        >
          Press <kbd style={{ background: '#1f2937', padding: '2px 6px', borderRadius: 4, marginInline: 4 }}>+</kbd> /
          <kbd style={{ background: '#1f2937', padding: '2px 6px', borderRadius: 4, marginInline: 4 }}>-</kbd> to zoom,
          <kbd style={{ background: '#1f2937', padding: '2px 6px', borderRadius: 4, marginInline: 4 }}>0</kbd> to reset
          {hasGallery && (
            <>
              , <kbd style={{ background: '#1f2937', padding: '2px 6px', borderRadius: 4, marginInline: 4 }}>←</kbd> /
              <kbd style={{ background: '#1f2937', padding: '2px 6px', borderRadius: 4, marginInline: 4 }}>→</kbd> to navigate
            </>
          )}
          , <kbd style={{ background: '#1f2937', padding: '2px 6px', borderRadius: 4, marginInline: 4 }}>Esc</kbd> to go back
        </div>
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
          color: 'var(--text-muted)',
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
        <p style={{ color: 'var(--text-muted)', marginBottom: 4 }}>by {creator}</p>
        <p style={{ color: 'var(--text-muted)', marginTop: 16 }}>
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
  const [comicData, setComicData] = useState<ComicReaderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const lastSavedProgress = useRef<number>(-1);

  // Load content
  useEffect(() => {
    if (!contentId) return;

    const loadContent = async () => {
      try {
        setLoading(true);
        setError(null);
        setComicData(null);

        const data = await libraryApi.getFullContent(parseInt(contentId));
        setContent(data);

        // If it's a comic, also load the comic pages/panels data
        if (data.content_type === 'comic') {
          try {
            const comic = await libraryApi.getComicReaderData(parseInt(contentId));
            setComicData(comic);
          } catch (comicErr) {
            console.error('Failed to load comic data:', comicErr);
            // Don't fail the whole load, just show an error for comic
            setError('Failed to load comic pages. Please try again.');
          }
        }

        // Auto-save 100% progress for art content (single-view content)
        if (data.content_type === 'art') {
          libraryApi
            .updateProgress(parseInt(contentId), 100, JSON.stringify({ viewed: true }))
            .then(() => {
              lastSavedProgress.current = 100;
            })
            .catch((err) => console.error('Failed to update art progress:', err));
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
          color: 'var(--text-muted)',
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
          <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 16 }}>
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

  // Comic viewer
  if (content.content_type === 'comic') {
    if (comicData && comicData.pages.length > 0) {
      return (
        <ComicReader
          contentId={contentId || ''}
          title={content.title}
          comicData={comicData}
          onBack={handleBack}
          copyrightYear={content.copyright_year}
          copyrightHolder={content.copyright_holder}
        />
      );
    } else {
      // Comic data not loaded or no pages
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
            <div style={{ fontSize: 48, marginBottom: 16 }}>📚</div>
            <div style={{ color: '#f8fafc', fontSize: 20, fontWeight: 600, marginBottom: 8 }}>
              {content.title}
            </div>
            <div style={{ color: 'var(--text-muted)', marginBottom: 24 }}>
              {error || 'Comic pages not available'}
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

  // Art viewer
  if (content.content_type === 'art') {
    // Art viewer - display the image(s)
    if (content.teaser_link || (content.gallery_images && content.gallery_images.length > 0)) {
      return (
        <ArtViewer
          title={content.title}
          imageUrl={content.teaser_link || ''}
          creator={content.creator}
          onBack={handleBack}
          copyrightYear={content.copyright_year}
          copyrightHolder={content.copyright_holder}
          galleryImages={content.gallery_images}
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
            <div style={{ color: 'var(--text-muted)', marginBottom: 24 }}>
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
      copyrightYear={content.copyright_year}
      copyrightHolder={content.copyright_holder}
    />
  );
}
