import { useEffect, useCallback } from 'react';

interface KeyboardNavigationHandlers {
  onNext?: () => void;
  onPrevious?: () => void;
  onFirst?: () => void;
  onLast?: () => void;
  onEscape?: () => void;
  onToggleSettings?: () => void;
  onToggleTOC?: () => void;
}

interface UseKeyboardNavigationOptions extends KeyboardNavigationHandlers {
  enabled?: boolean;
}

export function useKeyboardNavigation(options: UseKeyboardNavigationOptions) {
  const {
    onNext,
    onPrevious,
    onFirst,
    onLast,
    onEscape,
    onToggleSettings,
    onToggleTOC,
    enabled = true,
  } = options;

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return;

      // Don't handle if user is typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      switch (e.key) {
        case 'ArrowRight':
        case 'PageDown':
        case ' ': // Space bar
          if (e.key === ' ') e.preventDefault(); // Prevent page scroll
          onNext?.();
          break;

        case 'ArrowLeft':
        case 'PageUp':
          onPrevious?.();
          break;

        case 'Home':
          e.preventDefault();
          onFirst?.();
          break;

        case 'End':
          e.preventDefault();
          onLast?.();
          break;

        case 'Escape':
          onEscape?.();
          break;

        case 's':
        case 'S':
          // Toggle settings with 's' key
          if (!e.ctrlKey && !e.metaKey) {
            onToggleSettings?.();
          }
          break;

        case 't':
        case 'T':
          // Toggle table of contents with 't' key
          if (!e.ctrlKey && !e.metaKey) {
            onToggleTOC?.();
          }
          break;

        default:
          break;
      }
    },
    [
      enabled,
      onNext,
      onPrevious,
      onFirst,
      onLast,
      onEscape,
      onToggleSettings,
      onToggleTOC,
    ]
  );

  useEffect(() => {
    if (!enabled) return;

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [enabled, handleKeyDown]);
}

export default useKeyboardNavigation;
