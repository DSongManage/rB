import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useReaderSettings } from '../../hooks/useReaderSettings';
import { usePagination } from '../../hooks/usePagination';
import { useSwipeGesture } from '../../hooks/useSwipeGesture';
import { useKeyboardNavigation } from '../../hooks/useKeyboardNavigation';
import {
  detectChapters,
  updateChapterPageIndices,
  getCurrentChapter,
  injectChapterIds,
} from '../../utils/chapterDetection';
import { Chapter } from '../../types/reader';
import { ReaderHeader } from './ReaderHeader';
import { ReaderFooter } from './ReaderFooter';
import { ReaderNavigation } from './ReaderNavigation';
import { ReaderSettingsPanel } from './ReaderSettings';
import { TableOfContents } from './TableOfContents';

interface KindleReaderProps {
  contentId: string;
  title: string;
  htmlContent: string;
  onBack?: () => void;
}

export function KindleReader({
  contentId,
  title,
  htmlContent,
  onBack,
}: KindleReaderProps) {
  const navigate = useNavigate();
  const contentRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // State
  const [showUI, setShowUI] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showTOC, setShowTOC] = useState(false);
  const [chapters, setChapters] = useState<Chapter[]>([]);

  // Hooks
  const { settings, updateSetting, resetSettings, cssVars, themeClass } =
    useReaderSettings();

  // Process content with chapter IDs
  const processedContent = useMemo(
    () => injectChapterIds(htmlContent),
    [htmlContent]
  );

  // Detect chapters from content
  useEffect(() => {
    const detectedChapters = detectChapters(htmlContent);
    setChapters(detectedChapters);
  }, [htmlContent]);

  const {
    currentPage,
    totalPages,
    goToPage,
    nextPage,
    prevPage,
    goToStart,
    goToEnd,
    percentComplete,
    isFirstPage,
    isLastPage,
    recalculatePages,
  } = usePagination({
    contentRef,
    settings,
    contentId,
    onPageChange: (page, total) => {
      // Update chapter indices when pages change
      if (contentRef.current && chapters.length > 0) {
        const updatedChapters = updateChapterPageIndices(
          chapters,
          contentRef.current
        );
        setChapters(updatedChapters);
      }
    },
  });

  // Get current chapter
  const currentChapter = useMemo(
    () => getCurrentChapter(chapters, currentPage),
    [chapters, currentPage]
  );

  // Handle chapter selection from TOC
  const handleSelectChapter = useCallback(
    (chapter: Chapter) => {
      goToPage(chapter.pageIndex);
    },
    [goToPage]
  );

  // Toggle UI visibility
  const toggleUI = useCallback(() => {
    if (!showSettings && !showTOC) {
      setShowUI((prev) => !prev);
    }
  }, [showSettings, showTOC]);

  // Close all overlays
  const closeOverlays = useCallback(() => {
    setShowSettings(false);
    setShowTOC(false);
  }, []);

  // Handle back navigation
  const handleBack = useCallback(() => {
    if (onBack) {
      onBack();
    } else {
      navigate(-1);
    }
  }, [navigate, onBack]);

  // Swipe gestures
  useSwipeGesture(containerRef, {
    onSwipeLeft: nextPage,
    onSwipeRight: prevPage,
    enabled: !showSettings && !showTOC,
  });

  // Keyboard navigation
  useKeyboardNavigation({
    onNext: nextPage,
    onPrevious: prevPage,
    onFirst: goToStart,
    onLast: goToEnd,
    onEscape: () => {
      if (showSettings || showTOC) {
        closeOverlays();
      } else if (showUI) {
        setShowUI(false);
      }
    },
    onToggleSettings: () => {
      if (!showTOC) {
        setShowSettings((prev) => !prev);
      }
    },
    onToggleTOC: () => {
      if (!showSettings) {
        setShowTOC((prev) => !prev);
      }
    },
    enabled: true,
  });

  // Update chapter page indices after pagination recalculates
  useEffect(() => {
    if (contentRef.current && chapters.length > 0 && totalPages > 1) {
      const timer = setTimeout(() => {
        if (contentRef.current) {
          const updatedChapters = updateChapterPageIndices(
            chapters,
            contentRef.current
          );
          setChapters(updatedChapters);
        }
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [totalPages, chapters.length]);

  // CSS variables for theming
  const themeStyles: React.CSSProperties = {
    '--reader-font-size': cssVars['--reader-font-size'],
    '--reader-line-height': cssVars['--reader-line-height'],
    '--reader-bg': cssVars['--reader-bg'],
    '--reader-text': cssVars['--reader-text'],
    '--reader-secondary': cssVars['--reader-secondary'],
    '--reader-border': cssVars['--reader-border'],
    '--reader-font-family': cssVars['--reader-font-family'],
  } as React.CSSProperties;

  return (
    <div
      ref={containerRef}
      className={`kindle-reader ${themeClass}`}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--reader-bg)',
        color: 'var(--reader-text)',
        overflow: 'hidden',
        touchAction: 'pan-y',
        ...themeStyles,
      }}
    >
      {/* Header */}
      <ReaderHeader
        title={title}
        chapterTitle={currentChapter?.title}
        onBack={handleBack}
        onToggleSettings={() => setShowSettings(true)}
        onToggleTOC={() => setShowTOC(true)}
        visible={showUI}
      />

      {/* Content Area */}
      <div
        ref={contentRef}
        className="reader-content-area"
        style={{
          position: 'fixed',
          top: showUI ? '60px' : '20px',
          left: 0,
          right: 0,
          bottom: showUI ? '50px' : '20px',
          padding: '20px 40px',
          overflow: 'hidden',
          transition: 'top 0.3s ease, bottom 0.3s ease',
          background: 'var(--reader-bg)',
        }}
      >
        <div
          className="reader-columns"
          dangerouslySetInnerHTML={{ __html: processedContent }}
          style={{
            height: '100%',
            columnWidth: 'calc(100vw - 80px)',
            columnGap: '80px',
            columnFill: 'auto',
            fontFamily: 'var(--reader-font-family)',
            fontSize: 'var(--reader-font-size)',
            lineHeight: 'var(--reader-line-height)',
            color: 'var(--reader-text)',
            textAlign: 'justify',
            hyphens: 'auto',
            WebkitHyphens: 'auto',
            wordBreak: 'break-word',
            overflowX: 'hidden',
            overflowY: 'hidden',
          }}
        />
      </div>

      {/* Navigation Zones */}
      <ReaderNavigation
        onPrevious={prevPage}
        onNext={nextPage}
        onCenter={toggleUI}
        isFirstPage={isFirstPage}
        isLastPage={isLastPage}
        showArrows={showUI}
      />

      {/* Footer */}
      <ReaderFooter
        currentPage={currentPage}
        totalPages={totalPages}
        percentComplete={percentComplete}
        visible={showUI}
      />

      {/* Settings Panel */}
      <ReaderSettingsPanel
        settings={settings}
        updateSetting={updateSetting}
        resetSettings={resetSettings}
        onClose={() => setShowSettings(false)}
        visible={showSettings}
      />

      {/* Table of Contents */}
      <TableOfContents
        chapters={chapters}
        currentChapterId={currentChapter?.id}
        onSelectChapter={handleSelectChapter}
        onClose={() => setShowTOC(false)}
        visible={showTOC}
      />

      {/* Global styles for animations */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }

        @keyframes slideRight {
          from { transform: translateX(-100%); }
          to { transform: translateX(0); }
        }

        .reader-nav-zone:hover .reader-nav-arrow {
          opacity: 0.6 !important;
        }

        .reader-icon-button:hover {
          background: var(--reader-border) !important;
        }

        /* Reader content styles */
        .reader-columns h1,
        .reader-columns h2,
        .reader-columns h3 {
          color: var(--reader-text);
          margin-top: 1.5em;
          margin-bottom: 0.5em;
          line-height: 1.3;
        }

        .reader-columns h1 {
          font-size: 1.5em;
          font-weight: 700;
        }

        .reader-columns h2 {
          font-size: 1.3em;
          font-weight: 600;
        }

        .reader-columns h3 {
          font-size: 1.15em;
          font-weight: 600;
        }

        .reader-columns p {
          margin-bottom: 1em;
          text-indent: 1.5em;
        }

        .reader-columns p:first-of-type,
        .reader-columns h1 + p,
        .reader-columns h2 + p,
        .reader-columns h3 + p {
          text-indent: 0;
        }

        .reader-columns blockquote {
          margin: 1em 0;
          padding-left: 1em;
          border-left: 3px solid var(--reader-border);
          color: var(--reader-secondary);
          font-style: italic;
        }

        .reader-columns a {
          color: var(--reader-text);
          text-decoration: underline;
        }

        .reader-columns img {
          max-width: 100%;
          height: auto;
          margin: 1em 0;
        }

        .reader-columns ul,
        .reader-columns ol {
          margin: 1em 0;
          padding-left: 2em;
        }

        .reader-columns li {
          margin-bottom: 0.5em;
        }

        /* Hide scrollbar */
        .reader-content-area::-webkit-scrollbar {
          display: none;
        }

        .reader-content-area {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}

export default KindleReader;
