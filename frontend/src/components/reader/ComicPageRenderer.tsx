/**
 * ComicPageRenderer Component
 *
 * Renders a single comic page with all its panels.
 * Maintains aspect ratio and supports zoom.
 * When fitToContainer is true, scales to fit within parent bounds (like object-fit: contain).
 */

import React, { useRef, useState, useEffect } from 'react';
import { ComicPageData } from '../../services/libraryApi';
import { ComicPanelDisplay } from './ComicPanelDisplay';

interface ComicPageRendererProps {
  page: ComicPageData;
  zoom: number;
  /** When true, scales page to fit within container bounds (like object-fit: contain) */
  fitToContainer?: boolean;
}

export function ComicPageRenderer({ page, zoom, fitToContainer = false }: ComicPageRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  // Calculate aspect ratio from canvas dimensions
  const aspectRatio = page.canvas_width / page.canvas_height;

  // Observe container size changes when fitToContainer is enabled
  useEffect(() => {
    if (!fitToContainer || !containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setContainerSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [fitToContainer]);

  // Calculate fitted dimensions when fitToContainer is enabled
  let pageWidth: number | string = zoom <= 1 ? `calc(100% * ${zoom})` : `${zoom * 100}%`;
  let pageHeight: number | string = 'auto';
  let useAspectRatio = true;

  if (fitToContainer && containerSize.width > 0 && containerSize.height > 0) {
    const containerAspect = containerSize.width / containerSize.height;

    if (aspectRatio > containerAspect) {
      // Page is wider than container - constrain by width
      pageWidth = containerSize.width;
      pageHeight = containerSize.width / aspectRatio;
    } else {
      // Page is taller than container - constrain by height
      pageHeight = containerSize.height;
      pageWidth = containerSize.height * aspectRatio;
    }
    useAspectRatio = false; // We're setting explicit dimensions
  }

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: fitToContainer ? 'hidden' : (zoom > 1 ? 'auto' : 'hidden'),
      }}
    >
      <div
        style={{
          width: pageWidth,
          height: fitToContainer ? pageHeight : 'auto',
          maxWidth: fitToContainer ? 'none' : (zoom <= 1 ? '100%' : 'none'),
          aspectRatio: useAspectRatio ? `${aspectRatio}` : undefined,
          maxHeight: fitToContainer ? 'none' : (zoom <= 1 ? '100%' : 'none'),
          position: 'relative',
          backgroundColor: page.background_color || '#ffffff',
          backgroundImage: page.background_image ? `url(${page.background_image})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
          transition: fitToContainer ? 'none' : 'width 0.2s ease, max-width 0.2s ease',
        }}
      >
        {/* Render all panels sorted by z-index */}
        {page.panels &&
          [...page.panels]
            .sort((a, b) => a.z_index - b.z_index)
            .map((panel) => <ComicPanelDisplay key={panel.id} panel={panel} />)}
      </div>
    </div>
  );
}

export default ComicPageRenderer;
