/**
 * ComicReader Component
 *
 * Main comic reading interface with page navigation, zoom, and fullscreen support.
 * Similar to KindleReader but optimized for visual comic content.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  Grid3X3,
} from 'lucide-react';
import { ComicReaderData } from '../../services/libraryApi';
import { libraryApi } from '../../services/libraryApi';
import { ComicPageRenderer } from './ComicPageRenderer';
import { ComicThumbnailSidebar } from './ComicThumbnailSidebar';

interface ComicReaderProps {
  contentId: string;
  title: string;
  comicData: ComicReaderData;
  onBack: () => void;
  copyrightYear?: number | null;
  copyrightHolder?: string | null;
}

export function ComicReader({ contentId, title, comicData, onBack, copyrightYear, copyrightHolder }: ComicReaderProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [showUI, setShowUI] = useState(true);
  const [showThumbnails, setShowThumbnails] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoadingPosition, setIsLoadingPosition] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressUpdateTimer = useRef<NodeJS.Timeout | null>(null);
  const hasRestoredPosition = useRef(false);

  const totalPages = comicData.total_pages;
  const currentPageData = comicData.pages[currentPage];

  // Load saved reading position from server on mount
  useEffect(() => {
    if (hasRestoredPosition.current) {
      setIsLoadingPosition(false);
      return;
    }

    libraryApi.getProgress(parseInt(contentId))
      .then((progress) => {
        if (progress.last_position) {
          try {
            const position = JSON.parse(progress.last_position);
            if (typeof position.page === 'number' && position.page > 0) {
              const validPage = Math.min(position.page, totalPages - 1);
              setCurrentPage(validPage);
              hasRestoredPosition.current = true;
            }
          } catch (e) {
            console.error('Failed to parse saved position:', e);
          }
        }
      })
      .catch((err) => {
        // No saved progress is fine - user just hasn't read this yet
        console.debug('No saved progress found:', err);
      })
      .finally(() => {
        setIsLoadingPosition(false);
        hasRestoredPosition.current = true;
      });
  }, [contentId, totalPages]);

  // Navigation functions
  const goToPage = useCallback(
    (page: number) => {
      const validPage = Math.max(0, Math.min(page, totalPages - 1));
      setCurrentPage(validPage);
    },
    [totalPages]
  );

  const nextPage = useCallback(() => {
    if (currentPage < totalPages - 1) {
      goToPage(currentPage + 1);
    }
  }, [currentPage, totalPages, goToPage]);

  const prevPage = useCallback(() => {
    if (currentPage > 0) {
      goToPage(currentPage - 1);
    }
  }, [currentPage, goToPage]);

  // Zoom functions
  const zoomIn = useCallback(() => {
    setZoom((z) => Math.min(z + 0.25, 3));
  }, []);

  const zoomOut = useCallback(() => {
    setZoom((z) => Math.max(z - 0.25, 0.5));
  }, []);

  const resetZoom = useCallback(() => {
    setZoom(1);
  }, []);

  // Fullscreen toggle
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key) {
        case 'ArrowRight':
        case ' ':
        case 'PageDown':
          e.preventDefault();
          nextPage();
          break;
        case 'ArrowLeft':
        case 'PageUp':
          e.preventDefault();
          prevPage();
          break;
        case 'Home':
          e.preventDefault();
          goToPage(0);
          break;
        case 'End':
          e.preventDefault();
          goToPage(totalPages - 1);
          break;
        case 'Escape':
          if (showThumbnails) {
            setShowThumbnails(false);
          } else if (isFullscreen) {
            document.exitFullscreen();
          } else {
            onBack();
          }
          break;
        case '+':
        case '=':
          e.preventDefault();
          zoomIn();
          break;
        case '-':
          e.preventDefault();
          zoomOut();
          break;
        case '0':
          e.preventDefault();
          resetZoom();
          break;
        case 't':
        case 'T':
          e.preventDefault();
          setShowThumbnails((s) => !s);
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          toggleFullscreen();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    nextPage,
    prevPage,
    goToPage,
    totalPages,
    showThumbnails,
    isFullscreen,
    onBack,
    zoomIn,
    zoomOut,
    resetZoom,
    toggleFullscreen,
  ]);

  // Progress tracking (debounced with save on unmount)
  const lastSavedProgress = useRef<number>(-1);

  useEffect(() => {
    if (progressUpdateTimer.current) {
      clearTimeout(progressUpdateTimer.current);
    }

    const progress = ((currentPage + 1) / totalPages) * 100;

    progressUpdateTimer.current = setTimeout(() => {
      libraryApi
        .updateProgress(
          parseInt(contentId),
          progress,
          JSON.stringify({ page: currentPage, totalPages })
        )
        .then(() => {
          lastSavedProgress.current = progress;
        })
        .catch(console.error);
    }, 1000);

    return () => {
      if (progressUpdateTimer.current) {
        clearTimeout(progressUpdateTimer.current);
      }
      // Save immediately on unmount if progress changed
      const finalProgress = ((currentPage + 1) / totalPages) * 100;
      if (finalProgress !== lastSavedProgress.current) {
        libraryApi
          .updateProgress(
            parseInt(contentId),
            finalProgress,
            JSON.stringify({ page: currentPage, totalPages })
          )
          .catch(console.error);
      }
    };
  }, [currentPage, totalPages, contentId]);

  // Auto-hide UI after inactivity
  useEffect(() => {
    let hideTimer: NodeJS.Timeout;

    const resetTimer = () => {
      setShowUI(true);
      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => {
        if (!showThumbnails) {
          setShowUI(false);
        }
      }, 3000);
    };

    window.addEventListener('mousemove', resetTimer);
    window.addEventListener('touchstart', resetTimer);

    resetTimer();

    return () => {
      clearTimeout(hideTimer);
      window.removeEventListener('mousemove', resetTimer);
      window.removeEventListener('touchstart', resetTimer);
    };
  }, [showThumbnails]);

  const progressPercent = ((currentPage + 1) / totalPages) * 100;

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: '#0a0f1a',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          padding: '12px 16px',
          background: 'linear-gradient(to bottom, rgba(10, 15, 26, 0.95), transparent)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          zIndex: 100,
          opacity: showUI ? 1 : 0,
          transform: showUI ? 'translateY(0)' : 'translateY(-100%)',
          transition: 'opacity 0.3s ease, transform 0.3s ease',
          pointerEvents: showUI ? 'auto' : 'none',
        }}
      >
        {/* Left side - back button and title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={onBack}
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              borderRadius: 8,
              padding: 8,
              cursor: 'pointer',
              color: '#f8fafc',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#f8fafc' }}>{title}</div>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>by {comicData.creator}</div>
          </div>
        </div>

        {/* Right side - controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Thumbnails toggle */}
          <button
            onClick={() => setShowThumbnails(true)}
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              borderRadius: 8,
              padding: 8,
              cursor: 'pointer',
              color: '#f8fafc',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Pages (T)"
          >
            <Grid3X3 size={20} />
          </button>

          {/* Zoom controls */}
          <button
            onClick={zoomOut}
            disabled={zoom <= 0.5}
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              borderRadius: 8,
              padding: 8,
              cursor: zoom <= 0.5 ? 'not-allowed' : 'pointer',
              color: zoom <= 0.5 ? '#475569' : '#f8fafc',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: zoom <= 0.5 ? 0.5 : 1,
            }}
            title="Zoom out (-)"
          >
            <ZoomOut size={20} />
          </button>

          <button
            onClick={resetZoom}
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              borderRadius: 8,
              padding: '4px 12px',
              cursor: 'pointer',
              color: '#f8fafc',
              fontSize: 14,
              fontWeight: 500,
            }}
            title="Reset zoom (0)"
          >
            {Math.round(zoom * 100)}%
          </button>

          <button
            onClick={zoomIn}
            disabled={zoom >= 3}
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              borderRadius: 8,
              padding: 8,
              cursor: zoom >= 3 ? 'not-allowed' : 'pointer',
              color: zoom >= 3 ? '#475569' : '#f8fafc',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: zoom >= 3 ? 0.5 : 1,
            }}
            title="Zoom in (+)"
          >
            <ZoomIn size={20} />
          </button>

          {/* Fullscreen toggle */}
          <button
            onClick={toggleFullscreen}
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              borderRadius: 8,
              padding: 8,
              cursor: 'pointer',
              color: '#f8fafc',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Fullscreen (F)"
          >
            {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
          </button>
        </div>
      </div>

      {/* Main content area */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '60px 60px 80px',
          position: 'relative',
        }}
        onClick={() => setShowUI((s) => !s)}
      >
        {currentPageData && <ComicPageRenderer page={currentPageData} zoom={zoom} fitToContainer />}
      </div>

      {/* Navigation click zones */}
      <div
        style={{
          position: 'absolute',
          top: 60,
          bottom: 80,
          left: 0,
          width: '25%',
          cursor: currentPage > 0 ? 'pointer' : 'default',
          zIndex: 50,
        }}
        onClick={(e) => {
          e.stopPropagation();
          prevPage();
        }}
      >
        {/* Left navigation indicator */}
        {showUI && currentPage > 0 && (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: 16,
              transform: 'translateY(-50%)',
              background: 'rgba(0, 0, 0, 0.5)',
              borderRadius: '50%',
              padding: 12,
              color: '#f8fafc',
            }}
          >
            <ChevronLeft size={24} />
          </div>
        )}
      </div>

      <div
        style={{
          position: 'absolute',
          top: 60,
          bottom: 80,
          right: 0,
          width: '25%',
          cursor: currentPage < totalPages - 1 ? 'pointer' : 'default',
          zIndex: 50,
        }}
        onClick={(e) => {
          e.stopPropagation();
          nextPage();
        }}
      >
        {/* Right navigation indicator */}
        {showUI && currentPage < totalPages - 1 && (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              right: 16,
              transform: 'translateY(-50%)',
              background: 'rgba(0, 0, 0, 0.5)',
              borderRadius: '50%',
              padding: 12,
              color: '#f8fafc',
            }}
          >
            <ChevronRight size={24} />
          </div>
        )}
      </div>

      {/* Footer */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '16px 20px',
          background: 'linear-gradient(to top, rgba(10, 15, 26, 0.95), transparent)',
          zIndex: 100,
          opacity: showUI ? 1 : 0,
          transform: showUI ? 'translateY(0)' : 'translateY(100%)',
          transition: 'opacity 0.3s ease, transform 0.3s ease',
          pointerEvents: showUI ? 'auto' : 'none',
        }}
      >
        {/* Progress bar */}
        <div
          style={{
            height: 4,
            backgroundColor: 'rgba(255, 255, 255, 0.2)',
            borderRadius: 2,
            marginBottom: 12,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${progressPercent}%`,
              backgroundColor: '#f59e0b',
              borderRadius: 2,
              transition: 'width 0.3s ease',
            }}
          />
        </div>

        {/* Page indicator and navigation */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <button
            onClick={prevPage}
            disabled={currentPage === 0}
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              borderRadius: 8,
              padding: '8px 16px',
              cursor: currentPage === 0 ? 'not-allowed' : 'pointer',
              color: currentPage === 0 ? '#475569' : '#f8fafc',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 14,
              opacity: currentPage === 0 ? 0.5 : 1,
            }}
          >
            <ChevronLeft size={16} />
            Previous
          </button>

          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#f8fafc' }}>
              Page {currentPage + 1} of {totalPages}
            </div>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>
              {Math.round(progressPercent)}% complete
            </div>
          </div>

          <button
            onClick={nextPage}
            disabled={currentPage >= totalPages - 1}
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              borderRadius: 8,
              padding: '8px 16px',
              cursor: currentPage >= totalPages - 1 ? 'not-allowed' : 'pointer',
              color: currentPage >= totalPages - 1 ? '#475569' : '#f8fafc',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 14,
              opacity: currentPage >= totalPages - 1 ? 0.5 : 1,
            }}
          >
            Next
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Keyboard hints */}
        <div
          style={{
            marginTop: 12,
            fontSize: 11,
            color: '#64748b',
            textAlign: 'center',
          }}
        >
          Press <kbd style={{ background: '#1e293b', padding: '2px 6px', borderRadius: 4 }}>+</kbd>/
          <kbd style={{ background: '#1e293b', padding: '2px 6px', borderRadius: 4 }}>-</kbd> to
          zoom, <kbd style={{ background: '#1e293b', padding: '2px 6px', borderRadius: 4 }}>0</kbd>{' '}
          to reset,{' '}
          <kbd style={{ background: '#1e293b', padding: '2px 6px', borderRadius: 4 }}>Esc</kbd> to go
          back
        </div>

        {/* Copyright notice */}
        {(copyrightHolder || copyrightYear) && (
          <div
            style={{
              marginTop: 8,
              fontSize: 9,
              color: '#64748b',
              textAlign: 'center',
              opacity: 0.7,
            }}
          >
            (C) {copyrightYear || new Date().getFullYear()} {copyrightHolder}. All Rights Reserved.
          </div>
        )}
      </div>

      {/* Thumbnail sidebar */}
      {showThumbnails && (
        <ComicThumbnailSidebar
          pages={comicData.pages}
          currentPage={currentPage}
          onSelectPage={goToPage}
          onClose={() => setShowThumbnails(false)}
        />
      )}
    </div>
  );
}

export default ComicReader;
