/**
 * DrawingCanvas - SVG-based drawing surface for line-based panel creation.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Point, getPageBoundaryEdges, findSnapPoint, Line, generateDefaultControlPoints } from '../../../utils/geometry';
import { DividerLineData, LineRenderer } from './LineRenderer';
import { BezierHandles } from './BezierHandles';
import { PanelRegionOverlay } from './PanelRegionOverlay';
import { ComputedPanel, computePanelRegions, DividerLine } from '../../../utils/regionCalculator';

export type DrawingMode = 'select' | 'draw-line' | 'draw-bezier';

interface DrawingCanvasProps {
  lines: DividerLineData[];
  canvasWidth: number;
  canvasHeight: number;
  mode: DrawingMode;
  defaultThickness: number;
  defaultColor: string;
  gutterMode: boolean;
  selectedLineId: number | null;
  onLineCreate: (line: Omit<DividerLineData, 'id'>) => void;
  onLineUpdate: (lineId: number, updates: Partial<DividerLineData>) => void;
  onLineDelete: (lineId: number) => void;
  onLineSelect: (lineId: number | null) => void;
  onPanelSelect?: (panelId: string | null) => void;
  onPanelsComputed?: (panels: ComputedPanel[]) => void;
  showPanelOverlay?: boolean;
  selectedPanelId?: string | null;
  showPanelLabels?: boolean;
  panelArtwork?: Map<string, string>; // Maps computed panel ID to artwork URL
}

interface DrawingState {
  isDrawing: boolean;
  startPoint: Point | null;
  currentPoint: Point | null;
  previewLine: Partial<DividerLineData> | null;
}

const SNAP_THRESHOLD = 15; // pixels - larger for easier snapping
const MIN_LINE_LENGTH = 1; // minimum 1% length for a valid line

/**
 * Convert pixel coordinates to percentage.
 */
function toPercent(pixels: number, dimension: number): number {
  return (pixels / dimension) * 100;
}

/**
 * Convert percentage to pixels.
 */
function toPixels(percent: number, dimension: number): number {
  return (percent / 100) * dimension;
}

export const DrawingCanvas: React.FC<DrawingCanvasProps> = ({
  lines,
  canvasWidth,
  canvasHeight,
  mode,
  defaultThickness,
  defaultColor,
  gutterMode,
  selectedLineId,
  onLineCreate,
  onLineUpdate,
  onLineDelete,
  onLineSelect,
  onPanelSelect,
  onPanelsComputed,
  showPanelOverlay = true,
  selectedPanelId: externalSelectedPanelId,
  showPanelLabels = true,
  panelArtwork,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [drawingState, setDrawingState] = useState<DrawingState>({
    isDrawing: false,
    startPoint: null,
    currentPoint: null,
    previewLine: null,
  });
  const [hoverPoint, setHoverPoint] = useState<Point | null>(null);
  const [computedPanels, setComputedPanels] = useState<ComputedPanel[]>([]);
  const [internalSelectedPanelId, setInternalSelectedPanelId] = useState<string | null>(null);

  // Use external selection if provided, otherwise use internal
  const selectedPanelId = externalSelectedPanelId !== undefined ? externalSelectedPanelId : internalSelectedPanelId;

  // Recompute panels when lines change
  useEffect(() => {
    const dividerLines: DividerLine[] = lines.map((l) => ({
      id: l.id,
      line_type: l.line_type,
      start_x: l.start_x,
      start_y: l.start_y,
      end_x: l.end_x,
      end_y: l.end_y,
      control1_x: l.control1_x,
      control1_y: l.control1_y,
      control2_x: l.control2_x,
      control2_y: l.control2_y,
    }));

    const panels = computePanelRegions(dividerLines, 100, 100); // Use percentage coordinates
    setComputedPanels(panels);
    onPanelsComputed?.(panels);
  }, [lines, onPanelsComputed]);

  /**
   * Get mouse position relative to SVG canvas.
   */
  const getMousePosition = useCallback(
    (e: React.MouseEvent): Point => {
      const svg = svgRef.current;
      if (!svg) return { x: 0, y: 0 };

      const rect = svg.getBoundingClientRect();
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    },
    []
  );

  /**
   * Find snap point for the current mouse position.
   */
  const getSnappedPoint = useCallback(
    (point: Point): Point => {
      // Convert to percentage for snapping
      const pointPercent: Point = {
        x: toPercent(point.x, canvasWidth),
        y: toPercent(point.y, canvasHeight),
      };

      // Page edges in percentage
      const edges: Line[] = [
        { start: { x: 0, y: 0 }, end: { x: 100, y: 0 } },
        { start: { x: 100, y: 0 }, end: { x: 100, y: 100 } },
        { start: { x: 100, y: 100 }, end: { x: 0, y: 100 } },
        { start: { x: 0, y: 100 }, end: { x: 0, y: 0 } },
      ];

      // Existing lines (converted to Line format)
      const existingLines: Line[] = lines.map((l) => ({
        start: { x: l.start_x, y: l.start_y },
        end: { x: l.end_x, y: l.end_y },
      }));

      // Snap threshold in percentage
      const thresholdPercent = toPercent(SNAP_THRESHOLD, canvasWidth);

      const result = findSnapPoint(pointPercent, edges, existingLines, thresholdPercent);

      // Convert back to pixels
      return {
        x: toPixels(result.point.x, canvasWidth),
        y: toPixels(result.point.y, canvasHeight),
      };
    },
    [lines, canvasWidth, canvasHeight]
  );

  /**
   * Handle mouse down - start drawing.
   */
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (mode !== 'draw-line' && mode !== 'draw-bezier') return;

      const point = getMousePosition(e);
      const snappedPoint = getSnappedPoint(point);

      setDrawingState({
        isDrawing: true,
        startPoint: snappedPoint,
        currentPoint: snappedPoint,
        previewLine: null,
      });
    },
    [mode, getMousePosition, getSnappedPoint]
  );

  /**
   * Handle mouse move - update preview line and hover indicator.
   */
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const point = getMousePosition(e);
      const snappedPoint = getSnappedPoint(point);

      // Always update hover point in drawing modes
      if (mode === 'draw-line' || mode === 'draw-bezier') {
        setHoverPoint(snappedPoint);
      } else {
        setHoverPoint(null);
      }

      // If not actively drawing, just update hover
      if (!drawingState.isDrawing || !drawingState.startPoint) return;

      // Create preview line
      const startPercent = {
        x: toPercent(drawingState.startPoint.x, canvasWidth),
        y: toPercent(drawingState.startPoint.y, canvasHeight),
      };
      const endPercent = {
        x: toPercent(snappedPoint.x, canvasWidth),
        y: toPercent(snappedPoint.y, canvasHeight),
      };

      let previewLine: Partial<DividerLineData>;

      if (mode === 'draw-bezier') {
        const controls = generateDefaultControlPoints(startPercent, endPercent);
        previewLine = {
          line_type: 'bezier',
          start_x: startPercent.x,
          start_y: startPercent.y,
          end_x: endPercent.x,
          end_y: endPercent.y,
          control1_x: controls.control1.x,
          control1_y: controls.control1.y,
          control2_x: controls.control2.x,
          control2_y: controls.control2.y,
        };
      } else {
        previewLine = {
          line_type: 'straight',
          start_x: startPercent.x,
          start_y: startPercent.y,
          end_x: endPercent.x,
          end_y: endPercent.y,
        };
      }

      setDrawingState((prev) => ({
        ...prev,
        currentPoint: snappedPoint,
        previewLine,
      }));
    },
    [
      drawingState.isDrawing,
      drawingState.startPoint,
      mode,
      canvasWidth,
      canvasHeight,
      getMousePosition,
      getSnappedPoint,
    ]
  );

  /**
   * Handle mouse up - finish drawing.
   */
  const handleMouseUp = useCallback(() => {
    if (!drawingState.isDrawing || !drawingState.previewLine) {
      setDrawingState({
        isDrawing: false,
        startPoint: null,
        currentPoint: null,
        previewLine: null,
      });
      return;
    }

    // Check if line has sufficient length
    const dx = (drawingState.previewLine.end_x ?? 0) - (drawingState.previewLine.start_x ?? 0);
    const dy = (drawingState.previewLine.end_y ?? 0) - (drawingState.previewLine.start_y ?? 0);
    const length = Math.sqrt(dx * dx + dy * dy);

    if (length > MIN_LINE_LENGTH) {
      onLineCreate(drawingState.previewLine as Omit<DividerLineData, 'id'>);
    }

    setDrawingState({
      isDrawing: false,
      startPoint: null,
      currentPoint: null,
      previewLine: null,
    });
  }, [drawingState, onLineCreate]);

  /**
   * Handle canvas click for selection.
   */
  const handleCanvasClick = useCallback(
    (e: React.MouseEvent) => {
      if (mode === 'select') {
        // If clicking on empty space, deselect
        const target = e.target as SVGElement;
        if (target.tagName === 'svg' || target.classList.contains('panel-background')) {
          onLineSelect(null);
          setInternalSelectedPanelId(null);
          onPanelSelect?.(null);
        }
      }
    },
    [mode, onLineSelect, onPanelSelect]
  );

  /**
   * Handle line selection.
   */
  const handleLineClick = useCallback(
    (lineId: number) => {
      if (mode === 'select') {
        onLineSelect(lineId);
        setInternalSelectedPanelId(null);
        onPanelSelect?.(null);
      }
    },
    [mode, onLineSelect, onPanelSelect]
  );

  /**
   * Handle panel selection.
   */
  const handlePanelClick = useCallback(
    (panelId: string) => {
      if (mode === 'select') {
        setInternalSelectedPanelId(panelId);
        onLineSelect(null);
        onPanelSelect?.(panelId);
      }
    },
    [mode, onLineSelect, onPanelSelect]
  );

  /**
   * Handle bezier control point change.
   */
  const handleControlPointChange = useCallback(
    (lineId: number, controlPoint: 'control1' | 'control2', x: number, y: number) => {
      if (controlPoint === 'control1') {
        onLineUpdate(lineId, { control1_x: x, control1_y: y });
      } else {
        onLineUpdate(lineId, { control2_x: x, control2_y: y });
      }
    },
    [onLineUpdate]
  );

  /**
   * Handle keyboard events.
   */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedLineId !== null) {
        onLineDelete(selectedLineId);
        onLineSelect(null);
      } else if (e.key === 'Escape') {
        if (drawingState.isDrawing) {
          setDrawingState({
            isDrawing: false,
            startPoint: null,
            currentPoint: null,
            previewLine: null,
          });
        } else {
          onLineSelect(null);
          setInternalSelectedPanelId(null);
          onPanelSelect?.(null);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedLineId, drawingState.isDrawing, onLineDelete, onLineSelect]);

  // Get cursor style based on mode
  const getCursor = () => {
    if (mode === 'draw-line' || mode === 'draw-bezier') {
      return drawingState.isDrawing ? 'crosshair' : 'crosshair';
    }
    return 'default';
  };

  // Preview line with temporary ID for rendering
  const previewLineForRender = drawingState.previewLine
    ? { ...drawingState.previewLine, id: -1 } as DividerLineData
    : null;

  return (
    <svg
      ref={svgRef}
      width={canvasWidth}
      height={canvasHeight}
      className="border border-gray-300 bg-white"
      style={{ cursor: getCursor() }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => {
        handleMouseUp();
        setHoverPoint(null);
      }}
      onClick={handleCanvasClick}
    >
      {/* Background */}
      <rect
        x={0}
        y={0}
        width={canvasWidth}
        height={canvasHeight}
        fill="#ffffff"
        className="panel-background"
      />

      {/* Panel regions overlay */}
      {showPanelOverlay && computedPanels.length > 0 && (
        <PanelRegionOverlay
          panels={computedPanels}
          canvasWidth={canvasWidth}
          canvasHeight={canvasHeight}
          selectedPanelId={selectedPanelId}
          onPanelClick={handlePanelClick}
          showLabels={showPanelLabels}
          panelArtwork={panelArtwork}
        />
      )}

      {/* Existing lines */}
      <LineRenderer
        lines={lines}
        selectedLineId={selectedLineId}
        canvasWidth={canvasWidth}
        canvasHeight={canvasHeight}
        defaultThickness={defaultThickness}
        defaultColor={defaultColor}
        gutterMode={gutterMode}
        onLineClick={handleLineClick}
      />

      {/* Preview line while drawing */}
      {previewLineForRender && (
        <LineRenderer
          lines={[previewLineForRender]}
          selectedLineId={null}
          canvasWidth={canvasWidth}
          canvasHeight={canvasHeight}
          defaultThickness={defaultThickness}
          defaultColor={defaultColor}
          gutterMode={gutterMode}
        />
      )}

      {/* Bezier handles for selected line */}
      {selectedLineId !== null && mode === 'select' && (
        <>
          {lines
            .filter((l) => l.id === selectedLineId && l.line_type === 'bezier')
            .map((line) => (
              <BezierHandles
                key={line.id}
                line={line}
                canvasWidth={canvasWidth}
                canvasHeight={canvasHeight}
                onControlPointChange={handleControlPointChange}
              />
            ))}
        </>
      )}

      {/* Panel click layer - rendered on TOP of lines so panels are clickable */}
      {showPanelOverlay && computedPanels.length > 0 && mode === 'select' && (
        <g className="panel-click-layer">
          {computedPanels.map((panel) => {
            const points = panel.vertices
              .map((v) => `${(v.x / 100) * canvasWidth},${(v.y / 100) * canvasHeight}`)
              .join(' ');
            return (
              <polygon
                key={`click-${panel.id}`}
                points={points}
                fill="transparent"
                style={{ cursor: 'pointer' }}
                onClick={(e) => {
                  e.stopPropagation();
                  handlePanelClick(panel.id);
                }}
              />
            );
          })}
        </g>
      )}

      {/* Hover indicator - shows where line will start */}
      {hoverPoint && !drawingState.isDrawing && (mode === 'draw-line' || mode === 'draw-bezier') && (
        <g pointerEvents="none">
          {/* Outer glow */}
          <circle
            cx={hoverPoint.x}
            cy={hoverPoint.y}
            r={12}
            fill="none"
            stroke="#3b82f6"
            strokeWidth={2}
            opacity={0.3}
          />
          {/* Inner dot */}
          <circle
            cx={hoverPoint.x}
            cy={hoverPoint.y}
            r={6}
            fill="#3b82f6"
            stroke="#ffffff"
            strokeWidth={2}
          />
          {/* Crosshair lines */}
          <line
            x1={hoverPoint.x - 20}
            y1={hoverPoint.y}
            x2={hoverPoint.x - 8}
            y2={hoverPoint.y}
            stroke="#3b82f6"
            strokeWidth={1}
            opacity={0.5}
          />
          <line
            x1={hoverPoint.x + 8}
            y1={hoverPoint.y}
            x2={hoverPoint.x + 20}
            y2={hoverPoint.y}
            stroke="#3b82f6"
            strokeWidth={1}
            opacity={0.5}
          />
          <line
            x1={hoverPoint.x}
            y1={hoverPoint.y - 20}
            x2={hoverPoint.x}
            y2={hoverPoint.y - 8}
            stroke="#3b82f6"
            strokeWidth={1}
            opacity={0.5}
          />
          <line
            x1={hoverPoint.x}
            y1={hoverPoint.y + 8}
            x2={hoverPoint.x}
            y2={hoverPoint.y + 20}
            stroke="#3b82f6"
            strokeWidth={1}
            opacity={0.5}
          />
        </g>
      )}

      {/* Start point indicator while drawing */}
      {drawingState.startPoint && drawingState.isDrawing && (
        <circle
          cx={drawingState.startPoint.x}
          cy={drawingState.startPoint.y}
          r={6}
          fill="#22c55e"
          stroke="#ffffff"
          strokeWidth={2}
          pointerEvents="none"
        />
      )}

      {/* End point snap indicator while drawing */}
      {drawingState.currentPoint && drawingState.isDrawing && (
        <circle
          cx={drawingState.currentPoint.x}
          cy={drawingState.currentPoint.y}
          r={6}
          fill="#f59e0b"
          stroke="#ffffff"
          strokeWidth={2}
          pointerEvents="none"
        />
      )}
    </svg>
  );
};

export default DrawingCanvas;
