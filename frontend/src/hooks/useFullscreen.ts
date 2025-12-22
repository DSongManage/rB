import { useState, useCallback, useEffect, RefObject } from 'react';

interface FullscreenState {
  isFullscreen: boolean;
  enterFullscreen: () => Promise<void>;
  exitFullscreen: () => void;
  toggleFullscreen: () => void;
  isSupported: boolean;
}

export function useFullscreen(elementRef: RefObject<HTMLElement>): FullscreenState {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const isSupported = typeof document !== 'undefined' && (
    'fullscreenEnabled' in document ||
    'webkitFullscreenEnabled' in document
  );

  const enterFullscreen = useCallback(async () => {
    const el = elementRef.current;
    if (!el) return;

    try {
      if (el.requestFullscreen) {
        await el.requestFullscreen();
      } else if ((el as any).webkitRequestFullscreen) {
        await (el as any).webkitRequestFullscreen();
      }
    } catch (err) {
      console.warn('Fullscreen not available:', err);
    }
  }, [elementRef]);

  const exitFullscreen = useCallback(() => {
    try {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
      }
    } catch (err) {
      console.warn('Exit fullscreen failed:', err);
    }
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (isFullscreen) {
      exitFullscreen();
    } else {
      enterFullscreen();
    }
  }, [isFullscreen, enterFullscreen, exitFullscreen]);

  useEffect(() => {
    const handleChange = () => {
      const fullscreenElement = document.fullscreenElement || (document as any).webkitFullscreenElement;
      setIsFullscreen(!!fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleChange);
    document.addEventListener('webkitfullscreenchange', handleChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleChange);
      document.removeEventListener('webkitfullscreenchange', handleChange);
    };
  }, []);

  return {
    isFullscreen,
    enterFullscreen,
    exitFullscreen,
    toggleFullscreen,
    isSupported,
  };
}
