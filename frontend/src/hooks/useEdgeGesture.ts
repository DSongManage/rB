import { useEffect, useRef, useCallback, RefObject } from 'react';

interface EdgeGestureOptions {
  onLeftEdge?: () => void;   // Swipe from left edge = open TOC
  onRightEdge?: () => void;  // Swipe from right edge = open Settings
  edgeThreshold?: number;    // How close to edge to trigger (default 30px)
  swipeDistance?: number;    // Min distance to complete gesture (default 50px)
  enabled?: boolean;
}

interface TouchStart {
  x: number;
  y: number;
  isEdge: 'left' | 'right' | null;
  time: number;
}

export function useEdgeGesture(
  elementRef: RefObject<HTMLElement>,
  options: EdgeGestureOptions
) {
  const {
    onLeftEdge,
    onRightEdge,
    edgeThreshold = 30,
    swipeDistance = 50,
    enabled = true,
  } = options;

  const touchStartRef = useRef<TouchStart | null>(null);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (!enabled) return;

    const touch = e.touches[0];
    const screenWidth = window.innerWidth;

    let isEdge: 'left' | 'right' | null = null;
    if (touch.clientX <= edgeThreshold) {
      isEdge = 'left';
    } else if (touch.clientX >= screenWidth - edgeThreshold) {
      isEdge = 'right';
    }

    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      isEdge,
      time: Date.now(),
    };
  }, [enabled, edgeThreshold]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    // If it's an edge gesture, prevent scrolling
    if (touchStartRef.current?.isEdge) {
      const touch = e.touches[0];
      const deltaX = Math.abs(touch.clientX - touchStartRef.current.x);
      const deltaY = Math.abs(touch.clientY - touchStartRef.current.y);

      // If moving more horizontally than vertically, prevent scroll
      if (deltaX > deltaY && deltaX > 10) {
        e.preventDefault();
      }
    }
  }, []);

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    if (!enabled || !touchStartRef.current?.isEdge) {
      touchStartRef.current = null;
      return;
    }

    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = Math.abs(touch.clientY - touchStartRef.current.y);

    // Ignore if more vertical than horizontal
    if (deltaY > Math.abs(deltaX)) {
      touchStartRef.current = null;
      return;
    }

    // Check if swipe distance threshold met
    if (touchStartRef.current.isEdge === 'left' && deltaX >= swipeDistance) {
      onLeftEdge?.();
    } else if (touchStartRef.current.isEdge === 'right' && deltaX <= -swipeDistance) {
      onRightEdge?.();
    }

    touchStartRef.current = null;
  }, [enabled, swipeDistance, onLeftEdge, onRightEdge]);

  useEffect(() => {
    const element = elementRef.current;
    if (!element || !enabled) return;

    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchmove', handleTouchMove, { passive: false });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }, [elementRef, enabled, handleTouchStart, handleTouchMove, handleTouchEnd]);
}
