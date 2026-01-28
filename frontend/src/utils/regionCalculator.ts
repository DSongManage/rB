/**
 * Region Calculator for the line-based comic panel editor.
 *
 * Computes enclosed panel regions from a set of divider lines using
 * planar graph face enumeration.
 */

import {
  Point,
  Line,
  findLineIntersection,
  findInfiniteLineSegmentIntersection,
  sampleBezierCurve,
  polygonArea,
  polygonCentroid,
  getBoundingBox,
  lineAngle,
  normalizeAngle,
  closestPointOnLine,
  distance,
} from './geometry';

export interface DividerLine {
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
}

export interface ComputedPanel {
  id: string; // Hash of vertices for identity
  vertices: Point[]; // Polygon vertices in order
  bounds: { x: number; y: number; width: number; height: number };
  centroid: Point;
  area: number;
}

interface GraphNode {
  id: string;
  x: number;
  y: number;
  edges: GraphEdge[];
}

interface GraphEdge {
  targetNodeId: string;
  lineId: number | 'boundary';
  angle: number; // Angle from this node to target
}

interface LineSegment {
  start: Point;
  end: Point;
  lineId: number | 'boundary';
}

/**
 * Convert a DividerLine to line segments (straight lines become 1 segment,
 * bezier curves are sampled into multiple segments).
 */
function dividerLineToSegments(line: DividerLine): LineSegment[] {
  const start: Point = { x: line.start_x, y: line.start_y };
  const end: Point = { x: line.end_x, y: line.end_y };

  if (line.line_type === 'straight') {
    return [{ start, end, lineId: line.id }];
  }

  // Bezier curve - sample into segments
  const control1: Point = {
    x: line.control1_x ?? start.x,
    y: line.control1_y ?? start.y,
  };
  const control2: Point = {
    x: line.control2_x ?? end.x,
    y: line.control2_y ?? end.y,
  };

  const points = sampleBezierCurve(start, control1, control2, end, 20);
  const segments: LineSegment[] = [];

  for (let i = 0; i < points.length - 1; i++) {
    segments.push({
      start: points[i],
      end: points[i + 1],
      lineId: line.id,
    });
  }

  return segments;
}

/**
 * Create page boundary segments.
 */
function createBoundarySegments(
  pageWidth: number,
  pageHeight: number
): LineSegment[] {
  return [
    // Top edge (left to right)
    {
      start: { x: 0, y: 0 },
      end: { x: pageWidth, y: 0 },
      lineId: 'boundary' as const,
    },
    // Right edge (top to bottom)
    {
      start: { x: pageWidth, y: 0 },
      end: { x: pageWidth, y: pageHeight },
      lineId: 'boundary' as const,
    },
    // Bottom edge (right to left)
    {
      start: { x: pageWidth, y: pageHeight },
      end: { x: 0, y: pageHeight },
      lineId: 'boundary' as const,
    },
    // Left edge (bottom to top)
    {
      start: { x: 0, y: pageHeight },
      end: { x: 0, y: 0 },
      lineId: 'boundary' as const,
    },
  ];
}

/**
 * Generate a unique ID for a node based on coordinates.
 */
function nodeId(x: number, y: number): string {
  // Round to avoid floating point issues
  const rx = Math.round(x * 1000) / 1000;
  const ry = Math.round(y * 1000) / 1000;
  return `${rx},${ry}`;
}

/**
 * Check if two points are approximately equal.
 */
function pointsEqual(p1: Point, p2: Point, epsilon: number = 0.01): boolean {
  return Math.abs(p1.x - p2.x) < epsilon && Math.abs(p1.y - p2.y) < epsilon;
}

/**
 * Find all intersection points between segments.
 */
function findAllIntersections(segments: LineSegment[]): Map<string, Point> {
  const intersections = new Map<string, Point>();

  // Add segment endpoints
  for (const seg of segments) {
    const startId = nodeId(seg.start.x, seg.start.y);
    const endId = nodeId(seg.end.x, seg.end.y);
    intersections.set(startId, seg.start);
    intersections.set(endId, seg.end);
  }

  // Find intersections between all pairs of segments
  for (let i = 0; i < segments.length; i++) {
    for (let j = i + 1; j < segments.length; j++) {
      const line1: Line = { start: segments[i].start, end: segments[i].end };
      const line2: Line = { start: segments[j].start, end: segments[j].end };
      const intersection = findLineIntersection(line1, line2);

      if (intersection) {
        // Check it's not an endpoint (already added)
        const isEndpoint =
          pointsEqual(intersection, segments[i].start) ||
          pointsEqual(intersection, segments[i].end) ||
          pointsEqual(intersection, segments[j].start) ||
          pointsEqual(intersection, segments[j].end);

        if (!isEndpoint) {
          const id = nodeId(intersection.x, intersection.y);
          intersections.set(id, intersection);
        }
      }
    }
  }

  return intersections;
}

/**
 * Split segments at intersection points.
 */
function splitSegmentsAtIntersections(
  segments: LineSegment[],
  intersections: Map<string, Point>
): LineSegment[] {
  const result: LineSegment[] = [];

  for (const segment of segments) {
    // Find all intersection points on this segment
    const pointsOnSegment: { point: Point; t: number }[] = [];

    for (const [, point] of intersections) {
      // Check if point is on segment (not at endpoints)
      if (pointsEqual(point, segment.start) || pointsEqual(point, segment.end)) {
        continue;
      }

      // Calculate parameter t for point on segment
      const dx = segment.end.x - segment.start.x;
      const dy = segment.end.y - segment.start.y;
      let t: number;

      if (Math.abs(dx) > Math.abs(dy)) {
        t = (point.x - segment.start.x) / dx;
      } else if (Math.abs(dy) > 0.001) {
        t = (point.y - segment.start.y) / dy;
      } else {
        continue;
      }

      // Check if point is on segment (0 < t < 1)
      if (t > 0.001 && t < 0.999) {
        // Verify point is actually on the line
        const expectedX = segment.start.x + t * dx;
        const expectedY = segment.start.y + t * dy;
        if (pointsEqual(point, { x: expectedX, y: expectedY }, 0.1)) {
          pointsOnSegment.push({ point, t });
        }
      }
    }

    // Sort by t value
    pointsOnSegment.sort((a, b) => a.t - b.t);

    // Create sub-segments
    if (pointsOnSegment.length === 0) {
      result.push(segment);
    } else {
      let currentStart = segment.start;
      for (const { point } of pointsOnSegment) {
        result.push({
          start: currentStart,
          end: point,
          lineId: segment.lineId,
        });
        currentStart = point;
      }
      result.push({
        start: currentStart,
        end: segment.end,
        lineId: segment.lineId,
      });
    }
  }

  return result;
}

/**
 * Build a planar graph from segments.
 */
function buildPlanarGraph(segments: LineSegment[]): Map<string, GraphNode> {
  const graph = new Map<string, GraphNode>();

  // Create nodes for all unique points
  for (const segment of segments) {
    const startId = nodeId(segment.start.x, segment.start.y);
    const endId = nodeId(segment.end.x, segment.end.y);

    if (!graph.has(startId)) {
      graph.set(startId, {
        id: startId,
        x: segment.start.x,
        y: segment.start.y,
        edges: [],
      });
    }

    if (!graph.has(endId)) {
      graph.set(endId, {
        id: endId,
        x: segment.end.x,
        y: segment.end.y,
        edges: [],
      });
    }
  }

  // Add edges (in both directions)
  for (const segment of segments) {
    const startId = nodeId(segment.start.x, segment.start.y);
    const endId = nodeId(segment.end.x, segment.end.y);

    if (startId === endId) continue; // Skip degenerate segments

    const startNode = graph.get(startId)!;
    const endNode = graph.get(endId)!;

    // Forward edge
    const forwardAngle = lineAngle({
      start: segment.start,
      end: segment.end,
    });
    startNode.edges.push({
      targetNodeId: endId,
      lineId: segment.lineId,
      angle: forwardAngle,
    });

    // Backward edge
    const backwardAngle = normalizeAngle(forwardAngle + 180);
    endNode.edges.push({
      targetNodeId: startId,
      lineId: segment.lineId,
      angle: backwardAngle,
    });
  }

  // Sort edges at each node by angle
  for (const [, node] of graph) {
    node.edges.sort((a, b) => a.angle - b.angle);
  }

  return graph;
}

/**
 * Find the next edge in counterclockwise order from incoming angle.
 */
function findNextCounterclockwiseEdge(
  node: GraphNode,
  incomingAngle: number
): GraphEdge | null {
  if (node.edges.length === 0) return null;
  if (node.edges.length === 1) return node.edges[0];

  // Find the edge that comes next counterclockwise from incoming angle
  const normalizedIncoming = normalizeAngle(incomingAngle);

  for (let i = 0; i < node.edges.length; i++) {
    if (node.edges[i].angle > normalizedIncoming) {
      return node.edges[i];
    }
  }

  // Wrap around to first edge
  return node.edges[0];
}

/**
 * Trace a face (polygon) starting from an edge.
 */
function traceFace(
  graph: Map<string, GraphNode>,
  startNodeId: string,
  startEdge: GraphEdge,
  usedEdges: Set<string>
): Point[] {
  const face: Point[] = [];
  let currentNodeId = startNodeId;
  let currentEdge = startEdge;
  const maxIterations = 1000; // Safety limit
  let iterations = 0;

  do {
    iterations++;
    if (iterations > maxIterations) {
      console.warn('Max iterations reached in traceFace');
      break;
    }

    const edgeKey = `${currentNodeId}->${currentEdge.targetNodeId}`;
    if (usedEdges.has(edgeKey)) {
      break; // Already traced this edge in this direction
    }
    usedEdges.add(edgeKey);

    const currentNode = graph.get(currentNodeId);
    if (!currentNode) break;

    face.push({ x: currentNode.x, y: currentNode.y });

    // Move to next node
    const nextNodeId = currentEdge.targetNodeId;
    const nextNode = graph.get(nextNodeId);
    if (!nextNode) break;

    // Find the next edge in counterclockwise order
    const incomingAngle = normalizeAngle(currentEdge.angle + 180);
    const nextEdge = findNextCounterclockwiseEdge(nextNode, incomingAngle);
    if (!nextEdge) break;

    currentNodeId = nextNodeId;
    currentEdge = nextEdge;
  } while (currentNodeId !== startNodeId);

  return face;
}

/**
 * Enumerate all faces in the planar graph.
 */
function enumerateFaces(graph: Map<string, GraphNode>): Point[][] {
  const usedEdges = new Set<string>();
  const faces: Point[][] = [];

  for (const [nodeId, node] of graph) {
    for (const edge of node.edges) {
      const edgeKey = `${nodeId}->${edge.targetNodeId}`;
      if (usedEdges.has(edgeKey)) continue;

      const face = traceFace(graph, nodeId, edge, usedEdges);
      if (face.length >= 3) {
        faces.push(face);
      }
    }
  }

  return faces;
}

/**
 * Check if a face is the exterior (unbounded) face.
 * The exterior face has the largest area and winds counterclockwise.
 */
function isExteriorFace(
  face: Point[],
  pageWidth: number,
  pageHeight: number
): boolean {
  // Check if face contains all four corners
  const corners = [
    { x: 0, y: 0 },
    { x: pageWidth, y: 0 },
    { x: pageWidth, y: pageHeight },
    { x: 0, y: pageHeight },
  ];

  let cornerCount = 0;
  for (const corner of corners) {
    for (const vertex of face) {
      if (pointsEqual(vertex, corner, 0.1)) {
        cornerCount++;
        break;
      }
    }
  }

  // If face contains all 4 corners and has area close to page area, it's likely exterior
  const area = polygonArea(face);
  const pageArea = pageWidth * pageHeight;

  // The exterior face typically has very large area (close to or larger than page)
  // and often includes all boundary corners
  return cornerCount === 4 && area > pageArea * 0.9;
}

/**
 * Generate a unique hash for a polygon based on its vertices.
 * Uses more precision to avoid collisions.
 */
function hashPolygon(vertices: Point[]): string {
  // Filter out any invalid vertices
  const validVertices = vertices.filter(
    (v) => v && typeof v.x === 'number' && typeof v.y === 'number' && !isNaN(v.x) && !isNaN(v.y)
  );

  if (validVertices.length < 3) {
    return `invalid-${Math.random()}`;
  }

  // Sort vertices by angle from centroid for consistent ordering
  const centroid = polygonCentroid(validVertices);
  const sorted = [...validVertices].sort((a, b) => {
    const angleA = Math.atan2(a.y - centroid.y, a.x - centroid.x);
    const angleB = Math.atan2(b.y - centroid.y, b.x - centroid.x);
    return angleA - angleB;
  });

  // Create hash from sorted coordinates with more precision
  const coords = sorted.map((v) => `${v.x.toFixed(2)},${v.y.toFixed(2)}`);
  return coords.join('|');
}

/**
 * Check if two panels are effectively the same based on centroid and area.
 */
function panelsAreSame(a: { centroid: Point; area: number }, b: { centroid: Point; area: number }): boolean {
  const areaDiff = Math.abs(a.area - b.area);
  const centroidDist = Math.sqrt(
    Math.pow(a.centroid.x - b.centroid.x, 2) + Math.pow(a.centroid.y - b.centroid.y, 2)
  );
  // If area is within 1% and centroid within 1 unit, consider them the same
  return areaDiff < 1 && centroidDist < 1;
}

/**
 * Split a polygon by a line SEGMENT or curved path, returning the resulting polygons.
 * The divider line is treated as a SEGMENT (only splits where it actually exists).
 * Includes tolerance for endpoints that are CLOSE to but not exactly on edges.
 *
 * @param polygon - The polygon to split
 * @param lineStart - Start point of the divider
 * @param lineEnd - End point of the divider
 * @param curvePoints - Optional array of points along a curved path (for bezier curves)
 */
function splitPolygonByLine(
  polygon: Point[],
  lineStart: Point,
  lineEnd: Point,
  curvePoints?: Point[]
): Point[][] {
  if (polygon.length < 3) return [polygon];

  // Tolerance for considering a point "on" an edge (in pixels)
  // This handles drawing imprecision where lines don't quite meet
  const PROXIMITY_TOLERANCE = 5;

  // Find ALL intersection points between the line SEGMENT and polygon edges
  const rawIntersections: { point: Point; edgeIndex: number; t: number }[] = [];

  for (let i = 0; i < polygon.length; i++) {
    const p1 = polygon[i];
    const p2 = polygon[(i + 1) % polygon.length];
    const edge: Line = { start: p1, end: p2 };

    // 1. Check for exact segment-segment intersection
    const intersection = findLineIntersection(
      { start: lineStart, end: lineEnd },
      edge
    );

    if (intersection) {
      // Calculate t parameter along the polygon edge
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      let t: number;
      if (Math.abs(dx) > Math.abs(dy)) {
        t = (intersection.x - p1.x) / dx;
      } else if (Math.abs(dy) > 0.0001) {
        t = (intersection.y - p1.y) / dy;
      } else {
        continue;
      }

      if (t >= -0.0001 && t <= 1.0001) {
        rawIntersections.push({ point: intersection, edgeIndex: i, t: Math.max(0, Math.min(1, t)) });
      }
    }

    // 2. Check if line START endpoint is close to this edge (handles drawing imprecision)
    const distToStart = distance(lineStart, closestPointOnLine(lineStart, edge));
    if (distToStart < PROXIMITY_TOLERANCE && distToStart > 0.01) {
      const closest = closestPointOnLine(lineStart, edge);
      // Calculate t on the edge
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const edgeLen = Math.sqrt(dx * dx + dy * dy);
      if (edgeLen > 0.001) {
        const t = Math.abs(dx) > Math.abs(dy)
          ? (closest.x - p1.x) / dx
          : (closest.y - p1.y) / dy;
        if (t > 0.001 && t < 0.999) {
          rawIntersections.push({ point: closest, edgeIndex: i, t });
        }
      }
    }

    // 3. Check if line END endpoint is close to this edge
    const distToEnd = distance(lineEnd, closestPointOnLine(lineEnd, edge));
    if (distToEnd < PROXIMITY_TOLERANCE && distToEnd > 0.01) {
      const closest = closestPointOnLine(lineEnd, edge);
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const edgeLen = Math.sqrt(dx * dx + dy * dy);
      if (edgeLen > 0.001) {
        const t = Math.abs(dx) > Math.abs(dy)
          ? (closest.x - p1.x) / dx
          : (closest.y - p1.y) / dy;
        if (t > 0.001 && t < 0.999) {
          rawIntersections.push({ point: closest, edgeIndex: i, t });
        }
      }
    }
  }

  // Deduplicate intersections that are at the same point
  const intersections: { point: Point; edgeIndex: number; t: number }[] = [];
  for (const raw of rawIntersections) {
    const isDuplicate = intersections.some(
      existing =>
        Math.abs(existing.point.x - raw.point.x) < 1 &&
        Math.abs(existing.point.y - raw.point.y) < 1
    );
    if (!isDuplicate) {
      intersections.push(raw);
    }
  }

  // Need exactly 2 intersection points to split
  if (intersections.length !== 2) {
    return [polygon];
  }

  // Sort by edge index, then by t
  intersections.sort((a, b) => {
    if (a.edgeIndex !== b.edgeIndex) return a.edgeIndex - b.edgeIndex;
    return a.t - b.t;
  });

  const [int1, int2] = intersections;

  // Build two new polygons
  const poly1: Point[] = [];
  const poly2: Point[] = [];

  // If we have curve points, determine the correct direction for each polygon
  // The curve goes from curvePoints[0] (near lineStart) to curvePoints[last] (near lineEnd)
  // We need to add curve points in the direction that closes each polygon properly
  let curvePointsForPoly1: Point[] = [];
  let curvePointsForPoly2: Point[] = [];

  if (curvePoints && curvePoints.length > 2) {
    // Determine which intersection is closer to the start vs end of the curve
    const curveStart = curvePoints[0];
    const curveEnd = curvePoints[curvePoints.length - 1];

    const int1DistToStart = distance(int1.point, curveStart);
    const int1DistToEnd = distance(int1.point, curveEnd);
    const int2DistToStart = distance(int2.point, curveStart);
    const int2DistToEnd = distance(int2.point, curveEnd);

    // For poly1: goes from int1 → (around polygon) → int2, then needs curve from int2 back to int1
    // For poly2: goes from int2 → (around polygon) → int1, then needs curve from int1 back to int2

    // If int2 is closer to curve start and int1 is closer to curve end:
    // - poly1 needs curve from int2→int1, which is start→end (forward)
    // - poly2 needs curve from int1→int2, which is end→start (reverse)
    // And vice versa

    if (int2DistToStart < int2DistToEnd) {
      // int2 is near curve start, int1 is near curve end
      // poly1: int2→int1 = start→end = forward
      // poly2: int1→int2 = end→start = reverse
      curvePointsForPoly1 = [...curvePoints];
      curvePointsForPoly2 = [...curvePoints].reverse();
    } else {
      // int2 is near curve end, int1 is near curve start
      // poly1: int2→int1 = end→start = reverse
      // poly2: int1→int2 = start→end = forward
      curvePointsForPoly1 = [...curvePoints].reverse();
      curvePointsForPoly2 = [...curvePoints];
    }
  }

  // First polygon: from int1 to int2 going forward along polygon edges,
  // then back along the curve from int2 to int1
  poly1.push(int1.point);
  for (let i = int1.edgeIndex + 1; i <= int2.edgeIndex; i++) {
    poly1.push(polygon[i]);
  }
  poly1.push(int2.point);
  // Add curve points to close back to int1 (direction determined above)
  if (curvePointsForPoly1.length > 0) {
    // Skip first and last curve points as they're close to intersection points
    for (let i = 1; i < curvePointsForPoly1.length - 1; i++) {
      poly1.push(curvePointsForPoly1[i]);
    }
  }

  // Second polygon: from int2 to int1 going forward (wrapping) along polygon edges,
  // then back along the curve from int1 to int2
  poly2.push(int2.point);
  for (let i = int2.edgeIndex + 1; i < polygon.length; i++) {
    poly2.push(polygon[i]);
  }
  for (let i = 0; i <= int1.edgeIndex; i++) {
    poly2.push(polygon[i]);
  }
  poly2.push(int1.point);
  // Add curve points to close back to int2 (direction determined above)
  if (curvePointsForPoly2.length > 0) {
    // Skip first and last curve points as they're close to intersection points
    for (let i = 1; i < curvePointsForPoly2.length - 1; i++) {
      poly2.push(curvePointsForPoly2[i]);
    }
  }

  // Filter out degenerate polygons
  const result: Point[][] = [];
  const poly1Area = polygonArea(poly1);
  const poly2Area = polygonArea(poly2);

  if (poly1.length >= 3 && poly1Area > 0.5) {
    result.push(poly1);
  }
  if (poly2.length >= 3 && poly2Area > 0.5) {
    result.push(poly2);
  }

  return result.length > 0 ? result : [polygon];
}

/**
 * Compute panels by progressively splitting the page polygon with each line.
 * Uses multi-pass processing to handle lines that depend on each other.
 */
function computePanelsBySplitting(
  lines: DividerLine[],
  pageWidth: number,
  pageHeight: number
): ComputedPanel[] {
  // Start with the full page as a single polygon
  let polygons: Point[][] = [
    [
      { x: 0, y: 0 },
      { x: pageWidth, y: 0 },
      { x: pageWidth, y: pageHeight },
      { x: 0, y: pageHeight },
    ],
  ];

  // Convert all lines to pixel coordinates, preserving curve information
  interface ProcessedLine {
    start: Point;
    end: Point;
    curvePoints?: Point[]; // Sampled points for bezier curves
  }
  const processedLines: ProcessedLine[] = [];

  for (const line of lines) {
    // Convert coordinates from percentages to target coordinate space
    const start: Point = {
      x: (line.start_x / 100) * pageWidth,
      y: (line.start_y / 100) * pageHeight,
    };
    const end: Point = {
      x: (line.end_x / 100) * pageWidth,
      y: (line.end_y / 100) * pageHeight,
    };

    if (line.line_type === 'bezier' && line.control1_x !== undefined) {
      // Sample bezier curve into points for the curved boundary
      const control1: Point = {
        x: (line.control1_x / 100) * pageWidth,
        y: (line.control1_y! / 100) * pageHeight,
      };
      const control2: Point = {
        x: ((line.control2_x ?? line.control1_x) / 100) * pageWidth,
        y: ((line.control2_y ?? line.control1_y!) / 100) * pageHeight,
      };
      // Sample the bezier curve into 30 points for smooth curves
      const curvePoints = sampleBezierCurve(start, control1, control2, end, 30);
      processedLines.push({ start, end, curvePoints });
    } else {
      // Straight line - no curve points needed
      processedLines.push({ start, end });
    }
  }

  // Multi-pass processing: keep trying to split until no more progress
  // This handles cases where Line B depends on Line A creating a boundary first
  // IMPORTANT: Once a line successfully splits polygons, we mark it as "used"
  // and don't try to split with it again (to avoid re-splitting on curve edges)
  const usedLineIndices = new Set<number>();
  let madeProgress = true;
  let maxPasses = lines.length + 2; // Safety limit
  let passCount = 0;

  while (madeProgress && passCount < maxPasses) {
    madeProgress = false;
    passCount++;

    for (let lineIdx = 0; lineIdx < processedLines.length; lineIdx++) {
      // Skip lines that have already successfully split polygons
      if (usedLineIndices.has(lineIdx)) {
        continue;
      }

      const line = processedLines[lineIdx];
      const newPolygons: Point[][] = [];
      let splitOccurred = false;

      for (const polygon of polygons) {
        // Pass curve points for bezier curves so the polygon boundary follows the curve
        const splitResult = splitPolygonByLine(polygon, line.start, line.end, line.curvePoints);
        newPolygons.push(...splitResult);
        if (splitResult.length > 1) {
          splitOccurred = true;
        }
      }

      if (splitOccurred) {
        polygons = newPolygons;
        madeProgress = true;
        // Mark this line as used so we don't try to split with it again
        usedLineIndices.add(lineIdx);
      }
    }
  }

  // Convert polygons to ComputedPanel format
  const pageArea = pageWidth * pageHeight;
  const minPanelArea = pageArea * 0.01; // Minimum 1% of page area to filter slivers

  let panels: ComputedPanel[] = polygons
    .map((vertices, index) => {
      const centroid = polygonCentroid(vertices);
      const area = polygonArea(vertices);
      const bounds = getBoundingBox(vertices);

      return {
        id: `panel-${index}-${Math.round(centroid.x)}-${Math.round(centroid.y)}`,
        vertices,
        bounds,
        centroid,
        area,
      };
    })
    // Filter out tiny sliver panels (less than 1% of page)
    .filter(panel => panel.area >= minPanelArea);

  // Deduplicate panels with very similar centroids (likely duplicates from multi-pass)
  // Be careful not to merge adjacent panels - use very tight thresholds
  const deduplicatedPanels: ComputedPanel[] = [];
  for (const panel of panels) {
    const isDuplicate = deduplicatedPanels.some(existing => {
      const centroidDist = distance(existing.centroid, panel.centroid);
      const areaDiff = Math.abs(existing.area - panel.area) / Math.max(existing.area, panel.area);
      // Consider duplicate ONLY if centroids within 2px AND areas within 5%
      // This is very strict to avoid merging adjacent panels split by curves
      return centroidDist < 2 && areaDiff < 0.05;
    });
    if (!isDuplicate) {
      deduplicatedPanels.push(panel);
    }
  }
  panels = deduplicatedPanels;

  // Sort by reading order (top-to-bottom, left-to-right)
  panels.sort((a, b) => {
    const rowA = Math.floor(a.centroid.y / (pageHeight / 3));
    const rowB = Math.floor(b.centroid.y / (pageHeight / 3));
    if (rowA !== rowB) return rowA - rowB;
    return a.centroid.x - b.centroid.x;
  });

  return panels;
}

/**
 * Main function: Compute panel regions from divider lines.
 */
export function computePanelRegions(
  lines: DividerLine[],
  pageWidth: number,
  pageHeight: number
): ComputedPanel[] {

  // If no lines, return single panel covering entire page
  if (lines.length === 0) {
    const vertices = [
      { x: 0, y: 0 },
      { x: pageWidth, y: 0 },
      { x: pageWidth, y: pageHeight },
      { x: 0, y: pageHeight },
    ];
    return [
      {
        id: 'full-page',
        vertices,
        bounds: { x: 0, y: 0, width: pageWidth, height: pageHeight },
        centroid: { x: pageWidth / 2, y: pageHeight / 2 },
        area: pageWidth * pageHeight,
      },
    ];
  }

  // Use polygon splitting approach - splits the page by each line
  const panels = computePanelsBySplitting(lines, pageWidth, pageHeight);

  if (panels.length > 0) {
    return panels;
  }

  // Fallback: return full page as single panel
  const vertices = [
    { x: 0, y: 0 },
    { x: pageWidth, y: 0 },
    { x: pageWidth, y: pageHeight },
    { x: 0, y: pageHeight },
  ];
  return [
    {
      id: 'full-page',
      vertices,
      bounds: { x: 0, y: 0, width: pageWidth, height: pageHeight },
      centroid: { x: pageWidth / 2, y: pageHeight / 2 },
      area: pageWidth * pageHeight,
    },
  ];
}

/**
 * Find which computed panel a point belongs to.
 */
export function findPanelAtPoint(
  point: Point,
  panels: ComputedPanel[]
): ComputedPanel | null {
  for (const panel of panels) {
    // Quick bounding box check
    if (
      point.x < panel.bounds.x ||
      point.x > panel.bounds.x + panel.bounds.width ||
      point.y < panel.bounds.y ||
      point.y > panel.bounds.y + panel.bounds.height
    ) {
      continue;
    }

    // Detailed point-in-polygon check
    if (pointInPolygon(point, panel.vertices)) {
      return panel;
    }
  }
  return null;
}

/**
 * Simple point-in-polygon test using ray casting.
 */
function pointInPolygon(point: Point, polygon: Point[]): boolean {
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
