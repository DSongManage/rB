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
  const isInitializedRef = useRef(false);
  const settingsRef = useRef(settings);

  // Update settings ref
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  // Storage key for this specific content
  const storageKey = useMemo(
    () => `${POSITION_STORAGE_PREFIX}${contentId}`,
    [contentId]
  );

  // Calculate total pages based on content scroll width
  const calculateTotalPages = useCallback(() => {
    const content = contentRef.current;
    if (!content) return 1;

    // In continuous scroll mode, we don't paginate
    if (settings.continuousScroll) return 1;

    const containerWidth = content.clientWidth;
    const scrollWidth = content.scrollWidth;

    if (containerWidth === 0) return 1;

    // Calculate pages with a small tolerance to avoid creating empty pages
    // This handles cases where scrollWidth is slightly larger due to column gaps
    const rawPages = scrollWidth / containerWidth;
    const tolerance = 0.1; // 10% tolerance

    // If we're very close to a whole number, round down
    const pages = Math.max(1,
      rawPages - Math.floor(rawPages) < tolerance
        ? Math.floor(rawPages)
        : Math.ceil(rawPages)
    );

    return pages;
  }, [contentRef, settings.continuousScroll]);

  // Scroll to a specific page
  const scrollToPage = useCallback(
    (page: number) => {
      const content = contentRef.current;
      if (!content || settings.continuousScroll) return;

      const pageWidth = content.clientWidth;
      content.scrollLeft = page * pageWidth;
    },
    [contentRef, settings.continuousScroll]
  );

  // Save position to localStorage
  const savePosition = useCallback(
    (page: number, total: number) => {
      const position: PagePosition = {
        page,
        totalPages: total,
        fontSize: settings.fontSize,
        lineHeight: settings.lineHeight,
        margins: settings.margins,
        columns: settings.columns,
      };

      try {
        localStorage.setItem(storageKey, JSON.stringify(position));
      } catch (e) {
        console.error('Failed to save reading position:', e);
      }
    },
    [storageKey, settings.fontSize, settings.lineHeight, settings.margins, settings.columns]
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
      // Use requestAnimationFrame to ensure DOM has updated
      requestAnimationFrame(() => {
        scrollToPage(validPage);
      });
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
          // Calculate if settings changed significantly
          const settingsChanged =
            savedPos.fontSize !== settings.fontSize ||
            savedPos.lineHeight !== settings.lineHeight ||
            savedPos.margins !== settings.margins ||
            savedPos.columns !== settings.columns;

          let targetPage = savedPos.page;

          if (settingsChanged) {
            // Settings changed, estimate based on percentage
            const percent = savedPos.totalPages > 0
              ? savedPos.page / savedPos.totalPages
              : 0;
            targetPage = Math.round(percent * total);
          }

          // Ensure valid page
          targetPage = Math.max(0, Math.min(targetPage, total - 1));
          setCurrentPage(targetPage);

          // Wait for layout to settle before scrolling
          requestAnimationFrame(() => {
            scrollToPage(targetPage);
          });
        }

        isInitializedRef.current = true;
      }
    };

    // Wait for content to render
    const timeoutId = setTimeout(initializePages, 150);

    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
      // Debounce resize recalculation
      clearTimeout(timeoutId);
      setTimeout(() => {
        recalculatePages();
      }, 100);
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
    settings.margins,
    settings.columns,
  ]);

  // Recalculate when settings change
  useEffect(() => {
    if (!isInitializedRef.current) return;

    // Small delay to let CSS changes apply
    const timeoutId = setTimeout(() => {
      recalculatePages();
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [settings.fontSize, settings.lineHeight, settings.margins, settings.columns, recalculatePages]);

  // Go to specific page
  const goToPage = useCallback(
    (page: number) => {
      if (settings.continuousScroll) return;

      const validPage = Math.max(0, Math.min(page, totalPages - 1));
      setCurrentPage(validPage);
      scrollToPage(validPage);
      savePosition(validPage, totalPages);
      onPageChange?.(validPage, totalPages);
    },
    [totalPages, scrollToPage, savePosition, onPageChange, settings.continuousScroll]
  );

  // Navigation helpers
  const nextPage = useCallback(() => {
    if (settings.continuousScroll) return;
    if (currentPage < totalPages - 1) {
      goToPage(currentPage + 1);
    }
  }, [currentPage, totalPages, goToPage, settings.continuousScroll]);

  const prevPage = useCallback(() => {
    if (settings.continuousScroll) return;
    if (currentPage > 0) {
      goToPage(currentPage - 1);
    }
  }, [currentPage, goToPage, settings.continuousScroll]);

  const goToStart = useCallback(() => {
    if (settings.continuousScroll) {
      // Scroll to top in continuous mode
      const content = contentRef.current?.parentElement;
      if (content) content.scrollTop = 0;
      return;
    }
    goToPage(0);
  }, [goToPage, settings.continuousScroll, contentRef]);

  const goToEnd = useCallback(() => {
    if (settings.continuousScroll) {
      // Scroll to bottom in continuous mode
      const content = contentRef.current?.parentElement;
      if (content) content.scrollTop = content.scrollHeight;
      return;
    }
    goToPage(totalPages - 1);
  }, [totalPages, goToPage, settings.continuousScroll, contentRef]);

  // Computed values
  const percentComplete = useMemo(() => {
    if (settings.continuousScroll) {
      // For continuous scroll, we'd need to track scroll position
      // For now, return 0 or implement scroll tracking
      return 0;
    }
    if (totalPages <= 1) return 100;
    return Math.round(((currentPage + 1) / totalPages) * 100);
  }, [currentPage, totalPages, settings.continuousScroll]);

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
