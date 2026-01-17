/**
 * Professional Speech Bubble Shape Generation
 *
 * Generates SVG paths for comic book speech bubbles with:
 * - Authentic cloud shapes for thought bubbles
 * - Organic burst shapes for shout bubbles
 * - Smooth bezier tails that connect seamlessly
 * - Hand-drawn effect options for authentic comic feel
 */

import { BubbleType, BubbleStyle, TailType } from '../../services/collaborationApi';

// ===== Types =====

export interface Point {
  x: number;
  y: number;
}

export interface BubblePathResult {
  path: string;
  textPadding: { top: number; right: number; bottom: number; left: number };
}

// ===== Utility Functions =====

/**
 * Linear interpolation between two values
 */
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/**
 * Calculate distance between two points
 */
export const distance = (p1: Point, p2: Point): number =>
  Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));

/**
 * Normalize angle to 0-2PI range
 */
const normalizeAngle = (angle: number): number => {
  while (angle < 0) angle += Math.PI * 2;
  while (angle >= Math.PI * 2) angle -= Math.PI * 2;
  return angle;
};

/**
 * Add subtle hand-drawn effect to path points using seeded noise
 */
export const addHandDrawnEffect = (
  points: Point[],
  intensity: number = 1.5,
  seed: number = 0
): Point[] => {
  // Simple seeded pseudo-random for consistent rendering
  const seededRandom = (i: number) => {
    const x = Math.sin(seed + i * 9999) * 10000;
    return x - Math.floor(x);
  };

  return points.map((point, i) => ({
    x: point.x + (seededRandom(i) - 0.5) * intensity,
    y: point.y + (seededRandom(i + 1000) - 0.5) * intensity,
  }));
};

// ===== Bubble Shape Generators =====

/**
 * Generate standard oval/ellipse bubble path
 */
export const getOvalPath = (w: number, h: number): string => {
  const cx = w / 2;
  const cy = h / 2;
  const rx = w / 2 - 3;
  const ry = h / 2 - 3;

  return `M ${cx} ${cy - ry}
    A ${rx} ${ry} 0 1 1 ${cx} ${cy + ry}
    A ${rx} ${ry} 0 1 1 ${cx} ${cy - ry}`;
};

/**
 * Generate authentic thought cloud with bumpy edges
 * Uses overlapping arcs to create cloud-like appearance
 */
export const getThoughtCloudPath = (w: number, h: number, seed: number = 42): string => {
  const cx = w / 2;
  const cy = h / 2;
  const numBumps = 12;
  const baseRadiusX = w / 2 - 8;
  const baseRadiusY = h / 2 - 8;
  const bumpDepth = Math.min(w, h) * 0.12;

  const points: Point[] = [];

  for (let i = 0; i < numBumps; i++) {
    const angle = (i / numBumps) * Math.PI * 2 - Math.PI / 2;
    const nextAngle = ((i + 1) / numBumps) * Math.PI * 2 - Math.PI / 2;

    // Vary bump size slightly for organic feel
    const variation = 0.85 + ((Math.sin(seed + i * 3.7) + 1) / 2) * 0.3;
    const depth = bumpDepth * variation;

    // Outer point of bump
    const outerX = cx + Math.cos(angle) * baseRadiusX;
    const outerY = cy + Math.sin(angle) * baseRadiusY;

    // Inner point (valley between bumps)
    const midAngle = (angle + nextAngle) / 2;
    const innerX = cx + Math.cos(midAngle) * (baseRadiusX - depth);
    const innerY = cy + Math.sin(midAngle) * (baseRadiusY - depth);

    points.push({ x: outerX, y: outerY });
    points.push({ x: innerX, y: innerY });
  }

  // Build smooth curved path through points
  let path = `M ${points[0].x} ${points[0].y}`;

  for (let i = 0; i < points.length; i++) {
    const current = points[i];
    const next = points[(i + 1) % points.length];
    const afterNext = points[(i + 2) % points.length];

    // Use quadratic bezier for smooth curves
    const cpX = next.x;
    const cpY = next.y;
    const endX = (next.x + afterNext.x) / 2;
    const endY = (next.y + afterNext.y) / 2;

    path += ` Q ${cpX} ${cpY} ${endX} ${endY}`;
  }

  path += ' Z';
  return path;
};

/**
 * Generate organic shout/burst bubble with varied spikes
 */
export const getShoutBurstPath = (w: number, h: number, seed: number = 42): string => {
  const cx = w / 2;
  const cy = h / 2;
  const numPoints = 16;
  const outerRadiusX = w / 2 - 2;
  const outerRadiusY = h / 2 - 2;
  const innerRatio = 0.6;

  const points: Point[] = [];

  for (let i = 0; i < numPoints; i++) {
    const angle = (i / numPoints) * Math.PI * 2 - Math.PI / 2;
    const isSpike = i % 2 === 0;

    // Add variation to spike lengths
    const variation = isSpike
      ? 0.9 + ((Math.sin(seed + i * 2.3) + 1) / 2) * 0.2
      : innerRatio + ((Math.sin(seed + i * 4.1) + 1) / 2) * 0.15;

    const rx = outerRadiusX * variation;
    const ry = outerRadiusY * variation;

    points.push({
      x: cx + Math.cos(angle) * rx,
      y: cy + Math.sin(angle) * ry,
    });
  }

  // Build path with slight curves on spikes for organic feel
  let path = `M ${points[0].x} ${points[0].y}`;

  for (let i = 0; i < points.length; i++) {
    const current = points[i];
    const next = points[(i + 1) % points.length];

    // Add slight curve to make spikes look more dynamic
    const midX = (current.x + next.x) / 2;
    const midY = (current.y + next.y) / 2;

    // Offset control point slightly toward center for curved spikes
    const toCenterX = cx - midX;
    const toCenterY = cy - midY;
    const curveAmount = i % 2 === 0 ? 0.1 : -0.05;

    const cpX = midX + toCenterX * curveAmount;
    const cpY = midY + toCenterY * curveAmount;

    path += ` Q ${cpX} ${cpY} ${next.x} ${next.y}`;
  }

  path += ' Z';
  return path;
};

/**
 * Generate narrative/caption box with rounded corners
 */
export const getNarrativeBoxPath = (w: number, h: number, radius: number = 4): string => {
  const r = Math.min(radius, w / 4, h / 4);
  return `M ${r + 2} 2
    L ${w - r - 2} 2
    Q ${w - 2} 2 ${w - 2} ${r + 2}
    L ${w - 2} ${h - r - 2}
    Q ${w - 2} ${h - 2} ${w - r - 2} ${h - 2}
    L ${r + 2} ${h - 2}
    Q 2 ${h - 2} 2 ${h - r - 2}
    L 2 ${r + 2}
    Q 2 2 ${r + 2} 2
    Z`;
};

/**
 * Generate whisper bubble (same as oval but will use dashed stroke)
 */
export const getWhisperPath = (w: number, h: number): string => {
  return getOvalPath(w, h);
};

// ===== New Manga/Western Bubble Shapes =====

/**
 * Generate manga flash bubble - radial sunburst pattern
 * Used for emphasis, shock, or dramatic moments
 */
export const getMangaFlashPath = (w: number, h: number, numRays: number = 24): string => {
  const cx = w / 2;
  const cy = h / 2;
  const innerRadius = Math.min(w, h) * 0.35;
  const outerRadius = Math.min(w, h) * 0.48;

  let path = '';
  for (let i = 0; i < numRays; i++) {
    const angle1 = (i / numRays) * Math.PI * 2;
    const angle2 = ((i + 0.5) / numRays) * Math.PI * 2;
    const angle3 = ((i + 1) / numRays) * Math.PI * 2;

    // Inner point, outer spike, next inner point
    const inner1 = {
      x: cx + Math.cos(angle1) * innerRadius,
      y: cy + Math.sin(angle1) * innerRadius,
    };
    const outer = {
      x: cx + Math.cos(angle2) * outerRadius,
      y: cy + Math.sin(angle2) * outerRadius,
    };
    const inner2 = {
      x: cx + Math.cos(angle3) * innerRadius,
      y: cy + Math.sin(angle3) * innerRadius,
    };

    path += `${i === 0 ? 'M' : 'L'} ${inner1.x} ${inner1.y} L ${outer.x} ${outer.y} L ${inner2.x} ${inner2.y}`;
  }
  return path + ' Z';
};

/**
 * Generate wavy/nervous bubble - trembling outline for fear or hesitation
 */
export const getWavyBubblePath = (w: number, h: number, waveCount: number = 12): string => {
  const cx = w / 2;
  const cy = h / 2;
  const rx = w / 2 - 5;
  const ry = h / 2 - 5;
  const waveAmp = Math.min(w, h) * 0.03;

  let path = '';
  const segments = waveCount * 4;
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    const wave = Math.sin(angle * waveCount) * waveAmp;
    const x = cx + Math.cos(angle) * (rx + wave);
    const y = cy + Math.sin(angle) * (ry + wave);
    path += `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
  }
  return path + ' Z';
};

/**
 * Generate angry bubble - small hostile spikes around edge
 */
export const getAngryBubblePath = (w: number, h: number, spikeCount: number = 16): string => {
  const cx = w / 2;
  const cy = h / 2;
  const rx = w / 2 - 5;
  const ry = h / 2 - 5;
  const spikeHeight = Math.min(w, h) * 0.05;

  let path = '';
  for (let i = 0; i < spikeCount * 2; i++) {
    const angle = (i / (spikeCount * 2)) * Math.PI * 2;
    const isSpike = i % 2 === 0;
    const rMult = isSpike ? 1.0 + spikeHeight / Math.min(rx, ry) : 1.0;
    const x = cx + Math.cos(angle) * rx * rMult;
    const y = cy + Math.sin(angle) * ry * rMult;
    path += `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
  }
  return path + ' Z';
};

/**
 * Generate poof/sound effect bubble - fluffy cloud shape for BAM/POW effects
 */
export const getPoofBubblePath = (w: number, h: number, seed: number = 42): string => {
  const cx = w / 2;
  const cy = h / 2;
  const numBumps = 8;
  const baseRadiusX = w / 2 - 6;
  const baseRadiusY = h / 2 - 6;
  const bumpDepth = Math.min(w, h) * 0.18; // Deeper bumps than thought cloud

  const points: Point[] = [];

  for (let i = 0; i < numBumps; i++) {
    const angle = (i / numBumps) * Math.PI * 2 - Math.PI / 2;
    const nextAngle = ((i + 1) / numBumps) * Math.PI * 2 - Math.PI / 2;

    // More variation for puffy effect
    const variation = 0.75 + ((Math.sin(seed + i * 5.3) + 1) / 2) * 0.5;
    const depth = bumpDepth * variation;

    // Outer point of bump (pushed further out)
    const outerX = cx + Math.cos(angle) * (baseRadiusX + depth * 0.3);
    const outerY = cy + Math.sin(angle) * (baseRadiusY + depth * 0.3);

    // Inner point (deep valley)
    const midAngle = (angle + nextAngle) / 2;
    const innerX = cx + Math.cos(midAngle) * (baseRadiusX - depth);
    const innerY = cy + Math.sin(midAngle) * (baseRadiusY - depth);

    points.push({ x: outerX, y: outerY });
    points.push({ x: innerX, y: innerY });
  }

  // Build smooth curved path
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length; i++) {
    const next = points[(i + 1) % points.length];
    const afterNext = points[(i + 2) % points.length];

    const cpX = next.x;
    const cpY = next.y;
    const endX = (next.x + afterNext.x) / 2;
    const endY = (next.y + afterNext.y) / 2;

    path += ` Q ${cpX} ${cpY} ${endX} ${endY}`;
  }

  return path + ' Z';
};

/**
 * Generate electric/shock bubble - lightning bolt edges
 */
export const getElectricBubblePath = (w: number, h: number, zigCount: number = 12): string => {
  const cx = w / 2;
  const cy = h / 2;
  const rx = w / 2 - 4;
  const ry = h / 2 - 4;
  const zigAmp = Math.min(w, h) * 0.06;

  let path = '';
  const segments = zigCount * 3;
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    // Sharp zigzag pattern
    const zigOffset = (i % 3 === 1 ? 1 : i % 3 === 2 ? -1 : 0) * zigAmp;
    const x = cx + Math.cos(angle) * (rx + zigOffset);
    const y = cy + Math.sin(angle) * (ry + zigOffset);
    path += `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
  }
  return path + ' Z';
};

/**
 * Generate improved American-style thought cloud with larger, more pronounced bumps
 */
export const getAmericanThoughtCloudPath = (w: number, h: number, seed: number = 42): string => {
  const cx = w / 2;
  const cy = h / 2;
  const numBumps = 7;
  const baseRadiusX = w / 2 - 10;
  const baseRadiusY = h / 2 - 10;
  const bumpSize = Math.min(w, h) * 0.2; // Larger bumps

  const points: Point[] = [];

  for (let i = 0; i < numBumps; i++) {
    const angle = (i / numBumps) * Math.PI * 2 - Math.PI / 2;
    const nextAngle = ((i + 1) / numBumps) * Math.PI * 2 - Math.PI / 2;

    // Vary bump size for organic feel
    const variation = 0.8 + ((Math.sin(seed + i * 4.1) + 1) / 2) * 0.4;
    const bump = bumpSize * variation;

    // Outer point (peak of bump)
    const outerX = cx + Math.cos(angle) * (baseRadiusX + bump * 0.5);
    const outerY = cy + Math.sin(angle) * (baseRadiusY + bump * 0.5);

    // Valley point (between bumps)
    const midAngle = (angle + nextAngle) / 2;
    const valleyX = cx + Math.cos(midAngle) * (baseRadiusX - bump * 0.3);
    const valleyY = cy + Math.sin(midAngle) * (baseRadiusY - bump * 0.3);

    points.push({ x: outerX, y: outerY });
    points.push({ x: valleyX, y: valleyY });
  }

  // Build smooth curved path with more pronounced curves
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length; i++) {
    const next = points[(i + 1) % points.length];
    const afterNext = points[(i + 2) % points.length];

    // Use cubic bezier for smoother, more cloud-like curves
    const cp1X = lerp(points[i].x, next.x, 0.5);
    const cp1Y = lerp(points[i].y, next.y, 0.5);
    const cp2X = lerp(next.x, afterNext.x, 0.5);
    const cp2Y = lerp(next.y, afterNext.y, 0.5);

    path += ` Q ${next.x} ${next.y} ${cp2X} ${cp2Y}`;
  }

  return path + ' Z';
};

// ===== Speed Lines Generator =====

export interface SpeedLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/**
 * Generate radial speed lines emanating from bubble center (manga-style)
 */
export const getSpeedLines = (
  cx: number,
  cy: number,
  innerRadius: number,
  outerRadius: number,
  count: number = 32,
  seed: number = 42
): SpeedLine[] => {
  const lines: SpeedLine[] = [];
  for (let i = 0; i < count; i++) {
    // Skip some angles for variation
    const skipChance = Math.sin(seed + i * 7.3) * 0.5 + 0.5;
    if (skipChance < 0.3) continue;

    const angle = (i / count) * Math.PI * 2;
    // Vary line lengths
    const lengthVar = 0.7 + ((Math.sin(seed + i * 3.1) + 1) / 2) * 0.6;
    const actualOuter = innerRadius + (outerRadius - innerRadius) * lengthVar;

    lines.push({
      x1: cx + Math.cos(angle) * innerRadius,
      y1: cy + Math.sin(angle) * innerRadius,
      x2: cx + Math.cos(angle) * actualOuter,
      y2: cy + Math.sin(angle) * actualOuter,
    });
  }
  return lines;
};

// ===== Halftone Shadow Pattern =====

/**
 * Get SVG pattern definition for halftone shadow (western comics style)
 */
export const getHalftonePatternDef = (dotSize: number = 3, spacing: number = 6): string => {
  return `
    <pattern id="halftone-shadow-pattern" width="${spacing}" height="${spacing}" patternUnits="userSpaceOnUse">
      <circle cx="${spacing / 2}" cy="${spacing / 2}" r="${dotSize / 2}" fill="black" fill-opacity="0.4"/>
    </pattern>
  `;
};

/**
 * Get halftone shadow path (offset duplicate of bubble)
 */
export const getHalftoneShadowPath = (
  bubblePath: string,
  offsetX: number = 4,
  offsetY: number = 4
): string => {
  // The shadow is rendered using the same path but translated
  return bubblePath;
};

// ===== Tail Generators =====

/**
 * Calculate where a line from bubble center to target point exits the bubble edge
 */
export const calculateBubbleEdgeIntersection = (
  bubbleCenter: Point,
  bubbleWidth: number,
  bubbleHeight: number,
  targetPoint: Point,
  bubbleType: BubbleType
): { point: Point; angle: number } => {
  const dx = targetPoint.x - bubbleCenter.x;
  const dy = targetPoint.y - bubbleCenter.y;
  const angle = Math.atan2(dy, dx);

  // For oval/ellipse bubbles, calculate intersection with ellipse
  const rx = bubbleWidth / 2 - 5;
  const ry = bubbleHeight / 2 - 5;

  // Parametric point on ellipse at this angle
  const edgeX = bubbleCenter.x + rx * Math.cos(angle);
  const edgeY = bubbleCenter.y + ry * Math.sin(angle);

  return { point: { x: edgeX, y: edgeY }, angle };
};

/**
 * Generate smooth curved tail path (bezier)
 */
export const getCurvedTailPath = (
  bubbleCenter: Point,
  bubbleWidth: number,
  bubbleHeight: number,
  tailEndX: number,
  tailEndY: number,
  bubbleType: BubbleType,
  borderWidth: number = 2
): string => {
  const targetPoint = { x: tailEndX, y: tailEndY };
  const { point: exitPoint, angle } = calculateBubbleEdgeIntersection(
    bubbleCenter,
    bubbleWidth,
    bubbleHeight,
    targetPoint,
    bubbleType
  );

  // Calculate tail width at base (tapers to point)
  const tailBaseWidth = Math.min(20, bubbleWidth * 0.15, bubbleHeight * 0.15);

  // Calculate two points on bubble edge for tail base
  const perpAngle = angle + Math.PI / 2;
  const basePoint1 = {
    x: exitPoint.x + Math.cos(perpAngle) * tailBaseWidth / 2,
    y: exitPoint.y + Math.sin(perpAngle) * tailBaseWidth / 2,
  };
  const basePoint2 = {
    x: exitPoint.x - Math.cos(perpAngle) * tailBaseWidth / 2,
    y: exitPoint.y - Math.sin(perpAngle) * tailBaseWidth / 2,
  };

  // Control point for bezier curve (creates nice curve)
  const dist = distance(exitPoint, targetPoint);
  const controlOffset = dist * 0.4;
  const controlPoint = {
    x: exitPoint.x + Math.cos(angle) * controlOffset,
    y: exitPoint.y + Math.sin(angle) * controlOffset,
  };

  // Build tail path
  return `M ${basePoint1.x} ${basePoint1.y}
    Q ${controlPoint.x} ${controlPoint.y} ${tailEndX} ${tailEndY}
    Q ${controlPoint.x} ${controlPoint.y} ${basePoint2.x} ${basePoint2.y}
    Z`;
};

/**
 * Generate straight triangular tail path
 */
export const getStraightTailPath = (
  bubbleCenter: Point,
  bubbleWidth: number,
  bubbleHeight: number,
  tailEndX: number,
  tailEndY: number,
  bubbleType: BubbleType,
  borderWidth: number = 2
): string => {
  const targetPoint = { x: tailEndX, y: tailEndY };
  const { point: exitPoint, angle } = calculateBubbleEdgeIntersection(
    bubbleCenter,
    bubbleWidth,
    bubbleHeight,
    targetPoint,
    bubbleType
  );

  // Calculate tail width at base
  const tailBaseWidth = Math.min(18, bubbleWidth * 0.12, bubbleHeight * 0.12);

  // Calculate two points on bubble edge for tail base
  const perpAngle = angle + Math.PI / 2;
  const basePoint1 = {
    x: exitPoint.x + Math.cos(perpAngle) * tailBaseWidth / 2,
    y: exitPoint.y + Math.sin(perpAngle) * tailBaseWidth / 2,
  };
  const basePoint2 = {
    x: exitPoint.x - Math.cos(perpAngle) * tailBaseWidth / 2,
    y: exitPoint.y - Math.sin(perpAngle) * tailBaseWidth / 2,
  };

  return `M ${basePoint1.x} ${basePoint1.y}
    L ${tailEndX} ${tailEndY}
    L ${basePoint2.x} ${basePoint2.y}
    Z`;
};

/**
 * Generate thought bubble dots (diminishing circles leading to target)
 */
export interface ThoughtDot {
  x: number;
  y: number;
  radius: number;
}

export const getThoughtDots = (
  bubbleCenter: Point,
  bubbleWidth: number,
  bubbleHeight: number,
  tailEndX: number,
  tailEndY: number
): ThoughtDot[] => {
  const targetPoint = { x: tailEndX, y: tailEndY };
  const { point: exitPoint } = calculateBubbleEdgeIntersection(
    bubbleCenter,
    bubbleWidth,
    bubbleHeight,
    targetPoint,
    'thought'
  );

  const dots: ThoughtDot[] = [];
  const numDots = 3;

  // Start slightly outside bubble edge
  const startX = exitPoint.x + (tailEndX - exitPoint.x) * 0.15;
  const startY = exitPoint.y + (tailEndY - exitPoint.y) * 0.15;

  for (let i = 0; i < numDots; i++) {
    const t = (i + 1) / (numDots + 0.5);
    const x = lerp(startX, tailEndX, t);
    const y = lerp(startY, tailEndY, t);

    // Dots get smaller as they approach target
    const baseRadius = Math.min(bubbleWidth, bubbleHeight) * 0.06;
    const radius = baseRadius * (1 - t * 0.6);

    dots.push({ x, y, radius: Math.max(3, radius) });
  }

  return dots;
};

// ===== Main Bubble Path Generator =====

/**
 * Get complete bubble path based on type
 */
export const getBubblePath = (
  width: number,
  height: number,
  bubbleType: BubbleType,
  seed: number = 42,
  bubbleStyle: BubbleStyle = 'manga'
): BubblePathResult => {
  let path: string;
  let textPadding = { top: 15, right: 15, bottom: 15, left: 15 };

  switch (bubbleType) {
    case 'thought':
      // Use different thought cloud based on style
      path = bubbleStyle === 'western'
        ? getAmericanThoughtCloudPath(width, height, seed)
        : getThoughtCloudPath(width, height, seed);
      textPadding = { top: 20, right: 20, bottom: 20, left: 20 };
      break;

    case 'shout':
    case 'burst':
      path = getShoutBurstPath(width, height, seed);
      textPadding = { top: 22, right: 22, bottom: 22, left: 22 };
      break;

    case 'narrative':
    case 'caption':
      path = getNarrativeBoxPath(width, height);
      textPadding = { top: 10, right: 12, bottom: 10, left: 12 };
      break;

    case 'whisper':
      path = getWhisperPath(width, height);
      break;

    case 'radio':
      path = getOvalPath(width, height);
      break;

    // New manga/western types
    case 'flash':
      path = getMangaFlashPath(width, height);
      textPadding = { top: 25, right: 25, bottom: 25, left: 25 }; // Extra padding for rays
      break;

    case 'wavy':
      path = getWavyBubblePath(width, height);
      textPadding = { top: 16, right: 16, bottom: 16, left: 16 };
      break;

    case 'angry':
      path = getAngryBubblePath(width, height);
      textPadding = { top: 18, right: 18, bottom: 18, left: 18 };
      break;

    case 'poof':
      path = getPoofBubblePath(width, height, seed);
      textPadding = { top: 24, right: 24, bottom: 24, left: 24 };
      break;

    case 'electric':
      path = getElectricBubblePath(width, height);
      textPadding = { top: 20, right: 20, bottom: 20, left: 20 };
      break;

    case 'oval':
    default:
      path = getOvalPath(width, height);
      break;
  }

  return { path, textPadding };
};

/**
 * Get tail path or dots based on tail type
 */
export const getTailElements = (
  bubbleCenter: Point,
  bubbleWidth: number,
  bubbleHeight: number,
  tailEndX: number,
  tailEndY: number,
  tailType: TailType,
  bubbleType: BubbleType,
  borderWidth: number = 2
): { path?: string; dots?: ThoughtDot[] } => {
  // Thought bubbles always use dots
  if (bubbleType === 'thought' || tailType === 'dots') {
    return {
      dots: getThoughtDots(bubbleCenter, bubbleWidth, bubbleHeight, tailEndX, tailEndY),
    };
  }

  // Narrative/caption boxes don't have tails
  if (bubbleType === 'narrative' || bubbleType === 'caption') {
    return {};
  }

  // Generate appropriate tail path
  if (tailType === 'curved') {
    return {
      path: getCurvedTailPath(
        bubbleCenter,
        bubbleWidth,
        bubbleHeight,
        tailEndX,
        tailEndY,
        bubbleType,
        borderWidth
      ),
    };
  }

  return {
    path: getStraightTailPath(
      bubbleCenter,
      bubbleWidth,
      bubbleHeight,
      tailEndX,
      tailEndY,
      bubbleType,
      borderWidth
    ),
  };
};

// ===== SVG Filter Definitions =====

/**
 * Get SVG filter definitions for bubble effects
 */
export const getBubbleFilterDefs = (): string => {
  return `
    <filter id="bubble-shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="2" dy="2" stdDeviation="2" flood-color="#000" flood-opacity="0.2"/>
    </filter>
    <filter id="bubble-shadow-selected" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="3" dy="3" stdDeviation="3" flood-color="#3b82f6" flood-opacity="0.4"/>
    </filter>
    <!-- Halftone pattern for western comics style -->
    <pattern id="halftone-shadow-pattern" width="6" height="6" patternUnits="userSpaceOnUse">
      <circle cx="3" cy="3" r="1.5" fill="black" fill-opacity="0.4"/>
    </pattern>
  `;
};
