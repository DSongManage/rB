/**
 * LineRenderer - Renders divider lines (straight and bezier) on the canvas.
 */

import React from 'react';

export interface DividerLineData {
  id: number;
  line_type: 'straight' | 'bezier';
  start_x: number;
  start_y: number;
  end_x: number;
  end_y: number;
  control1_x?: number;
  control1_y?: number;
  control2_x?: number;
  control2_y?: number;
  thickness?: number;
  color?: string;
}

interface LineRendererProps {
  lines: DividerLineData[];
  selectedLineId: number | null;
  canvasWidth: number;
  canvasHeight: number;
  defaultThickness: number;
  defaultColor: string;
  gutterMode: boolean;
  onLineClick?: (lineId: number) => void;
}

/**
 * Convert percentage coordinates to pixels.
 */
function toPixels(percent: number, dimension: number): number {
  return (percent / 100) * dimension;
}

/**
 * Generate SVG path for a bezier curve.
 */
function bezierPath(
  startX: number,
  startY: number,
  control1X: number,
  control1Y: number,
  control2X: number,
  control2Y: number,
  endX: number,
  endY: number
): string {
  return `M ${startX} ${startY} C ${control1X} ${control1Y}, ${control2X} ${control2Y}, ${endX} ${endY}`;
}

export const LineRenderer: React.FC<LineRendererProps> = ({
  lines,
  selectedLineId,
  canvasWidth,
  canvasHeight,
  defaultThickness,
  defaultColor,
  gutterMode,
  onLineClick,
}) => {
  const handleLineClick = (lineId: number) => (e: React.MouseEvent) => {
    e.stopPropagation();
    onLineClick?.(lineId);
  };

  return (
    <g className="divider-lines">
      {lines.map((line) => {
        const startX = toPixels(line.start_x, canvasWidth);
        const startY = toPixels(line.start_y, canvasHeight);
        const endX = toPixels(line.end_x, canvasWidth);
        const endY = toPixels(line.end_y, canvasHeight);

        const thickness = line.thickness ?? defaultThickness;
        const color = line.color ?? defaultColor;
        const isSelected = selectedLineId === line.id;

        // Always show lines with their color - gutter mode affects the visual style
        // In gutter mode, show a thicker line with the color (represents the gap)
        // In border mode, show a thinner solid stroke
        const strokeColor = color;
        const baseWidth = toPixels(thickness, canvasWidth);
        const strokeWidth = gutterMode ? Math.max(baseWidth, 2) : Math.max(baseWidth * 0.5, 1);

        if (line.line_type === 'bezier') {
          const control1X = toPixels(line.control1_x ?? line.start_x, canvasWidth);
          const control1Y = toPixels(line.control1_y ?? line.start_y, canvasHeight);
          const control2X = toPixels(line.control2_x ?? line.end_x, canvasWidth);
          const control2Y = toPixels(line.control2_y ?? line.end_y, canvasHeight);

          const pathD = bezierPath(
            startX,
            startY,
            control1X,
            control1Y,
            control2X,
            control2Y,
            endX,
            endY
          );

          return (
            <g key={line.id} onClick={handleLineClick(line.id)}>
              {/* Selection highlight */}
              {isSelected && (
                <path
                  d={pathD}
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth={strokeWidth + 4}
                  strokeLinecap="round"
                  className="cursor-pointer"
                />
              )}
              {/* Main line */}
              <path
                d={pathD}
                fill="none"
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                className="cursor-pointer hover:opacity-80 transition-opacity"
              />
              {/* Invisible wider hit area for easier selection */}
              <path
                d={pathD}
                fill="none"
                stroke="transparent"
                strokeWidth={Math.max(strokeWidth + 30, 40)}
                strokeLinecap="round"
                className="cursor-pointer"
              />
            </g>
          );
        }

        // Straight line
        return (
          <g key={line.id} onClick={handleLineClick(line.id)}>
            {/* Selection highlight */}
            {isSelected && (
              <line
                x1={startX}
                y1={startY}
                x2={endX}
                y2={endY}
                stroke="#f59e0b"
                strokeWidth={strokeWidth + 4}
                strokeLinecap="round"
                className="cursor-pointer"
              />
            )}
            {/* Main line */}
            <line
              x1={startX}
              y1={startY}
              x2={endX}
              y2={endY}
              stroke={strokeColor}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              className="cursor-pointer hover:opacity-80 transition-opacity"
            />
            {/* Invisible wider hit area for easier selection */}
            <line
              x1={startX}
              y1={startY}
              x2={endX}
              y2={endY}
              stroke="transparent"
              strokeWidth={Math.max(strokeWidth + 30, 40)}
              strokeLinecap="round"
              className="cursor-pointer"
            />
          </g>
        );
      })}
    </g>
  );
};

export default LineRenderer;
