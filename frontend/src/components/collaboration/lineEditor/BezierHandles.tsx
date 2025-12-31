/**
 * BezierHandles - Control point handles for editing bezier curves.
 */

import React, { useState, useCallback } from 'react';
import { DividerLineData } from './LineRenderer';

interface BezierHandlesProps {
  line: DividerLineData;
  canvasWidth: number;
  canvasHeight: number;
  onControlPointChange: (
    lineId: number,
    controlPoint: 'control1' | 'control2',
    x: number,
    y: number
  ) => void;
}

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

export const BezierHandles: React.FC<BezierHandlesProps> = ({
  line,
  canvasWidth,
  canvasHeight,
  onControlPointChange,
}) => {
  const [dragging, setDragging] = useState<'control1' | 'control2' | null>(null);

  // Convert line points to pixels
  const startX = toPixels(line.start_x, canvasWidth);
  const startY = toPixels(line.start_y, canvasHeight);
  const endX = toPixels(line.end_x, canvasWidth);
  const endY = toPixels(line.end_y, canvasHeight);
  const control1X = toPixels(line.control1_x ?? line.start_x, canvasWidth);
  const control1Y = toPixels(line.control1_y ?? line.start_y, canvasHeight);
  const control2X = toPixels(line.control2_x ?? line.end_x, canvasWidth);
  const control2Y = toPixels(line.control2_y ?? line.end_y, canvasHeight);

  const handleMouseDown = useCallback(
    (controlPoint: 'control1' | 'control2') => (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      setDragging(controlPoint);
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

      // Clamp to valid range
      const clampedX = Math.max(0, Math.min(100, xPercent));
      const clampedY = Math.max(0, Math.min(100, yPercent));

      onControlPointChange(line.id, dragging, clampedX, clampedY);
    },
    [dragging, line.id, canvasWidth, canvasHeight, onControlPointChange]
  );

  const handleMouseUp = useCallback(() => {
    setDragging(null);
  }, []);

  if (line.line_type !== 'bezier') {
    return null;
  }

  return (
    <g
      className="bezier-handles"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Line from start to control1 */}
      <line
        x1={startX}
        y1={startY}
        x2={control1X}
        y2={control1Y}
        stroke="#6366f1"
        strokeWidth={1}
        strokeDasharray="4 2"
        pointerEvents="none"
      />

      {/* Line from end to control2 */}
      <line
        x1={endX}
        y1={endY}
        x2={control2X}
        y2={control2Y}
        stroke="#6366f1"
        strokeWidth={1}
        strokeDasharray="4 2"
        pointerEvents="none"
      />

      {/* Control point 1 handle */}
      <circle
        cx={control1X}
        cy={control1Y}
        r={8}
        fill="#6366f1"
        stroke="#ffffff"
        strokeWidth={2}
        className="cursor-move"
        onMouseDown={handleMouseDown('control1')}
        style={{ filter: dragging === 'control1' ? 'drop-shadow(0 0 4px #6366f1)' : undefined }}
      />

      {/* Control point 2 handle */}
      <circle
        cx={control2X}
        cy={control2Y}
        r={8}
        fill="#6366f1"
        stroke="#ffffff"
        strokeWidth={2}
        className="cursor-move"
        onMouseDown={handleMouseDown('control2')}
        style={{ filter: dragging === 'control2' ? 'drop-shadow(0 0 4px #6366f1)' : undefined }}
      />

      {/* Start point indicator */}
      <circle
        cx={startX}
        cy={startY}
        r={5}
        fill="#10b981"
        stroke="#ffffff"
        strokeWidth={2}
        pointerEvents="none"
      />

      {/* End point indicator */}
      <circle
        cx={endX}
        cy={endY}
        r={5}
        fill="#ef4444"
        stroke="#ffffff"
        strokeWidth={2}
        pointerEvents="none"
      />
    </g>
  );
};

export default BezierHandles;
