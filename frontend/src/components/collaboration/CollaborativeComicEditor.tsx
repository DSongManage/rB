import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Rnd } from 'react-rnd';
import {
  CollaborativeProject,
  ComicPage,
  ComicPanel,
  SpeechBubble,
  BubbleType,
  BubbleStyle,
  TailType,
  ComicIssue,
  ComicIssueListItem,
  DividerLine,
  collaborationApi,
  ArtworkLibraryItem,
} from '../../services/collaborationApi';
import {
  getBubblePath,
  getTailElements,
  getBubbleFilterDefs,
  getSpeedLines,
  SpeedLine,
  ThoughtDot,
} from './bubbleShapes';
import { ArtworkLibraryPanel } from './ArtworkLibraryPanel';
import { LineBasedEditor, LINE_TEMPLATES, ORIENTATION_PRESETS, LineTemplate, LineBasedEditorRef } from './lineEditor';
import { DividerLineData } from './lineEditor/LineRenderer';
import {
  Plus,
  Trash2,
  Upload,
  Type,
  Layout,
  Image,
  MessageCircle,
  ChevronLeft,
  ChevronRight,
  Save,
  Loader2,
  Maximize2,
  Grid3X3,
  X,
  BookOpen,
  ChevronDown,
  Pencil,
  Check,
} from 'lucide-react';

interface User {
  id: number;
  username: string;
  display_name?: string;
}

interface CollaborativeComicEditorProps {
  project: CollaborativeProject;
  currentUser: User;
  onProjectUpdate?: (project: CollaborativeProject) => void;
}

type EditorMode = 'layout' | 'artwork' | 'text';

// Style presets with their available bubble types
const BUBBLE_STYLES: { value: BubbleStyle; label: string }[] = [
  { value: 'manga', label: 'Manga' },
  { value: 'western', label: 'Western' },
];

// Bubble types organized by style
const MANGA_BUBBLE_TYPES: { value: BubbleType; label: string }[] = [
  { value: 'oval', label: 'Speech' },
  { value: 'flash', label: 'Flash' },
  { value: 'thought', label: 'Thought' },
  { value: 'wavy', label: 'Nervous' },
  { value: 'angry', label: 'Angry' },
  { value: 'shout', label: 'Shout' },
  { value: 'whisper', label: 'Whisper' },
];

const WESTERN_BUBBLE_TYPES: { value: BubbleType; label: string }[] = [
  { value: 'oval', label: 'Speech' },
  { value: 'thought', label: 'Thought' },
  { value: 'shout', label: 'Shout' },
  { value: 'narrative', label: 'Narration' },
  { value: 'electric', label: 'Electric' },
  { value: 'poof', label: 'Poof/SFX' },
  { value: 'caption', label: 'Caption' },
];

// Combined list for legacy/select elements
const BUBBLE_TYPES: { value: BubbleType; label: string }[] = [
  { value: 'oval', label: 'Speech' },
  { value: 'thought', label: 'Thought' },
  { value: 'shout', label: 'Shout' },
  { value: 'narrative', label: 'Narration' },
  { value: 'whisper', label: 'Whisper' },
  { value: 'caption', label: 'Caption' },
  { value: 'flash', label: 'Flash' },
  { value: 'wavy', label: 'Nervous' },
  { value: 'angry', label: 'Angry' },
  { value: 'poof', label: 'Poof/SFX' },
  { value: 'electric', label: 'Electric' },
];

const TAIL_TYPES: { value: TailType; label: string }[] = [
  { value: 'curved', label: 'Curved' },
  { value: 'straight', label: 'Straight' },
  { value: 'dots', label: 'Dots' },
];

// Helper to get bubble types for a specific style
const getBubbleTypesForStyle = (style: BubbleStyle): { value: BubbleType; label: string }[] => {
  switch (style) {
    case 'manga':
      return MANGA_BUBBLE_TYPES;
    case 'western':
      return WESTERN_BUBBLE_TYPES;
    default:
      return BUBBLE_TYPES;
  }
};

// Panel layout templates for quick page setup
interface PanelTemplate {
  id: string;
  name: string;
  panels: { x: number; y: number; w: number; h: number; skewX?: number; skewY?: number }[];
}

const PANEL_TEMPLATES: PanelTemplate[] = [
  {
    id: 'full',
    name: 'Full Page',
    panels: [{ x: 2, y: 2, w: 96, h: 96 }],
  },
  {
    id: 'horizontal-2',
    name: '2 Horizontal',
    panels: [
      { x: 2, y: 2, w: 96, h: 47 },
      { x: 2, y: 51, w: 96, h: 47 },
    ],
  },
  {
    id: 'vertical-2',
    name: '2 Vertical',
    panels: [
      { x: 2, y: 2, w: 47, h: 96 },
      { x: 51, y: 2, w: 47, h: 96 },
    ],
  },
  {
    id: 'grid-4',
    name: '4 Grid',
    panels: [
      { x: 2, y: 2, w: 47, h: 47 },
      { x: 51, y: 2, w: 47, h: 47 },
      { x: 2, y: 51, w: 47, h: 47 },
      { x: 51, y: 51, w: 47, h: 47 },
    ],
  },
  {
    id: 'horizontal-3',
    name: '3 Horizontal',
    panels: [
      { x: 2, y: 2, w: 96, h: 31 },
      { x: 2, y: 35, w: 96, h: 31 },
      { x: 2, y: 67, w: 96, h: 31 },
    ],
  },
  {
    id: 'diagonal-3',
    name: '3 Diagonal',
    panels: [
      // Staircase diagonal layout - no skew, just positioned diagonally
      { x: 2, y: 2, w: 60, h: 30 },
      { x: 20, y: 34, w: 60, h: 30 },
      { x: 38, y: 66, w: 60, h: 32 },
    ],
  },
  {
    id: 'l-shape',
    name: 'L-Shape',
    panels: [
      { x: 2, y: 2, w: 65, h: 47 },
      { x: 69, y: 2, w: 29, h: 96 },
      { x: 2, y: 51, w: 65, h: 47 },
    ],
  },
  {
    id: 'splash',
    name: 'Splash Page',
    panels: [
      { x: 2, y: 2, w: 96, h: 70 },
      { x: 2, y: 74, w: 31, h: 24 },
      { x: 35, y: 74, w: 31, h: 24 },
      { x: 67, y: 74, w: 31, h: 24 },
    ],
  },
];

// Gap detection types and utilities
interface GapRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  area: number;
}

// Find empty regions on the page using grid-based detection
function findGaps(panels: ComicPanel[]): GapRegion[] {
  const GRID_SIZE = 20;
  const CELL_SIZE = 100 / GRID_SIZE; // 5% per cell

  // Create grid and mark occupied cells
  const grid: boolean[][] = Array(GRID_SIZE)
    .fill(null)
    .map(() => Array(GRID_SIZE).fill(false));

  // Mark cells occupied by panels (using bounding box)
  for (const panel of panels) {
    const startX = Math.floor(Math.max(0, panel.x_percent) / CELL_SIZE);
    const endX = Math.ceil(Math.min(100, panel.x_percent + panel.width_percent) / CELL_SIZE);
    const startY = Math.floor(Math.max(0, panel.y_percent) / CELL_SIZE);
    const endY = Math.ceil(Math.min(100, panel.y_percent + panel.height_percent) / CELL_SIZE);

    for (let y = startY; y < endY && y < GRID_SIZE; y++) {
      for (let x = startX; x < endX && x < GRID_SIZE; x++) {
        if (x >= 0 && y >= 0) {
          grid[y][x] = true;
        }
      }
    }
  }

  // Find largest empty rectangles using maximal rectangle algorithm
  const gaps: GapRegion[] = [];
  const heights = Array(GRID_SIZE).fill(0);

  for (let y = 0; y < GRID_SIZE; y++) {
    // Update heights
    for (let x = 0; x < GRID_SIZE; x++) {
      heights[x] = grid[y][x] ? 0 : heights[x] + 1;
    }

    // Find largest rectangle in histogram
    const stack: number[] = [];
    for (let x = 0; x <= GRID_SIZE; x++) {
      const h = x === GRID_SIZE ? 0 : heights[x];
      while (stack.length > 0 && heights[stack[stack.length - 1]] > h) {
        const height = heights[stack.pop()!];
        const width = stack.length === 0 ? x : x - stack[stack.length - 1] - 1;
        const area = height * width;
        if (area >= 4) { // Minimum 4 cells (20% x 20%)
          const startX = stack.length === 0 ? 0 : stack[stack.length - 1] + 1;
          gaps.push({
            x: startX * CELL_SIZE,
            y: (y - height + 1) * CELL_SIZE,
            width: width * CELL_SIZE,
            height: height * CELL_SIZE,
            area: area * CELL_SIZE * CELL_SIZE,
          });
        }
      }
      stack.push(x);
    }
  }

  // Sort by area (largest first) and remove duplicates/overlapping
  gaps.sort((a, b) => b.area - a.area);

  // Filter to keep only non-overlapping gaps
  const result: GapRegion[] = [];
  for (const gap of gaps) {
    const overlaps = result.some(
      (existing) =>
        gap.x < existing.x + existing.width &&
        gap.x + gap.width > existing.x &&
        gap.y < existing.y + existing.height &&
        gap.y + gap.height > existing.y
    );
    if (!overlaps) {
      result.push(gap);
    }
  }

  return result.slice(0, 5); // Return top 5 gaps
}

// Find adjacent panel to match skew
function findAdjacentPanel(panels: ComicPanel[], gap: GapRegion): ComicPanel | null {
  let closest: ComicPanel | null = null;
  let minDistance = Infinity;

  for (const panel of panels) {
    // Calculate distance from gap to panel
    const panelCenterX = panel.x_percent + panel.width_percent / 2;
    const panelCenterY = panel.y_percent + panel.height_percent / 2;
    const gapCenterX = gap.x + gap.width / 2;
    const gapCenterY = gap.y + gap.height / 2;

    const distance = Math.sqrt(
      Math.pow(panelCenterX - gapCenterX, 2) + Math.pow(panelCenterY - gapCenterY, 2)
    );

    if (distance < minDistance) {
      minDistance = distance;
      closest = panel;
    }
  }

  return closest;
}

export default function CollaborativeComicEditor({
  project,
  currentUser,
  onProjectUpdate,
}: CollaborativeComicEditorProps) {
  // State
  const [pages, setPages] = useState<ComicPage[]>([]);
  const [selectedPageIndex, setSelectedPageIndex] = useState(0);
  const [selectedPanelId, setSelectedPanelId] = useState<number | null>(null);
  const [selectedComputedPanelId, setSelectedComputedPanelId] = useState<string | null>(null); // For line-based editor
  const [computedPanels, setComputedPanels] = useState<import('../../utils/regionCalculator').ComputedPanel[]>([]);
  const [panelArtworkMap, setPanelArtworkMap] = useState<Map<string, string>>(new Map()); // Maps computed panel ID to artwork URL
  const [selectedBubbleId, setSelectedBubbleId] = useState<number | null>(null);
  const [mode, setMode] = useState<EditorMode>('layout');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [newBubbleType, setNewBubbleType] = useState<BubbleType>('oval');
  const [newBubbleStyle, setNewBubbleStyle] = useState<BubbleStyle>('manga');
  const [showTemplates, setShowTemplates] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Issue state
  const [issues, setIssues] = useState<ComicIssueListItem[]>([]);
  const [selectedIssueId, setSelectedIssueId] = useState<number | null>(null);
  const [showIssueDropdown, setShowIssueDropdown] = useState(false);
  const [creatingIssue, setCreatingIssue] = useState(false);
  const [editingIssueId, setEditingIssueId] = useState<number | null>(null);
  const [editingIssueTitle, setEditingIssueTitle] = useState('');

  const canvasRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lineEditorRef = useRef<LineBasedEditorRef>(null);

  // Sync refs to prevent race conditions during save/reload
  const isReloadingRef = useRef(false);
  const lastPageIdRef = useRef<number | null>(null);

  // Guard to prevent duplicate initial load (React StrictMode runs effects twice)
  const isInitialLoadRunningRef = useRef(false);
  const hasInitializedRef = useRef(false);

  // Canvas dimension tracking for pixel-based positioning
  const [canvasDimensions, setCanvasDimensions] = useState({ width: 0, height: 0 });

  // Track available space for responsive canvas sizing
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [availableCanvasSpace, setAvailableCanvasSpace] = useState({ width: 800, height: 700 });

  // Stable canvas size for bubble positioning - prevents drift on re-renders
  // This is updated from LineBasedEditor and persists across renders
  const [stableCanvasSize, setStableCanvasSize] = useState({ width: 550, height: 712 });

  // Smart alignment guides state
  const [guides, setGuides] = useState<{
    vertical: number[];
    horizontal: number[];
  }>({ vertical: [], horizontal: [] });

  // Track which panel is being dragged
  const [draggingPanelId, setDraggingPanelId] = useState<number | null>(null);

  // Artwork library state for drag-and-drop
  const [artworkLibraryExpanded, setArtworkLibraryExpanded] = useState(true);
  const [draggingArtworkItem, setDraggingArtworkItem] = useState<ArtworkLibraryItem | null>(null);
  const [dropTargetPanelId, setDropTargetPanelId] = useState<string | null>(null);

  // Permissions - creator always has full access
  const collaborators = project.collaborators || [];
  const currentUserRole = collaborators.find((c) => c.user === currentUser.id);
  const creatorId = typeof project.created_by === 'object'
    ? (project.created_by as any)?.id
    : project.created_by;
  const isCreator = creatorId === currentUser.id;
  // Base permissions from role - use can_edit array which is derived from
  // RoleDefinition permissions (with fallback to legacy booleans on backend)
  const hasImagePermission = isCreator ||
    (currentUserRole?.can_edit?.includes('image') ?? false);
  const hasTextPermission = isCreator ||
    (currentUserRole?.can_edit?.includes('text') ?? false);

  // Current page data
  const currentPage = pages[selectedPageIndex];

  // Load issues and pages on mount
  useEffect(() => {
    // Guard against React StrictMode double-invocation
    if (hasInitializedRef.current || isInitialLoadRunningRef.current) {
      return;
    }
    loadIssuesAndPages();
  }, [project.id]);

  const loadIssuesAndPages = async () => {
    // Prevent concurrent calls (React StrictMode protection)
    if (isInitialLoadRunningRef.current) {
      console.log('[INIT] Skipping duplicate loadIssuesAndPages call');
      return;
    }
    isInitialLoadRunningRef.current = true;

    setLoading(true);
    setError('');
    try {
      // Load issues for this project
      const loadedIssues = await collaborationApi.getComicIssues({ project: project.id });
      setIssues(loadedIssues);

      if (loadedIssues.length > 0) {
        // Select first issue by default
        const firstIssueId = loadedIssues[0].id;
        setSelectedIssueId(firstIssueId);
        // Load pages for the first issue
        await loadPagesForIssue(firstIssueId);
      } else {
        // No issues yet - create first issue automatically
        const newIssue = await collaborationApi.createComicIssue({
          project: project.id,
          title: 'Issue #1',
          issue_number: 1,
        });
        setIssues([{ ...newIssue, page_count: 1 }]);
        setSelectedIssueId(newIssue.id);
        // Create first page for this issue (only send issue, not project)
        const newPage = await collaborationApi.createComicPage({
          issue: newIssue.id,
        });
        setPages([{ ...newPage, panels: newPage.panels || [] }]);
      }
      hasInitializedRef.current = true;
    } catch (err: any) {
      setError(err.message || 'Failed to load comic');
      // Fallback: try loading pages directly from project (backwards compat)
      await loadPages();
    } finally {
      setLoading(false);
      isInitialLoadRunningRef.current = false;
    }
  };

  const loadPagesForIssue = async (issueId: number) => {
    try {
      const loadedPages = await collaborationApi.getComicIssuePages(issueId);
      const normalizedPages = (loadedPages || []).map((page) => ({
        ...page,
        panels: page.panels || [],
      }));
      setPages(normalizedPages);
      setSelectedPageIndex(0);
      setSelectedPanelId(null);
      setSelectedComputedPanelId(null);
      setSelectedBubbleId(null);
      // Update the page count in issues state to match actual loaded pages
      updateIssuePageCount(issueId, normalizedPages.length);
      if (normalizedPages.length === 0) {
        // Create first page for this issue (only send issue, not project)
        const newPage = await collaborationApi.createComicPage({
          issue: issueId,
        });
        setPages([{ ...newPage, panels: newPage.panels || [] }]);
        updateIssuePageCount(issueId, 1);
      }
    } catch (err: any) {
      console.error('Failed to load pages for issue:', err);
      setError(err.message || 'Failed to load pages');
    }
  };

  // Handle issue selection
  const handleSelectIssue = async (issueId: number) => {
    if (issueId === selectedIssueId) {
      setShowIssueDropdown(false);
      return;
    }
    setSelectedIssueId(issueId);
    setShowIssueDropdown(false);
    setSelectedPanelId(null);
    setSelectedComputedPanelId(null);
    setSelectedBubbleId(null);
    setLoading(true);
    try {
      await loadPagesForIssue(issueId);
    } finally {
      setLoading(false);
    }
  };

  // Create new issue
  const handleCreateIssue = async () => {
    if (!canEditPanels || creatingIssue) return;
    setCreatingIssue(true);
    try {
      const nextIssueNumber = issues.length + 1;
      const newIssue = await collaborationApi.createComicIssue({
        project: project.id,
        title: `Issue #${nextIssueNumber}`,
        issue_number: nextIssueNumber,
      });
      // Add new issue to list with page_count of 1 (we'll create first page)
      const newIssueWithCount = { ...newIssue, page_count: 1 };
      setIssues([...issues, newIssueWithCount]);
      // Switch to the new issue
      setSelectedIssueId(newIssue.id);
      setShowIssueDropdown(false);
      // Clear old pages and create first page for this new issue
      setPages([]);
      setSelectedPageIndex(0);
      setSelectedPanelId(null);
      setSelectedComputedPanelId(null);
      setSelectedBubbleId(null);
      // Create first blank page for the new issue (only send issue, not project)
      const newPage = await collaborationApi.createComicPage({
        issue: newIssue.id,
      });
      setPages([{ ...newPage, panels: newPage.panels || [] }]);
    } catch (err: any) {
      setError(err.message || 'Failed to create issue');
    } finally {
      setCreatingIssue(false);
    }
  };

  // Start editing an issue title
  const handleStartEditIssue = (issue: ComicIssueListItem) => {
    setEditingIssueId(issue.id);
    setEditingIssueTitle(issue.title);
  };

  // Save issue title
  const handleSaveIssueTitle = async () => {
    if (!editingIssueId || !editingIssueTitle.trim()) {
      setEditingIssueId(null);
      return;
    }
    try {
      await collaborationApi.updateComicIssue(editingIssueId, { title: editingIssueTitle.trim() });
      // Update local state
      setIssues(issues.map(issue =>
        issue.id === editingIssueId
          ? { ...issue, title: editingIssueTitle.trim() }
          : issue
      ));
    } catch (err: any) {
      setError(err.message || 'Failed to update issue title');
    } finally {
      setEditingIssueId(null);
    }
  };

  // Update page count for an issue in local state
  const updateIssuePageCount = (issueId: number, pageCount: number) => {
    setIssues(prevIssues => prevIssues.map(issue =>
      issue.id === issueId
        ? { ...issue, page_count: pageCount }
        : issue
    ));
  };

  // Get current issue
  const currentIssue = issues.find((i) => i.id === selectedIssueId);

  // Issue-level published check - published issues are read-only
  const isCurrentIssuePublished = currentIssue?.is_published ?? false;
  const canEditPanels = !isCurrentIssuePublished && hasImagePermission;
  const canEditText = !isCurrentIssuePublished && hasTextPermission;

  // Track canvas dimensions with ResizeObserver for accurate pixel positioning
  // Use debouncing to prevent rapid updates that cause panel instability
  const canvasDimensionsRef = useRef(canvasDimensions);
  canvasDimensionsRef.current = canvasDimensions;

  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null;

    const updateDimensions = () => {
      if (canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        const newWidth = rect.width;
        const newHeight = rect.height;

        // Only update if dimensions actually changed significantly (>2px)
        // This prevents micro-updates from causing panel position jumps
        const widthDiff = Math.abs(newWidth - canvasDimensionsRef.current.width);
        const heightDiff = Math.abs(newHeight - canvasDimensionsRef.current.height);

        if (canvasDimensionsRef.current.width === 0 || widthDiff > 2 || heightDiff > 2) {
          setCanvasDimensions({ width: newWidth, height: newHeight });
        }
      }
    };

    const debouncedUpdate = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      timeoutId = setTimeout(updateDimensions, 100);
    };

    // Initial update immediately
    updateDimensions();

    const resizeObserver = new ResizeObserver(debouncedUpdate);
    if (canvasRef.current) {
      resizeObserver.observe(canvasRef.current);
    }

    window.addEventListener('resize', debouncedUpdate);
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      resizeObserver.disconnect();
      window.removeEventListener('resize', debouncedUpdate);
    };
  }, []);

  // Track canvas container size for responsive canvas sizing
  useEffect(() => {
    const updateAvailableSpace = () => {
      if (canvasContainerRef.current) {
        const rect = canvasContainerRef.current.getBoundingClientRect();
        // Leave some padding (32px total for padding inside container)
        const availableWidth = Math.max(400, rect.width - 32);
        const availableHeight = Math.max(400, rect.height - 40); // Minimal reserved space for cleaner look
        setAvailableCanvasSpace({ width: availableWidth, height: availableHeight });
      }
    };

    // Initial update
    updateAvailableSpace();

    // Watch for resize
    const resizeObserver = new ResizeObserver(updateAvailableSpace);
    if (canvasContainerRef.current) {
      resizeObserver.observe(canvasContainerRef.current);
    }

    window.addEventListener('resize', updateAvailableSpace);
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateAvailableSpace);
    };
  }, []);

  // Update stable canvas size when LineBasedEditor reports dimensions
  // This runs periodically to catch dimension changes and ensures bubble positions stay consistent
  useEffect(() => {
    const updateStableSize = () => {
      const size = lineEditorRef.current?.getCanvasSize();
      if (size && size.width > 0 && size.height > 0) {
        // Only update if dimensions actually changed to avoid unnecessary re-renders
        setStableCanvasSize(prev => {
          if (Math.abs(prev.width - size.width) > 1 || Math.abs(prev.height - size.height) > 1) {
            return { width: size.width, height: size.height };
          }
          return prev;
        });
      }
    };

    // Update immediately and then periodically
    updateStableSize();
    const intervalId = setInterval(updateStableSize, 500);

    return () => clearInterval(intervalId);
  }, [currentPage?.id, availableCanvasSpace]); // Re-run when page or available space changes

  // Keyboard shortcut for deleting selected bubble
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle Delete/Backspace when a bubble is selected
      if (!selectedBubbleId || !canEditText || mode !== 'text') return;

      // Don't delete if user is typing in an input/textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        handleDeleteBubble(selectedBubbleId);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedBubbleId, canEditText, mode]);

  const loadPages = async () => {
    setLoading(true);
    setError('');
    try {
      const loadedPages = await collaborationApi.getComicPages(project.id);
      // Ensure all pages have panels array (normalize data)
      const normalizedPages = (loadedPages || []).map((page) => ({
        ...page,
        panels: page.panels || [],
      }));
      setPages(normalizedPages);
      if (normalizedPages.length === 0) {
        // Create first page automatically
        const newPage = await collaborationApi.createComicPage({ project: project.id });
        setPages([{ ...newPage, panels: newPage.panels || [] }]);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load pages');
    } finally {
      setLoading(false);
    }
  };

  // Page management
  const handleAddPage = async () => {
    if (!canEditPanels) return;
    setSaving(true);
    try {
      // When issue is selected, page belongs to issue (not directly to project)
      const pageData: { project?: number; issue?: number } = selectedIssueId
        ? { issue: selectedIssueId }
        : { project: project.id };
      const newPage = await collaborationApi.createComicPage(pageData);
      const newPages = [...pages, newPage];
      setPages(newPages);
      setSelectedPageIndex(pages.length);
      // Update page count in issues state
      if (selectedIssueId) {
        updateIssuePageCount(selectedIssueId, newPages.length);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to add page');
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePage = async () => {
    if (!canEditPanels || !currentPage || pages.length <= 1) return;
    if (!confirm('Delete this page? This cannot be undone.')) return;

    setSaving(true);
    try {
      await collaborationApi.deleteComicPage(currentPage.id);
      const newPages = pages.filter((_, i) => i !== selectedPageIndex);
      setPages(newPages);
      setSelectedPageIndex(Math.max(0, selectedPageIndex - 1));
      // Update page count in issues state
      if (selectedIssueId) {
        updateIssuePageCount(selectedIssueId, newPages.length);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to delete page');
    } finally {
      setSaving(false);
    }
  };

  // Manual save - all changes are auto-saved, but this provides user feedback
  const handleSave = async () => {
    // Changes are already saved automatically, but this gives user confidence
    // by refreshing the data from server
    console.log('[SAVE] Starting save, setting isReloadingRef=true');
    setSaving(true);
    // IMPORTANT: Set reload flag to prevent artwork map rebuild with stale data
    isReloadingRef.current = true;
    try {
      // Load pages for the current issue, not the project
      if (selectedIssueId) {
        await loadPagesForIssue(selectedIssueId);
      } else {
        await loadPages();
      }
      console.log('[SAVE] Pages reloaded successfully');
      setLastSaved(new Date());
      setError('');
    } catch (err: any) {
      console.log('[SAVE] Error during save:', err);
      setError(err.message || 'Failed to save');
    } finally {
      setSaving(false);
      // Allow state to settle before re-enabling artwork map updates
      // This gives computedPanels time to sync with the new page data
      setTimeout(() => {
        console.log('[SAVE] Clearing isReloadingRef after 100ms');
        isReloadingRef.current = false;
      }, 100);
    }
  };

  // Panel management with smart placement
  const handleAddPanel = async () => {
    if (!canEditPanels || !currentPage) return;

    // Smart placement: find best empty spot
    let x = 5, y = 5, width = 45, height = 40;

    if (currentPage.panels.length > 0) {
      const gaps = findGaps(currentPage.panels);
      if (gaps.length > 0) {
        const gap = gaps[0];
        // Size panel to 80% of gap with some margin
        x = gap.x + gap.width * 0.1;
        y = gap.y + gap.height * 0.1;
        width = Math.min(gap.width * 0.8, 90);
        height = Math.min(gap.height * 0.8, 90);

        // Ensure minimum size
        width = Math.max(width, 20);
        height = Math.max(height, 20);
      }
    }

    setSaving(true);
    try {
      const newPanel = await collaborationApi.createComicPanel({
        page: currentPage.id,
        x_percent: x,
        y_percent: y,
        width_percent: width,
        height_percent: height,
      });
      // Update local state
      const updatedPages = [...pages];
      updatedPages[selectedPageIndex] = {
        ...currentPage,
        panels: [...currentPage.panels, newPanel],
      };
      setPages(updatedPages);
      setSelectedPanelId(newPanel.id);
    } catch (err: any) {
      setError(err.message || 'Failed to add panel');
    } finally {
      setSaving(false);
    }
  };

  // Fill gap with a new panel - works best with non-skewed rectangular panels
  const handleFillGap = async () => {
    if (!canEditPanels || !currentPage) return;

    // Check if any panels have significant skew - warn user
    const hasSkewedPanels = currentPage.panels.some(
      (p) => Math.abs(p.skew_x || 0) > 5 || Math.abs(p.skew_y || 0) > 5 || Math.abs(p.rotation || 0) > 5
    );

    if (hasSkewedPanels) {
      const proceed = confirm(
        'This page has skewed or rotated panels. Fill Gap works best with rectangular panels. Continue anyway?'
      );
      if (!proceed) return;
    }

    const gaps = findGaps(currentPage.panels);
    if (gaps.length === 0) {
      setError('No significant gaps detected. Try using Add Panel instead.');
      return;
    }

    const largestGap = gaps[0];

    // For skewed pages, don't apply skew to new panel - let user adjust manually
    setSaving(true);
    try {
      const newPanel = await collaborationApi.createComicPanel({
        page: currentPage.id,
        x_percent: largestGap.x,
        y_percent: largestGap.y,
        width_percent: largestGap.width,
        height_percent: largestGap.height,
      });

      const updatedPages = [...pages];
      updatedPages[selectedPageIndex] = {
        ...currentPage,
        panels: [...currentPage.panels, newPanel],
      };
      setPages(updatedPages);
      setSelectedPanelId(newPanel.id);
    } catch (err: any) {
      setError(err.message || 'Failed to fill gap');
    } finally {
      setSaving(false);
    }
  };

  // Apply a panel template to the current page
  const applyTemplate = async (template: PanelTemplate) => {
    if (!canEditPanels || !currentPage) return;

    // Confirm if page has existing panels
    if (currentPage.panels.length > 0) {
      if (!confirm('Replace existing panels with template?')) return;

      // Delete existing panels
      setSaving(true);
      try {
        for (const panel of currentPage.panels) {
          await collaborationApi.deleteComicPanel(panel.id);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to clear existing panels');
        setSaving(false);
        return;
      }
    }

    // Create panels from template
    setSaving(true);
    try {
      const newPanels: ComicPanel[] = [];
      for (const p of template.panels) {
        const newPanel = await collaborationApi.createComicPanel({
          page: currentPage.id,
          x_percent: p.x,
          y_percent: p.y,
          width_percent: p.w,
          height_percent: p.h,
          skew_x: p.skewX || 0,
          skew_y: p.skewY || 0,
        });
        newPanels.push(newPanel);
      }

      const updatedPages = [...pages];
      updatedPages[selectedPageIndex] = {
        ...currentPage,
        panels: newPanels,
      };
      setPages(updatedPages);
      setShowTemplates(false);
      setSelectedPanelId(null);
      setSelectedComputedPanelId(null);
    } catch (err: any) {
      setError(err.message || 'Failed to apply template');
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePanel = async (panelId: number) => {
    if (!canEditPanels || !currentPage) return;
    if (!confirm('Delete this panel?')) return;

    setSaving(true);
    try {
      await collaborationApi.deleteComicPanel(panelId);
      // Update local state
      const updatedPages = [...pages];
      updatedPages[selectedPageIndex] = {
        ...currentPage,
        panels: currentPage.panels.filter((p) => p.id !== panelId),
      };
      setPages(updatedPages);
      setSelectedPanelId(null);
      setSelectedComputedPanelId(null);
    } catch (err: any) {
      setError(err.message || 'Failed to delete panel');
    } finally {
      setSaving(false);
    }
  };

  // ============ LINE-BASED EDITOR HANDLERS ============

  // Convert API DividerLine to component DividerLineData
  const toDividerLineData = (line: DividerLine): DividerLineData => ({
    id: line.id,
    line_type: line.line_type as 'straight' | 'bezier',
    start_x: line.start_x,
    start_y: line.start_y,
    end_x: line.end_x,
    end_y: line.end_y,
    control1_x: line.control1_x ?? undefined,
    control1_y: line.control1_y ?? undefined,
    control2_x: line.control2_x ?? undefined,
    control2_y: line.control2_y ?? undefined,
    thickness: line.thickness ?? undefined,
    color: line.color ?? undefined,
  });

  // Get divider lines for current page as DividerLineData[]
  const currentDividerLines: DividerLineData[] = useMemo(() => {
    if (!currentPage?.divider_lines) return [];
    return currentPage.divider_lines.map(toDividerLineData);
  }, [currentPage?.divider_lines]);

  // Helper to round coordinate values to 4 decimal places (matches backend precision)
  const roundCoord = (val: number | undefined): number | undefined => {
    if (val === undefined) return undefined;
    return Math.round(val * 10000) / 10000;
  };

  // Create a new divider line
  const handleLineCreate = async (lineData: Omit<DividerLineData, 'id'>) => {
    if (!canEditPanels || !currentPage) return;

    setSaving(true);
    try {
      const newLine = await collaborationApi.createDividerLine({
        page: currentPage.id,
        line_type: lineData.line_type,
        start_x: roundCoord(lineData.start_x)!,
        start_y: roundCoord(lineData.start_y)!,
        end_x: roundCoord(lineData.end_x)!,
        end_y: roundCoord(lineData.end_y)!,
        control1_x: roundCoord(lineData.control1_x),
        control1_y: roundCoord(lineData.control1_y),
        control2_x: roundCoord(lineData.control2_x),
        control2_y: roundCoord(lineData.control2_y),
        thickness: lineData.thickness,
        color: lineData.color,
      });

      // Update local state
      const updatedPages = [...pages];
      updatedPages[selectedPageIndex] = {
        ...currentPage,
        divider_lines: [...(currentPage.divider_lines || []), newLine],
      };
      setPages(updatedPages);
    } catch (err: any) {
      setError(err.message || 'Failed to create line');
    } finally {
      setSaving(false);
    }
  };

  // Update an existing divider line
  const handleLineUpdate = async (lineId: number, updates: Partial<DividerLineData>) => {
    if (!canEditPanels || !currentPage) return;

    try {
      // Round coordinate values before sending
      const roundedUpdates: Partial<DividerLineData> = { ...updates };
      if (roundedUpdates.start_x !== undefined) roundedUpdates.start_x = roundCoord(roundedUpdates.start_x)!;
      if (roundedUpdates.start_y !== undefined) roundedUpdates.start_y = roundCoord(roundedUpdates.start_y)!;
      if (roundedUpdates.end_x !== undefined) roundedUpdates.end_x = roundCoord(roundedUpdates.end_x)!;
      if (roundedUpdates.end_y !== undefined) roundedUpdates.end_y = roundCoord(roundedUpdates.end_y)!;
      if (roundedUpdates.control1_x !== undefined) roundedUpdates.control1_x = roundCoord(roundedUpdates.control1_x);
      if (roundedUpdates.control1_y !== undefined) roundedUpdates.control1_y = roundCoord(roundedUpdates.control1_y);
      if (roundedUpdates.control2_x !== undefined) roundedUpdates.control2_x = roundCoord(roundedUpdates.control2_x);
      if (roundedUpdates.control2_y !== undefined) roundedUpdates.control2_y = roundCoord(roundedUpdates.control2_y);

      const updatedLine = await collaborationApi.updateDividerLine(lineId, roundedUpdates);

      // Update local state
      const updatedPages = [...pages];
      updatedPages[selectedPageIndex] = {
        ...currentPage,
        divider_lines: currentPage.divider_lines.map((l) =>
          l.id === lineId ? updatedLine : l
        ),
      };
      setPages(updatedPages);
    } catch (err: any) {
      setError(err.message || 'Failed to update line');
    }
  };

  // Delete a divider line
  const handleLineDelete = async (lineId: number) => {
    if (!canEditPanels || !currentPage) return;

    try {
      await collaborationApi.deleteDividerLine(lineId);

      // Update local state
      const updatedPages = [...pages];
      updatedPages[selectedPageIndex] = {
        ...currentPage,
        divider_lines: currentPage.divider_lines.filter((l) => l.id !== lineId),
      };
      setPages(updatedPages);
    } catch (err: any) {
      setError(err.message || 'Failed to delete line');
    }
  };

  // Apply a line template
  const handleApplyLineTemplate = async (template: LineTemplate) => {
    if (!canEditPanels || !currentPage) return;

    setSaving(true);
    try {
      // Delete existing lines
      for (const line of currentPage.divider_lines || []) {
        await collaborationApi.deleteDividerLine(line.id);
      }

      // Create new lines from template
      if (template.lines.length > 0) {
        const result = await collaborationApi.batchCreateDividerLines(
          currentPage.id,
          template.lines.map((l) => ({
            line_type: l.line_type,
            start_x: roundCoord(l.start_x)!,
            start_y: roundCoord(l.start_y)!,
            end_x: roundCoord(l.end_x)!,
            end_y: roundCoord(l.end_y)!,
            control1_x: roundCoord(l.control1_x),
            control1_y: roundCoord(l.control1_y),
            control2_x: roundCoord(l.control2_x),
            control2_y: roundCoord(l.control2_y),
          }))
        );

        // Update local state
        const updatedPages = [...pages];
        updatedPages[selectedPageIndex] = {
          ...currentPage,
          divider_lines: result.created,
        };
        setPages(updatedPages);
      } else {
        // Empty template - clear all lines
        const updatedPages = [...pages];
        updatedPages[selectedPageIndex] = {
          ...currentPage,
          divider_lines: [],
        };
        setPages(updatedPages);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to apply template');
    } finally {
      setSaving(false);
    }
  };

  // Update page orientation
  const handleOrientationChange = async (orientation: string) => {
    if (!canEditPanels || !currentPage) return;

    try {
      await collaborationApi.updateComicPage(currentPage.id, { orientation } as any);

      const updatedPages = [...pages];
      updatedPages[selectedPageIndex] = {
        ...currentPage,
        orientation: orientation as any,
      };
      setPages(updatedPages);
    } catch (err: any) {
      setError(err.message || 'Failed to update orientation');
    }
  };

  // Update gutter mode
  const handleGutterModeChange = async (gutterMode: boolean) => {
    if (!canEditPanels || !currentPage) return;

    try {
      await collaborationApi.updateComicPage(currentPage.id, { gutter_mode: gutterMode } as any);

      const updatedPages = [...pages];
      updatedPages[selectedPageIndex] = {
        ...currentPage,
        gutter_mode: gutterMode,
      };
      setPages(updatedPages);
    } catch (err: any) {
      setError(err.message || 'Failed to update gutter mode');
    }
  };

  // Update gutter width
  const handleGutterWidthChange = async (width: number) => {
    if (!canEditPanels || !currentPage) return;

    try {
      await collaborationApi.updateComicPage(currentPage.id, { default_gutter_width: width } as any);

      const updatedPages = [...pages];
      updatedPages[selectedPageIndex] = {
        ...currentPage,
        default_gutter_width: width,
      };
      setPages(updatedPages);
    } catch (err: any) {
      setError(err.message || 'Failed to update gutter width');
    }
  };

  // Update line color
  const handleLineColorChange = async (color: string) => {
    if (!canEditPanels || !currentPage) return;

    try {
      await collaborationApi.updateComicPage(currentPage.id, { default_line_color: color } as any);

      const updatedPages = [...pages];
      updatedPages[selectedPageIndex] = {
        ...currentPage,
        default_line_color: color,
      };
      setPages(updatedPages);
    } catch (err: any) {
      setError(err.message || 'Failed to update line color');
    }
  };

  // Check if using line-based layout (version 2+)
  const useLineBasedLayout = currentPage && (currentPage.layout_version ?? 2) >= 2;

  // ============ END LINE-BASED EDITOR HANDLERS ============

  // Snap-to-grid helper (5% increments for clean alignment)
  const GRID_SIZE = 5;
  const snapToGrid = (value: number): number => {
    return Math.round(value / GRID_SIZE) * GRID_SIZE;
  };

  // Calculate smart alignment guides during drag
  const calculateGuides = useCallback(
    (panelId: number, x: number, y: number, width: number, height: number) => {
      if (!currentPage || canvasDimensions.width === 0) return;

      const SNAP_THRESHOLD = 10; // pixels
      const newGuides: { vertical: number[]; horizontal: number[] } = {
        vertical: [],
        horizontal: [],
      };

      // Calculate this panel's edges
      const panelRight = x + width;
      const panelBottom = y + height;
      const panelCenterX = x + width / 2;
      const panelCenterY = y + height / 2;

      currentPage.panels.forEach((other) => {
        if (other.id === panelId) return;

        // Calculate other panel's position in pixels
        const otherX = (other.x_percent / 100) * canvasDimensions.width;
        const otherY = (other.y_percent / 100) * canvasDimensions.height;
        const otherWidth = (other.width_percent / 100) * canvasDimensions.width;
        const otherHeight = (other.height_percent / 100) * canvasDimensions.height;
        const otherRight = otherX + otherWidth;
        const otherBottom = otherY + otherHeight;
        const otherCenterX = otherX + otherWidth / 2;
        const otherCenterY = otherY + otherHeight / 2;

        // Check vertical alignments (left, right, center)
        if (Math.abs(x - otherX) < SNAP_THRESHOLD) newGuides.vertical.push(otherX);
        if (Math.abs(x - otherRight) < SNAP_THRESHOLD) newGuides.vertical.push(otherRight);
        if (Math.abs(panelRight - otherX) < SNAP_THRESHOLD) newGuides.vertical.push(otherX);
        if (Math.abs(panelRight - otherRight) < SNAP_THRESHOLD) newGuides.vertical.push(otherRight);
        if (Math.abs(panelCenterX - otherCenterX) < SNAP_THRESHOLD) newGuides.vertical.push(otherCenterX);

        // Check horizontal alignments (top, bottom, center)
        if (Math.abs(y - otherY) < SNAP_THRESHOLD) newGuides.horizontal.push(otherY);
        if (Math.abs(y - otherBottom) < SNAP_THRESHOLD) newGuides.horizontal.push(otherBottom);
        if (Math.abs(panelBottom - otherY) < SNAP_THRESHOLD) newGuides.horizontal.push(otherY);
        if (Math.abs(panelBottom - otherBottom) < SNAP_THRESHOLD) newGuides.horizontal.push(otherBottom);
        if (Math.abs(panelCenterY - otherCenterY) < SNAP_THRESHOLD) newGuides.horizontal.push(otherCenterY);
      });

      // Remove duplicates
      newGuides.vertical = [...new Set(newGuides.vertical)];
      newGuides.horizontal = [...new Set(newGuides.horizontal)];

      setGuides(newGuides);
    },
    [currentPage, canvasDimensions]
  );

  // Clear guides when drag ends
  const clearGuides = useCallback(() => {
    setGuides({ vertical: [], horizontal: [] });
    setDraggingPanelId(null);
  }, []);

  const handlePanelPositionChange = useCallback(
    async (
      panelId: number,
      x: number,
      y: number,
      width: number,
      height: number
    ) => {
      if (!canEditPanels || !currentPage) return;

      // Validate inputs are valid numbers to prevent NaN/null being sent to backend
      if (
        !Number.isFinite(x) ||
        !Number.isFinite(y) ||
        !Number.isFinite(width) ||
        !Number.isFinite(height)
      ) {
        console.warn('Invalid position values, skipping update:', { x, y, width, height });
        return;
      }

      // Use tracked dimensions, fallback to getBoundingClientRect
      const canvasWidth = canvasDimensions.width || canvasRef.current?.getBoundingClientRect().width || 1;
      const canvasHeight = canvasDimensions.height || canvasRef.current?.getBoundingClientRect().height || 1;

      // Convert to percentages and snap to grid
      let xPercent = Math.round((x / canvasWidth) * 10000) / 100;
      let yPercent = Math.round((y / canvasHeight) * 10000) / 100;
      let widthPercent = Math.round((width / canvasWidth) * 10000) / 100;
      let heightPercent = Math.round((height / canvasHeight) * 10000) / 100;

      // Apply snap-to-grid
      xPercent = snapToGrid(xPercent);
      yPercent = snapToGrid(yPercent);
      widthPercent = snapToGrid(widthPercent);
      heightPercent = snapToGrid(heightPercent);

      // Allow off-page positioning like PowerPoint (-50% to 150%)
      // This enables creative panel layouts that extend beyond the page edge
      xPercent = Math.max(-50, Math.min(150 - widthPercent, xPercent));
      yPercent = Math.max(-50, Math.min(150 - heightPercent, yPercent));
      widthPercent = Math.max(10, Math.min(100, widthPercent)); // minimum 10% width
      heightPercent = Math.max(10, Math.min(100, heightPercent)); // minimum 10% height

      // Final validation
      if (
        !Number.isFinite(xPercent) ||
        !Number.isFinite(yPercent) ||
        !Number.isFinite(widthPercent) ||
        !Number.isFinite(heightPercent)
      ) {
        console.warn('Calculated percentages are invalid, skipping update');
        return;
      }

      // Update local state immediately for responsiveness
      const updatedPages = [...pages];
      const panelIndex = currentPage.panels.findIndex((p) => p.id === panelId);
      if (panelIndex >= 0) {
        updatedPages[selectedPageIndex].panels[panelIndex] = {
          ...currentPage.panels[panelIndex],
          x_percent: xPercent,
          y_percent: yPercent,
          width_percent: widthPercent,
          height_percent: heightPercent,
        };
        setPages(updatedPages);
      }

      // Clear guides after position change
      clearGuides();

      // Save to server
      try {
        await collaborationApi.updateComicPanel(panelId, {
          x_percent: xPercent,
          y_percent: yPercent,
          width_percent: widthPercent,
          height_percent: heightPercent,
        });
      } catch (err: any) {
        console.error('Failed to update panel position:', err);
      }
    },
    [pages, selectedPageIndex, currentPage, canEditPanels, canvasDimensions, clearGuides]
  );

  // Artwork upload
  const handleArtworkUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    panelId: number
  ) => {
    if (!canEditPanels || !currentPage) return;
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate
    const validTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      setError('Please upload a PNG, JPG, WebP, or GIF image');
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setError('File size must be under 50MB');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const updatedPanel = await collaborationApi.uploadPanelArtwork(panelId, file);
      // Update local state
      const updatedPages = [...pages];
      const panelIndex = currentPage.panels.findIndex((p) => p.id === panelId);
      if (panelIndex >= 0) {
        updatedPages[selectedPageIndex].panels[panelIndex] = updatedPanel;
        setPages(updatedPages);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to upload artwork');
    } finally {
      setSaving(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Artwork upload for computed panels (line-based editor)
  const handleComputedPanelArtworkUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    computedPanelId: string
  ) => {
    if (!canEditPanels || !currentPage) return;
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file
    const validTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      setError('Please upload a PNG, JPG, WebP, or GIF image');
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setError('File size must be under 50MB');
      return;
    }

    // Find the computed panel
    const computedPanel = computedPanels.find((p) => p.id === computedPanelId);
    if (!computedPanel) {
      setError('Panel region not found');
      return;
    }

    setSaving(true);
    setError('');
    try {
      // First, check if we already have a ComicPanel for this region (by bounding box overlap)
      let targetPanel = currentPage.panels.find((p) => {
        const panelBounds = {
          x: p.x_percent,
          y: p.y_percent,
          width: p.width_percent,
          height: p.height_percent,
        };
        const overlap = calculateBoundsOverlap(computedPanel.bounds, panelBounds);
        return overlap > 0.3; // 30% IoU threshold
      });

      if (!targetPanel) {
        // Create a new ComicPanel for this computed region
        // Round to 2 decimal places to fit within database constraints (max_digits=5)
        targetPanel = await collaborationApi.createComicPanel({
          page: currentPage.id,
          x_percent: Math.round(computedPanel.bounds.x * 100) / 100,
          y_percent: Math.round(computedPanel.bounds.y * 100) / 100,
          width_percent: Math.round(computedPanel.bounds.width * 100) / 100,
          height_percent: Math.round(computedPanel.bounds.height * 100) / 100,
          border_style: 'none',
        });

        // Add to local state
        const updatedPages = [...pages];
        updatedPages[selectedPageIndex].panels.push({
          ...targetPanel,
          speech_bubbles: [],
        });
        setPages(updatedPages);
      }

      // Upload artwork to the panel
      const updatedPanel = await collaborationApi.uploadPanelArtwork(targetPanel.id, file);

      // Update local state
      const updatedPages = [...pages];
      const panelIndex = updatedPages[selectedPageIndex].panels.findIndex((p) => p.id === targetPanel!.id);
      if (panelIndex >= 0) {
        updatedPages[selectedPageIndex].panels[panelIndex] = {
          ...updatedPanel,
          speech_bubbles: updatedPages[selectedPageIndex].panels[panelIndex].speech_bubbles,
        };
      }
      setPages(updatedPages);

      // Update artwork map for immediate display
      const newArtworkMap = new Map(panelArtworkMap);
      newArtworkMap.set(computedPanelId, updatedPanel.artwork || '');
      setPanelArtworkMap(newArtworkMap);
    } catch (err: any) {
      setError(err.message || 'Failed to upload artwork');
    } finally {
      setSaving(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Artwork library drag-and-drop handlers
  const handleArtworkDragStart = useCallback((item: ArtworkLibraryItem) => {
    setDraggingArtworkItem(item);
  }, []);

  const handlePanelDragOver = useCallback((panelId: string, e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setDropTargetPanelId(panelId);
  }, []);

  const handlePanelDragLeave = useCallback(() => {
    setDropTargetPanelId(null);
  }, []);

  const handlePanelDrop = useCallback(
    async (computedPanelId: string, computedPanel: import('../../utils/regionCalculator').ComputedPanel, e: React.DragEvent) => {
      e.preventDefault();
      setDropTargetPanelId(null);
      setDraggingArtworkItem(null);

      if (!canEditPanels || !currentPage) return;

      // Parse drag data
      try {
        const data = JSON.parse(e.dataTransfer.getData('application/json'));
        if (data.type !== 'artwork-library-item') return;

        setSaving(true);
        setError('');

        // Find or create ComicPanel for this computed region
        let targetPanel = currentPage.panels.find((p) => {
          const panelBounds = {
            x: p.x_percent,
            y: p.y_percent,
            width: p.width_percent,
            height: p.height_percent,
          };
          const overlap = calculateBoundsOverlap(computedPanel.bounds, panelBounds);
          return overlap > 0.3;
        });

        // Apply artwork via API
        const result = await collaborationApi.applyArtworkToPanel(data.artworkId, {
          panel_id: targetPanel?.id,
          page_id: targetPanel ? undefined : currentPage.id,
          bounds: targetPanel
            ? undefined
            : {
                x: Math.round(computedPanel.bounds.x * 100) / 100,
                y: Math.round(computedPanel.bounds.y * 100) / 100,
                width: Math.round(computedPanel.bounds.width * 100) / 100,
                height: Math.round(computedPanel.bounds.height * 100) / 100,
              },
        });

        // Update local state
        const updatedPages = [...pages];
        if (targetPanel) {
          const panelIndex = updatedPages[selectedPageIndex].panels.findIndex(
            (p) => p.id === targetPanel!.id
          );
          if (panelIndex >= 0) {
            updatedPages[selectedPageIndex].panels[panelIndex] = {
              ...result,
              speech_bubbles: updatedPages[selectedPageIndex].panels[panelIndex].speech_bubbles,
            };
          }
        } else {
          updatedPages[selectedPageIndex].panels.push({
            ...result,
            speech_bubbles: [],
          });
        }
        setPages(updatedPages);

        // Update artwork map
        const newArtworkMap = new Map(panelArtworkMap);
        newArtworkMap.set(computedPanelId, data.file_url);
        setPanelArtworkMap(newArtworkMap);
      } catch (err: any) {
        setError(err.message || 'Failed to apply artwork');
      } finally {
        setSaving(false);
      }
    },
    [canEditPanels, currentPage, pages, selectedPageIndex, panelArtworkMap]
  );

  // Sync computed panels with existing artwork when panels change
  // Helper: Calculate bounding box overlap (IoU - Intersection over Union)
  const calculateBoundsOverlap = (
    bounds1: { x: number; y: number; width: number; height: number },
    bounds2: { x: number; y: number; width: number; height: number }
  ): number => {
    const x1 = Math.max(bounds1.x, bounds2.x);
    const y1 = Math.max(bounds1.y, bounds2.y);
    const x2 = Math.min(bounds1.x + bounds1.width, bounds2.x + bounds2.width);
    const y2 = Math.min(bounds1.y + bounds1.height, bounds2.y + bounds2.height);

    if (x2 <= x1 || y2 <= y1) return 0; // No overlap

    const intersection = (x2 - x1) * (y2 - y1);
    const area1 = bounds1.width * bounds1.height;
    const area2 = bounds2.width * bounds2.height;
    const union = area1 + area2 - intersection;

    return union > 0 ? intersection / union : 0;
  };

  // Just store computed panels - artwork map is rebuilt separately
  const handlePanelsComputed = useCallback((panels: import('../../utils/regionCalculator').ComputedPanel[]) => {
    setComputedPanels(panels);
  }, []);

  // Rebuild artwork map whenever computed panels or page panels change
  // This ensures the map is always in sync with the data
  useEffect(() => {
    // Skip if no page data
    if (!currentPage) {
      return;
    }

    // Track page changes for debugging
    const pageChanged = lastPageIdRef.current !== currentPage.id;
    if (pageChanged) {
      lastPageIdRef.current = currentPage.id;
    }

    // Check if we're waiting for computed panels
    const hasLines = (currentPage.divider_lines?.length ?? 0) > 0;
    const waitingForComputedPanels = hasLines && computedPanels.length === 0;

    console.log('[ARTWORK] useEffect triggered', {
      currentPageId: currentPage.id,
      pageChanged,
      computedPanelsCount: computedPanels.length,
      panelsWithArtwork: currentPage.panels.filter(p => p.artwork).length,
      waitingForComputedPanels,
    });

    // If we have lines but no computed panels yet, set up a retry
    // This handles the case where page changes before panels are computed
    if (waitingForComputedPanels) {
      console.log('[ARTWORK] Waiting for computedPanels, will retry...');
      const retryTimeout = setTimeout(() => {
        // Force a re-render to trigger this effect again
        setPanelArtworkMap(prev => new Map(prev));
      }, 100);
      return () => clearTimeout(retryTimeout);
    }

    const newArtworkMap = new Map<string, string>();

    // For each panel with artwork, find the best matching computed panel
    for (const panel of currentPage.panels) {
      if (!panel.artwork) continue;

      // Parse bounds as floats - API returns strings like "0.00"
      const panelBounds = {
        x: parseFloat(String(panel.x_percent)) || 0,
        y: parseFloat(String(panel.y_percent)) || 0,
        width: parseFloat(String(panel.width_percent)) || 0,
        height: parseFloat(String(panel.height_percent)) || 0,
      };

      // Find best matching computed panel by IoU (lower threshold 5% for robustness)
      let bestMatch: { id: string; iou: number } | null = null;
      for (const computedPanel of computedPanels) {
        const iou = calculateBoundsOverlap(computedPanel.bounds, panelBounds);
        if (iou > 0.05 && (!bestMatch || iou > bestMatch.iou)) {
          bestMatch = { id: computedPanel.id, iou };
        }
      }

      if (bestMatch) {
        newArtworkMap.set(bestMatch.id, panel.artwork);
        console.log('[ARTWORK] Matched panel', panel.id, 'to computed', bestMatch.id, 'IoU:', bestMatch.iou.toFixed(3));
      } else {
        console.log('[ARTWORK] No match for panel', panel.id, 'bounds:', panelBounds);
      }
    }

    console.log('[ARTWORK] New map built:', Array.from(newArtworkMap.entries()));
    setPanelArtworkMap(newArtworkMap);
  }, [currentPage?.panels, currentPage?.id, currentPage?.divider_lines, computedPanels]);

  // Speech bubble management
  const handleAddBubble = async (panelId: number) => {
    if (!canEditText || !currentPage) return;
    setSaving(true);
    try {
      // Calculate tail default position (below bubble center)
      const bubbleX = 20;
      const bubbleY = 10;
      const bubbleW = 40;
      const bubbleH = 25;
      const tailType = newBubbleType === 'thought' ? 'dots' : 'curved';

      // Set default effects based on style
      const speedLinesEnabled = newBubbleStyle === 'manga' && newBubbleType === 'flash';
      const halftoneShadow = newBubbleStyle === 'western';

      const newBubble = await collaborationApi.createSpeechBubble({
        panel: panelId,
        bubble_type: newBubbleType,
        x_percent: bubbleX,
        y_percent: bubbleY,
        width_percent: bubbleW,
        height_percent: bubbleH,
        text: 'Enter text...',
        // Tail fields - tail points below bubble by default
        tail_end_x_percent: bubbleX + bubbleW / 2,
        tail_end_y_percent: bubbleY + bubbleH + 15, // 15% below bubble
        tail_type: tailType,
        // Style system fields
        bubble_style: newBubbleStyle,
        speed_lines_enabled: speedLinesEnabled,
        halftone_shadow: halftoneShadow,
      });
      // Update local state
      const updatedPages = [...pages];
      const panelIndex = currentPage.panels.findIndex((p) => p.id === panelId);
      if (panelIndex >= 0) {
        updatedPages[selectedPageIndex].panels[panelIndex].speech_bubbles = [
          ...currentPage.panels[panelIndex].speech_bubbles,
          newBubble,
        ];
        setPages(updatedPages);
      }
      setSelectedBubbleId(newBubble.id);
    } catch (err: any) {
      setError(err.message || 'Failed to add speech bubble');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBubble = async (bubbleId: number) => {
    if (!canEditText || !currentPage) return;

    setSaving(true);
    try {
      await collaborationApi.deleteSpeechBubble(bubbleId);
      // Update local state
      const updatedPages = [...pages];
      const panelIndex = currentPage.panels.findIndex((p) =>
        p.speech_bubbles.some((b) => b.id === bubbleId)
      );
      if (panelIndex >= 0) {
        updatedPages[selectedPageIndex].panels[panelIndex].speech_bubbles =
          currentPage.panels[panelIndex].speech_bubbles.filter(
            (b) => b.id !== bubbleId
          );
        setPages(updatedPages);
      }
      setSelectedBubbleId(null);
    } catch (err: any) {
      setError(err.message || 'Failed to delete bubble');
    } finally {
      setSaving(false);
    }
  };

  const handleBubbleTextChange = useCallback(
    async (bubbleId: number, text: string) => {
      if (!canEditText || !currentPage) return;

      // Update local state
      const updatedPages = [...pages];
      for (let i = 0; i < currentPage.panels.length; i++) {
        const bubbleIndex = currentPage.panels[i].speech_bubbles.findIndex(
          (b) => b.id === bubbleId
        );
        if (bubbleIndex >= 0) {
          updatedPages[selectedPageIndex].panels[i].speech_bubbles[bubbleIndex] = {
            ...currentPage.panels[i].speech_bubbles[bubbleIndex],
            text,
          };
          setPages(updatedPages);
          break;
        }
      }

      // Save to server
      try {
        await collaborationApi.updateSpeechBubble(bubbleId, { text });
      } catch (err: any) {
        console.error('Failed to update bubble text:', err);
      }
    },
    [pages, selectedPageIndex, currentPage, canEditText]
  );

  // Bubble position change handler (for dragging/resizing bubbles)
  const handleBubblePositionChange = useCallback(
    async (
      bubbleId: number,
      x: number,
      y: number,
      width: number,
      height: number,
      panelWidth: number,
      panelHeight: number
    ) => {
      if (!canEditText || !currentPage) return;

      // Validate inputs
      if (
        !Number.isFinite(x) || !Number.isFinite(y) ||
        !Number.isFinite(width) || !Number.isFinite(height) ||
        panelWidth <= 0 || panelHeight <= 0
      ) {
        console.warn('Invalid bubble position values');
        return;
      }

      // Convert pixels to percentages relative to panel
      const xPercent = Math.max(0, Math.min(100, Math.round((x / panelWidth) * 10000) / 100));
      const yPercent = Math.max(0, Math.min(100, Math.round((y / panelHeight) * 10000) / 100));
      const widthPercent = Math.max(10, Math.min(100, Math.round((width / panelWidth) * 10000) / 100));
      const heightPercent = Math.max(10, Math.min(100, Math.round((height / panelHeight) * 10000) / 100));

      // Update local state
      const updatedPages = [...pages];
      for (let i = 0; i < currentPage.panels.length; i++) {
        const bubbleIndex = currentPage.panels[i].speech_bubbles.findIndex(
          (b) => b.id === bubbleId
        );
        if (bubbleIndex >= 0) {
          updatedPages[selectedPageIndex].panels[i].speech_bubbles[bubbleIndex] = {
            ...currentPage.panels[i].speech_bubbles[bubbleIndex],
            x_percent: xPercent,
            y_percent: yPercent,
            width_percent: widthPercent,
            height_percent: heightPercent,
          };
          setPages(updatedPages);
          break;
        }
      }

      // Save to server
      try {
        await collaborationApi.updateSpeechBubble(bubbleId, {
          x_percent: xPercent,
          y_percent: yPercent,
          width_percent: widthPercent,
          height_percent: heightPercent,
        });
      } catch (err: any) {
        console.error('Failed to update bubble position:', err);
      }
    },
    [pages, selectedPageIndex, currentPage, canEditText]
  );

  // Canvas-relative bubble move handler (for draggable bubbles)
  const handleBubbleMove = useCallback(
    async (bubbleId: number, panelId: number, xPercent: number, yPercent: number) => {
      if (!canEditText || !currentPage) return;

      // Clamp values to 0-100 and round to 2 decimal places (backend limit)
      const clampedX = Math.round(Math.max(0, Math.min(100, xPercent)) * 100) / 100;
      const clampedY = Math.round(Math.max(0, Math.min(100, yPercent)) * 100) / 100;

      console.log('[BUBBLE] Move - bubbleId:', bubbleId, 'new position:', { xPercent: clampedX, yPercent: clampedY });

      // Update local state
      const updatedPages = [...pages];
      const panelIdx = currentPage.panels.findIndex(p => p.id === panelId);
      if (panelIdx >= 0) {
        const bubbleIdx = currentPage.panels[panelIdx].speech_bubbles.findIndex(b => b.id === bubbleId);
        if (bubbleIdx >= 0) {
          updatedPages[selectedPageIndex].panels[panelIdx].speech_bubbles[bubbleIdx] = {
            ...currentPage.panels[panelIdx].speech_bubbles[bubbleIdx],
            x_percent: clampedX,
            y_percent: clampedY,
          };
          setPages(updatedPages);
        }
      }

      // Save to server
      try {
        const response = await collaborationApi.updateSpeechBubble(bubbleId, {
          x_percent: clampedX,
          y_percent: clampedY,
        });
        console.log('[BUBBLE] Move saved to server:', response);
      } catch (err: any) {
        console.error('[BUBBLE] Failed to update bubble position:', err);
      }
    },
    [pages, selectedPageIndex, currentPage, canEditText]
  );

  // Canvas-relative bubble resize handler
  const handleBubbleResize = useCallback(
    async (bubbleId: number, panelId: number, xPercent: number, yPercent: number, widthPercent: number, heightPercent: number) => {
      if (!canEditText || !currentPage) return;

      // Clamp values and round to 2 decimal places (backend limit)
      const clampedX = Math.round(Math.max(0, Math.min(100, xPercent)) * 100) / 100;
      const clampedY = Math.round(Math.max(0, Math.min(100, yPercent)) * 100) / 100;
      const clampedW = Math.round(Math.max(5, Math.min(100, widthPercent)) * 100) / 100;
      const clampedH = Math.round(Math.max(5, Math.min(100, heightPercent)) * 100) / 100;

      console.log('[BUBBLE] Resize - bubbleId:', bubbleId, 'new bounds:', { x: clampedX, y: clampedY, w: clampedW, h: clampedH });

      // Update local state
      const updatedPages = [...pages];
      const panelIdx = currentPage.panels.findIndex(p => p.id === panelId);
      if (panelIdx >= 0) {
        const bubbleIdx = currentPage.panels[panelIdx].speech_bubbles.findIndex(b => b.id === bubbleId);
        if (bubbleIdx >= 0) {
          updatedPages[selectedPageIndex].panels[panelIdx].speech_bubbles[bubbleIdx] = {
            ...currentPage.panels[panelIdx].speech_bubbles[bubbleIdx],
            x_percent: clampedX,
            y_percent: clampedY,
            width_percent: clampedW,
            height_percent: clampedH,
          };
          setPages(updatedPages);
        }
      }

      // Save to server
      try {
        const response = await collaborationApi.updateSpeechBubble(bubbleId, {
          x_percent: clampedX,
          y_percent: clampedY,
          width_percent: clampedW,
          height_percent: clampedH,
        });
        console.log('[BUBBLE] Resize saved to server:', response);
      } catch (err: any) {
        console.error('[BUBBLE] Failed to update bubble size:', err);
      }
    },
    [pages, selectedPageIndex, currentPage, canEditText]
  );

  // Canvas-relative tail endpoint move handler
  const handleTailMove = useCallback(
    async (bubbleId: number, panelId: number, tailEndXPercent: number, tailEndYPercent: number) => {
      if (!canEditText || !currentPage) return;

      // Allow values outside 0-100 for tails pointing outside the bubble area
      // Round to 2 decimal places for backend
      const roundedX = Math.round(tailEndXPercent * 100) / 100;
      const roundedY = Math.round(tailEndYPercent * 100) / 100;

      console.log('[BUBBLE] Tail move - bubbleId:', bubbleId, 'new tail position:', { x: roundedX, y: roundedY });

      // Update local state
      const updatedPages = [...pages];
      const panelIdx = currentPage.panels.findIndex(p => p.id === panelId);
      if (panelIdx >= 0) {
        const bubbleIdx = currentPage.panels[panelIdx].speech_bubbles.findIndex(b => b.id === bubbleId);
        if (bubbleIdx >= 0) {
          updatedPages[selectedPageIndex].panels[panelIdx].speech_bubbles[bubbleIdx] = {
            ...currentPage.panels[panelIdx].speech_bubbles[bubbleIdx],
            tail_end_x_percent: roundedX,
            tail_end_y_percent: roundedY,
          };
          setPages(updatedPages);
        }
      }

      // Save to server
      try {
        const response = await collaborationApi.updateSpeechBubble(bubbleId, {
          tail_end_x_percent: roundedX,
          tail_end_y_percent: roundedY,
        });
        console.log('[BUBBLE] Tail move saved to server:', response);
      } catch (err: any) {
        console.error('[BUBBLE] Failed to update tail position:', err);
      }
    },
    [pages, selectedPageIndex, currentPage, canEditText]
  );

  // Render loading state
  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: 400,
          color: '#64748b',
        }}
      >
        <Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} />
        <span style={{ marginLeft: 8 }}>Loading comic editor...</span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: 16, height: 'calc(100vh - 140px)', minHeight: 500, padding: '16px 24px', alignItems: 'stretch' }}>
      {/* Left Sidebar - Page Navigator */}
      <div
        style={{
          width: 160,
          minWidth: 160,
          flexShrink: 0,
          background: '#1e293b',
          borderRadius: 12,
          padding: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        {/* Issue Selector */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowIssueDropdown(!showIssueDropdown)}
            style={{
              width: '100%',
              background: '#0f172a',
              border: '1px solid #334155',
              borderRadius: 6,
              padding: '8px 10px',
              color: '#f8fafc',
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 6,
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <BookOpen size={14} style={{ color: '#f59e0b' }} />
              {currentIssue ? currentIssue.title : 'Select Issue'}
            </span>
            <ChevronDown size={14} style={{ color: '#64748b' }} />
          </button>

          {/* Issue Dropdown */}
          {showIssueDropdown && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                background: '#0f172a',
                border: '1px solid #334155',
                borderRadius: 6,
                marginTop: 4,
                zIndex: 100,
                maxHeight: 250,
                overflow: 'auto',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              }}
            >
              {issues.map((issue, index) => (
                <div
                  key={issue.id}
                  style={{
                    background: issue.id === selectedIssueId ? 'rgba(245, 158, 11, 0.15)' : 'transparent',
                    borderBottom: '1px solid #1e293b',
                    padding: '6px 8px',
                  }}
                >
                  {editingIssueId === issue.id ? (
                    /* Editing mode */
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <input
                        type="text"
                        value={editingIssueTitle}
                        onChange={(e) => setEditingIssueTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveIssueTitle();
                          if (e.key === 'Escape') setEditingIssueId(null);
                        }}
                        autoFocus
                        style={{
                          flex: 1,
                          background: '#1e293b',
                          border: '1px solid #f59e0b',
                          borderRadius: 4,
                          padding: '4px 6px',
                          color: '#f8fafc',
                          fontSize: 11,
                          outline: 'none',
                        }}
                      />
                      <button
                        onClick={handleSaveIssueTitle}
                        style={{
                          background: '#22c55e',
                          border: 'none',
                          borderRadius: 4,
                          padding: 4,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                        }}
                      >
                        <Check size={12} color="#fff" />
                      </button>
                    </div>
                  ) : (
                    /* Display mode */
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <button
                        onClick={() => handleSelectIssue(issue.id)}
                        style={{
                          flex: 1,
                          background: 'transparent',
                          border: 'none',
                          padding: '2px 0',
                          color: issue.id === selectedIssueId ? '#f59e0b' : '#f8fafc',
                          fontSize: 11,
                          cursor: 'pointer',
                          textAlign: 'left',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ color: '#64748b', fontSize: 10, minWidth: 18 }}>#{issue.issue_number}</span>
                          <span>{issue.title}</span>
                        </span>
                        <span style={{ color: '#64748b', fontSize: 10 }}>{issue.page_count} pg</span>
                      </button>
                      {canEditPanels && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartEditIssue(issue);
                          }}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            padding: 4,
                            cursor: 'pointer',
                            color: '#64748b',
                            display: 'flex',
                            alignItems: 'center',
                          }}
                          title="Edit issue title"
                        >
                          <Pencil size={12} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {canEditPanels && (
                <button
                  onClick={handleCreateIssue}
                  disabled={creatingIssue}
                  style={{
                    width: '100%',
                    background: '#1e293b',
                    border: 'none',
                    padding: '8px 10px',
                    color: '#22c55e',
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: creatingIssue ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <Plus size={12} />
                  {creatingIssue ? 'Creating...' : 'New Issue'}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Pages Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingBottom: 8,
            borderBottom: '1px solid #334155',
          }}
        >
          <span style={{ color: '#f8fafc', fontWeight: 600, fontSize: 12 }}>
            Pages ({pages.length})
          </span>
          {canEditPanels && (
            <div style={{ display: 'flex', gap: 4 }}>
              {pages.length > 1 && (
                <button
                  onClick={handleDeletePage}
                  style={{
                    background: 'rgba(239, 68, 68, 0.2)',
                    color: '#ef4444',
                    border: 'none',
                    borderRadius: 4,
                    padding: '4px 6px',
                    fontSize: 11,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                  title="Delete current page"
                >
                  <Trash2 size={12} />
                </button>
              )}
              <button
                onClick={handleAddPage}
                disabled={saving}
                style={{
                  background: '#f59e0b',
                  color: '#000',
                  border: 'none',
                  borderRadius: 4,
                  padding: '4px 8px',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <Plus size={12} /> Add
              </button>
            </div>
          )}
        </div>

        <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 6, minHeight: 0 }}>
          {(pages || []).map((page, index) => (
            <div
              key={page.id}
              onClick={() => setSelectedPageIndex(index)}
              style={{
                background:
                  selectedPageIndex === index ? 'rgba(245, 158, 11, 0.15)' : '#0f172a',
                border: `2px solid ${
                  selectedPageIndex === index ? '#f59e0b' : '#334155'
                }`,
                borderRadius: 8,
                padding: 8,
                cursor: 'pointer',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  width: '100%',
                  aspectRatio: '8.5/11',
                  background: '#fff',
                  borderRadius: 4,
                  marginBottom: 4,
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {/* SVG for line-based layouts - shows divider lines AND artwork */}
                {(page.divider_lines || []).length > 0 ? (
                  <svg
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                    }}
                  >
                    {/* For current page, render computed panels with artwork using polygon clipping */}
                    {selectedPageIndex === index && computedPanels.length > 0 && (
                      <>
                        {/* Define clip paths for each computed panel */}
                        <defs>
                          {computedPanels.map((panel) => (
                            <clipPath key={`thumb-clip-${panel.id}`} id={`thumb-clip-${panel.id}`}>
                              <polygon
                                points={panel.vertices.map(v => `${v.x},${v.y}`).join(' ')}
                              />
                            </clipPath>
                          ))}
                        </defs>
                        {/* Render artwork clipped to panel polygons */}
                        {computedPanels.map((panel) => {
                          const artworkUrl = panelArtworkMap.get(panel.id);
                          if (!artworkUrl) return null;
                          return (
                            <image
                              key={`thumb-art-${panel.id}`}
                              href={artworkUrl}
                              x={panel.bounds.x}
                              y={panel.bounds.y}
                              width={panel.bounds.width}
                              height={panel.bounds.height}
                              preserveAspectRatio="xMidYMid slice"
                              clipPath={`url(#thumb-clip-${panel.id})`}
                            />
                          );
                        })}
                      </>
                    )}
                    {/* For non-current pages, render panel artwork from database */}
                    {selectedPageIndex !== index && (page.panels || []).map((panel) => {
                      if (!panel.artwork) return null;
                      return (
                        <image
                          key={`thumb-panel-${panel.id}`}
                          href={panel.artwork}
                          x={panel.x_percent}
                          y={panel.y_percent}
                          width={panel.width_percent}
                          height={panel.height_percent}
                          preserveAspectRatio="xMidYMid slice"
                        />
                      );
                    })}
                    {/* Divider lines on top */}
                    {(page.divider_lines || []).map((line) => (
                      <line
                        key={line.id}
                        x1={line.start_x}
                        y1={line.start_y}
                        x2={line.end_x}
                        y2={line.end_y}
                        stroke={line.color || page.default_line_color || '#6b7280'}
                        strokeWidth={Math.max(0.5, (line.thickness || page.default_gutter_width || 2) * 0.3)}
                        strokeLinecap="round"
                      />
                    ))}
                    {/* Speech bubbles on thumbnails */}
                    {(page.panels || []).flatMap((panel) =>
                      (panel.speech_bubbles || []).map((bubble) => (
                        <g key={`thumb-bubble-${bubble.id}`}>
                          {bubble.bubble_type === 'narrative' || bubble.bubble_type === 'caption' ? (
                            <rect
                              x={Number(bubble.x_percent)}
                              y={Number(bubble.y_percent)}
                              width={Number(bubble.width_percent)}
                              height={Number(bubble.height_percent)}
                              fill={bubble.background_color || '#fff'}
                              stroke={bubble.border_color || '#000'}
                              strokeWidth={0.5}
                              rx={1}
                            />
                          ) : (
                            <ellipse
                              cx={Number(bubble.x_percent) + Number(bubble.width_percent) / 2}
                              cy={Number(bubble.y_percent) + Number(bubble.height_percent) / 2}
                              rx={Number(bubble.width_percent) / 2}
                              ry={Number(bubble.height_percent) / 2}
                              fill={bubble.background_color || '#fff'}
                              stroke={bubble.border_color || '#000'}
                              strokeWidth={0.5}
                            />
                          )}
                        </g>
                      ))
                    )}
                  </svg>
                ) : (
                  /* Legacy panel-based layout - no divider lines */
                  (page.panels || []).map((panel) => (
                    <div
                      key={panel.id}
                      style={{
                        position: 'absolute',
                        left: `${panel.x_percent}%`,
                        top: `${panel.y_percent}%`,
                        width: `${panel.width_percent}%`,
                        height: `${panel.height_percent}%`,
                        border: `${Math.max(1, (panel.border_width || 2) / 2)}px solid ${panel.border_color || '#000000'}`,
                        borderRadius: panel.border_radius || 0,
                        background: panel.artwork ? `url(${panel.artwork}) center/cover` : (panel.background_color || '#ffffff'),
                        transform: `rotate(${panel.rotation || 0}deg) skewX(${panel.skew_x || 0}deg) skewY(${panel.skew_y || 0}deg)`,
                        transformOrigin: 'center center',
                      }}
                    />
                  ))
                )}
              </div>
              <span
                style={{
                  color: selectedPageIndex === index ? '#f59e0b' : '#94a3b8',
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                Page {index + 1}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Main Canvas Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Published Issue Banner */}
        {isCurrentIssuePublished && currentIssue && (
          <div
            style={{
              background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
              color: '#fff',
              padding: '10px 16px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span style={{ fontSize: 16 }}>✓</span>
            {currentIssue.title || `Issue ${currentIssue.issue_number}`} is published and read-only. Content cannot be modified.
          </div>
        )}

        {/* Toolbar */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: '#1e293b',
            borderRadius: 8,
            padding: '8px 12px',
          }}
        >
          <div style={{ display: 'flex', gap: 4 }}>
            {/* Mode tabs */}
            {[
              { mode: 'layout' as EditorMode, icon: Layout, label: 'Layout', enabled: canEditPanels },
              { mode: 'artwork' as EditorMode, icon: Image, label: 'Artwork', enabled: canEditPanels },
              { mode: 'text' as EditorMode, icon: Type, label: 'Text', enabled: canEditText },
            ].map(({ mode: m, icon: Icon, label, enabled }) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                disabled={!enabled}
                style={{
                  background: mode === m ? '#f59e0b' : 'transparent',
                  color: mode === m ? '#000' : enabled ? '#f8fafc' : '#475569',
                  border: 'none',
                  borderRadius: 6,
                  padding: '6px 12px',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: enabled ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  opacity: enabled ? 1 : 0.5,
                }}
              >
                <Icon size={14} /> {label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {/* Save button with status - hidden for published issues */}
            {!isCurrentIssuePublished && (
              <>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  style={{
                    background: saving ? '#475569' : '#10b981',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 6,
                    padding: '6px 12px',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: saving ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    minWidth: 80,
                    justifyContent: 'center',
                  }}
                >
                  {saving ? (
                    <>
                      <Loader2 size={14} className="animate-spin" /> Saving...
                    </>
                  ) : (
                    <>
                      <Save size={14} /> Save
                    </>
                  )}
                </button>
                {lastSaved && (
                  <span style={{ color: '#64748b', fontSize: 10 }}>
                    Saved {lastSaved.toLocaleTimeString()}
                  </span>
                )}
              </>
            )}

            {/* Page navigation */}
            <button
              onClick={() => setSelectedPageIndex(Math.max(0, selectedPageIndex - 1))}
              disabled={selectedPageIndex === 0}
              style={{
                background: 'transparent',
                border: '1px solid #334155',
                borderRadius: 4,
                padding: 4,
                color: '#f8fafc',
                cursor: selectedPageIndex === 0 ? 'not-allowed' : 'pointer',
                opacity: selectedPageIndex === 0 ? 0.5 : 1,
              }}
            >
              <ChevronLeft size={16} />
            </button>
            <span style={{ color: '#94a3b8', fontSize: 12 }}>
              {selectedPageIndex + 1} / {pages.length}
            </span>
            <button
              onClick={() =>
                setSelectedPageIndex(Math.min(pages.length - 1, selectedPageIndex + 1))
              }
              disabled={selectedPageIndex === pages.length - 1}
              style={{
                background: 'transparent',
                border: '1px solid #334155',
                borderRadius: 4,
                padding: 4,
                color: '#f8fafc',
                cursor: selectedPageIndex === pages.length - 1 ? 'not-allowed' : 'pointer',
                opacity: selectedPageIndex === pages.length - 1 ? 0.5 : 1,
              }}
            >
              <ChevronRight size={16} />
            </button>

            {/* Legacy layout mode buttons removed - line-based editor has its own toolbar */}

            {/* Cascading bubble style and type selector for text mode */}
            {mode === 'text' && canEditText && selectedPanelId && (
              <>
                {/* Style selector (Manga/Western) */}
                <select
                  value={newBubbleStyle}
                  onChange={(e) => {
                    const newStyle = e.target.value as BubbleStyle;
                    setNewBubbleStyle(newStyle);
                    // Reset to first available type in new style
                    const typesForStyle = getBubbleTypesForStyle(newStyle);
                    if (!typesForStyle.find(t => t.value === newBubbleType)) {
                      setNewBubbleType(typesForStyle[0].value);
                    }
                  }}
                  style={{
                    background: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: 6,
                    padding: '6px 8px',
                    color: '#f8fafc',
                    fontSize: 12,
                  }}
                >
                  {BUBBLE_STYLES.map((bs) => (
                    <option key={bs.value} value={bs.value}>
                      {bs.label}
                    </option>
                  ))}
                </select>
                {/* Type selector (cascaded based on style) */}
                <select
                  value={newBubbleType}
                  onChange={(e) => setNewBubbleType(e.target.value as BubbleType)}
                  style={{
                    background: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: 6,
                    padding: '6px 8px',
                    color: '#f8fafc',
                    fontSize: 12,
                  }}
                >
                  {getBubbleTypesForStyle(newBubbleStyle).map((bt) => (
                    <option key={bt.value} value={bt.value}>
                      {bt.label}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => handleAddBubble(selectedPanelId)}
                  disabled={saving}
                  style={{
                    background: '#3b82f6',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 6,
                    padding: '6px 12px',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <MessageCircle size={14} /> Add Bubble
                </button>
              </>
            )}

            {saving && (
              <Loader2 size={16} style={{ color: '#f59e0b', animation: 'spin 1s linear infinite' }} />
            )}
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div
            style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid #ef4444',
              color: '#ef4444',
              padding: 8,
              borderRadius: 6,
              fontSize: 12,
            }}
          >
            {error}
            <button
              onClick={() => setError('')}
              style={{
                marginLeft: 8,
                background: 'none',
                border: 'none',
                color: '#ef4444',
                cursor: 'pointer',
              }}
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Canvas Container */}
        <div
          ref={canvasContainerRef}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            background: '#0f172a',
            borderRadius: 8,
            overflow: 'hidden',
            minWidth: 0, // Allow flex item to shrink below content size
            minHeight: 0,
          }}
        >
          {/* Line-based editor for v2 pages (all modes) */}
          {useLineBasedLayout ? (
            <LineBasedEditor
              ref={lineEditorRef}
              lines={currentDividerLines}
              orientation={currentPage?.orientation || 'portrait'}
              gutterMode={currentPage?.gutter_mode ?? true}
              defaultGutterWidth={Number(currentPage?.default_gutter_width) || 0.5}
              defaultLineColor={currentPage?.default_line_color || '#9ca3af'}
              onLineCreate={handleLineCreate}
              onLineUpdate={handleLineUpdate}
              onLineDelete={handleLineDelete}
              onApplyTemplate={handleApplyLineTemplate}
              onOrientationChange={handleOrientationChange}
              onGutterModeChange={handleGutterModeChange}
              onGutterWidthChange={handleGutterWidthChange}
              onLineColorChange={handleLineColorChange}
              canEdit={canEditPanels && mode === 'layout'}
              selectedPanelId={selectedComputedPanelId}
              onPanelSelect={setSelectedComputedPanelId}
              onPanelsComputed={handlePanelsComputed}
              showPanelNumbers={mode === 'layout' || mode === 'artwork'}
              panelArtwork={panelArtworkMap}
              maxCanvasWidth={availableCanvasSpace.width}
              maxCanvasHeight={availableCanvasSpace.height}
              computedPanels={computedPanels}
              dropTargetPanelId={dropTargetPanelId}
              onPanelDragOver={handlePanelDragOver}
              onPanelDragLeave={handlePanelDragLeave}
              onPanelDrop={handlePanelDrop}
            >
              {/* Speech bubble overlay - rendered inside canvas container */}
              {/* Bubbles use canvas-relative positioning (x_percent/y_percent are % of canvas) */}
              {/* Bubbles visible in all modes, but only editable in text mode */}
              {(() => {
                // Use stable canvas size for consistent bubble positioning
                // This prevents position drift when ref is temporarily unavailable
                const displayWidth = stableCanvasSize.width;
                const displayHeight = stableCanvasSize.height;

                // Collect all bubbles from all panels
                const allBubbles = currentPage?.panels.flatMap(panel =>
                  panel.speech_bubbles?.map(bubble => ({ ...bubble, panelId: panel.id })) || []
                ) || [];

                return allBubbles.map((bubble) => {
                  // Position bubble relative to canvas (x_percent/y_percent are 0-100 of canvas)
                  const bubbleX = (bubble.x_percent / 100) * displayWidth;
                  const bubbleY = (bubble.y_percent / 100) * displayHeight;
                  const bubbleW = (bubble.width_percent / 100) * displayWidth;
                  const bubbleH = (bubble.height_percent / 100) * displayHeight;

                  // Calculate bubble center for tail calculations
                  const bubbleCenterX = bubbleX + bubbleW / 2;
                  const bubbleCenterY = bubbleY + bubbleH / 2;

                  // Calculate tail endpoint position in pixels
                  // tail_end values are percentages of the canvas, relative to bubble position
                  const tailEndX = (bubble.tail_end_x_percent / 100) * displayWidth;
                  const tailEndY = (bubble.tail_end_y_percent / 100) * displayHeight;

                  // Use new shape utilities with style
                  const bubbleStyle = bubble.bubble_style || 'manga';
                  const { path: bubblePath, textPadding } = getBubblePath(
                    bubbleW,
                    bubbleH,
                    bubble.bubble_type,
                    bubble.id, // Use bubble ID as seed for consistent rendering
                    bubbleStyle
                  );

                  // Generate speed lines for manga flash bubbles
                  const showSpeedLines = bubble.speed_lines_enabled && bubble.bubble_type === 'flash';
                  const speedLines: SpeedLine[] = showSpeedLines
                    ? getSpeedLines(
                        bubbleW / 2,
                        bubbleH / 2,
                        Math.min(bubbleW, bubbleH) * 0.5, // Start at bubble edge
                        Math.min(bubbleW, bubbleH) * 0.7, // Extend outside
                        32,
                        bubble.id
                      )
                    : [];

                  // Get tail elements (path or dots)
                  const tailType = bubble.tail_type || 'curved';
                  const tailElements = getTailElements(
                    { x: bubbleCenterX, y: bubbleCenterY },
                    bubbleW,
                    bubbleH,
                    tailEndX,
                    tailEndY,
                    tailType as TailType,
                    bubble.bubble_type,
                    bubble.border_width || 2
                  );

                  const isSelected = mode === 'text' && selectedBubbleId === bubble.id;
                  const canInteract = mode === 'text' && canEditText;

                  // Check if this bubble type should have a tail
                  const hasTail = bubble.bubble_type !== 'narrative' && bubble.bubble_type !== 'caption';

                  return (
                    <React.Fragment key={bubble.id}>
                      {/* Main bubble with Rnd for drag/resize */}
                      <Rnd
                        position={{ x: bubbleX, y: bubbleY }}
                        size={{ width: bubbleW, height: bubbleH }}
                        onDragStop={(_e, d) => {
                          const newXPercent = (d.x / displayWidth) * 100;
                          const newYPercent = (d.y / displayHeight) * 100;
                          handleBubbleMove(bubble.id, bubble.panelId, newXPercent, newYPercent);
                        }}
                        onResizeStop={(_e, _direction, ref, _delta, position) => {
                          const newWidth = parseInt(ref.style.width, 10);
                          const newHeight = parseInt(ref.style.height, 10);
                          const newXPercent = (position.x / displayWidth) * 100;
                          const newYPercent = (position.y / displayHeight) * 100;
                          const newWidthPercent = (newWidth / displayWidth) * 100;
                          const newHeightPercent = (newHeight / displayHeight) * 100;
                          handleBubbleResize(bubble.id, bubble.panelId, newXPercent, newYPercent, newWidthPercent, newHeightPercent);
                        }}
                        bounds="parent"
                        enableResizing={canInteract && isSelected}
                        disableDragging={!canInteract}
                        style={{
                          cursor: canInteract ? 'move' : 'default',
                          zIndex: 100 + (bubble.z_index || 0),
                          pointerEvents: mode === 'text' ? 'auto' : 'none',
                        }}
                        onClick={() => canInteract && setSelectedBubbleId(bubble.id)}
                      >
                        <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                          {/* SVG bubble shape with professional rendering */}
                          <svg
                            width="100%"
                            height="100%"
                            viewBox={`0 0 ${bubbleW} ${bubbleH}`}
                            preserveAspectRatio="none"
                            style={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              overflow: 'visible',
                              filter: bubble.halftone_shadow ? 'none' : 'drop-shadow(2px 2px 3px rgba(0,0,0,0.15))',
                            }}
                          >
                            {/* Halftone pattern definition for western style */}
                            <defs>
                              <pattern id={`halftone-${bubble.id}`} width="6" height="6" patternUnits="userSpaceOnUse">
                                <circle cx="3" cy="3" r="1.5" fill="black" fillOpacity="0.35" />
                              </pattern>
                            </defs>

                            {/* Halftone shadow for western comics (rendered first, behind bubble) */}
                            {bubble.halftone_shadow && (
                              <g transform="translate(4, 4)">
                                <path
                                  d={bubblePath}
                                  fill={`url(#halftone-${bubble.id})`}
                                  stroke="none"
                                />
                              </g>
                            )}

                            {/* Speed lines for manga flash (rendered behind main bubble) */}
                            {showSpeedLines && speedLines.map((line, idx) => (
                              <line
                                key={idx}
                                x1={line.x1}
                                y1={line.y1}
                                x2={line.x2}
                                y2={line.y2}
                                stroke={bubble.border_color || '#000'}
                                strokeWidth={1}
                                strokeLinecap="round"
                              />
                            ))}

                            {/* Bubble shape */}
                            <path
                              d={bubblePath}
                              fill={bubble.background_color || '#fff'}
                              stroke={bubble.border_color || '#000'}
                              strokeWidth={bubbleStyle === 'western' ? (bubble.border_width || 2) * 1.2 : (bubble.border_width || 2)}
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeDasharray={bubble.bubble_type === 'whisper' || bubble.bubble_type === 'radio' ? '6,4' : 'none'}
                            />
                          </svg>

                          {/* Selection indicator */}
                          {isSelected && (
                            <div
                              style={{
                                position: 'absolute',
                                inset: -3,
                                border: '2px dashed #3b82f6',
                                borderRadius: bubble.bubble_type === 'narrative' || bubble.bubble_type === 'caption' ? 6 : '50%',
                                pointerEvents: 'none',
                                animation: 'marchingAnts 0.5s linear infinite',
                              }}
                            />
                          )}

                          {/* Text content with dynamic padding */}
                          <div
                            style={{
                              position: 'absolute',
                              top: `${(textPadding.top / bubbleH) * 100}%`,
                              left: `${(textPadding.left / bubbleW) * 100}%`,
                              right: `${(textPadding.right / bubbleW) * 100}%`,
                              bottom: `${(textPadding.bottom / bubbleH) * 100}%`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              overflow: 'hidden',
                            }}
                          >
                            {canInteract && isSelected ? (
                              <textarea
                                value={bubble.text || ''}
                                onChange={(e) => handleBubbleTextChange(bubble.id, e.target.value)}
                                style={{
                                  width: '100%',
                                  height: '100%',
                                  border: 'none',
                                  background: 'transparent',
                                  resize: 'none',
                                  textAlign: (bubble.text_align as any) || 'center',
                                  fontSize: Math.max(10, Math.min(bubbleH * 0.18, 18)),
                                  fontFamily: bubble.font_family || "'Comic Neue', 'Comic Sans MS', cursive",
                                  fontWeight: bubble.bubble_type === 'shout' || bubble.bubble_type === 'burst' ? 'bold' : (bubble.font_weight || 'normal'),
                                  fontStyle: bubble.bubble_type === 'whisper' || bubble.bubble_type === 'narrative' ? 'italic' : (bubble.font_style || 'normal'),
                                  color: bubble.font_color || '#000',
                                  outline: 'none',
                                  lineHeight: 1.3,
                                }}
                                onClick={(e) => e.stopPropagation()}
                              />
                            ) : (
                              <span
                                style={{
                                  fontSize: Math.max(10, Math.min(bubbleH * 0.18, 18)),
                                  fontFamily: bubble.font_family || "'Comic Neue', 'Comic Sans MS', cursive",
                                  fontWeight: bubble.bubble_type === 'shout' || bubble.bubble_type === 'burst' ? 'bold' : (bubble.font_weight || 'normal'),
                                  fontStyle: bubble.bubble_type === 'whisper' || bubble.bubble_type === 'narrative' ? 'italic' : (bubble.font_style || 'normal'),
                                  color: bubble.font_color || '#000',
                                  textAlign: (bubble.text_align as any) || 'center',
                                  wordBreak: 'break-word',
                                  lineHeight: 1.3,
                                  display: 'block',
                                  width: '100%',
                                }}
                              >
                                {bubble.text || 'Enter text...'}
                              </span>
                            )}
                          </div>
                        </div>
                      </Rnd>

                      {/* Tail SVG - rendered separately to allow tail to extend outside bubble bounds */}
                      {hasTail && (
                        <svg
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: displayWidth,
                            height: displayHeight,
                            pointerEvents: 'none',
                            zIndex: 99 + (bubble.z_index || 0),
                            overflow: 'visible',
                          }}
                        >
                          {/* Render bezier tail path */}
                          {tailElements.path && (
                            <path
                              d={tailElements.path}
                              fill={bubble.background_color || '#fff'}
                              stroke={bubble.border_color || '#000'}
                              strokeWidth={bubble.border_width || 2}
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              style={{ filter: 'drop-shadow(1px 1px 2px rgba(0,0,0,0.1))' }}
                            />
                          )}

                          {/* Render thought bubble dots */}
                          {tailElements.dots && tailElements.dots.map((dot: ThoughtDot, idx: number) => (
                            <circle
                              key={idx}
                              cx={dot.x}
                              cy={dot.y}
                              r={dot.radius}
                              fill={bubble.background_color || '#fff'}
                              stroke={bubble.border_color || '#000'}
                              strokeWidth={Math.max(1, (bubble.border_width || 2) * 0.8)}
                              style={{ filter: 'drop-shadow(1px 1px 2px rgba(0,0,0,0.1))' }}
                            />
                          ))}
                        </svg>
                      )}

                      {/* Draggable tail handle - PowerPoint-style yellow circle */}
                      {hasTail && canInteract && isSelected && (
                        <Rnd
                          position={{ x: tailEndX - 8, y: tailEndY - 8 }}
                          size={{ width: 16, height: 16 }}
                          onDragStop={(_e, d) => {
                            const newTailX = ((d.x + 8) / displayWidth) * 100;
                            const newTailY = ((d.y + 8) / displayHeight) * 100;
                            handleTailMove(bubble.id, bubble.panelId, newTailX, newTailY);
                          }}
                          enableResizing={false}
                          bounds="parent"
                          style={{
                            zIndex: 200 + (bubble.z_index || 0),
                            cursor: 'grab',
                          }}
                        >
                          <div
                            style={{
                              width: 16,
                              height: 16,
                              borderRadius: '50%',
                              background: '#fbbf24',
                              border: '2px solid #f59e0b',
                              boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                              cursor: 'grab',
                            }}
                            title="Drag to move tail"
                          />
                        </Rnd>
                      )}
                    </React.Fragment>
                  );
                });
              })()}
            </LineBasedEditor>
          ) : (
            /* Legacy panel-based editor */
            <div
              ref={canvasRef}
              style={{
                width: '100%',
                maxWidth: 550,
                aspectRatio: '8.5 / 11',
                background: '#fff',
                borderRadius: 4,
                position: 'relative',
                overflow: 'visible',
                boxShadow: '0 8px 32px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.2)',
                flexShrink: 0,
                outline: '2px dashed rgba(59, 130, 246, 0.5)',
                outlineOffset: '-2px',
              }}
            >
              {currentPage?.panels.map((panel) => (
                <PanelComponent
                  key={panel.id}
                  panel={panel}
                  isSelected={selectedPanelId === panel.id}
                  isDragging={draggingPanelId === panel.id}
                  canEdit={canEditPanels}
                  canEditText={canEditText}
                  mode={mode}
                  selectedBubbleId={selectedBubbleId}
                  canvasWidth={canvasDimensions.width}
                  canvasHeight={canvasDimensions.height}
                  onSelect={() => {
                    setSelectedPanelId(panel.id);
                    setSelectedBubbleId(null);
                  }}
                  onPositionChange={(x, y, w, h) =>
                    handlePanelPositionChange(panel.id, x, y, w, h)
                  }
                  onDragStart={() => setDraggingPanelId(panel.id)}
                  onDrag={(x, y, w, h) => calculateGuides(panel.id, x, y, w, h)}
                  onDragEnd={clearGuides}
                  onDelete={() => handleDeletePanel(panel.id)}
                  onUploadArtwork={(e) => handleArtworkUpload(e, panel.id)}
                  onSelectBubble={setSelectedBubbleId}
                  onBubbleTextChange={handleBubbleTextChange}
                  onBubblePositionChange={handleBubblePositionChange}
                  onDeleteBubble={handleDeleteBubble}
                />
              ))}

              {/* Smart alignment guides - professional dashed style */}
              {guides.vertical.map((x, i) => (
                <div
                  key={`v-guide-${i}`}
                  style={{
                    position: 'absolute',
                    left: x - 1,
                    top: 0,
                    width: 2,
                    height: '100%',
                    background: 'linear-gradient(to bottom, #f59e0b 50%, transparent 50%)',
                    backgroundSize: '2px 8px',
                    pointerEvents: 'none',
                    zIndex: 9999,
                    boxShadow: '0 0 4px rgba(245, 158, 11, 0.5)',
                  }}
                />
              ))}
              {guides.horizontal.map((y, i) => (
                <div
                  key={`h-guide-${i}`}
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: y - 1,
                    width: '100%',
                    height: 2,
                    background: 'linear-gradient(to right, #f59e0b 50%, transparent 50%)',
                    backgroundSize: '8px 2px',
                    pointerEvents: 'none',
                    zIndex: 9999,
                    boxShadow: '0 0 4px rgba(245, 158, 11, 0.5)',
                  }}
                />
              ))}

              {/* Empty state for legacy editor */}
              {currentPage?.panels.length === 0 && (
                <div
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    textAlign: 'center',
                    color: '#64748b',
                  }}
                >
                  <Layout size={48} style={{ marginBottom: 8, opacity: 0.5 }} />
                  <p style={{ fontSize: 14, margin: 0 }}>
                    {canEditPanels
                      ? 'Click "Add Panel" to start creating your comic!'
                      : 'No panels yet. Waiting for artist to add panels.'}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right Sidebar - Panel Properties */}
      <div
        style={{
          width: 200,
          minWidth: 200,
          flexShrink: 0,
          background: '#1e293b',
          borderRadius: 12,
          padding: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <span style={{ color: '#f8fafc', fontWeight: 600, fontSize: 12 }}>Properties</span>

        {/* Artwork Library Panel - visible in artwork mode */}
        {mode === 'artwork' && (
          <ArtworkLibraryPanel
            projectId={project.id}
            canEdit={canEditPanels}
            onDragStart={handleArtworkDragStart}
            isExpanded={artworkLibraryExpanded}
            onToggle={() => setArtworkLibraryExpanded(!artworkLibraryExpanded)}
          />
        )}

        {/* Computed panel selected (line-based editor) */}
        {useLineBasedLayout && selectedComputedPanelId ? (
          (() => {
            const panelIndex = computedPanels?.findIndex(p => p.id === selectedComputedPanelId) ?? -1;
            const selectedPanel = panelIndex >= 0 ? computedPanels[panelIndex] : null;
            const hasArtwork = panelArtworkMap?.has(selectedComputedPanelId) ?? false;
            const displayIndex = panelIndex >= 0 ? panelIndex + 1 : '?';

            return (
              <>
                <div style={{
                  background: '#0f172a',
                  borderRadius: 8,
                  padding: 12,
                  border: '1px solid #334155',
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 8,
                  }}>
                    <div style={{
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      background: '#f59e0b',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 11,
                      fontWeight: 700,
                      color: '#000',
                    }}>
                      {displayIndex}
                    </div>
                    <span style={{ color: '#f8fafc', fontSize: 13, fontWeight: 600 }}>
                      Panel {displayIndex}
                    </span>
                  </div>

                  {selectedPanel && (
                    <div style={{ fontSize: 11, color: '#64748b' }}>
                      Size: {Math.round(selectedPanel.bounds.width)}% × {Math.round(selectedPanel.bounds.height)}%
                    </div>
                  )}

                  {hasArtwork && (
                    <div style={{
                      marginTop: 8,
                      fontSize: 11,
                      color: '#22c55e',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}>
                      <Image size={12} /> Artwork uploaded
                    </div>
                  )}
                </div>

                {/* Artwork upload for computed panels */}
                {canEditPanels && mode === 'artwork' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        background: hasArtwork ? '#334155' : '#22c55e',
                        color: '#fff',
                        padding: '10px 12px',
                        borderRadius: 6,
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <Upload size={14} /> {hasArtwork ? 'Replace Artwork' : 'Upload Artwork'}
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        onChange={(e) => {
                          if (selectedComputedPanelId) {
                            handleComputedPanelArtworkUpload(e, selectedComputedPanelId);
                          }
                        }}
                        style={{ display: 'none' }}
                      />
                    </label>
                  </div>
                )}

                {mode === 'layout' && (
                  <p style={{ color: '#64748b', fontSize: 11, margin: 0 }}>
                    Switch to <strong style={{ color: '#94a3b8' }}>Artwork</strong> mode to upload images.
                  </p>
                )}

                {mode === 'text' && canEditText && selectedPanel && (() => {
                  // Find the ComicPanel associated with this computed panel
                  const matchingComicPanel = currentPage?.panels.find((p) => {
                    const panelBounds = {
                      x: p.x_percent,
                      y: p.y_percent,
                      width: p.width_percent,
                      height: p.height_percent,
                    };
                    return calculateBoundsOverlap(selectedPanel.bounds, panelBounds) > 0.3;
                  });

                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {/* Bubble type selector */}
                      {/* Style selector */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span style={{ color: '#94a3b8', fontSize: 10, fontWeight: 600 }}>
                          Style
                        </span>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {BUBBLE_STYLES.map((style) => (
                            <button
                              key={style.value}
                              onClick={() => {
                                setNewBubbleStyle(style.value);
                                // Reset type if not available in new style
                                const typesForStyle = getBubbleTypesForStyle(style.value);
                                if (!typesForStyle.find(t => t.value === newBubbleType)) {
                                  setNewBubbleType(typesForStyle[0].value);
                                }
                              }}
                              style={{
                                padding: '4px 10px',
                                borderRadius: 4,
                                fontSize: 10,
                                fontWeight: 600,
                                cursor: 'pointer',
                                border: newBubbleStyle === style.value ? '1px solid #3b82f6' : '1px solid #334155',
                                background: newBubbleStyle === style.value ? 'rgba(59, 130, 246, 0.2)' : '#0f172a',
                                color: newBubbleStyle === style.value ? '#3b82f6' : '#94a3b8',
                              }}
                            >
                              {style.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      {/* Bubble type selector (cascaded based on style) */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span style={{ color: '#94a3b8', fontSize: 10, fontWeight: 600 }}>
                          Bubble Type
                        </span>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {getBubbleTypesForStyle(newBubbleStyle).map((bt) => (
                            <button
                              key={bt.value}
                              onClick={() => setNewBubbleType(bt.value)}
                              style={{
                                padding: '4px 8px',
                                borderRadius: 4,
                                fontSize: 10,
                                fontWeight: 500,
                                cursor: 'pointer',
                                border: newBubbleType === bt.value ? '1px solid #3b82f6' : '1px solid #334155',
                                background: newBubbleType === bt.value ? 'rgba(59, 130, 246, 0.2)' : '#0f172a',
                                color: newBubbleType === bt.value ? '#3b82f6' : '#94a3b8',
                              }}
                            >
                              {bt.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <button
                        onClick={async () => {
                          if (!selectedPanel || !currentPage) return;
                          setSaving(true);
                          try {
                            let targetPanel = matchingComicPanel;
                            if (!targetPanel) {
                              // Create a ComicPanel to hold the speech bubble
                              targetPanel = await collaborationApi.createComicPanel({
                                page: currentPage.id,
                                x_percent: Math.round(selectedPanel.bounds.x * 100) / 100,
                                y_percent: Math.round(selectedPanel.bounds.y * 100) / 100,
                                width_percent: Math.round(selectedPanel.bounds.width * 100) / 100,
                                height_percent: Math.round(selectedPanel.bounds.height * 100) / 100,
                                border_style: 'none',
                              });
                              // Add to local state
                              const updatedPages = [...pages];
                              updatedPages[selectedPageIndex].panels.push({
                                ...targetPanel,
                                speech_bubbles: [],
                              });
                              setPages(updatedPages);
                            }
                            // Now add the speech bubble - positioned at canvas center
                            // x_percent/y_percent are now canvas-relative (0-100 of canvas)
                            // Calculate tail default position (below bubble center)
                            const bubbleX = 35;
                            const bubbleY = 40;
                            const bubbleW = 25;
                            const bubbleH = 15;
                            const tailType = newBubbleType === 'thought' ? 'dots' : 'curved';

                            // Set default effects based on style
                            const speedLinesEnabled = newBubbleStyle === 'manga' && newBubbleType === 'flash';
                            const halftoneShadow = newBubbleStyle === 'western';

                            const newBubble = await collaborationApi.createSpeechBubble({
                              panel: targetPanel.id,
                              bubble_type: newBubbleType,
                              x_percent: bubbleX, // Center-ish on canvas
                              y_percent: bubbleY,
                              width_percent: bubbleW, // 25% of canvas width
                              height_percent: bubbleH, // 15% of canvas height
                              text: 'Enter text...',
                              // Tail fields - tail points below bubble by default
                              tail_end_x_percent: bubbleX + bubbleW / 2,
                              tail_end_y_percent: bubbleY + bubbleH + 12, // 12% below bubble
                              tail_type: tailType,
                              // Style system fields
                              bubble_style: newBubbleStyle,
                              speed_lines_enabled: speedLinesEnabled,
                              halftone_shadow: halftoneShadow,
                            });
                            // Update local state
                            const updatedPages = [...pages];
                            const panelIdx = updatedPages[selectedPageIndex].panels.findIndex(
                              (p) => p.id === targetPanel!.id
                            );
                            if (panelIdx >= 0) {
                              updatedPages[selectedPageIndex].panels[panelIdx].speech_bubbles = [
                                ...updatedPages[selectedPageIndex].panels[panelIdx].speech_bubbles,
                                newBubble,
                              ];
                              setPages(updatedPages);
                            }
                            setSelectedBubbleId(newBubble.id);
                          } catch (err: any) {
                            setError(err.message || 'Failed to add speech bubble');
                          } finally {
                            setSaving(false);
                          }
                        }}
                        disabled={saving}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 8,
                          background: '#3b82f6',
                          color: '#fff',
                          padding: '10px 12px',
                          borderRadius: 6,
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: saving ? 'wait' : 'pointer',
                          border: 'none',
                        }}
                      >
                        <MessageCircle size={14} /> Add Speech Bubble
                      </button>

                      {/* List existing bubbles */}
                      {matchingComicPanel?.speech_bubbles && matchingComicPanel.speech_bubbles.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <span style={{ color: '#94a3b8', fontSize: 10, fontWeight: 600 }}>
                            Bubbles ({matchingComicPanel.speech_bubbles.length})
                          </span>
                          {matchingComicPanel.speech_bubbles.map((bubble, i) => (
                            <div
                              key={bubble.id}
                              onClick={() => setSelectedBubbleId(bubble.id)}
                              style={{
                                background: selectedBubbleId === bubble.id ? 'rgba(59, 130, 246, 0.2)' : '#0f172a',
                                border: `1px solid ${selectedBubbleId === bubble.id ? '#3b82f6' : '#334155'}`,
                                borderRadius: 4,
                                padding: 6,
                                fontSize: 10,
                                color: '#94a3b8',
                                cursor: 'pointer',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                              }}
                            >
                              <span>Bubble {i + 1}</span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteBubble(bubble.id);
                                }}
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  color: '#ef4444',
                                  cursor: 'pointer',
                                  padding: 2,
                                }}
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      <p style={{ color: '#64748b', fontSize: 10, margin: 0 }}>
                        Bubbles will appear in the page preview. Full visual editing coming soon.
                      </p>
                    </div>
                  );
                })()}
              </>
            );
          })()
        ) : selectedPanelId ? (
          <>
            <div style={{ color: '#94a3b8', fontSize: 11 }}>
              Panel #{currentPage?.panels.findIndex((p) => p.id === selectedPanelId)! + 1}
            </div>

            {/* Panel actions */}
            {canEditPanels && mode === 'artwork' && (
              <div>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    background: '#22c55e',
                    color: '#fff',
                    padding: '8px 12px',
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <Upload size={14} /> Upload Artwork
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    onChange={(e) => handleArtworkUpload(e, selectedPanelId)}
                    style={{ display: 'none' }}
                  />
                </label>
              </div>
            )}

            {/* Delete panel */}
            {canEditPanels && (
              <button
                onClick={() => handleDeletePanel(selectedPanelId)}
                style={{
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid #ef4444',
                  color: '#ef4444',
                  padding: '8px 12px',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <Trash2 size={14} /> Delete Panel
              </button>
            )}

            {/* Panel Styling */}
            {canEditPanels && mode === 'layout' && (() => {
              const selectedPanel = currentPage?.panels.find((p) => p.id === selectedPanelId);
              if (!selectedPanel) return null;

              const updatePanelStyle = async (updates: Partial<typeof selectedPanel>) => {
                const updatedPages = [...pages];
                const panelIndex = currentPage?.panels.findIndex((p) => p.id === selectedPanelId);
                if (panelIndex !== undefined && panelIndex >= 0) {
                  updatedPages[selectedPageIndex].panels[panelIndex] = {
                    ...selectedPanel,
                    ...updates,
                  };
                  setPages(updatedPages);
                  try {
                    await collaborationApi.updateComicPanel(selectedPanelId, updates as any);
                  } catch (err) {
                    console.error('Failed to update panel style:', err);
                  }
                }
              };

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
                  <span style={{ color: '#f8fafc', fontWeight: 600, fontSize: 11, borderTop: '1px solid #334155', paddingTop: 12 }}>
                    Panel Styling
                  </span>

                  {/* Border Width */}
                  <div>
                    <label style={{ color: '#94a3b8', fontSize: 10, display: 'block', marginBottom: 4 }}>
                      Border Width: {selectedPanel.border_width}px
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={10}
                      value={selectedPanel.border_width}
                      onChange={(e) => updatePanelStyle({ border_width: parseInt(e.target.value) })}
                      style={{ width: '100%', accentColor: '#f59e0b' }}
                    />
                  </div>

                  {/* Border Color */}
                  <div>
                    <label style={{ color: '#94a3b8', fontSize: 10, display: 'block', marginBottom: 4 }}>
                      Border Color
                    </label>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {['#000000', '#1a1a1a', '#374151', '#1e40af', '#dc2626', '#16a34a', '#ca8a04', '#7c3aed'].map((color) => (
                        <button
                          key={color}
                          onClick={() => updatePanelStyle({ border_color: color })}
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: 4,
                            background: color,
                            border: (selectedPanel.border_color || '#000000') === color
                              ? '2px solid #f59e0b'
                              : '2px solid #475569',
                            cursor: 'pointer',
                          }}
                          title={color}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Skew X */}
                  <div>
                    <label style={{ color: '#94a3b8', fontSize: 10, display: 'block', marginBottom: 4 }}>
                      Skew X: {selectedPanel.skew_x ?? 0}°
                    </label>
                    <input
                      type="range"
                      min={-30}
                      max={30}
                      value={selectedPanel.skew_x ?? 0}
                      onChange={(e) => updatePanelStyle({ skew_x: parseInt(e.target.value) })}
                      style={{ width: '100%', accentColor: '#f59e0b' }}
                    />
                  </div>

                  {/* Skew Y */}
                  <div>
                    <label style={{ color: '#94a3b8', fontSize: 10, display: 'block', marginBottom: 4 }}>
                      Skew Y: {selectedPanel.skew_y ?? 0}°
                    </label>
                    <input
                      type="range"
                      min={-30}
                      max={30}
                      value={selectedPanel.skew_y ?? 0}
                      onChange={(e) => updatePanelStyle({ skew_y: parseInt(e.target.value) })}
                      style={{ width: '100%', accentColor: '#f59e0b' }}
                    />
                  </div>

                  {/* Rotation */}
                  <div>
                    <label style={{ color: '#94a3b8', fontSize: 10, display: 'block', marginBottom: 4 }}>
                      Rotation: {selectedPanel.rotation ?? 0}°
                    </label>
                    <input
                      type="range"
                      min={-45}
                      max={45}
                      value={selectedPanel.rotation ?? 0}
                      onChange={(e) => updatePanelStyle({ rotation: parseInt(e.target.value) })}
                      style={{ width: '100%', accentColor: '#f59e0b' }}
                    />
                  </div>
                </div>
              );
            })()}

            {/* Bubble list */}
            {mode === 'text' && (
              <div style={{ marginTop: 12 }}>
                <span style={{ color: '#f8fafc', fontWeight: 600, fontSize: 11 }}>
                  Speech Bubbles
                </span>
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {currentPage?.panels
                    .find((p) => p.id === selectedPanelId)
                    ?.speech_bubbles.map((bubble, i) => (
                      <div
                        key={bubble.id}
                        onClick={() => setSelectedBubbleId(bubble.id)}
                        style={{
                          background:
                            selectedBubbleId === bubble.id
                              ? 'rgba(59, 130, 246, 0.2)'
                              : '#0f172a',
                          border: `1px solid ${
                            selectedBubbleId === bubble.id ? '#3b82f6' : '#334155'
                          }`,
                          borderRadius: 6,
                          padding: 8,
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <span style={{ color: '#f8fafc', fontSize: 11 }}>
                          {bubble.bubble_type} #{i + 1}
                        </span>
                        {canEditText && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteBubble(bubble.id);
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#ef4444',
                              cursor: 'pointer',
                              padding: 2,
                            }}
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div style={{ color: '#64748b', fontSize: 11 }}>
            Select a panel to view properties
          </div>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        style={{ display: 'none' }}
      />

      {/* Templates Modal */}
      {showTemplates && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
          }}
          onClick={() => setShowTemplates(false)}
        >
          <div
            style={{
              background: '#1e293b',
              borderRadius: 12,
              padding: 24,
              maxWidth: 600,
              width: '90%',
              maxHeight: '80vh',
              overflow: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 20,
              }}
            >
              <h3 style={{ color: '#f8fafc', margin: 0, fontSize: 18, fontWeight: 600 }}>
                Choose a Layout Template
              </h3>
              <button
                onClick={() => setShowTemplates(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: 4,
                }}
              >
                <X size={20} />
              </button>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 12,
              }}
            >
              {PANEL_TEMPLATES.map((template) => (
                <button
                  key={template.id}
                  onClick={() => applyTemplate(template)}
                  disabled={saving}
                  style={{
                    background: '#0f172a',
                    border: '2px solid #334155',
                    borderRadius: 8,
                    padding: 12,
                    cursor: 'pointer',
                    transition: 'border-color 0.2s, transform 0.2s',
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.borderColor = '#f59e0b';
                    e.currentTarget.style.transform = 'scale(1.02)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.borderColor = '#334155';
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                >
                  {/* Template preview */}
                  <div
                    style={{
                      width: '100%',
                      aspectRatio: '8.5/11',
                      background: '#fff',
                      borderRadius: 4,
                      marginBottom: 8,
                      position: 'relative',
                      overflow: 'hidden',
                    }}
                  >
                    {template.panels.map((p, i) => (
                      <div
                        key={i}
                        style={{
                          position: 'absolute',
                          left: `${p.x}%`,
                          top: `${p.y}%`,
                          width: `${p.w}%`,
                          height: `${p.h}%`,
                          border: '1px solid #000',
                          background: '#f1f5f9',
                          transform: `skewX(${p.skewX || 0}deg) skewY(${p.skewY || 0}deg)`,
                          transformOrigin: 'center center',
                        }}
                      />
                    ))}
                  </div>
                  <span
                    style={{
                      color: '#f8fafc',
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  >
                    {template.name}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Panel subcomponent
interface PanelComponentProps {
  panel: ComicPanel;
  isSelected: boolean;
  isDragging: boolean;
  canEdit: boolean;
  canEditText: boolean;
  mode: EditorMode;
  selectedBubbleId: number | null;
  canvasWidth: number;
  canvasHeight: number;
  onSelect: () => void;
  onPositionChange: (x: number, y: number, width: number, height: number) => void;
  onDragStart: () => void;
  onDrag: (x: number, y: number, width: number, height: number) => void;
  onDragEnd: () => void;
  onDelete: () => void;
  onUploadArtwork: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSelectBubble: (id: number) => void;
  onBubbleTextChange: (id: number, text: string) => void;
  onBubblePositionChange: (bubbleId: number, x: number, y: number, width: number, height: number, panelWidth: number, panelHeight: number) => void;
  onDeleteBubble: (id: number) => void;
}

function PanelComponent({
  panel,
  isSelected,
  isDragging,
  canEdit,
  canEditText,
  mode,
  selectedBubbleId,
  canvasWidth,
  canvasHeight,
  onSelect,
  onPositionChange,
  onDragStart,
  onDrag,
  onDragEnd,
  onDelete,
  onUploadArtwork,
  onSelectBubble,
  onBubbleTextChange,
  onBubblePositionChange,
  onDeleteBubble,
}: PanelComponentProps) {
  const parentRef = useRef<HTMLDivElement | null>(null);

  // Track panel dimensions for bubble positioning
  const [panelDimensions, setPanelDimensions] = useState({ width: 0, height: 0 });

  // Store stable canvas dimensions - only update when they actually change significantly
  const [stableCanvasDimensions, setStableCanvasDimensions] = useState({ width: 0, height: 0 });
  const stableDimensionsRef = useRef(stableCanvasDimensions);
  stableDimensionsRef.current = stableCanvasDimensions;

  // Only update stable dimensions when canvas dimensions change significantly (more than 5px)
  // This prevents micro-adjustments from causing panel jumps
  useEffect(() => {
    if (canvasWidth > 0 && canvasHeight > 0) {
      const current = stableDimensionsRef.current;
      const widthDiff = Math.abs(canvasWidth - current.width);
      const heightDiff = Math.abs(canvasHeight - current.height);
      // Only update if dimensions changed significantly (>5px) or first initialization
      if (current.width === 0 || widthDiff > 5 || heightDiff > 5) {
        setStableCanvasDimensions({ width: canvasWidth, height: canvasHeight });
      }
    }
  }, [canvasWidth, canvasHeight]);

  // Use stable dimensions for all calculations (with fallback for initial render)
  const effectiveCanvasWidth = stableCanvasDimensions.width || canvasWidth || 550;
  const effectiveCanvasHeight = stableCanvasDimensions.height || canvasHeight || 712;

  const pixelX = (panel.x_percent / 100) * effectiveCanvasWidth;
  const pixelY = (panel.y_percent / 100) * effectiveCanvasHeight;
  const pixelWidth = (panel.width_percent / 100) * effectiveCanvasWidth;
  const pixelHeight = (panel.height_percent / 100) * effectiveCanvasHeight;

  // Update panel dimensions when panel size changes
  useEffect(() => {
    if (parentRef.current) {
      const rect = parentRef.current.getBoundingClientRect();
      setPanelDimensions({ width: rect.width, height: rect.height });
    }
  }, [pixelWidth, pixelHeight]);

  // Grid size for snapping (5% of canvas)
  const gridX = effectiveCanvasWidth * 0.05;
  const gridY = effectiveCanvasHeight * 0.05;

  return (
    <Rnd
      position={{
        x: pixelX,
        y: pixelY,
      }}
      size={{
        width: pixelWidth,
        height: pixelHeight,
      }}
      style={{
        position: 'absolute',
        zIndex: panel.z_index + (isSelected ? 100 : 0),
        transition: isDragging ? 'none' : 'box-shadow 0.2s ease-out',
      }}
      // Allow off-page positioning - no bounds constraint
      dragGrid={[gridX, gridY]}
      resizeGrid={[gridX, gridY]}
      minWidth={effectiveCanvasWidth * 0.1}
      minHeight={effectiveCanvasHeight * 0.1}
      disableDragging={!canEdit || mode !== 'layout'}
      enableResizing={canEdit && mode === 'layout'}
      onDragStart={() => {
        onDragStart();
      }}
      onDrag={(e, d) => {
        // Calculate width and height for guide calculation
        onDrag(d.x, d.y, pixelWidth, pixelHeight);
      }}
      onDragStop={(e, d) => {
        onDragEnd();
        onPositionChange(d.x, d.y, pixelWidth, pixelHeight);
      }}
      onResizeStop={(e, direction, ref, delta, position) => {
        onDragEnd();
        onPositionChange(position.x, position.y, ref.offsetWidth, ref.offsetHeight);
      }}
      onClick={(e: React.MouseEvent) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      <div
        ref={parentRef}
        style={{
          width: '100%',
          height: '100%',
          border: `${panel.border_width || 2}px ${panel.border_style === 'none' ? 'none' : (panel.border_style || 'solid')} ${panel.border_color || '#000000'}`,
          borderRadius: panel.border_radius || 0,
          background: panel.background_color || '#ffffff',
          position: 'relative',
          overflow: 'hidden',
          // Professional shadow styling with colored selection outline
          boxShadow: isDragging
            ? '0 25px 50px rgba(0,0,0,0.35), 0 12px 24px rgba(0,0,0,0.25), 0 0 0 3px #f59e0b, inset 0 0 0 1px rgba(255,255,255,0.1)'
            : isSelected
              ? '0 4px 12px rgba(0,0,0,0.15), 0 0 0 3px #f59e0b'
              : '0 2px 8px rgba(0,0,0,0.1), 0 1px 3px rgba(0,0,0,0.08)',
          cursor: mode === 'layout' && canEdit ? 'move' : 'default',
          transform: `rotate(${panel.rotation || 0}deg) skewX(${panel.skew_x || 0}deg) skewY(${panel.skew_y || 0}deg)${isDragging ? ' scale(1.02)' : ''}`,
          transformOrigin: 'center center',
          transition: isDragging ? 'none' : 'box-shadow 0.25s cubic-bezier(0.4, 0, 0.2, 1), transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {/* Artwork */}
        {panel.artwork && (
          <img
            src={panel.artwork}
            alt=""
            style={{
              width: '100%',
              height: '100%',
              objectFit: panel.artwork_fit,
              pointerEvents: 'none',
            }}
          />
        )}

        {/* Upload prompt when no artwork */}
        {!panel.artwork && mode === 'artwork' && canEdit && (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center',
              color: '#64748b',
              pointerEvents: 'none',
            }}
          >
            <Upload size={24} style={{ opacity: 0.5 }} />
            <p style={{ fontSize: 10, margin: '4px 0 0' }}>Upload artwork</p>
          </div>
        )}

        {/* Speech bubbles */}
        {panel.speech_bubbles.map((bubble) => (
          <BubbleComponent
            key={bubble.id}
            bubble={bubble}
            isSelected={selectedBubbleId === bubble.id}
            canEdit={canEditText && mode === 'text'}
            panelWidth={panelDimensions.width}
            panelHeight={panelDimensions.height}
            onSelect={() => onSelectBubble(bubble.id)}
            onTextChange={(text) => onBubbleTextChange(bubble.id, text)}
            onPositionChange={(x, y, w, h) =>
              onBubblePositionChange(bubble.id, x, y, w, h, panelDimensions.width, panelDimensions.height)
            }
          />
        ))}
      </div>
    </Rnd>
  );
}

// Bubble subcomponent
interface BubbleComponentProps {
  bubble: SpeechBubble;
  isSelected: boolean;
  canEdit: boolean;
  panelWidth: number;
  panelHeight: number;
  onSelect: () => void;
  onTextChange: (text: string) => void;
  onPositionChange: (x: number, y: number, width: number, height: number) => void;
}

function BubbleComponent({
  bubble,
  isSelected,
  canEdit,
  panelWidth,
  panelHeight,
  onSelect,
  onTextChange,
  onPositionChange,
}: BubbleComponentProps) {
  // Generate bubble shape SVG path
  const getBubblePath = (w: number, h: number): string => {
    const cx = w / 2;
    const cy = h / 2;
    const rx = w / 2 - 2;
    const ry = h / 2 - 10;

    switch (bubble.bubble_type) {
      case 'thought':
        // Cloud-like bumpy path
        return `M ${cx} ${h * 0.15}
          Q ${w * 0.8} ${h * 0.1}, ${w * 0.85} ${h * 0.35}
          Q ${w * 0.95} ${h * 0.5}, ${w * 0.85} ${h * 0.65}
          Q ${w * 0.8} ${h * 0.9}, ${cx} ${h * 0.85}
          Q ${w * 0.2} ${h * 0.9}, ${w * 0.15} ${h * 0.65}
          Q ${w * 0.05} ${h * 0.5}, ${w * 0.15} ${h * 0.35}
          Q ${w * 0.2} ${h * 0.1}, ${cx} ${h * 0.15}
          Z`;
      case 'shout':
        // Jagged explosion path
        const points = 12;
        let path = '';
        for (let i = 0; i < points; i++) {
          const angle = (i / points) * Math.PI * 2;
          const r = i % 2 === 0 ? Math.min(rx, ry) * 0.7 : Math.min(rx, ry) * 1.0;
          const x = cx + Math.cos(angle) * r;
          const y = cy + Math.sin(angle) * r;
          path += (i === 0 ? 'M' : 'L') + ` ${x} ${y} `;
        }
        return path + 'Z';
      case 'narrative':
      case 'caption':
        // Rectangle
        return `M 2 2 L ${w - 2} 2 L ${w - 2} ${h - 2} L 2 ${h - 2} Z`;
      case 'whisper':
      default:
        // Oval
        return `M ${cx} ${cy - ry}
          A ${rx} ${ry} 0 1 1 ${cx} ${cy + ry}
          A ${rx} ${ry} 0 1 1 ${cx} ${cy - ry}`;
    }
  };

  // Convert percentages to pixels for Rnd positioning
  const hasValidDimensions = panelWidth > 0 && panelHeight > 0;
  const effectivePanelWidth = hasValidDimensions ? panelWidth : 200;
  const effectivePanelHeight = hasValidDimensions ? panelHeight : 200;

  const pixelX = (bubble.x_percent / 100) * effectivePanelWidth;
  const pixelY = (bubble.y_percent / 100) * effectivePanelHeight;
  const pixelWidth = (bubble.width_percent / 100) * effectivePanelWidth;
  const pixelHeight = (bubble.height_percent / 100) * effectivePanelHeight;

  return (
    <Rnd
      position={{ x: pixelX, y: pixelY }}
      size={{ width: pixelWidth, height: pixelHeight }}
      bounds="parent"
      disableDragging={!canEdit}
      enableResizing={canEdit}
      minWidth={30}
      minHeight={20}
      style={{
        zIndex: bubble.z_index + (isSelected ? 50 : 0),
      }}
      onDragStop={(e, d) => {
        onPositionChange(d.x, d.y, pixelWidth, pixelHeight);
      }}
      onResizeStop={(e, direction, ref, delta, position) => {
        onPositionChange(position.x, position.y, ref.offsetWidth, ref.offsetHeight);
      }}
      onClick={(e: React.MouseEvent) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          cursor: canEdit ? 'move' : 'default',
          outline: isSelected ? '2px solid #3b82f6' : 'none',
          borderRadius: 4,
        }}
      >
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 100 60`}
        preserveAspectRatio="none"
        style={{ position: 'absolute', top: 0, left: 0 }}
      >
        <path
          d={getBubblePath(100, 60)}
          fill={bubble.background_color}
          stroke={bubble.border_color}
          strokeWidth={bubble.border_width}
          strokeDasharray={bubble.bubble_type === 'whisper' ? '3,3' : 'none'}
        />
        {/* Pointer tail */}
        {bubble.pointer_direction !== 'none' && bubble.bubble_type !== 'narrative' && (
          <polygon
            points={
              bubble.pointer_direction === 'bottom'
                ? `${40 + bubble.pointer_position * 0.2},55 50,75 ${60 - bubble.pointer_position * 0.2},55`
                : bubble.pointer_direction === 'left'
                ? `5,25 -10,30 5,35`
                : bubble.pointer_direction === 'right'
                ? `95,25 110,30 95,35`
                : `${40 + bubble.pointer_position * 0.2},5 50,-15 ${60 - bubble.pointer_position * 0.2},5`
            }
            fill={bubble.background_color}
            stroke={bubble.border_color}
            strokeWidth={bubble.border_width}
          />
        )}
      </svg>

      {/* Text content */}
      <div
        style={{
          position: 'absolute',
          top: '10%',
          left: '10%',
          width: '80%',
          height: '80%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {canEdit && isSelected ? (
          <textarea
            value={bubble.text}
            onChange={(e) => onTextChange(e.target.value)}
            style={{
              width: '100%',
              height: '100%',
              fontFamily: bubble.font_family,
              fontSize: Math.min(bubble.font_size, 14),
              color: bubble.font_color,
              fontWeight: bubble.font_weight,
              fontStyle: bubble.font_style,
              textAlign: bubble.text_align as any,
              background: 'transparent',
              border: 'none',
              resize: 'none',
              outline: 'none',
              overflow: 'hidden',
            }}
          />
        ) : (
          <span
            style={{
              fontFamily: bubble.font_family,
              fontSize: Math.min(bubble.font_size, 14),
              color: bubble.font_color,
              fontWeight: bubble.font_weight,
              fontStyle: bubble.font_style,
              textAlign: bubble.text_align as any,
              wordBreak: 'break-word',
              overflow: 'hidden',
            }}
          >
            {bubble.text}
          </span>
        )}
      </div>
      </div>
    </Rnd>
  );
}
