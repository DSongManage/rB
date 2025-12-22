import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useReaderSettings } from '../../hooks/useReaderSettings';
import { useSwipeGesture } from '../../hooks/useSwipeGesture';
import { useKeyboardNavigation } from '../../hooks/useKeyboardNavigation';
import { useMobile } from '../../hooks/useMobile';
import { useFullscreen } from '../../hooks/useFullscreen';
import { useEdgeGesture } from '../../hooks/useEdgeGesture';
import {
  detectChapters,
  getCurrentChapter,
  injectChapterIds,
} from '../../utils/chapterDetection';
import { sanitizeHtml } from '../../utils/sanitize';
import { Chapter } from '../../types/reader';
import { ReaderHeader } from './ReaderHeader';
import { ReaderFooter } from './ReaderFooter';
import { ReaderNavigation } from './ReaderNavigation';
import { ReaderSettingsPanel } from './ReaderSettings';
import { MobileReaderSettings } from './MobileReaderSettings';
import { TableOfContents } from './TableOfContents';

interface KindleReaderProps {
  contentId: string;
  title: string;
  htmlContent: string;
  onBack?: () => void;
}

// Fixed reading widths for comfortable reading
const SINGLE_COLUMN_MAX_WIDTH = 650;
const TWO_COLUMN_MAX_WIDTH = 1200;
// Gap between columns in two-column mode
const COLUMN_GAP = 60;

export function KindleReader({
  contentId,
  title,
  htmlContent,
  onBack,
}: KindleReaderProps) {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // State
  const [showUI, setShowUI] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showTOC, setShowTOC] = useState(false);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [pageWidth, setPageWidth] = useState(0);
  const [columnWidth, setColumnWidth] = useState(0);

  // Hooks
  const { settings, updateSetting, resetSettings, cssVars, themeClass } =
    useReaderSettings();
  const { isMobile, isPhone } = useMobile();
  const { isFullscreen, toggleFullscreen, isSupported: fullscreenSupported } = useFullscreen(containerRef);

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

  // Calculate the page dimensions
  // First principles: viewport width = page width = column width (for single column)
  // or viewport width = 2 * column width + gap (for two columns)
  // NO padding on the column container - margins applied via CSS to content
  const calculateDimensions = useCallback(() => {
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport || !content || settings.continuousScroll) {
      setTotalPages(1);
      return;
    }

    // The viewport width IS the page width - they must be identical
    const viewportWidth = viewport.clientWidth;
    setPageWidth(viewportWidth);

    // Force single column on phones for better readability
    const effectiveCols = isPhone ? 'single' : settings.columns;

    // Column width must fit EXACTLY within viewport
    // Single column: column width = viewport width (entire page is one column)
    // Two columns: 2 * column width + gap = viewport width
    const calculatedColumnWidth = effectiveCols === 'two'
      ? Math.floor((viewportWidth - COLUMN_GAP) / 2)
      : viewportWidth; // Single column = full viewport width, no rounding needed
    setColumnWidth(calculatedColumnWidth);

    // Wait for columns to render, then calculate total pages
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!content) return;

        const scrollWidth = content.scrollWidth;
        // Pages = total scroll width / viewport width
        // Use Math.ceil to ensure we don't lose the last partial page
        const pages = Math.max(1, Math.ceil(scrollWidth / viewportWidth));
        setTotalPages(pages);

        // Ensure current page is valid
        setCurrentPage((prev) => Math.min(prev, Math.max(0, pages - 1)));
      });
    });
  }, [settings.continuousScroll, settings.columns, isPhone]);

  // Initialize and handle resize
  useEffect(() => {
    if (settings.continuousScroll) return;

    // Wait for content to render
    const timer = setTimeout(calculateDimensions, 250);

    // Handle resize
    const handleResize = () => {
      setTimeout(calculateDimensions, 150);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
    };
  }, [calculateDimensions, settings.continuousScroll]);

  // Recalculate when settings change
  useEffect(() => {
    const timer = setTimeout(calculateDimensions, 200);
    return () => clearTimeout(timer);
  }, [
    processedContent,
    calculateDimensions,
    settings.fontSize,
    settings.lineHeight,
    settings.columns,
    settings.margins,
  ]);

  // Navigation functions
  const goToPage = useCallback((page: number) => {
    const validPage = Math.max(0, Math.min(page, totalPages - 1));
    setCurrentPage(validPage);
  }, [totalPages]);

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

  const goToStart = useCallback(() => {
    goToPage(0);
  }, [goToPage]);

  const goToEnd = useCallback(() => {
    goToPage(totalPages - 1);
  }, [totalPages, goToPage]);

  // Get current chapter
  const currentChapter = useMemo(
    () => getCurrentChapter(chapters, currentPage),
    [chapters, currentPage]
  );

  // Handle chapter selection from TOC
  const handleSelectChapter = useCallback(
    (chapter: Chapter) => {
      goToPage(chapter.pageIndex);
      setShowTOC(false);
    },
    [goToPage]
  );

  // Toggle UI visibility
  const toggleUI = useCallback(() => {
    if (!showSettings && !showTOC) {
      setShowUI((prev) => !prev);
    }
  }, [showSettings, showTOC]);

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
    enabled: !showSettings && !showTOC && !settings.continuousScroll,
  });

  // Keyboard navigation
  useKeyboardNavigation({
    onNext: settings.continuousScroll ? undefined : nextPage,
    onPrevious: settings.continuousScroll ? undefined : prevPage,
    onFirst: goToStart,
    onLast: goToEnd,
    onEscape: () => {
      if (showSettings || showTOC) {
        setShowSettings(false);
        setShowTOC(false);
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

  // Edge gestures for mobile (swipe from edges to open TOC/Settings)
  useEdgeGesture(containerRef, {
    onLeftEdge: () => setShowTOC(true),
    onRightEdge: () => setShowSettings(true),
    enabled: isMobile && !showSettings && !showTOC && !settings.continuousScroll,
  });

  // Force single column on phones for better readability
  const effectiveColumns = isPhone ? 'single' : settings.columns;

  // Calculate percent complete
  const percentComplete = useMemo(() => {
    if (totalPages <= 1) return 100;
    return Math.round(((currentPage + 1) / totalPages) * 100);
  }, [currentPage, totalPages]);

  const isFirstPage = currentPage === 0;
  const isLastPage = currentPage >= totalPages - 1;

  // CSS variables for theming
  const themeStyles: React.CSSProperties = {
    '--reader-font-size': cssVars['--reader-font-size'],
    '--reader-line-height': cssVars['--reader-line-height'],
    '--reader-bg': cssVars['--reader-bg'],
    '--reader-text': cssVars['--reader-text'],
    '--reader-secondary': cssVars['--reader-secondary'],
    '--reader-border': cssVars['--reader-border'],
    '--reader-accent': cssVars['--reader-accent'],
    '--reader-font-family': cssVars['--reader-font-family'],
    '--reader-margin': cssVars['--reader-margin'],
    '--reader-text-align': cssVars['--reader-text-align'],
  } as React.CSSProperties;

  // Content width based on column setting (use effectiveColumns which forces single on phones)
  const contentMaxWidth = effectiveColumns === 'two' ? TWO_COLUMN_MAX_WIDTH : SINGLE_COLUMN_MAX_WIDTH;

  // Mobile-specific dimensions
  const headerHeight = isMobile ? 48 : 60;
  const footerHeight = isMobile ? 40 : 50;

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
        touchAction: settings.continuousScroll ? 'auto' : 'pan-y',
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
        className="reader-content-area"
        style={{
          position: 'fixed',
          top: showUI ? `${headerHeight}px` : '0',
          left: 0,
          right: 0,
          bottom: showUI ? `${footerHeight}px` : '0',
          display: 'flex',
          justifyContent: 'center',
          overflow: settings.continuousScroll ? 'auto' : 'hidden',
          transition: 'top 0.3s ease, bottom 0.3s ease',
          background: 'var(--reader-bg)',
        }}
      >
        {/*
          VIEWPORT: The visible page area
          - Fixed width = max reading width
          - overflow: hidden clips columns at exact page boundaries
          - NO padding here - padding would misalign columns with pages
        */}
        <div
          ref={viewportRef}
          className="reader-viewport"
          style={{
            width: '100%',
            maxWidth: `${contentMaxWidth}px`,
            height: '100%',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          {/*
            CONTENT: CSS columns container
            - column-width = viewport width (single) or (viewport - gap) / 2 (two)
            - ZERO padding - critical for alignment!
            - Margins are applied via CSS rules on p, h1, h2, etc.
            - Transform slides by exactly viewport width per page
          */}
          <div
            ref={contentRef}
            className="reader-columns"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(processedContent) }}
            style={{
              height: settings.continuousScroll ? 'auto' : '100%',
              // CRITICAL: No horizontal padding on the column container!
              // Padding would offset columns from page boundaries
              padding: settings.continuousScroll ? '24px 48px' : '24px 0',
              boxSizing: 'border-box',
              // CSS Columns - columnWidth determines column size, NOT column-count
              // For pagination: columns flow horizontally, transform slides by pageWidth
              // column-count would LIMIT total columns, breaking pagination
              columnGap: effectiveColumns === 'two' ? `${COLUMN_GAP}px` : '0',
              columnFill: 'auto',
              columnWidth: settings.continuousScroll
                ? undefined
                : columnWidth > 0 ? `${columnWidth}px` : undefined,
              // Transform slides content by exactly one page width
              transform: settings.continuousScroll
                ? 'none'
                : `translateX(-${currentPage * pageWidth}px)`,
              transition: 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
              // Typography
              fontFamily: 'var(--reader-font-family)',
              fontSize: 'var(--reader-font-size)',
              lineHeight: 'var(--reader-line-height)',
              color: 'var(--reader-text)',
              textAlign: settings.textAlign as 'left' | 'justify',
              hyphens: settings.textAlign === 'justify' ? 'auto' : 'none',
              WebkitHyphens: settings.textAlign === 'justify' ? 'auto' : 'none',
              wordBreak: 'break-word',
            }}
          />
        </div>
      </div>

      {/* Navigation Zones */}
      {!settings.continuousScroll && (
        <ReaderNavigation
          onPrevious={prevPage}
          onNext={nextPage}
          onCenter={toggleUI}
          isFirstPage={isFirstPage}
          isLastPage={isLastPage}
          showArrows={showUI}
          isMobile={isMobile}
          headerHeight={headerHeight}
          footerHeight={footerHeight}
        />
      )}

      {/* Footer */}
      <ReaderFooter
        currentPage={settings.continuousScroll ? 0 : currentPage}
        totalPages={settings.continuousScroll ? 1 : totalPages}
        percentComplete={percentComplete}
        visible={showUI}
        continuousScroll={settings.continuousScroll}
      />

      {/* Settings Panel - Mobile uses bottom drawer, desktop uses side panel */}
      {isMobile ? (
        <MobileReaderSettings
          settings={settings}
          updateSetting={updateSetting}
          onClose={() => setShowSettings(false)}
          visible={showSettings}
        />
      ) : (
        <ReaderSettingsPanel
          settings={settings}
          updateSetting={updateSetting}
          resetSettings={resetSettings}
          onClose={() => setShowSettings(false)}
          visible={showSettings}
        />
      )}

      {/* Table of Contents */}
      <TableOfContents
        chapters={chapters}
        currentChapterId={currentChapter?.id}
        onSelectChapter={handleSelectChapter}
        onClose={() => setShowTOC(false)}
        visible={showTOC}
      />

      {/* Global styles */}
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
          opacity: 0.7 !important;
        }

        .reader-icon-button:hover {
          background: var(--reader-border) !important;
        }

        /*
          Reader content styles - Kindle-like typography
          IMPORTANT: Visual margins are applied here to content elements,
          NOT to the column container. This keeps columns aligned with pages.
        */
        .reader-columns {
          letter-spacing: 0.01em;
          overflow: hidden;
        }

        .reader-viewport {
          overflow: hidden !important;
        }

        /* Apply horizontal padding to all direct children and common elements */
        .reader-columns > *,
        .reader-columns p,
        .reader-columns h1,
        .reader-columns h2,
        .reader-columns h3,
        .reader-columns h4,
        .reader-columns h5,
        .reader-columns h6,
        .reader-columns ul,
        .reader-columns ol,
        .reader-columns blockquote,
        .reader-columns pre,
        .reader-columns div {
          padding-left: 32px;
          padding-right: 32px;
          box-sizing: border-box;
        }

        .reader-columns h1,
        .reader-columns h2,
        .reader-columns h3 {
          color: var(--reader-text);
          margin-top: 1.5em;
          margin-bottom: 0.7em;
          line-height: 1.3;
          break-after: avoid;
        }

        .reader-columns h1:first-child,
        .reader-columns h2:first-child,
        .reader-columns h3:first-child {
          margin-top: 0;
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
          margin: 0 0 1em 0;
          text-indent: 0;
          orphans: 2;
          widows: 2;
          break-inside: avoid-column;
          -webkit-column-break-inside: avoid;
        }

        .reader-columns p + p {
          text-indent: 1.5em;
          margin-top: 0;
        }

        .reader-columns blockquote {
          margin: 1em 0;
          padding-top: 0.6em;
          padding-bottom: 0.6em;
          border-left: 3px solid var(--reader-border);
          color: var(--reader-secondary);
          font-style: italic;
          margin-left: 32px;
          padding-left: 1em;
        }

        .reader-columns a {
          color: var(--reader-accent, var(--reader-text));
          text-decoration: underline;
          text-underline-offset: 2px;
        }

        .reader-columns img {
          max-width: calc(100% - 64px);
          height: auto;
          margin: 1em auto;
          display: block;
        }

        .reader-columns ul,
        .reader-columns ol {
          margin: 1em 0;
          padding-left: calc(32px + 1.5em);
        }

        .reader-columns li {
          margin-bottom: 0.3em;
          padding-left: 0;
          padding-right: 0;
        }

        .reader-columns hr {
          border: none;
          text-align: center;
          margin: 1.5em 32px;
          padding: 0;
        }

        .reader-columns hr::before {
          content: "* * *";
          color: var(--reader-secondary);
          letter-spacing: 0.5em;
        }

        .reader-columns sup {
          font-size: 0.75em;
          vertical-align: super;
          line-height: 0;
        }

        .reader-columns pre,
        .reader-columns code {
          font-family: 'SF Mono', Monaco, 'Consolas', monospace;
          font-size: 0.85em;
          background: rgba(128, 128, 128, 0.1);
          border-radius: 4px;
        }

        .reader-columns pre {
          padding-top: 0.8em;
          padding-bottom: 0.8em;
          overflow-x: auto;
          margin: 1em 0;
        }

        .reader-columns code {
          padding: 0.15em 0.35em;
        }

        .reader-columns pre code {
          padding: 0;
          background: none;
        }

        /* Scrollbar for continuous mode */
        .reader-content-area::-webkit-scrollbar {
          width: 8px;
        }

        .reader-content-area::-webkit-scrollbar-track {
          background: transparent;
        }

        .reader-content-area::-webkit-scrollbar-thumb {
          background: var(--reader-border);
          border-radius: 4px;
        }

        .reader-content-area::-webkit-scrollbar-thumb:hover {
          background: var(--reader-secondary);
        }

        /* Selection */
        .reader-columns ::selection {
          background: var(--reader-accent, #58a6ff);
          color: white;
        }
      `}</style>
    </div>
  );
}

export default KindleReader;
