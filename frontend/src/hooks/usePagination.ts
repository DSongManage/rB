import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { ReaderSettings, PagePosition, SavedPosition, isPagePosition } from '../types/reader';

interface UsePaginationOptions {
  contentRef: React.RefObject<HTMLDivElement>;
  settings: ReaderSettings;
  contentId: string;
  onPageChange?: (page: number, totalPages: number) => void;
}

interface UsePaginationReturn {
  currentPage: number;
  totalPages: number;
  goToPage: (page: number) => void;
  nextPage: () => void;
  prevPage: () => void;
  goToStart: () => void;
  goToEnd: () => void;
  percentComplete: number;
  isFirstPage: boolean;
  isLastPage: boolean;
  recalculatePages: () => void;
}

const POSITION_STORAGE_PREFIX = 'rb_reader_position_';

export function usePagination({
  contentRef,
  settings,
  contentId,
  onPageChange,
}: UsePaginationOptions): UsePaginationReturn {
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isInitializedRef = useRef(false);

  // Storage key for this specific content
  const storageKey = useMemo(
    () => `${POSITION_STORAGE_PREFIX}${contentId}`,
    [contentId]
  );

  // Calculate total pages based on content scroll width
  const calculateTotalPages = useCallback(() => {
    const content = contentRef.current;
    if (!content) return 1;

    const containerWidth = content.clientWidth;
    const scrollWidth = content.scrollWidth;

    if (containerWidth === 0) return 1;

    // Total pages is scrollWidth / containerWidth (each page is one column)
    const pages = Math.max(1, Math.ceil(scrollWidth / containerWidth));
    return pages;
  }, [contentRef]);

  // Scroll to a specific page
  const scrollToPage = useCallback(
    (page: number) => {
      const content = contentRef.current;
      if (!content) return;

      const pageWidth = content.clientWidth;
      content.scrollLeft = page * pageWidth;
    },
    [contentRef]
  );

  // Save position to localStorage
  const savePosition = useCallback(
    (page: number, total: number) => {
      const position: PagePosition = {
        page,
        totalPages: total,
        fontSize: settings.fontSize,
        lineHeight: settings.lineHeight,
      };

      try {
        localStorage.setItem(storageKey, JSON.stringify(position));
      } catch (e) {
        console.error('Failed to save reading position:', e);
      }
    },
    [storageKey, settings.fontSize, settings.lineHeight]
  );

  // Load saved position from localStorage
  const loadSavedPosition = useCallback((): PagePosition | null => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed: SavedPosition = JSON.parse(stored);
        if (isPagePosition(parsed)) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Failed to load reading position:', e);
    }
    return null;
  }, [storageKey]);

  // Recalculate pages and adjust position
  const recalculatePages = useCallback(() => {
    const newTotal = calculateTotalPages();
    setTotalPages(newTotal);

    // Ensure current page is valid
    setCurrentPage((prev) => {
      const validPage = Math.min(prev, newTotal - 1);
      scrollToPage(validPage);
      return validPage;
    });
  }, [calculateTotalPages, scrollToPage]);

  // Initialize and handle resize
  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;

    // Initial calculation
    const initializePages = () => {
      const total = calculateTotalPages();
      setTotalPages(total);

      // Try to restore saved position
      if (!isInitializedRef.current) {
        const savedPos = loadSavedPosition();
        if (savedPos) {
          // If settings changed, estimate new position
          let targetPage = savedPos.page;

          if (
            savedPos.fontSize !== settings.fontSize ||
            savedPos.lineHeight !== settings.lineHeight
          ) {
            // Settings changed, estimate based on percentage
            const percent = savedPos.page / savedPos.totalPages;
            targetPage = Math.round(percent * total);
          }

          // Ensure valid page
          targetPage = Math.max(0, Math.min(targetPage, total - 1));
          setCurrentPage(targetPage);
          scrollToPage(targetPage);
        }

        isInitializedRef.current = true;
      }
    };

    // Wait for content to render
    const timeoutId = setTimeout(initializePages, 100);

    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
      recalculatePages();
    });

    resizeObserver.observe(content);

    return () => {
      clearTimeout(timeoutId);
      resizeObserver.disconnect();
    };
  }, [
    contentRef,
    calculateTotalPages,
    loadSavedPosition,
    scrollToPage,
    recalculatePages,
    settings.fontSize,
    settings.lineHeight,
  ]);

  // Recalculate when settings change
  useEffect(() => {
    // Small delay to let CSS changes apply
    const timeoutId = setTimeout(() => {
      recalculatePages();
    }, 50);

    return () => clearTimeout(timeoutId);
  }, [settings.fontSize, settings.lineHeight, recalculatePages]);

  // Go to specific page
  const goToPage = useCallback(
    (page: number) => {
      const validPage = Math.max(0, Math.min(page, totalPages - 1));
      setCurrentPage(validPage);
      scrollToPage(validPage);
      savePosition(validPage, totalPages);
      onPageChange?.(validPage, totalPages);
    },
    [totalPages, scrollToPage, savePosition, onPageChange]
  );

  // Navigation helpers
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

  // Computed values
  const percentComplete = useMemo(() => {
    if (totalPages <= 1) return 100;
    return Math.round(((currentPage + 1) / totalPages) * 100);
  }, [currentPage, totalPages]);

  const isFirstPage = currentPage === 0;
  const isLastPage = currentPage >= totalPages - 1;

  return {
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
  };
}

export default usePagination;
