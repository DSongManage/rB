import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface ReaderNavigationProps {
  onPrevious: () => void;
  onNext: () => void;
  onCenter: () => void;
  isFirstPage: boolean;
  isLastPage: boolean;
  showArrows: boolean;
  isMobile?: boolean;
  headerHeight?: number;
  footerHeight?: number;
}

export function ReaderNavigation({
  onPrevious,
  onNext,
  onCenter,
  isFirstPage,
  isLastPage,
  showArrows,
  isMobile = false,
  headerHeight = 60,
  footerHeight = 50,
}: ReaderNavigationProps) {
  // Mobile: 33%/34%/33% zones (larger tap areas)
  // Desktop: 25%/50%/25% zones
  const sideWidth = isMobile ? '33%' : '25%';
  const centerLeft = isMobile ? '33%' : '25%';
  const centerRight = isMobile ? '33%' : '25%';

  return (
    <>
      {/* Left click zone (previous page) */}
      <div
        className="reader-nav-zone reader-nav-left"
        onClick={(e) => {
          e.stopPropagation();
          if (!isFirstPage) onPrevious();
        }}
        style={{
          position: 'fixed',
          left: 0,
          top: isMobile ? 0 : `${headerHeight}px`,
          bottom: isMobile ? 0 : `${footerHeight}px`,
          width: sideWidth,
          cursor: isFirstPage ? 'default' : 'pointer',
          zIndex: 50,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          paddingLeft: isMobile ? '8px' : '12px',
        }}
        role="button"
        aria-label="Previous page"
      >
        {/* Hide arrows on mobile - just use tap zones */}
        {!isMobile && showArrows && !isFirstPage && (
          <div
            className="reader-nav-arrow"
            style={{
              opacity: 0.3,
              transition: 'opacity 0.2s ease',
              color: 'var(--reader-secondary)',
            }}
          >
            <ChevronLeft size={32} />
          </div>
        )}
      </div>

      {/* Center click zone (toggle UI) */}
      <div
        className="reader-nav-zone reader-nav-center"
        onClick={(e) => {
          e.stopPropagation();
          onCenter();
        }}
        style={{
          position: 'fixed',
          left: centerLeft,
          right: centerRight,
          top: isMobile ? 0 : `${headerHeight}px`,
          bottom: isMobile ? 0 : `${footerHeight}px`,
          cursor: 'pointer',
          zIndex: 50,
        }}
        role="button"
        aria-label="Toggle controls"
      />

      {/* Right click zone (next page) */}
      <div
        className="reader-nav-zone reader-nav-right"
        onClick={(e) => {
          e.stopPropagation();
          if (!isLastPage) onNext();
        }}
        style={{
          position: 'fixed',
          right: 0,
          top: isMobile ? 0 : `${headerHeight}px`,
          bottom: isMobile ? 0 : `${footerHeight}px`,
          width: sideWidth,
          cursor: isLastPage ? 'default' : 'pointer',
          zIndex: 50,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          paddingRight: isMobile ? '8px' : '12px',
        }}
        role="button"
        aria-label="Next page"
      >
        {/* Hide arrows on mobile - just use tap zones */}
        {!isMobile && showArrows && !isLastPage && (
          <div
            className="reader-nav-arrow"
            style={{
              opacity: 0.3,
              transition: 'opacity 0.2s ease',
              color: 'var(--reader-secondary)',
            }}
          >
            <ChevronRight size={32} />
          </div>
        )}
      </div>
    </>
  );
}

export default ReaderNavigation;
