import React from 'react';

interface Collaborator {
  id: number;
  username: string;
  role: string;
  revenue_percentage: number;
}

interface RevenueSplitChartProps {
  collaborators: Collaborator[];
  size?: number;
}

// Color palette for collaborators
const COLORS = [
  '#8b5cf6', // Purple
  '#f59e0b', // Amber
  '#10b981', // Green
  '#3b82f6', // Blue
  '#ef4444', // Red
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#f97316', // Orange
];

export default function RevenueSplitChart({
  collaborators,
  size = 200,
}: RevenueSplitChartProps) {
  const centerX = size / 2;
  const centerY = size / 2;
  const radius = size / 2 - 10;
  const innerRadius = radius * 0.6; // Donut hole

  // Calculate pie slices
  let currentAngle = -90; // Start at top
  const slices = collaborators.map((collab, index) => {
    const percentage = Number(collab.revenue_percentage);
    const angle = (percentage / 100) * 360;
    const startAngle = currentAngle;
    const endAngle = currentAngle + angle;
    currentAngle = endAngle;

    return {
      ...collab,
      color: COLORS[index % COLORS.length],
      startAngle,
      endAngle,
      percentage,
    };
  });

  // Convert polar to cartesian coordinates
  const polarToCartesian = (cx: number, cy: number, r: number, angle: number) => {
    const radians = (angle * Math.PI) / 180;
    return {
      x: cx + r * Math.cos(radians),
      y: cy + r * Math.sin(radians),
    };
  };

  // Create arc path
  const createArc = (startAngle: number, endAngle: number, outerR: number, innerR: number) => {
    const start = polarToCartesian(centerX, centerY, outerR, startAngle);
    const end = polarToCartesian(centerX, centerY, outerR, endAngle);
    const startInner = polarToCartesian(centerX, centerY, innerR, endAngle);
    const endInner = polarToCartesian(centerX, centerY, innerR, startAngle);

    const largeArc = endAngle - startAngle > 180 ? 1 : 0;

    return `
      M ${start.x} ${start.y}
      A ${outerR} ${outerR} 0 ${largeArc} 1 ${end.x} ${end.y}
      L ${startInner.x} ${startInner.y}
      A ${innerR} ${innerR} 0 ${largeArc} 0 ${endInner.x} ${endInner.y}
      Z
    `;
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
      {/* Donut Chart */}
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {slices.map((slice, index) => (
          <path
            key={slice.id}
            d={createArc(slice.startAngle, slice.endAngle, radius, innerRadius)}
            fill={slice.color}
            stroke="var(--panel)"
            strokeWidth={2}
            style={{ transition: 'opacity 0.2s', cursor: 'pointer' }}
            onMouseEnter={(e) => {
              (e.target as SVGPathElement).style.opacity = '0.8';
            }}
            onMouseLeave={(e) => {
              (e.target as SVGPathElement).style.opacity = '1';
            }}
          >
            <title>{slice.username}: {slice.percentage}%</title>
          </path>
        ))}
        {/* Center text */}
        <text
          x={centerX}
          y={centerY - 8}
          textAnchor="middle"
          fill="var(--text)"
          fontSize={24}
          fontWeight={700}
        >
          {collaborators.length}
        </text>
        <text
          x={centerX}
          y={centerY + 14}
          textAnchor="middle"
          fill="#94a3b8"
          fontSize={11}
        >
          {collaborators.length === 1 ? 'Creator' : 'Creators'}
        </text>
      </svg>

      {/* Legend */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {slices.map((slice) => (
          <div
            key={slice.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: 3,
                background: slice.color,
                flexShrink: 0,
              }}
            />
            <div style={{ flex: 1 }}>
              <div style={{
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--text)',
              }}>
                @{slice.username}
              </div>
              <div style={{
                fontSize: 11,
                color: '#94a3b8',
              }}>
                {slice.role}
              </div>
            </div>
            <div style={{
              fontSize: 14,
              fontWeight: 700,
              color: slice.color,
            }}>
              {Number(slice.percentage).toFixed(2)}%
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
