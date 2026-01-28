/**
 * CollaborationPreviewReader Component
 *
 * A full-screen preview modal that shows how the comic will look when published.
 * Reuses ComicPageRenderer and ComicThumbnailSidebar from the reader.
 * Supports RTL (manga) and LTR (western) reading directions.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  Grid3X3,
  HelpCircle,
} from 'lucide-react';
import { ComicPage, CollaborativeProject } from '../../services/collaborationApi';
import { ComicPageData } from '../../services/libraryApi';
import { ComicPageRenderer } from '../reader/ComicPageRenderer';
import { ComicThumbnailSidebar } from '../reader/ComicThumbnailSidebar';
import { KeyboardShortcutsHelp } from './KeyboardShortcutsHelp';
import { transformToReaderData, isRTLReading } from '../../utils/collaborationToReaderTransform';

interface CollaborationPreviewReaderProps {
  pages: ComicPage[];
  project: CollaborativeProject;
  initialPage?: number;
  onClose: () => void;
}

export function CollaborationPreviewReader({
  pages,
  project,
  initialPage = 0,
  onClose,
}: CollaborationPreviewReaderProps) {
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [zoom, setZoom] = useState(1);
  const [showUI, setShowUI] = useState(true);
  const [showThumbnails, setShowThumbnails] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Transform collaboration data to reader format
  const readerData = transformToReaderData(project, pages);
  const isRTL = isRTLReading(project);
  const totalPages = readerData.total_pages;
  const currentPageData: ComicPageData | undefined = readerData.pages[currentPage];

  // Navigation functions that respect reading direction
  const goToPage = useCallback(
    (page: number) => {
      const validPage = Math.max(0, Math.min(page, totalPages - 1));
      setCurrentPage(validPage);
    },
    [totalPages]
  );

  const goToNextPage = useCallback(() => {
    if (currentPage < totalPages - 1) {
      goToPage(currentPage + 1);
    }
  }, [currentPage, totalPages, goToPage]);

  const goToPrevPage = useCallback(() => {
    if (currentPage > 0) {
      goToPage(currentPage - 1);
    }
  }, [currentPage, goToPage]);

  // RTL-aware navigation
  const handleLeftAction = useCallback(() => {
    if (isRTL) {
      goToNextPage();
    } else {
      goToPrevPage();
    }
  }, [isRTL, goToNextPage, goToPrevPage]);

  const handleRightAction = useCallback(() => {
    if (isRTL) {
      goToPrevPage();
    } else {
      goToNextPage();
    }
  }, [isRTL, goToNextPage, goToPrevPage]);

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
          handleRightAction();
          break;
        case 'ArrowLeft':
        case 'PageUp':
          e.preventDefault();
          handleLeftAction();
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
          if (showShortcuts) {
            setShowShortcuts(false);
          } else if (showThumbnails) {
            setShowThumbnails(false);
          } else if (isFullscreen) {
            document.exitFullscreen();
          } else {
            onClose();
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
        case '?':
          e.preventDefault();
          setShowShortcuts((s) => !s);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    handleLeftAction,
    handleRightAction,
    goToPage,
    totalPages,
    showThumbnails,
    showShortcuts,
    isFullscreen,
    onClose,
    zoomIn,
    zoomOut,
    resetZoom,
    toggleFullscreen,
  ]);

  // Auto-hide UI after inactivity
  useEffect(() => {
    let hideTimer: NodeJS.Timeout;

    const resetTimer = () => {
      setShowUI(true);
      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => {
        if (!showThumbnails && !showShortcuts) {
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
  }, [showThumbnails, showShortcuts]);

  const progressPercent = ((currentPage + 1) / totalPages) * 100;

  // Check if we have pages to display
  if (totalPages === 0) {
    return (
      <div
        ref={containerRef}
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: '#0a0f1a',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
        }}
      >
        <div style={{ color: '#94a3b8', textAlign: 'center' }}>
          <div style={{ fontSize: 18, marginBottom: 12 }}>No pages to preview</div>
          <div style={{ fontSize: 14, marginBottom: 24 }}>Add some pages to your comic first.</div>
          <button
            onClick={onClose}
            style={{
              background: '#f59e0b',
              color: '#000',
              border: 'none',
              borderRadius: 8,
              padding: '10px 20px',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Back to Editor
          </button>
        </div>
      </div>
    );
  }

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
        zIndex: 9999,
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
        {/* Left side - close button, title, and reading direction badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={onClose}
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
            title="Close preview (Esc)"
          >
            <X size={20} />
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#f8fafc' }}>
                {project.title}
              </div>
              {/* Reading direction badge */}
              <span
                style={{
                  background: isRTL ? '#4c1d95' : '#1e3a5f',
                  color: isRTL ? '#c4b5fd' : '#93c5fd',
                  padding: '2px 8px',
                  borderRadius: 4,
                  fontSize: 11,
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                {isRTL ? (
                  <>
                    <ChevronLeft size={12} /> Manga
                  </>
                ) : (
                  <>
                    Western <ChevronRight size={12} />
                  </>
                )}
              </span>
            </div>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>Preview Mode</div>
          </div>
        </div>

        {/* Right side - controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Help button */}
          <button
            onClick={() => setShowShortcuts(true)}
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
            title="Keyboard shortcuts (?)"
          >
            <HelpCircle size={20} />
          </button>

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

      {/* Navigation click zones - flipped for RTL */}
      <div
        style={{
          position: 'absolute',
          top: 60,
          bottom: 80,
          left: 0,
          width: '25%',
          cursor: isRTL ? (currentPage < totalPages - 1 ? 'pointer' : 'default') : (currentPage > 0 ? 'pointer' : 'default'),
          zIndex: 50,
        }}
        onClick={(e) => {
          e.stopPropagation();
          handleLeftAction();
        }}
      >
        {/* Left navigation indicator */}
        {showUI && (isRTL ? currentPage < totalPages - 1 : currentPage > 0) && (
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
          cursor: isRTL ? (currentPage > 0 ? 'pointer' : 'default') : (currentPage < totalPages - 1 ? 'pointer' : 'default'),
          zIndex: 50,
        }}
        onClick={(e) => {
          e.stopPropagation();
          handleRightAction();
        }}
      >
        {/* Right navigation indicator */}
        {showUI && (isRTL ? currentPage > 0 : currentPage < totalPages - 1) && (
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
            onClick={isRTL ? goToNextPage : goToPrevPage}
            disabled={isRTL ? currentPage >= totalPages - 1 : currentPage === 0}
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              borderRadius: 8,
              padding: '8px 16px',
              cursor: (isRTL ? currentPage >= totalPages - 1 : currentPage === 0) ? 'not-allowed' : 'pointer',
              color: (isRTL ? currentPage >= totalPages - 1 : currentPage === 0) ? '#475569' : '#f8fafc',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 14,
              opacity: (isRTL ? currentPage >= totalPages - 1 : currentPage === 0) ? 0.5 : 1,
            }}
          >
            <ChevronLeft size={16} />
            {isRTL ? 'Next' : 'Previous'}
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
            onClick={isRTL ? goToPrevPage : goToNextPage}
            disabled={isRTL ? currentPage === 0 : currentPage >= totalPages - 1}
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              borderRadius: 8,
              padding: '8px 16px',
              cursor: (isRTL ? currentPage === 0 : currentPage >= totalPages - 1) ? 'not-allowed' : 'pointer',
              color: (isRTL ? currentPage === 0 : currentPage >= totalPages - 1) ? '#475569' : '#f8fafc',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 14,
              opacity: (isRTL ? currentPage === 0 : currentPage >= totalPages - 1) ? 0.5 : 1,
            }}
          >
            {isRTL ? 'Previous' : 'Next'}
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
          Press <kbd style={{ background: '#1e293b', padding: '2px 6px', borderRadius: 4 }}>?</kbd>{' '}
          for keyboard shortcuts
        </div>
      </div>

      {/* Thumbnail sidebar */}
      {showThumbnails && (
        <ComicThumbnailSidebar
          pages={readerData.pages}
          currentPage={currentPage}
          onSelectPage={goToPage}
          onClose={() => setShowThumbnails(false)}
        />
      )}

      {/* Keyboard shortcuts help */}
      {showShortcuts && (
        <KeyboardShortcutsHelp onClose={() => setShowShortcuts(false)} isRTL={isRTL} />
      )}
    </div>
  );
}

export default CollaborationPreviewReader;
