/**
 * LineEndpointHandles - Draggable handles for moving line start and end points.
 */

import React, { useState, useCallback } from 'react';
import { DividerLineData } from './LineRenderer';
import { Point, Line, findSnapPoint } from '../../../utils/geometry';

interface LineEndpointHandlesProps {
  line: DividerLineData;
  allLines: DividerLineData[];
  canvasWidth: number;
  canvasHeight: number;
  onEndpointChange: (
    lineId: number,
    endpoint: 'start' | 'end',
    x: number,
    y: number,
    controlPointDelta?: { dx: number; dy: number }
  ) => void;
}

const SNAP_THRESHOLD_PERCENT = 3; // 3% of canvas for snapping

/**
 * Convert percentage coordinates to pixels.
 */
function toPixels(percent: number, dimension: number): number {
  return (percent / 100) * dimension;
}

/**
 * Convert pixel coordinates to percentage.
 */
function toPercent(pixels: number, dimension: number): number {
  return (pixels / dimension) * 100;
}

export const LineEndpointHandles: React.FC<LineEndpointHandlesProps> = ({
  line,
  allLines,
  canvasWidth,
  canvasHeight,
  onEndpointChange,
}) => {
  const [dragging, setDragging] = useState<'start' | 'end' | null>(null);

  // Convert line points to pixels
  const startX = toPixels(line.start_x, canvasWidth);
  const startY = toPixels(line.start_y, canvasHeight);
  const endX = toPixels(line.end_x, canvasWidth);
  const endY = toPixels(line.end_y, canvasHeight);

  /**
   * Get snapped point position in percentage coordinates.
   */
  const getSnappedPointPercent = useCallback(
    (pointPercent: Point): Point => {
      // Page edges in percentage
      const edges: Line[] = [
        { start: { x: 0, y: 0 }, end: { x: 100, y: 0 } },
        { start: { x: 100, y: 0 }, end: { x: 100, y: 100 } },
        { start: { x: 100, y: 100 }, end: { x: 0, y: 100 } },
        { start: { x: 0, y: 100 }, end: { x: 0, y: 0 } },
      ];

      // Other lines (excluding the current line being edited)
      const otherLines: Line[] = allLines
        .filter((l) => l.id !== line.id)
        .map((l) => ({
          start: { x: l.start_x, y: l.start_y },
          end: { x: l.end_x, y: l.end_y },
        }));

      const result = findSnapPoint(pointPercent, edges, otherLines, SNAP_THRESHOLD_PERCENT);
      return result.point;
    },
    [allLines, line.id]
  );

  const handleMouseDown = useCallback(
    (endpoint: 'start' | 'end') => (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      setDragging(endpoint);
    },
    []
  );

  const handleTouchStart = useCallback(
    (endpoint: 'start' | 'end') => (e: React.TouchEvent) => {
      e.stopPropagation();
      e.preventDefault();
      setDragging(endpoint);
    },
    []
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGGElement>) => {
      if (!dragging) return;

      const svg = e.currentTarget.closest('svg');
      if (!svg) return;

      const rect = svg.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Convert to percentage
      const xPercent = toPercent(x, canvasWidth);
      const yPercent = toPercent(y, canvasHeight);

      // Apply snapping
      const snapped = getSnappedPointPercent({ x: xPercent, y: yPercent });

      // Clamp to valid range
      const clampedX = Math.max(0, Math.min(100, snapped.x));
      const clampedY = Math.max(0, Math.min(100, snapped.y));

      // Calculate delta for bezier control point adjustment
      let controlPointDelta: { dx: number; dy: number } | undefined;
      if (line.line_type === 'bezier') {
        if (dragging === 'start') {
          controlPointDelta = {
            dx: clampedX - line.start_x,
            dy: clampedY - line.start_y,
          };
        } else {
          controlPointDelta = {
            dx: clampedX - line.end_x,
            dy: clampedY - line.end_y,
          };
        }
      }

      onEndpointChange(line.id, dragging, clampedX, clampedY, controlPointDelta);
    },
    [dragging, line, canvasWidth, canvasHeight, getSnappedPointPercent, onEndpointChange]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent<SVGGElement>) => {
      if (!dragging) return;
      if (e.touches.length === 0) return;

      const svg = e.currentTarget.closest('svg');
      if (!svg) return;

      const rect = svg.getBoundingClientRect();
      const x = e.touches[0].clientX - rect.left;
      const y = e.touches[0].clientY - rect.top;

      // Convert to percentage
      const xPercent = toPercent(x, canvasWidth);
      const yPercent = toPercent(y, canvasHeight);

      // Apply snapping
      const snapped = getSnappedPointPercent({ x: xPercent, y: yPercent });

      // Clamp to valid range
      const clampedX = Math.max(0, Math.min(100, snapped.x));
      const clampedY = Math.max(0, Math.min(100, snapped.y));

      // Calculate delta for bezier control point adjustment
      let controlPointDelta: { dx: number; dy: number } | undefined;
      if (line.line_type === 'bezier') {
        if (dragging === 'start') {
          controlPointDelta = {
            dx: clampedX - line.start_x,
            dy: clampedY - line.start_y,
          };
        } else {
          controlPointDelta = {
            dx: clampedX - line.end_x,
            dy: clampedY - line.end_y,
          };
        }
      }

      onEndpointChange(line.id, dragging, clampedX, clampedY, controlPointDelta);
    },
    [dragging, line, canvasWidth, canvasHeight, getSnappedPointPercent, onEndpointChange]
  );

  const handleMouseUp = useCallback(() => {
    setDragging(null);
  }, []);

  const handleTouchEnd = useCallback(() => {
    setDragging(null);
  }, []);

  return (
    <g
      className="line-endpoint-handles"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Invisible larger hit area for the entire line */}
      <line
        x1={startX}
        y1={startY}
        x2={endX}
        y2={endY}
        stroke="transparent"
        strokeWidth={20}
        pointerEvents="stroke"
      />

      {/* Start point handle - green */}
      <circle
        cx={startX}
        cy={startY}
        r={10}
        fill="#10b981"
        stroke="#ffffff"
        strokeWidth={2}
        className="cursor-move"
        onMouseDown={handleMouseDown('start')}
        onTouchStart={handleTouchStart('start')}
        style={{ filter: dragging === 'start' ? 'drop-shadow(0 0 6px #10b981)' : undefined }}
      />

      {/* End point handle - red */}
      <circle
        cx={endX}
        cy={endY}
        r={10}
        fill="#ef4444"
        stroke="#ffffff"
        strokeWidth={2}
        className="cursor-move"
        onMouseDown={handleMouseDown('end')}
        onTouchStart={handleTouchStart('end')}
        style={{ filter: dragging === 'end' ? 'drop-shadow(0 0 6px #ef4444)' : undefined }}
      />

      {/* Labels */}
      <text
        x={startX}
        y={startY - 16}
        textAnchor="middle"
        fontSize={10}
        fill="#10b981"
        fontWeight="bold"
        pointerEvents="none"
      >
        Start
      </text>
      <text
        x={endX}
        y={endY - 16}
        textAnchor="middle"
        fontSize={10}
        fill="#ef4444"
        fontWeight="bold"
        pointerEvents="none"
      >
        End
      </text>
    </g>
  );
};

export default LineEndpointHandles;
