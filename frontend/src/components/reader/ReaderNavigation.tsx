import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface ReaderNavigationProps {
  onPrevious: () => void;
  onNext: () => void;
  onCenter: () => void;
  isFirstPage: boolean;
  isLastPage: boolean;
  showArrows: boolean;
}

export function ReaderNavigation({
  onPrevious,
  onNext,
  onCenter,
  isFirstPage,
  isLastPage,
  showArrows,
}: ReaderNavigationProps) {
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
          top: '60px',
          bottom: '50px',
          width: '25%',
          cursor: isFirstPage ? 'default' : 'pointer',
          zIndex: 50,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          paddingLeft: '12px',
        }}
        role="button"
        aria-label="Previous page"
      >
        {showArrows && !isFirstPage && (
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
          left: '25%',
          right: '25%',
          top: '60px',
          bottom: '50px',
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
          top: '60px',
          bottom: '50px',
          width: '25%',
          cursor: isLastPage ? 'default' : 'pointer',
          zIndex: 50,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          paddingRight: '12px',
        }}
        role="button"
        aria-label="Next page"
      >
        {showArrows && !isLastPage && (
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
