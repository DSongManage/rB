/**
 * Geometry utilities for the line-based comic panel editor.
 * Provides functions for line intersection, bezier curves, and snapping.
 */

export interface Point {
  x: number;
  y: number;
}

export interface Line {
  start: Point;
  end: Point;
}

export interface BezierLine extends Line {
  control1: Point;
  control2: Point;
}

/**
 * Calculate the distance between two points.
 */
export function distance(p1: Point, p2: Point): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Find the intersection point between two line segments.
 * Returns null if lines don't intersect or are parallel.
 */
export function findLineIntersection(line1: Line, line2: Line): Point | null {
  const { start: p1, end: p2 } = line1;
  const { start: p3, end: p4 } = line2;

  const d1x = p2.x - p1.x;
  const d1y = p2.y - p1.y;
  const d2x = p4.x - p3.x;
  const d2y = p4.y - p3.y;

  const denominator = d1x * d2y - d1y * d2x;

  // Lines are parallel
  if (Math.abs(denominator) < 1e-10) {
    return null;
  }

  const t = ((p3.x - p1.x) * d2y - (p3.y - p1.y) * d2x) / denominator;
  const u = ((p3.x - p1.x) * d1y - (p3.y - p1.y) * d1x) / denominator;

  // Check if intersection is within both line segments
  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
    return {
      x: p1.x + t * d1x,
      y: p1.y + t * d1y,
    };
  }

  return null;
}

/**
 * Find where an infinite line intersects a line segment.
 * The first parameter is treated as an INFINITE line.
 * The second parameter is treated as a SEGMENT.
 * Returns null if the infinite line doesn't cross the segment.
 * NOTE: This is kept for potential future use but the panel system
 * now uses segment-segment intersection (findLineIntersection).
 */
export function findInfiniteLineSegmentIntersection(
  infiniteLine: Line,
  segment: Line
): Point | null {
  const { start: p1, end: p2 } = infiniteLine;
  const { start: p3, end: p4 } = segment;

  const d1x = p2.x - p1.x;
  const d1y = p2.y - p1.y;
  const d2x = p4.x - p3.x;
  const d2y = p4.y - p3.y;

  const denominator = d1x * d2y - d1y * d2x;

  // Lines are parallel
  if (Math.abs(denominator) < 1e-10) {
    return null;
  }

  // t is parameter on the infinite line (can be any value)
  const t = ((p3.x - p1.x) * d2y - (p3.y - p1.y) * d2x) / denominator;
  // u is parameter on the segment (must be 0-1)
  const u = ((p3.x - p1.x) * d1y - (p3.y - p1.y) * d1x) / denominator;

  // Only check if intersection is on the segment (u between 0 and 1)
  // The infinite line can intersect at any t value
  if (u >= 0 && u <= 1) {
    return {
      x: p1.x + t * d1x,
      y: p1.y + t * d1y,
    };
  }

  return null;
}

/**
 * Find the closest point on a line segment to a given point.
 */
export function closestPointOnLine(point: Point, line: Line): Point {
  const { start, end } = line;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0) {
    return start;
  }

  // Project point onto line, clamped to segment
  let t = ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared;
  t = Math.max(0, Math.min(1, t));

  return {
    x: start.x + t * dx,
    y: start.y + t * dy,
  };
}

/**
 * Calculate the distance from a point to a line segment.
 */
export function distanceToLine(point: Point, line: Line): number {
  const closest = closestPointOnLine(point, line);
  return distance(point, closest);
}

/**
 * Evaluate a cubic bezier curve at parameter t (0-1).
 */
export function evaluateBezier(
  p0: Point,
  p1: Point,
  p2: Point,
  p3: Point,
  t: number
): Point {
  const u = 1 - t;
  const tt = t * t;
  const uu = u * u;
  const uuu = uu * u;
  const ttt = tt * t;

  return {
    x: uuu * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + ttt * p3.x,
    y: uuu * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + ttt * p3.y,
  };
}

/**
 * Sample a bezier curve as a polyline for intersection testing.
 */
export function sampleBezierCurve(
  start: Point,
  control1: Point,
  control2: Point,
  end: Point,
  numSamples: number = 20
): Point[] {
  const points: Point[] = [];
  for (let i = 0; i <= numSamples; i++) {
    const t = i / numSamples;
    points.push(evaluateBezier(start, control1, control2, end, t));
  }
  return points;
}

/**
 * Find the closest point on a bezier curve to a given point.
 * Uses sampling for approximation.
 */
export function closestPointOnBezier(
  point: Point,
  start: Point,
  control1: Point,
  control2: Point,
  end: Point,
  numSamples: number = 50
): { point: Point; t: number; distance: number } {
  let closestPoint = start;
  let closestT = 0;
  let minDistance = distance(point, start);

  for (let i = 1; i <= numSamples; i++) {
    const t = i / numSamples;
    const curvePoint = evaluateBezier(start, control1, control2, end, t);
    const dist = distance(point, curvePoint);
    if (dist < minDistance) {
      minDistance = dist;
      closestPoint = curvePoint;
      closestT = t;
    }
  }

  return { point: closestPoint, t: closestT, distance: minDistance };
}

/**
 * Find intersection between a bezier curve and a straight line.
 * Uses sampling for approximation.
 */
export function findBezierLineIntersection(
  bezier: { start: Point; control1: Point; control2: Point; end: Point },
  line: Line,
  numSamples: number = 50
): Point[] {
  const bezierPoints = sampleBezierCurve(
    bezier.start,
    bezier.control1,
    bezier.control2,
    bezier.end,
    numSamples
  );

  const intersections: Point[] = [];

  for (let i = 0; i < bezierPoints.length - 1; i++) {
    const segment: Line = {
      start: bezierPoints[i],
      end: bezierPoints[i + 1],
    };
    const intersection = findLineIntersection(segment, line);
    if (intersection) {
      intersections.push(intersection);
    }
  }

  return intersections;
}

/**
 * Page boundary edges for snapping.
 */
export function getPageBoundaryEdges(
  width: number,
  height: number
): Line[] {
  return [
    { start: { x: 0, y: 0 }, end: { x: width, y: 0 } }, // Top
    { start: { x: width, y: 0 }, end: { x: width, y: height } }, // Right
    { start: { x: width, y: height }, end: { x: 0, y: height } }, // Bottom
    { start: { x: 0, y: height }, end: { x: 0, y: 0 } }, // Left
  ];
}

/**
 * Find the nearest snap point from a set of edges and lines.
 */
export function findSnapPoint(
  point: Point,
  edges: Line[],
  lines: Line[],
  snapThreshold: number
): { point: Point; snapped: boolean; snapType: 'edge' | 'line' | 'none' } {
  let nearestPoint = point;
  let nearestDistance = snapThreshold;
  let snapType: 'edge' | 'line' | 'none' = 'none';

  // Check edges first (higher priority)
  for (const edge of edges) {
    const closest = closestPointOnLine(point, edge);
    const dist = distance(point, closest);
    if (dist < nearestDistance) {
      nearestDistance = dist;
      nearestPoint = closest;
      snapType = 'edge';
    }
  }

  // Check existing lines
  for (const line of lines) {
    const closest = closestPointOnLine(point, line);
    const dist = distance(point, closest);
    if (dist < nearestDistance) {
      nearestDistance = dist;
      nearestPoint = closest;
      snapType = 'line';
    }
  }

  return {
    point: nearestPoint,
    snapped: snapType !== 'none',
    snapType,
  };
}

/**
 * Calculate the angle of a line in degrees (0-360).
 */
export function lineAngle(line: Line): number {
  const dx = line.end.x - line.start.x;
  const dy = line.end.y - line.start.y;
  let angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  if (angle < 0) angle += 360;
  return angle;
}

/**
 * Normalize angle to 0-360 range.
 */
export function normalizeAngle(angle: number): number {
  while (angle < 0) angle += 360;
  while (angle >= 360) angle -= 360;
  return angle;
}

/**
 * Check if a point is inside a polygon (using ray casting algorithm).
 */
export function pointInPolygon(point: Point, polygon: Point[]): boolean {
  let inside = false;
  const n = polygon.length;

  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;

    if (
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi
    ) {
      inside = !inside;
    }
  }

  return inside;
}

/**
 * Calculate the area of a polygon using the shoelace formula.
 */
export function polygonArea(vertices: Point[]): number {
  let area = 0;
  const n = vertices.length;

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += vertices[i].x * vertices[j].y;
    area -= vertices[j].x * vertices[i].y;
  }

  return Math.abs(area / 2);
}

/**
 * Calculate the centroid of a polygon.
 */
export function polygonCentroid(vertices: Point[]): Point {
  let cx = 0;
  let cy = 0;
  const n = vertices.length;

  for (const vertex of vertices) {
    cx += vertex.x;
    cy += vertex.y;
  }

  return { x: cx / n, y: cy / n };
}

/**
 * Get the bounding box of a set of points.
 */
export function getBoundingBox(points: Point[]): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  if (points.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  let minX = points[0].x;
  let minY = points[0].y;
  let maxX = points[0].x;
  let maxY = points[0].y;

  for (const point of points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

/**
 * Generate default control points for a bezier curve
 * that creates a smooth curve between start and end.
 */
export function generateDefaultControlPoints(
  start: Point,
  end: Point
): { control1: Point; control2: Point } {
  const dx = end.x - start.x;
  const dy = end.y - start.y;

  return {
    control1: {
      x: start.x + dx * 0.33,
      y: start.y + dy * 0.33,
    },
    control2: {
      x: start.x + dx * 0.67,
      y: start.y + dy * 0.67,
    },
  };
}
