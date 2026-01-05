/**
 * ComicPageRenderer Component
 *
 * Renders a single comic page using SVG with polygon clipping.
 * Uses divider lines to compute panel regions, matching the editor's rendering.
 * Maintains aspect ratio and supports zoom.
 */

import React, { useRef, useState, useEffect, useMemo } from 'react';
import { ComicPageData, ComicPanelData } from '../../services/libraryApi';
import { computePanelRegions, ComputedPanel, DividerLine } from '../../utils/regionCalculator';
import { SpeechBubbleDisplay } from './SpeechBubbleDisplay';

interface ComicPageRendererProps {
  page: ComicPageData;
  zoom: number;
  /** When true, scales page to fit within container bounds (like object-fit: contain) */
  fitToContainer?: boolean;
}

/**
 * Convert point vertices to SVG polygon points string.
 */
function verticesToPoints(
  vertices: { x: number; y: number }[],
  canvasWidth: number,
  canvasHeight: number
): string {
  return vertices
    .map((v) => {
      // Vertices are in pixels (from computePanelRegions), already scaled
      return `${v.x},${v.y}`;
    })
    .join(' ');
}

/**
 * Find the API panel that best matches a computed panel region.
 * Matches based on centroid proximity.
 */
function findMatchingPanel(
  computedPanel: ComputedPanel,
  apiPanels: ComicPanelData[],
  canvasWidth: number,
  canvasHeight: number
): ComicPanelData | null {
  if (apiPanels.length === 0) return null;

  // Convert computed centroid to percentage for comparison
  const computedCentroidXPercent = (computedPanel.centroid.x / canvasWidth) * 100;
  const computedCentroidYPercent = (computedPanel.centroid.y / canvasHeight) * 100;

  let bestMatch: ComicPanelData | null = null;
  let bestDistance = Infinity;

  for (const panel of apiPanels) {
    // Parse values as numbers (API may return strings)
    const xPercent = Number(panel.x_percent);
    const yPercent = Number(panel.y_percent);
    const widthPercent = Number(panel.width_percent);
    const heightPercent = Number(panel.height_percent);

    // Calculate API panel's centroid in percentage
    const panelCentroidX = xPercent + widthPercent / 2;
    const panelCentroidY = yPercent + heightPercent / 2;

    // Calculate distance
    const dx = panelCentroidX - computedCentroidXPercent;
    const dy = panelCentroidY - computedCentroidYPercent;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < bestDistance) {
      bestDistance = distance;
      bestMatch = panel;
    }
  }

  // Only return match if it's reasonably close (within 20% of canvas)
  if (bestDistance < 20) {
    return bestMatch;
  }

  return null;
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

  // Convert API divider lines to the format expected by regionCalculator
  const dividerLines: DividerLine[] = useMemo(() => {
    if (!page.divider_lines) return [];
    return page.divider_lines.map(line => ({
      id: line.id,
      line_type: line.line_type,
      start_x: line.start_x,
      start_y: line.start_y,
      end_x: line.end_x,
      end_y: line.end_y,
      control1_x: line.control1_x,
      control1_y: line.control1_y,
      control2_x: line.control2_x,
      control2_y: line.control2_y,
    }));
  }, [page.divider_lines]);

  // Compute panel regions from divider lines
  const computedPanels = useMemo(() => {
    return computePanelRegions(dividerLines, page.canvas_width, page.canvas_height);
  }, [dividerLines, page.canvas_width, page.canvas_height]);

  // Match computed panels with API panels to get artwork URLs
  const panelMatches = useMemo(() => {
    const matches = new Map<string, ComicPanelData>();
    const usedPanels = new Set<number>();

    // Only consider panels that have artwork
    const panelsWithArtwork = page.panels.filter(p => p.artwork);

    for (const computed of computedPanels) {
      const match = findMatchingPanel(
        computed,
        panelsWithArtwork.filter(p => !usedPanels.has(p.id)),
        page.canvas_width,
        page.canvas_height
      );
      if (match) {
        matches.set(computed.id, match);
        usedPanels.add(match.id);
      }
    }

    return matches;
  }, [computedPanels, page.panels, page.canvas_width, page.canvas_height]);

  // Calculate fitted dimensions when fitToContainer is enabled
  let pageWidth: number | string = zoom <= 1 ? `calc(100% * ${zoom})` : `${zoom * 100}%`;
  let pageHeight: number | string = 'auto';
  let useAspectRatio = true;
  let renderedWidth = page.canvas_width;
  let renderedHeight = page.canvas_height;

  if (fitToContainer && containerSize.width > 0 && containerSize.height > 0) {
    // Leave some breathing room (use 92% of container to avoid edge-to-edge)
    const availableWidth = containerSize.width * 0.92;
    const availableHeight = containerSize.height * 0.92;
    const containerAspect = availableWidth / availableHeight;

    if (aspectRatio > containerAspect) {
      // Page is wider than container - constrain by width
      renderedWidth = availableWidth;
      renderedHeight = availableWidth / aspectRatio;
    } else {
      // Page is taller than container - constrain by height
      renderedHeight = availableHeight;
      renderedWidth = availableHeight * aspectRatio;
    }
    // Apply zoom to the fitted dimensions
    pageWidth = renderedWidth * zoom;
    pageHeight = renderedHeight * zoom;
    useAspectRatio = false;
  }

  // For non-fitted mode, use canvas dimensions
  if (!fitToContainer || containerSize.width === 0) {
    renderedWidth = page.canvas_width;
    renderedHeight = page.canvas_height;
  }

  // Calculate scale factor for polygon vertices
  const scaleX = renderedWidth / page.canvas_width;
  const scaleY = renderedHeight / page.canvas_height;

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: zoom > 1 ? 'auto' : 'hidden',
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
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
          transition: fitToContainer ? 'none' : 'width 0.2s ease, max-width 0.2s ease',
          flexShrink: 0,
        }}
      >
        {/* SVG for polygon-clipped panel rendering */}
        <svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${page.canvas_width} ${page.canvas_height}`}
          preserveAspectRatio="xMidYMid meet"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
          }}
        >
          {/* Background image if present */}
          {page.background_image && (
            <image
              href={page.background_image}
              x={0}
              y={0}
              width={page.canvas_width}
              height={page.canvas_height}
              preserveAspectRatio="xMidYMid slice"
            />
          )}

          {/* Define clip paths for each panel */}
          <defs>
            {computedPanels.map((panel) => (
              <clipPath key={`clip-${panel.id}`} id={`reader-clip-${panel.id}`}>
                <polygon points={verticesToPoints(panel.vertices, page.canvas_width, page.canvas_height)} />
              </clipPath>
            ))}
          </defs>

          {/* Render panels with artwork clipped to polygon shapes */}
          {computedPanels.map((computedPanel, index) => {
            const apiPanel = panelMatches.get(computedPanel.id);
            const artworkUrl = apiPanel?.artwork;
            const backgroundColor = apiPanel?.background_color || '#ffffff';
            const borderColor = apiPanel?.border_color || '#000000';
            const borderWidth = apiPanel?.border_width ?? 2;
            const borderStyle = apiPanel?.border_style || 'solid';

            return (
              <g key={computedPanel.id}>
                {/* Panel background */}
                <polygon
                  points={verticesToPoints(computedPanel.vertices, page.canvas_width, page.canvas_height)}
                  fill={backgroundColor}
                  stroke={borderStyle !== 'none' ? borderColor : 'none'}
                  strokeWidth={borderStyle !== 'none' ? borderWidth : 0}
                />

                {/* Artwork clipped to panel shape */}
                {artworkUrl && (
                  <image
                    href={artworkUrl}
                    x={computedPanel.bounds.x}
                    y={computedPanel.bounds.y}
                    width={computedPanel.bounds.width}
                    height={computedPanel.bounds.height}
                    preserveAspectRatio="xMidYMid slice"
                    clipPath={`url(#reader-clip-${computedPanel.id})`}
                  />
                )}
              </g>
            );
          })}
        </svg>

        {/* Speech bubbles - rendered as HTML overlays on top of SVG */}
        {/* Bubble positions are stored as page-relative percentages (0-100) */}
        {page.panels &&
          page.panels.flatMap((panel) =>
            (panel.speech_bubbles || []).map((bubble) => (
              <SpeechBubbleDisplay key={bubble.id} bubble={bubble} />
            ))
          )}
      </div>
    </div>
  );
}

export default ComicPageRenderer;
