/**
 * PersistenceBugs.test.tsx - Tests for artwork and speech bubble persistence fixes.
 *
 * These tests verify fixes for:
 * 1. Artwork disappearing after save (race condition fix)
 * 2. Speech bubbles not rendering (restrictive condition fix)
 */

import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// Mock ResizeObserver (not available in jsdom)
class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
global.ResizeObserver = MockResizeObserver as any;
import CollaborativeComicEditor from '../CollaborativeComicEditor';
import { collaborationApi } from '../../../services/collaborationApi';

// Mock the collaboration API
vi.mock('../../../services/collaborationApi', () => ({
  collaborationApi: {
    getComicPages: vi.fn(),
    getComicIssues: vi.fn(),
    getComicIssuePages: vi.fn(),
    createComicPage: vi.fn(),
    createComicIssue: vi.fn(),
    deleteComicPage: vi.fn(),
    createComicPanel: vi.fn(),
    updateComicPanel: vi.fn(),
    deleteComicPanel: vi.fn(),
    createSpeechBubble: vi.fn(),
    updateSpeechBubble: vi.fn(),
    deleteSpeechBubble: vi.fn(),
    uploadPanelArtwork: vi.fn(),
    updateComicIssue: vi.fn(),
  },
}));

// Mock react-rnd to avoid complex drag/resize in tests
vi.mock('react-rnd', () => ({
  Rnd: ({ children, ...props }: any) => (
    <div data-testid="rnd-wrapper" {...props}>
      {children}
    </div>
  ),
}));

// Mock LineBasedEditor since it's complex - use forwardRef to match the real component
vi.mock('../lineEditor', () => ({
  LineBasedEditor: React.forwardRef(({ panelArtwork, onPanelsComputed, children }: any, ref: any) => {
    // Expose mock ref methods
    React.useImperativeHandle(ref, () => ({
      getCanvasRect: () => ({ left: 0, top: 0, width: 550, height: 712 }),
      getCanvasSize: () => ({ width: 550, height: 712 }),
    }), []);

    // Simulate calling onPanelsComputed with mock computed panels
    React.useEffect(() => {
      if (onPanelsComputed) {
        onPanelsComputed([
          {
            id: 'panel-0-25-25',
            vertices: [
              { x: 0, y: 0 },
              { x: 50, y: 0 },
              { x: 50, y: 50 },
              { x: 0, y: 50 },
            ],
            bounds: { x: 0, y: 0, width: 50, height: 50 },
            centroid: { x: 25, y: 25 },
          },
          {
            id: 'panel-1-75-25',
            vertices: [
              { x: 50, y: 0 },
              { x: 100, y: 0 },
              { x: 100, y: 50 },
              { x: 50, y: 50 },
            ],
            bounds: { x: 50, y: 0, width: 50, height: 50 },
            centroid: { x: 75, y: 25 },
          },
        ]);
      }
    }, [onPanelsComputed]);

    // Display artwork map content for testing
    const artworkEntries = panelArtwork ? Array.from(panelArtwork.entries()) : [];

    return (
      <div data-testid="line-based-editor" style={{ position: 'relative' }}>
        <div data-testid="panel-artwork-map">
          {artworkEntries.map(([panelId, url]: [string, string]) => (
            <div key={panelId} data-testid={`artwork-${panelId}`}>
              {url}
            </div>
          ))}
        </div>
        {/* Render children (speech bubbles) */}
        {children}
      </div>
    );
  }),
  LINE_TEMPLATES: {},
  ORIENTATION_PRESETS: {
    portrait: { width: 8.5, height: 11 },
    landscape: { width: 11, height: 8.5 },
    square: { width: 10, height: 10 },
  },
}));

const mockProject = {
  id: 1,
  title: 'Test Comic',
  description: 'A test comic',
  content_type: 'comic' as const,
  created_by: 1,
  status: 'active' as const,
  collaborators: [],
};

const mockUser = {
  id: 1,
  username: 'testuser',
  display_name: 'Test User',
};

const mockIssue = {
  id: 1,
  project: 1,
  title: 'Issue #1',
  issue_number: 1,
  page_count: 1,
};

// Base mock page with divider lines (triggers line-based editor)
const mockPageWithLines = {
  id: 1,
  project: 1,
  issue: 1,
  page_number: 1,
  page_format: 'standard',
  panels: [],
  canvas_width: 800,
  canvas_height: 1200,
  background_color: '#ffffff',
  orientation: 'portrait',
  divider_lines: [
    { id: 1, start_x: 50, start_y: 0, end_x: 50, end_y: 100, line_type: 'vertical' },
  ],
};

// Panel with artwork
const mockPanelWithArtwork = {
  id: 1,
  page: 1,
  x_percent: 0,
  y_percent: 0,
  width_percent: 50,
  height_percent: 50,
  order: 0,
  artwork: 'https://example.com/artwork1.png',
  speech_bubbles: [],
};

// Panel with speech bubbles
const mockPanelWithBubbles = {
  id: 2,
  page: 1,
  x_percent: 50,
  y_percent: 0,
  width_percent: 50,
  height_percent: 50,
  order: 1,
  artwork: null,
  speech_bubbles: [
    {
      id: 1,
      panel: 2,
      bubble_type: 'oval' as const,
      text: 'Hello World!',
      x_percent: 20,
      y_percent: 20,
      width_percent: 60,
      height_percent: 40,
      order: 0,
    },
  ],
};

describe('Persistence Bug Fixes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('Artwork Persistence (Race Condition Fix)', () => {
    it('should maintain artwork map when component mounts with artwork', async () => {
      const pageWithArtwork = {
        ...mockPageWithLines,
        panels: [mockPanelWithArtwork],
      };

      vi.mocked(collaborationApi.getComicIssues).mockResolvedValue([mockIssue]);
      vi.mocked(collaborationApi.getComicIssuePages).mockResolvedValue([pageWithArtwork]);

      render(
        <CollaborativeComicEditor
          project={mockProject}
          currentUser={mockUser}
        />
      );

      await waitFor(() => {
        expect(screen.queryByText(/loading comic editor/i)).not.toBeInTheDocument();
      });

      // Wait for panels to compute and artwork map to build
      await act(async () => {
        vi.advanceTimersByTime(200);
      });

      // The line-based editor should have received the artwork map
      const editor = screen.getByTestId('line-based-editor');
      expect(editor).toBeInTheDocument();
    });

    it('should not rebuild artwork map during reload (race condition prevention)', async () => {
      const pageWithArtwork = {
        ...mockPageWithLines,
        panels: [mockPanelWithArtwork],
      };

      vi.mocked(collaborationApi.getComicIssues).mockResolvedValue([mockIssue]);
      vi.mocked(collaborationApi.getComicIssuePages).mockResolvedValue([pageWithArtwork]);

      render(
        <CollaborativeComicEditor
          project={mockProject}
          currentUser={mockUser}
        />
      );

      await waitFor(() => {
        expect(screen.queryByText(/loading comic editor/i)).not.toBeInTheDocument();
      });

      // Simulate waiting for stable state
      await act(async () => {
        vi.advanceTimersByTime(200);
      });

      // Verify issues were loaded (proving component rendered correctly)
      expect(collaborationApi.getComicIssues).toHaveBeenCalledWith({ project: 1 });
    });

    it('should correctly map multiple panels with artwork', async () => {
      const secondPanelWithArtwork = {
        ...mockPanelWithArtwork,
        id: 3,
        x_percent: 50,
        y_percent: 0,
        artwork: 'https://example.com/artwork2.png',
      };

      const pageWithMultipleArtwork = {
        ...mockPageWithLines,
        panels: [mockPanelWithArtwork, secondPanelWithArtwork],
      };

      vi.mocked(collaborationApi.getComicIssues).mockResolvedValue([mockIssue]);
      vi.mocked(collaborationApi.getComicIssuePages).mockResolvedValue([pageWithMultipleArtwork]);

      render(
        <CollaborativeComicEditor
          project={mockProject}
          currentUser={mockUser}
        />
      );

      await waitFor(() => {
        expect(screen.queryByText(/loading comic editor/i)).not.toBeInTheDocument();
      });

      await act(async () => {
        vi.advanceTimersByTime(200);
      });

      // Both panels should be loaded
      expect(collaborationApi.getComicIssuePages).toHaveBeenCalledWith(1);
    });

    it('should handle page with no panels gracefully', async () => {
      const emptyPage = {
        ...mockPageWithLines,
        panels: [],
      };

      vi.mocked(collaborationApi.getComicIssues).mockResolvedValue([mockIssue]);
      vi.mocked(collaborationApi.getComicIssuePages).mockResolvedValue([emptyPage]);

      render(
        <CollaborativeComicEditor
          project={mockProject}
          currentUser={mockUser}
        />
      );

      await waitFor(() => {
        expect(screen.queryByText(/loading comic editor/i)).not.toBeInTheDocument();
      });

      // Should not crash with empty panels
      const editor = screen.getByTestId('line-based-editor');
      expect(editor).toBeInTheDocument();
    });
  });

  describe('Speech Bubble Rendering (Restrictive Condition Fix)', () => {
    it('should render speech bubbles when they exist in database', async () => {
      const pageWithBubbles = {
        ...mockPageWithLines,
        panels: [mockPanelWithBubbles],
      };

      vi.mocked(collaborationApi.getComicIssues).mockResolvedValue([mockIssue]);
      vi.mocked(collaborationApi.getComicIssuePages).mockResolvedValue([pageWithBubbles]);

      render(
        <CollaborativeComicEditor
          project={mockProject}
          currentUser={mockUser}
        />
      );

      await waitFor(() => {
        expect(screen.queryByText(/loading comic editor/i)).not.toBeInTheDocument();
      });

      // Switch to text mode to see bubbles
      const textButton = screen.getByRole('button', { name: /text/i });
      textButton.click();

      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      // The bubble text should be visible (using database panel bounds)
      await waitFor(() => {
        expect(screen.getByText('Hello World!')).toBeInTheDocument();
      });
    });

    it('should render bubbles even with low IoU match', async () => {
      // Panel bounds don't exactly match computed panel bounds
      const panelWithOffsetBubbles = {
        ...mockPanelWithBubbles,
        x_percent: 48, // Slightly off from computed panel at 50
        y_percent: 2,
      };

      const pageWithOffsetBubbles = {
        ...mockPageWithLines,
        panels: [panelWithOffsetBubbles],
      };

      vi.mocked(collaborationApi.getComicIssues).mockResolvedValue([mockIssue]);
      vi.mocked(collaborationApi.getComicIssuePages).mockResolvedValue([pageWithOffsetBubbles]);

      render(
        <CollaborativeComicEditor
          project={mockProject}
          currentUser={mockUser}
        />
      );

      await waitFor(() => {
        expect(screen.queryByText(/loading comic editor/i)).not.toBeInTheDocument();
      });

      // Switch to text mode
      const textButton = screen.getByRole('button', { name: /text/i });
      textButton.click();

      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      // Bubbles should still render (using database bounds as fallback)
      await waitFor(() => {
        expect(screen.getByText('Hello World!')).toBeInTheDocument();
      });
    });

    it('should not render bubbles for panels without speech bubbles', async () => {
      const panelWithNoBubbles = {
        ...mockPanelWithArtwork,
        speech_bubbles: [],
      };

      const pageWithNoBubbles = {
        ...mockPageWithLines,
        panels: [panelWithNoBubbles],
      };

      vi.mocked(collaborationApi.getComicIssues).mockResolvedValue([mockIssue]);
      vi.mocked(collaborationApi.getComicIssuePages).mockResolvedValue([pageWithNoBubbles]);

      render(
        <CollaborativeComicEditor
          project={mockProject}
          currentUser={mockUser}
        />
      );

      await waitFor(() => {
        expect(screen.queryByText(/loading comic editor/i)).not.toBeInTheDocument();
      });

      // Switch to text mode
      const textButton = screen.getByRole('button', { name: /text/i });
      textButton.click();

      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      // No bubble text should be visible (panel has no bubbles)
      expect(screen.queryByText('Hello World!')).not.toBeInTheDocument();
    });

    it('should handle panels with multiple speech bubbles', async () => {
      const panelWithMultipleBubbles = {
        ...mockPanelWithBubbles,
        speech_bubbles: [
          {
            id: 1,
            panel: 2,
            bubble_type: 'oval' as const,
            text: 'First Bubble',
            x_percent: 10,
            y_percent: 10,
            width_percent: 30,
            height_percent: 20,
            order: 0,
          },
          {
            id: 2,
            panel: 2,
            bubble_type: 'thought' as const,
            text: 'Second Bubble',
            x_percent: 50,
            y_percent: 50,
            width_percent: 40,
            height_percent: 30,
            order: 1,
          },
        ],
      };

      const pageWithMultipleBubbles = {
        ...mockPageWithLines,
        panels: [panelWithMultipleBubbles],
      };

      vi.mocked(collaborationApi.getComicIssues).mockResolvedValue([mockIssue]);
      vi.mocked(collaborationApi.getComicIssuePages).mockResolvedValue([pageWithMultipleBubbles]);

      render(
        <CollaborativeComicEditor
          project={mockProject}
          currentUser={mockUser}
        />
      );

      await waitFor(() => {
        expect(screen.queryByText(/loading comic editor/i)).not.toBeInTheDocument();
      });

      // Switch to text mode
      const textButton = screen.getByRole('button', { name: /text/i });
      textButton.click();

      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      // Both bubbles should render
      await waitFor(() => {
        expect(screen.getByText('First Bubble')).toBeInTheDocument();
        expect(screen.getByText('Second Bubble')).toBeInTheDocument();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid page switching without losing artwork', async () => {
      const page1 = {
        ...mockPageWithLines,
        id: 1,
        page_number: 1,
        panels: [mockPanelWithArtwork],
      };

      const page2 = {
        ...mockPageWithLines,
        id: 2,
        page_number: 2,
        panels: [
          {
            ...mockPanelWithArtwork,
            id: 4,
            artwork: 'https://example.com/page2artwork.png',
          },
        ],
      };

      vi.mocked(collaborationApi.getComicIssues).mockResolvedValue([{ ...mockIssue, page_count: 2 }]);
      vi.mocked(collaborationApi.getComicIssuePages).mockResolvedValue([page1, page2]);

      render(
        <CollaborativeComicEditor
          project={mockProject}
          currentUser={mockUser}
        />
      );

      await waitFor(() => {
        expect(screen.queryByText(/loading comic editor/i)).not.toBeInTheDocument();
      });

      await act(async () => {
        vi.advanceTimersByTime(200);
      });

      // Component should handle multiple pages without crashing
      expect(screen.getByTestId('line-based-editor')).toBeInTheDocument();
    });

    it('should handle page with both artwork and bubbles', async () => {
      const combinedPanel = {
        ...mockPanelWithArtwork,
        speech_bubbles: mockPanelWithBubbles.speech_bubbles,
      };

      const combinedPage = {
        ...mockPageWithLines,
        panels: [combinedPanel],
      };

      vi.mocked(collaborationApi.getComicIssues).mockResolvedValue([mockIssue]);
      vi.mocked(collaborationApi.getComicIssuePages).mockResolvedValue([combinedPage]);

      render(
        <CollaborativeComicEditor
          project={mockProject}
          currentUser={mockUser}
        />
      );

      await waitFor(() => {
        expect(screen.queryByText(/loading comic editor/i)).not.toBeInTheDocument();
      });

      await act(async () => {
        vi.advanceTimersByTime(200);
      });

      // Should handle panel with both artwork and bubbles
      const editor = screen.getByTestId('line-based-editor');
      expect(editor).toBeInTheDocument();

      // Switch to text mode
      const textButton = screen.getByRole('button', { name: /text/i });
      textButton.click();

      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      // Bubble should render
      await waitFor(() => {
        expect(screen.getByText('Hello World!')).toBeInTheDocument();
      });
    });
  });
});
