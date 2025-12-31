/**
 * Tests for the region calculator - panel computation from divider lines.
 */
import { describe, it, expect } from 'vitest';
import { computePanelRegions, DividerLine } from '../regionCalculator';
import { findLineIntersection, findInfiniteLineSegmentIntersection } from '../geometry';

// Test page dimensions (in pixels, similar to actual canvas)
const PAGE_WIDTH = 480;
const PAGE_HEIGHT = 620;

describe('Line Intersection Functions', () => {
  describe('findLineIntersection (segment-segment)', () => {
    it('should find intersection of two crossing segments', () => {
      const line1 = { start: { x: 0, y: 50 }, end: { x: 100, y: 50 } };
      const line2 = { start: { x: 50, y: 0 }, end: { x: 50, y: 100 } };
      const intersection = findLineIntersection(line1, line2);
      expect(intersection).not.toBeNull();
      expect(intersection?.x).toBeCloseTo(50);
      expect(intersection?.y).toBeCloseTo(50);
    });

    it('should return null for parallel lines', () => {
      const line1 = { start: { x: 0, y: 0 }, end: { x: 100, y: 0 } };
      const line2 = { start: { x: 0, y: 50 }, end: { x: 100, y: 50 } };
      const intersection = findLineIntersection(line1, line2);
      expect(intersection).toBeNull();
    });

    it('should return null if segments dont actually cross', () => {
      // Lines would cross if extended, but segments don't touch
      const line1 = { start: { x: 0, y: 0 }, end: { x: 40, y: 0 } };
      const line2 = { start: { x: 50, y: -10 }, end: { x: 50, y: 10 } };
      const intersection = findLineIntersection(line1, line2);
      expect(intersection).toBeNull();
    });

    it('should find intersection at segment endpoint', () => {
      const line1 = { start: { x: 0, y: 50 }, end: { x: 50, y: 50 } };
      const line2 = { start: { x: 50, y: 50 }, end: { x: 50, y: 100 } };
      const intersection = findLineIntersection(line1, line2);
      // Should find at t=1 for line1, t=0 for line2
      expect(intersection).not.toBeNull();
      expect(intersection?.x).toBeCloseTo(50);
      expect(intersection?.y).toBeCloseTo(50);
    });
  });

  describe('findInfiniteLineSegmentIntersection', () => {
    it('should find intersection even when infinite line is outside segment bounds', () => {
      // Line segment from (0,50) to (50,50) - only goes halfway
      // But as infinite line, it extends to x=100
      const infiniteLine = { start: { x: 0, y: 50 }, end: { x: 50, y: 50 } };
      const segment = { start: { x: 75, y: 0 }, end: { x: 75, y: 100 } };
      const intersection = findInfiniteLineSegmentIntersection(infiniteLine, segment);
      // The infinite line at y=50 should cross the segment at x=75
      expect(intersection).not.toBeNull();
      expect(intersection?.x).toBeCloseTo(75);
      expect(intersection?.y).toBeCloseTo(50);
    });
  });
});

describe('computePanelRegions', () => {
  describe('No lines', () => {
    it('should return 1 full-page panel when no lines exist', () => {
      const lines: DividerLine[] = [];
      const panels = computePanelRegions(lines, PAGE_WIDTH, PAGE_HEIGHT);

      expect(panels).toHaveLength(1);
      expect(panels[0].id).toBe('full-page');
      expect(panels[0].bounds.width).toBe(PAGE_WIDTH);
      expect(panels[0].bounds.height).toBe(PAGE_HEIGHT);
    });
  });

  describe('Single horizontal line', () => {
    it('should create 2 panels from a horizontal line across the page', () => {
      // Line at 50% height, from left edge (0%) to right edge (100%)
      const lines: DividerLine[] = [
        {
          id: 1,
          line_type: 'straight',
          start_x: 0,    // Left edge
          start_y: 50,   // Middle height
          end_x: 100,    // Right edge
          end_y: 50,     // Middle height
        },
      ];

      const panels = computePanelRegions(lines, PAGE_WIDTH, PAGE_HEIGHT);

      expect(panels).toHaveLength(2);

      // Top panel should be roughly top half
      const topPanel = panels.find(p => p.centroid.y < PAGE_HEIGHT / 2);
      expect(topPanel).toBeDefined();

      // Bottom panel should be roughly bottom half
      const bottomPanel = panels.find(p => p.centroid.y > PAGE_HEIGHT / 2);
      expect(bottomPanel).toBeDefined();
    });
  });

  describe('Single vertical line', () => {
    it('should create 2 panels from a vertical line down the page', () => {
      // Line at 50% width, from top edge to bottom edge
      const lines: DividerLine[] = [
        {
          id: 1,
          line_type: 'straight',
          start_x: 50,   // Middle width
          start_y: 0,    // Top edge
          end_x: 50,     // Middle width
          end_y: 100,    // Bottom edge
        },
      ];

      const panels = computePanelRegions(lines, PAGE_WIDTH, PAGE_HEIGHT);

      expect(panels).toHaveLength(2);

      // Left panel
      const leftPanel = panels.find(p => p.centroid.x < PAGE_WIDTH / 2);
      expect(leftPanel).toBeDefined();

      // Right panel
      const rightPanel = panels.find(p => p.centroid.x > PAGE_WIDTH / 2);
      expect(rightPanel).toBeDefined();
    });
  });

  describe('Cross pattern (2 crossing lines)', () => {
    it('should create 4 panels from crossing horizontal and vertical lines', () => {
      const lines: DividerLine[] = [
        {
          id: 1,
          line_type: 'straight',
          start_x: 0,
          start_y: 50,
          end_x: 100,
          end_y: 50,
        },
        {
          id: 2,
          line_type: 'straight',
          start_x: 50,
          start_y: 0,
          end_x: 50,
          end_y: 100,
        },
      ];

      const panels = computePanelRegions(lines, PAGE_WIDTH, PAGE_HEIGHT);

      expect(panels).toHaveLength(4);
    });
  });

  describe('T-junction (line starting from another line)', () => {
    it('should create 3 panels when second line starts from first line', () => {
      // This is the key test case that was failing!
      // Line 1: Horizontal line at 30% from top, edge to edge
      // Line 2: Starts FROM Line 1 (at 50%, 30%) and goes to bottom-right corner

      const lines: DividerLine[] = [
        {
          id: 1,
          line_type: 'straight',
          start_x: 0,    // Left edge
          start_y: 30,   // 30% from top
          end_x: 100,    // Right edge
          end_y: 30,     // 30% from top
        },
        {
          id: 2,
          line_type: 'straight',
          start_x: 50,   // Middle of page (on Line 1)
          start_y: 30,   // ON Line 1
          end_x: 100,    // Right edge
          end_y: 100,    // Bottom edge
        },
      ];

      const panels = computePanelRegions(lines, PAGE_WIDTH, PAGE_HEIGHT);

      // Should have exactly 3 panels:
      // 1. Top region (above Line 1)
      // 2. Bottom-left region (below Line 1, left of Line 2)
      // 3. Bottom-right region (below Line 1, right of Line 2)
      expect(panels).toHaveLength(3);
    });

    it('should create 3 panels - variant with diagonal starting from horizontal', () => {
      // Similar to above but with different coordinates
      const lines: DividerLine[] = [
        {
          id: 1,
          line_type: 'straight',
          start_x: 0,
          start_y: 25,   // Near top
          end_x: 100,
          end_y: 25,
        },
        {
          id: 2,
          line_type: 'straight',
          start_x: 40,   // Start on Line 1
          start_y: 25,   // ON Line 1
          end_x: 80,     // Go toward bottom-right
          end_y: 100,
        },
      ];

      const panels = computePanelRegions(lines, PAGE_WIDTH, PAGE_HEIGHT);
      expect(panels).toHaveLength(3);
    });
  });

  describe('Diagonal line', () => {
    it('should create 2 panels from a diagonal line corner to corner', () => {
      const lines: DividerLine[] = [
        {
          id: 1,
          line_type: 'straight',
          start_x: 0,
          start_y: 0,
          end_x: 100,
          end_y: 100,
        },
      ];

      const panels = computePanelRegions(lines, PAGE_WIDTH, PAGE_HEIGHT);
      expect(panels).toHaveLength(2);
    });
  });

  describe('Line not reaching edges', () => {
    it('should NOT split if line doesnt reach polygon boundaries', () => {
      // A short line in the middle that doesn't touch any edge
      const lines: DividerLine[] = [
        {
          id: 1,
          line_type: 'straight',
          start_x: 40,
          start_y: 40,
          end_x: 60,
          end_y: 60,
        },
      ];

      const panels = computePanelRegions(lines, PAGE_WIDTH, PAGE_HEIGHT);
      // Should still be 1 panel since line doesn't cross boundaries
      expect(panels).toHaveLength(1);
    });
  });

  describe('Three-way split', () => {
    it('should handle 3 lines creating multiple regions', () => {
      // Grid pattern: 1 horizontal + 2 vertical = 6 panels
      const lines: DividerLine[] = [
        {
          id: 1,
          line_type: 'straight',
          start_x: 0,
          start_y: 50,
          end_x: 100,
          end_y: 50,
        },
        {
          id: 2,
          line_type: 'straight',
          start_x: 33,
          start_y: 0,
          end_x: 33,
          end_y: 100,
        },
        {
          id: 3,
          line_type: 'straight',
          start_x: 66,
          start_y: 0,
          end_x: 66,
          end_y: 100,
        },
      ];

      const panels = computePanelRegions(lines, PAGE_WIDTH, PAGE_HEIGHT);
      expect(panels).toHaveLength(6);
    });
  });
});

describe('Complex multi-line patterns', () => {
  it('should handle lines that nearly touch (within tolerance)', () => {
    // Line 1: horizontal at 30%
    // Line 2: starts NEAR Line 1 (not exactly on it) and goes down
    // This simulates drawing imprecision
    const lines: DividerLine[] = [
      {
        id: 1,
        line_type: 'straight',
        start_x: 0,
        start_y: 30,
        end_x: 100,
        end_y: 30,
      },
      {
        id: 2,
        line_type: 'straight',
        start_x: 50,
        start_y: 30.5, // Slightly off from Line 1 (drawing imprecision)
        end_x: 100,
        end_y: 100,
      },
    ];

    const panels = computePanelRegions(lines, PAGE_WIDTH, PAGE_HEIGHT);
    // Should still create 3 panels despite the small gap
    expect(panels).toHaveLength(3);
  });

  it('should handle multiple intersecting lines creating multiple regions', () => {
    // Realistic manga-style layout with properly connected lines
    // All lines go edge-to-edge or edge-to-other-line
    const lines: DividerLine[] = [
      // Line 1: horizontal across the page at 35%
      {
        id: 1,
        line_type: 'straight',
        start_x: 0,
        start_y: 35,
        end_x: 100,
        end_y: 35,
      },
      // Line 2: vertical from Line 1 down to bottom at 40%
      {
        id: 2,
        line_type: 'straight',
        start_x: 40,
        start_y: 35, // Starts ON Line 1
        end_x: 40,
        end_y: 100,
      },
      // Line 3: horizontal from Line 2 to right edge at 65%
      {
        id: 3,
        line_type: 'straight',
        start_x: 40, // Starts ON Line 2
        start_y: 65,
        end_x: 100,
        end_y: 65,
      },
    ];

    const panels = computePanelRegions(lines, PAGE_WIDTH, PAGE_HEIGHT);
    // With 3 properly connected lines creating a T + horizontal pattern:
    // 1. Top region (above Line 1)
    // 2. Middle-left (between Line 1, Line 2, Line 3)
    // 3. Middle-right-top (between Line 1, right edge, Line 3)
    // 4. Bottom-left (between Line 2, bottom edge)
    // 5. Bottom-right (between Line 3, bottom edge)
    // Expecting 4+ panels
    expect(panels.length).toBeGreaterThanOrEqual(4);
  });
});

describe('Edge cases', () => {
  it('should handle lines at exact page boundaries', () => {
    // Line exactly on top edge (shouldn't split anything meaningful)
    const lines: DividerLine[] = [
      {
        id: 1,
        line_type: 'straight',
        start_x: 0,
        start_y: 0,
        end_x: 100,
        end_y: 0,
      },
    ];

    const panels = computePanelRegions(lines, PAGE_WIDTH, PAGE_HEIGHT);
    // Line on boundary shouldn't create a meaningful split
    expect(panels.length).toBeGreaterThanOrEqual(1);
  });

  it('should handle very small angle lines', () => {
    // Nearly horizontal line
    const lines: DividerLine[] = [
      {
        id: 1,
        line_type: 'straight',
        start_x: 0,
        start_y: 50,
        end_x: 100,
        end_y: 51,
      },
    ];

    const panels = computePanelRegions(lines, PAGE_WIDTH, PAGE_HEIGHT);
    expect(panels).toHaveLength(2);
  });
});
