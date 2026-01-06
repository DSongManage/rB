/**
 * Ruler - Traditional inch-based ruler like MS Word/PowerPoint.
 * Shows major ticks every inch, medium ticks at 1/2", and minor ticks at 1/8".
 */

import React, { useMemo } from 'react';

export interface RulerProps {
  orientation: 'horizontal' | 'vertical';
  length: number; // Display canvas length in pixels
  thickness?: number; // Ruler thickness in pixels (default 20)
  pageSize?: number; // Actual page size in pixels (e.g., 2550 for 8.5" at 300dpi)
  pageDpi?: number; // Page DPI (default 300 for print quality)
  cursorPosition?: number | null; // Cursor position in pixels for highlight
}

const RULER_BG = '#1e293b';
const MAJOR_TICK_COLOR = '#e2e8f0';
const MEDIUM_TICK_COLOR = '#94a3b8';
const MINOR_TICK_COLOR = '#475569';
const CURSOR_COLOR = '#f59e0b';
const TEXT_COLOR = '#94a3b8';

export const Ruler: React.FC<RulerProps> = ({
  orientation,
  length,
  thickness = 20,
  pageSize,
  pageDpi = 300,
  cursorPosition,
}) => {
  // Calculate tick positions
  const ticks = useMemo(() => {
    const majorTicks: { position: number; label: string }[] = [];
    const mediumTicks: number[] = [];
    const minorTicks: number[] = [];

    // Calculate scale: how many display pixels per page pixel
    const scale = pageSize ? length / pageSize : 1;

    // Calculate total inches based on page size
    const totalInches = pageSize ? pageSize / pageDpi : length / 96;

    // Pixels per inch on the display
    const displayPixelsPerInch = pageSize ? (pageDpi * scale) : 96;

    // Generate tick marks
    for (let inch = 0; inch <= Math.ceil(totalInches); inch++) {
      const basePosition = inch * displayPixelsPerInch;

      // Major tick at each inch
      if (basePosition <= length) {
        majorTicks.push({ position: basePosition, label: inch.toString() });
      }

      // Medium tick at 1/2 inch
      const halfInchPos = basePosition + displayPixelsPerInch / 2;
      if (halfInchPos <= length && halfInchPos > 0) {
        mediumTicks.push(halfInchPos);
      }

      // Minor ticks at 1/8 inch intervals (excluding 0, 1/2, and whole inches)
      for (let eighth = 1; eighth < 8; eighth++) {
        if (eighth === 4) continue; // Skip 1/2 inch (already covered)
        const eighthPos = basePosition + (eighth * displayPixelsPerInch) / 8;
        if (eighthPos <= length && eighthPos > 0) {
          minorTicks.push(eighthPos);
        }
      }
    }

    return { majorTicks, mediumTicks, minorTicks };
  }, [length, pageSize, pageDpi]);

  // Tick heights based on importance
  const majorTickHeight = thickness * 0.6;
  const mediumTickHeight = thickness * 0.4;
  const minorTickHeight = thickness * 0.25;

  if (orientation === 'horizontal') {
    return (
      <svg
        width={length}
        height={thickness}
        style={{ display: 'block', flexShrink: 0 }}
      >
        {/* Background */}
        <rect x={0} y={0} width={length} height={thickness} fill={RULER_BG} />

        {/* Bottom edge line */}
        <line
          x1={0}
          y1={thickness - 0.5}
          x2={length}
          y2={thickness - 0.5}
          stroke={MINOR_TICK_COLOR}
          strokeWidth={1}
        />

        {/* Minor ticks (1/8 inch) */}
        {ticks.minorTicks.map((pos, i) => (
          <line
            key={`minor-${i}`}
            x1={pos}
            y1={thickness}
            x2={pos}
            y2={thickness - minorTickHeight}
            stroke={MINOR_TICK_COLOR}
            strokeWidth={1}
          />
        ))}

        {/* Medium ticks (1/2 inch) */}
        {ticks.mediumTicks.map((pos, i) => (
          <line
            key={`medium-${i}`}
            x1={pos}
            y1={thickness}
            x2={pos}
            y2={thickness - mediumTickHeight}
            stroke={MEDIUM_TICK_COLOR}
            strokeWidth={1}
          />
        ))}

        {/* Major ticks (1 inch) with labels */}
        {ticks.majorTicks.map(({ position, label }, i) => (
          <g key={`major-${i}`}>
            <line
              x1={position}
              y1={thickness}
              x2={position}
              y2={thickness - majorTickHeight}
              stroke={MAJOR_TICK_COLOR}
              strokeWidth={1}
            />
            {/* Only show label if there's enough space (not at the very start) */}
            {position > 4 && (
              <text
                x={position - 3}
                y={thickness - majorTickHeight - 2}
                fontSize={9}
                fill={TEXT_COLOR}
                textAnchor="middle"
              >
                {label}
              </text>
            )}
          </g>
        ))}

        {/* Cursor position indicator */}
        {cursorPosition !== null && cursorPosition !== undefined && cursorPosition >= 0 && cursorPosition <= length && (
          <line
            x1={cursorPosition}
            y1={0}
            x2={cursorPosition}
            y2={thickness}
            stroke={CURSOR_COLOR}
            strokeWidth={1}
          />
        )}
      </svg>
    );
  }

  // Vertical ruler
  return (
    <svg
      width={thickness}
      height={length}
      style={{ display: 'block', flexShrink: 0 }}
    >
      {/* Background */}
      <rect x={0} y={0} width={thickness} height={length} fill={RULER_BG} />

      {/* Right edge line */}
      <line
        x1={thickness - 0.5}
        y1={0}
        x2={thickness - 0.5}
        y2={length}
        stroke={MINOR_TICK_COLOR}
        strokeWidth={1}
      />

      {/* Minor ticks (1/8 inch) */}
      {ticks.minorTicks.map((pos, i) => (
        <line
          key={`minor-${i}`}
          x1={thickness}
          y1={pos}
          x2={thickness - minorTickHeight}
          y2={pos}
          stroke={MINOR_TICK_COLOR}
          strokeWidth={1}
        />
      ))}

      {/* Medium ticks (1/2 inch) */}
      {ticks.mediumTicks.map((pos, i) => (
        <line
          key={`medium-${i}`}
          x1={thickness}
          y1={pos}
          x2={thickness - mediumTickHeight}
          y2={pos}
          stroke={MEDIUM_TICK_COLOR}
          strokeWidth={1}
        />
      ))}

      {/* Major ticks (1 inch) with labels */}
      {ticks.majorTicks.map(({ position, label }, i) => (
        <g key={`major-${i}`}>
          <line
            x1={thickness}
            y1={position}
            x2={thickness - majorTickHeight}
            y2={position}
            stroke={MAJOR_TICK_COLOR}
            strokeWidth={1}
          />
          {/* Only show label if there's enough space (not at the very start) */}
          {position > 4 && (
            <text
              x={thickness - majorTickHeight - 4}
              y={position + 3}
              fontSize={9}
              fill={TEXT_COLOR}
              textAnchor="end"
            >
              {label}
            </text>
          )}
        </g>
      ))}

      {/* Cursor position indicator */}
      {cursorPosition !== null && cursorPosition !== undefined && cursorPosition >= 0 && cursorPosition <= length && (
        <line
          x1={0}
          y1={cursorPosition}
          x2={thickness}
          y2={cursorPosition}
          stroke={CURSOR_COLOR}
          strokeWidth={1}
        />
      )}
    </svg>
  );
};

export default Ruler;
