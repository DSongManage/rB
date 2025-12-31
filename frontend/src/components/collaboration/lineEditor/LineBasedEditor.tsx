/**
 * LineBasedEditor - Main wrapper component for line-based comic panel editing.
 *
 * Provides the complete UI for:
 * - Drawing divider lines (straight and bezier)
 * - Managing panel regions
 * - Page orientation and gutter settings
 * - Templates
 */

import React, { useState, useCallback, useMemo, useRef, useImperativeHandle, forwardRef } from 'react';
import { Pencil, MousePointer, Spline, Trash2, Grid3X3, Settings, X } from 'lucide-react';
import { DrawingCanvas, DrawingMode } from './DrawingCanvas';
import { DividerLineData } from './LineRenderer';

// Page orientation presets
export const ORIENTATION_PRESETS: Record<string, { width: number; height: number; label: string }> = {
  portrait: { width: 2550, height: 3300, label: 'Portrait (8.5×11)' },
  landscape: { width: 3300, height: 2550, label: 'Landscape (11×8.5)' },
  square: { width: 3000, height: 3000, label: 'Square (10×10)' },
  webtoon: { width: 800, height: 10000, label: 'Webtoon (Vertical)' },
  manga_b5: { width: 2114, height: 2992, label: 'Manga B5' },
  social_square: { width: 1080, height: 1080, label: 'Social (1:1)' },
  social_story: { width: 1080, height: 1920, label: 'Social Story (9:16)' },
};

// Line template definitions
export interface LineTemplate {
  id: string;
  name: string;
  lines: Omit<DividerLineData, 'id'>[];
}

export const LINE_TEMPLATES: LineTemplate[] = [
  { id: 'full', name: 'Full Page', lines: [] },
  {
    id: 'horizontal-2',
    name: '2 Rows',
    lines: [
      { line_type: 'straight', start_x: 0, start_y: 50, end_x: 100, end_y: 50 },
    ],
  },
  {
    id: 'vertical-2',
    name: '2 Columns',
    lines: [
      { line_type: 'straight', start_x: 50, start_y: 0, end_x: 50, end_y: 100 },
    ],
  },
  {
    id: 'grid-4',
    name: '4 Grid',
    lines: [
      { line_type: 'straight', start_x: 50, start_y: 0, end_x: 50, end_y: 100 },
      { line_type: 'straight', start_x: 0, start_y: 50, end_x: 100, end_y: 50 },
    ],
  },
  {
    id: 'horizontal-3',
    name: '3 Rows',
    lines: [
      { line_type: 'straight', start_x: 0, start_y: 33, end_x: 100, end_y: 33 },
      { line_type: 'straight', start_x: 0, start_y: 66, end_x: 100, end_y: 66 },
    ],
  },
  {
    id: 'grid-6',
    name: '6 Grid',
    lines: [
      { line_type: 'straight', start_x: 50, start_y: 0, end_x: 50, end_y: 100 },
      { line_type: 'straight', start_x: 0, start_y: 33, end_x: 100, end_y: 33 },
      { line_type: 'straight', start_x: 0, start_y: 66, end_x: 100, end_y: 66 },
    ],
  },
  {
    id: 'diagonal-split',
    name: 'Diagonal',
    lines: [
      { line_type: 'straight', start_x: 0, start_y: 0, end_x: 100, end_y: 100 },
    ],
  },
  {
    id: 'curved-wave',
    name: 'Wave',
    lines: [
      {
        line_type: 'bezier',
        start_x: 0,
        start_y: 50,
        end_x: 100,
        end_y: 50,
        control1_x: 25,
        control1_y: 25,
        control2_x: 75,
        control2_y: 75,
      },
    ],
  },
];

interface LineBasedEditorProps {
  lines: DividerLineData[];
  orientation: string;
  gutterMode: boolean;
  defaultGutterWidth: number;
  defaultLineColor: string;
  onLineCreate: (line: Omit<DividerLineData, 'id'>) => void;
  onLineUpdate: (lineId: number, updates: Partial<DividerLineData>) => void;
  onLineDelete: (lineId: number) => void;
  onApplyTemplate: (template: LineTemplate) => void;
  onOrientationChange: (orientation: string) => void;
  onGutterModeChange: (gutterMode: boolean) => void;
  onGutterWidthChange: (width: number) => void;
  onLineColorChange: (color: string) => void;
  canEdit: boolean;
  // Panel selection for artwork mode
  selectedPanelId?: string | null;
  onPanelSelect?: (panelId: string | null) => void;
  onPanelsComputed?: (panels: import('../../../utils/regionCalculator').ComputedPanel[]) => void;
  showPanelNumbers?: boolean;
  panelArtwork?: Map<string, string>;
  // Responsive sizing - if not provided, uses defaults
  maxCanvasWidth?: number;
  maxCanvasHeight?: number;
  // Overlay content (e.g., speech bubbles) rendered inside the canvas container
  children?: React.ReactNode;
}

// Ref handle for accessing canvas dimensions
export interface LineBasedEditorRef {
  getCanvasRect: () => DOMRect | null;
  getCanvasSize: () => { width: number; height: number };
}

// Shared button style
const buttonBase = {
  padding: '8px',
  borderRadius: 6,
  border: 'none',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'all 0.15s ease',
};

export const LineBasedEditor = forwardRef<LineBasedEditorRef, LineBasedEditorProps>(({
  lines,
  orientation,
  gutterMode,
  defaultGutterWidth,
  defaultLineColor,
  onLineCreate,
  onLineUpdate,
  onLineDelete,
  onApplyTemplate,
  onOrientationChange,
  onGutterModeChange,
  onGutterWidthChange,
  onLineColorChange,
  canEdit,
  selectedPanelId: externalSelectedPanelId,
  onPanelSelect,
  onPanelsComputed,
  showPanelNumbers = true,
  panelArtwork,
  maxCanvasWidth,
  maxCanvasHeight,
  children,
}, ref) => {
  const [mode, setMode] = useState<DrawingMode>('select');
  const [selectedLineId, setSelectedLineId] = useState<number | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  // Use external panel selection if provided, otherwise manage internally
  const selectedPanelId = externalSelectedPanelId;

  // Calculate canvas dimensions based on orientation (scaled for display)
  // Use props if provided, otherwise fall back to defaults
  const orientationConfig = ORIENTATION_PRESETS[orientation] || ORIENTATION_PRESETS.portrait;
  const maxDisplayWidth = maxCanvasWidth || 550;
  const maxDisplayHeight = maxCanvasHeight || 712;

  const canvasSize = useMemo(() => {
    const aspectRatio = orientationConfig.width / orientationConfig.height;
    let displayWidth: number;
    let displayHeight: number;

    if (aspectRatio > maxDisplayWidth / maxDisplayHeight) {
      displayWidth = maxDisplayWidth;
      displayHeight = maxDisplayWidth / aspectRatio;
    } else {
      displayHeight = maxDisplayHeight;
      displayWidth = maxDisplayHeight * aspectRatio;
    }

    return { width: displayWidth, height: displayHeight };
  }, [orientationConfig, maxDisplayWidth, maxDisplayHeight]);

  // Expose canvas rect and size via ref for parent to use
  useImperativeHandle(ref, () => ({
    getCanvasRect: () => canvasContainerRef.current?.getBoundingClientRect() || null,
    getCanvasSize: () => canvasSize,
  }), [canvasSize]);

  const handleLineSelect = useCallback((lineId: number | null) => {
    setSelectedLineId(lineId);
  }, []);

  const handleApplyTemplate = useCallback(
    (template: LineTemplate) => {
      if (!canEdit) return;

      const confirmed = lines.length === 0 || window.confirm(
        'This will replace all existing divider lines. Continue?'
      );

      if (confirmed) {
        onApplyTemplate(template);
        setShowTemplates(false);
      }
    },
    [lines.length, onApplyTemplate, canEdit]
  );

  const handleDeleteSelected = useCallback(() => {
    if (selectedLineId !== null) {
      onLineDelete(selectedLineId);
      setSelectedLineId(null);
    }
  }, [selectedLineId, onLineDelete]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
      {/* Toolbar */}
      {canEdit && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 12px',
            background: '#1e293b',
            borderBottom: '1px solid #334155',
            borderRadius: '8px 8px 0 0',
          }}
        >
          {/* Mode buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button
              onClick={() => setMode('select')}
              style={{
                ...buttonBase,
                background: mode === 'select' ? '#f59e0b' : '#334155',
                color: mode === 'select' ? '#000' : '#94a3b8',
              }}
              title="Select"
            >
              <MousePointer size={16} />
            </button>
            <button
              onClick={() => setMode('draw-line')}
              style={{
                ...buttonBase,
                background: mode === 'draw-line' ? '#f59e0b' : '#334155',
                color: mode === 'draw-line' ? '#000' : '#94a3b8',
              }}
              title="Draw Line"
            >
              <Pencil size={16} />
            </button>
            <button
              onClick={() => setMode('draw-bezier')}
              style={{
                ...buttonBase,
                background: mode === 'draw-bezier' ? '#f59e0b' : '#334155',
                color: mode === 'draw-bezier' ? '#000' : '#94a3b8',
              }}
              title="Draw Curve"
            >
              <Spline size={16} />
            </button>
          </div>

          <div style={{ width: 1, height: 24, background: '#475569' }} />

          {/* Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button
              onClick={() => { setShowTemplates(!showTemplates); setShowSettings(false); }}
              style={{
                ...buttonBase,
                background: showTemplates ? '#f59e0b' : '#334155',
                color: showTemplates ? '#000' : '#94a3b8',
              }}
              title="Templates"
            >
              <Grid3X3 size={16} />
            </button>
            <button
              onClick={() => { setShowSettings(!showSettings); setShowTemplates(false); }}
              style={{
                ...buttonBase,
                background: showSettings ? '#f59e0b' : '#334155',
                color: showSettings ? '#000' : '#94a3b8',
              }}
              title="Settings"
            >
              <Settings size={16} />
            </button>
          </div>

          {/* Delete button (when line selected) */}
          {selectedLineId !== null && (
            <>
              <div style={{ width: 1, height: 24, background: '#475569' }} />
              <button
                onClick={handleDeleteSelected}
                style={{
                  ...buttonBase,
                  background: '#ef4444',
                  color: '#fff',
                }}
                title="Delete Line"
              >
                <Trash2 size={16} />
              </button>
            </>
          )}

          {/* Mode indicator */}
          <span style={{ marginLeft: 'auto', fontSize: 11, color: '#64748b' }}>
            {mode === 'select' && 'Select lines'}
            {mode === 'draw-line' && 'Drag to draw'}
            {mode === 'draw-bezier' && 'Drag for curve'}
          </span>
        </div>
      )}

      {/* Settings Panel */}
      {showSettings && canEdit && (
        <div
          style={{
            padding: 16,
            background: '#1e293b',
            borderBottom: '1px solid #334155',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ color: '#f8fafc', fontWeight: 600, fontSize: 12 }}>Page Settings</span>
            <button
              onClick={() => setShowSettings(false)}
              style={{ ...buttonBase, padding: 4, background: 'transparent', color: '#64748b' }}
            >
              <X size={14} />
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* Orientation */}
            <div>
              <label style={{ display: 'block', fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>
                Page Size
              </label>
              <select
                value={orientation}
                onChange={(e) => onOrientationChange(e.target.value)}
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  background: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: 6,
                  color: '#f8fafc',
                  fontSize: 12,
                }}
              >
                {Object.entries(ORIENTATION_PRESETS).map(([key, config]) => (
                  <option key={key} value={key}>
                    {config.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Gutter Width */}
            <div>
              <label style={{ display: 'block', fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>
                Gap Width: {defaultGutterWidth.toFixed(1)}%
              </label>
              <input
                type="range"
                min="0.5"
                max="5"
                step="0.5"
                value={defaultGutterWidth}
                onChange={(e) => onGutterWidthChange(parseFloat(e.target.value))}
                style={{ width: '100%', accentColor: '#f59e0b' }}
              />
            </div>

            {/* Gutter Mode */}
            <div>
              <label style={{ display: 'block', fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>
                Line Style
              </label>
              <div style={{ display: 'flex', gap: 12 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 12, color: '#f8fafc' }}>
                  <input
                    type="radio"
                    checked={gutterMode}
                    onChange={() => onGutterModeChange(true)}
                    style={{ accentColor: '#f59e0b' }}
                  />
                  Gap
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 12, color: '#f8fafc' }}>
                  <input
                    type="radio"
                    checked={!gutterMode}
                    onChange={() => onGutterModeChange(false)}
                    style={{ accentColor: '#f59e0b' }}
                  />
                  Border
                </label>
              </div>
            </div>

            {/* Line Color */}
            <div>
              <label style={{ display: 'block', fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>
                Color
              </label>
              <input
                type="color"
                value={defaultLineColor}
                onChange={(e) => onLineColorChange(e.target.value)}
                style={{
                  width: '100%',
                  height: 28,
                  padding: 0,
                  border: '1px solid #334155',
                  borderRadius: 6,
                  cursor: 'pointer',
                  background: 'transparent',
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Templates Panel */}
      {showTemplates && canEdit && (
        <div
          style={{
            padding: 16,
            background: '#1e293b',
            borderBottom: '1px solid #334155',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ color: '#f8fafc', fontWeight: 600, fontSize: 12 }}>Quick Layouts</span>
            <button
              onClick={() => setShowTemplates(false)}
              style={{ ...buttonBase, padding: 4, background: 'transparent', color: '#64748b' }}
            >
              <X size={14} />
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {LINE_TEMPLATES.map((template) => (
              <button
                key={template.id}
                onClick={() => handleApplyTemplate(template)}
                style={{
                  padding: 8,
                  background: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: 8,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.borderColor = '#f59e0b';
                  e.currentTarget.style.background = '#1e293b';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.borderColor = '#334155';
                  e.currentTarget.style.background = '#0f172a';
                }}
              >
                {/* Template preview */}
                <div
                  style={{
                    width: '100%',
                    aspectRatio: '8.5/11',
                    background: '#fff',
                    borderRadius: 4,
                    marginBottom: 6,
                    overflow: 'hidden',
                  }}
                >
                  <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%' }}>
                    <rect x="0" y="0" width="100" height="100" fill="#fff" />
                    {template.lines.map((line, i) => (
                      <line
                        key={i}
                        x1={line.start_x}
                        y1={line.start_y}
                        x2={line.end_x}
                        y2={line.end_y}
                        stroke="#334155"
                        strokeWidth="2"
                      />
                    ))}
                  </svg>
                </div>
                <span style={{ fontSize: 10, color: '#94a3b8' }}>
                  {template.name}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Canvas */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
          background: '#0f172a',
          overflow: 'hidden',
          minWidth: 0, // Allow flex item to shrink below content size
          minHeight: 0,
        }}
      >
        <div
          ref={canvasContainerRef}
          style={{
            position: 'relative',
            borderRadius: 4,
            boxShadow: '0 8px 32px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.2)',
            overflow: 'hidden',
            width: canvasSize.width,
            height: canvasSize.height,
            maxWidth: '100%',
            maxHeight: '100%',
            flexShrink: 0,
          }}
        >
          <DrawingCanvas
            lines={lines}
            canvasWidth={canvasSize.width}
            canvasHeight={canvasSize.height}
            mode={canEdit ? mode : 'select'}
            defaultThickness={defaultGutterWidth}
            defaultColor={defaultLineColor}
            gutterMode={gutterMode}
            selectedLineId={selectedLineId}
            onLineCreate={onLineCreate}
            onLineUpdate={onLineUpdate}
            onLineDelete={onLineDelete}
            onLineSelect={handleLineSelect}
            showPanelOverlay={true}
            selectedPanelId={selectedPanelId}
            onPanelSelect={onPanelSelect}
            onPanelsComputed={onPanelsComputed}
            showPanelLabels={showPanelNumbers}
            panelArtwork={panelArtwork}
          />
          {/* Overlay content (speech bubbles, etc.) positioned relative to canvas */}
          {children}
        </div>
      </div>

      {/* Info bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 12px',
          background: '#1e293b',
          borderTop: '1px solid #334155',
          borderRadius: '0 0 8px 8px',
          fontSize: 11,
          color: '#64748b',
        }}
      >
        <span>
          {lines.length} line{lines.length !== 1 ? 's' : ''} • {ORIENTATION_PRESETS[orientation]?.label || 'Custom'}
        </span>
        <span>
          Snaps to edges
        </span>
      </div>
    </div>
  );
});

// Set display name for debugging
LineBasedEditor.displayName = 'LineBasedEditor';

export default LineBasedEditor;
