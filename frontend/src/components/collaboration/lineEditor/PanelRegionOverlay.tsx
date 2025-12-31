/**
 * PanelRegionOverlay - Visual overlay showing computed panel regions.
 * Regions are mostly transparent - just show selection and numbers.
 * Renders artwork clipped to panel polygon shapes.
 */

import React from 'react';
import { ComputedPanel } from '../../../utils/regionCalculator';

interface PanelRegionOverlayProps {
  panels: ComputedPanel[];
  canvasWidth: number;
  canvasHeight: number;
  selectedPanelId: string | null;
  onPanelClick?: (panelId: string) => void;
  showLabels?: boolean;
  panelArtwork?: Map<string, string>; // Maps panel ID to artwork URL
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
      // Vertices are in percentage, convert to pixels
      const x = (v.x / 100) * canvasWidth;
      const y = (v.y / 100) * canvasHeight;
      return `${x},${y}`;
    })
    .join(' ');
}

export const PanelRegionOverlay: React.FC<PanelRegionOverlayProps> = ({
  panels,
  canvasWidth,
  canvasHeight,
  selectedPanelId,
  onPanelClick,
  showLabels = true,
  panelArtwork,
}) => {
  return (
    <g className="panel-regions">
      {/* Define clip paths for each panel */}
      <defs>
        {panels.map((panel) => (
          <clipPath key={`clip-${panel.id}`} id={`clip-${panel.id}`}>
            <polygon points={verticesToPoints(panel.vertices, canvasWidth, canvasHeight)} />
          </clipPath>
        ))}
      </defs>

      {panels.map((panel, index) => {
        const isSelected = selectedPanelId === panel.id;
        const points = verticesToPoints(panel.vertices, canvasWidth, canvasHeight);
        const labelX = (panel.centroid.x / 100) * canvasWidth;
        const labelY = (panel.centroid.y / 100) * canvasHeight;
        const artworkUrl = panelArtwork?.get(panel.id);

        // Calculate bounding box in pixels for image positioning
        const boundsX = (panel.bounds.x / 100) * canvasWidth;
        const boundsY = (panel.bounds.y / 100) * canvasHeight;
        const boundsWidth = (panel.bounds.width / 100) * canvasWidth;
        const boundsHeight = (panel.bounds.height / 100) * canvasHeight;

        return (
          <g
            key={panel.id}
            onClick={(e) => {
              e.stopPropagation();
              onPanelClick?.(panel.id);
            }}
            style={{ cursor: 'pointer' }}
          >
            {/* Artwork clipped to panel shape */}
            {artworkUrl && (
              <image
                href={artworkUrl}
                x={boundsX}
                y={boundsY}
                width={boundsWidth}
                height={boundsHeight}
                preserveAspectRatio="xMidYMid slice"
                clipPath={`url(#clip-${panel.id})`}
                style={{ pointerEvents: 'none' }}
              />
            )}

            {/* Panel clickable area - transparent unless selected */}
            <polygon
              points={points}
              fill={isSelected ? 'rgba(245, 158, 11, 0.15)' : 'transparent'}
              stroke={isSelected ? '#f59e0b' : 'transparent'}
              strokeWidth={isSelected ? 2 : 0}
              style={{ transition: 'fill 0.15s ease' }}
            />

            {/* Hover effect */}
            <polygon
              points={points}
              fill="transparent"
              style={{ transition: 'fill 0.15s ease' }}
              onMouseEnter={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.fill = 'rgba(245, 158, 11, 0.08)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.fill = 'transparent';
                }
              }}
            />

            {/* Panel number label */}
            {showLabels && (
              <>
                <circle
                  cx={labelX}
                  cy={labelY}
                  r={12}
                  fill="rgba(30, 41, 59, 0.8)"
                  stroke="rgba(71, 85, 105, 0.5)"
                  strokeWidth={1}
                  style={{ pointerEvents: 'none' }}
                />
                <text
                  x={labelX}
                  y={labelY}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="#f8fafc"
                  fontSize={10}
                  fontWeight="600"
                  fontFamily="system-ui, -apple-system, sans-serif"
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >
                  {index + 1}
                </text>
              </>
            )}
          </g>
        );
      })}
    </g>
  );
};

export default PanelRegionOverlay;
