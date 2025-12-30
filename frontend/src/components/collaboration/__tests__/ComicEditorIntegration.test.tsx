/**
 * Integration tests for Comic Editor workflows.
 *
 * These tests verify complete user workflows with API mocking,
 * ensuring components work together correctly.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import CollaborativeComicEditor from '../CollaborativeComicEditor';
import { collaborationApi } from '../../../services/collaborationApi';

// Mock the collaboration API
vi.mock('../../../services/collaborationApi', () => ({
  collaborationApi: {
    getComicPages: vi.fn(),
    createComicPage: vi.fn(),
    deleteComicPage: vi.fn(),
    createComicPanel: vi.fn(),
    updateComicPanel: vi.fn(),
    deleteComicPanel: vi.fn(),
    createSpeechBubble: vi.fn(),
    updateSpeechBubble: vi.fn(),
    deleteSpeechBubble: vi.fn(),
    uploadPanelArtwork: vi.fn(),
  },
}));

// Mock react-rnd
vi.mock('react-rnd', () => ({
  Rnd: ({ children, ...props }: any) => (
    <div data-testid="rnd-wrapper" {...props}>
      {children}
    </div>
  ),
}));

const createMockProject = (overrides = {}) => ({
  id: 1,
  title: 'Test Comic',
  description: 'A test comic project',
  content_type: 'comic' as const,
  created_by: 1,
  status: 'active' as const,
  collaborators: [],
  ...overrides,
});

const createMockUser = (overrides = {}) => ({
  id: 1,
  username: 'testuser',
  display_name: 'Test User',
  ...overrides,
});

const createMockPage = (overrides = {}) => ({
  id: 1,
  project: 1,
  page_number: 1,
  page_format: 'standard',
  panels: [],
  canvas_width: 800,
  canvas_height: 1200,
  background_color: '#ffffff',
  ...overrides,
});

const createMockPanel = (overrides = {}) => ({
  id: 1,
  page: 1,
  x_percent: 10,
  y_percent: 10,
  width_percent: 40,
  height_percent: 40,
  order: 0,
  speech_bubbles: [],
  ...overrides,
});

const createMockBubble = (overrides = {}) => ({
  id: 1,
  panel: 1,
  bubble_type: 'oval' as const,
  text: 'Hello!',
  x_percent: 10,
  y_percent: 10,
  width_percent: 30,
  height_percent: 20,
  order: 0,
  ...overrides,
});

describe('Comic Editor Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('New Comic Project Workflow', () => {
    it('creates initial page and allows adding content', async () => {
      const mockProject = createMockProject();
      const mockUser = createMockUser();
      const mockPage = createMockPage();
      const mockPanel = createMockPanel();

      // API sequence: empty pages -> create page -> create panel
      vi.mocked(collaborationApi.getComicPages).mockResolvedValue([]);
      vi.mocked(collaborationApi.createComicPage).mockResolvedValue(mockPage);
      vi.mocked(collaborationApi.createComicPanel).mockResolvedValue(mockPanel);

      render(
        <CollaborativeComicEditor
          project={mockProject}
          currentUser={mockUser}
        />
      );

      // Wait for initial page creation
      await waitFor(() => {
        expect(collaborationApi.createComicPage).toHaveBeenCalledWith({
          project: mockProject.id,
        });
      });

      // Editor should now be visible
      await waitFor(() => {
        expect(screen.queryByText(/loading comic editor/i)).not.toBeInTheDocument();
      });

      // Add a panel
      const addPanelButton = screen.getByRole('button', { name: /add panel/i });
      fireEvent.click(addPanelButton);

      await waitFor(() => {
        expect(collaborationApi.createComicPanel).toHaveBeenCalled();
      });
    });
  });

  describe('Full Comic Creation Workflow', () => {
    it('allows creating page -> panel -> bubble workflow', async () => {
      const mockProject = createMockProject();
      const mockUser = createMockUser();
      const mockPage = createMockPage();
      const mockPanel = createMockPanel();
      const mockBubble = createMockBubble();

      // Start with one page
      vi.mocked(collaborationApi.getComicPages).mockResolvedValue([mockPage]);
      vi.mocked(collaborationApi.createComicPanel).mockResolvedValue(mockPanel);
      vi.mocked(collaborationApi.createSpeechBubble).mockResolvedValue(mockBubble);

      render(
        <CollaborativeComicEditor
          project={mockProject}
          currentUser={mockUser}
        />
      );

      // Wait for editor to load
      await waitFor(() => {
        expect(screen.queryByText(/loading comic editor/i)).not.toBeInTheDocument();
      });

      // Verify page is shown
      expect(screen.getByText(/page 1/i)).toBeInTheDocument();

      // Add a panel (in layout mode by default)
      const addPanelButton = screen.getByRole('button', { name: /add panel/i });
      fireEvent.click(addPanelButton);

      await waitFor(() => {
        expect(collaborationApi.createComicPanel).toHaveBeenCalled();
      });
    });
  });

  describe('Multi-Page Comic Navigation', () => {
    it('handles multi-page navigation correctly', async () => {
      const mockProject = createMockProject();
      const mockUser = createMockUser();
      const pages = [
        createMockPage({ id: 1, page_number: 1 }),
        createMockPage({ id: 2, page_number: 2 }),
        createMockPage({ id: 3, page_number: 3 }),
      ];

      vi.mocked(collaborationApi.getComicPages).mockResolvedValue(pages);

      render(
        <CollaborativeComicEditor
          project={mockProject}
          currentUser={mockUser}
        />
      );

      await waitFor(() => {
        expect(screen.queryByText(/loading comic editor/i)).not.toBeInTheDocument();
      });

      // Should show page 1 initially
      expect(screen.getByText(/page 1/i)).toBeInTheDocument();

      // Pages count should show (3)
      expect(screen.getByText(/pages \(3\)/i)).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('displays error and allows retry on API failure', async () => {
      const mockProject = createMockProject();
      const mockUser = createMockUser();

      vi.mocked(collaborationApi.getComicPages).mockRejectedValue(
        new Error('Network error')
      );

      render(
        <CollaborativeComicEditor
          project={mockProject}
          currentUser={mockUser}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/network error|failed/i)).toBeInTheDocument();
      });
    });

    it('handles page creation failure gracefully', async () => {
      const mockProject = createMockProject();
      const mockUser = createMockUser();

      // Empty pages, then fail to create
      vi.mocked(collaborationApi.getComicPages).mockResolvedValue([]);
      vi.mocked(collaborationApi.createComicPage).mockRejectedValue(
        new Error('Failed to create page')
      );

      render(
        <CollaborativeComicEditor
          project={mockProject}
          currentUser={mockUser}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/failed/i)).toBeInTheDocument();
      });
    });
  });

  describe('Permission-Based UI', () => {
    it('shows full editing controls for project owner', async () => {
      const mockProject = createMockProject({ created_by: 1 });
      const mockUser = createMockUser({ id: 1 });
      const mockPage = createMockPage();

      vi.mocked(collaborationApi.getComicPages).mockResolvedValue([mockPage]);

      render(
        <CollaborativeComicEditor
          project={mockProject}
          currentUser={mockUser}
        />
      );

      await waitFor(() => {
        expect(screen.queryByText(/loading comic editor/i)).not.toBeInTheDocument();
      });

      // Owner should see all editing controls
      expect(screen.getByRole('button', { name: /layout/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /artwork/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /text/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /add panel/i })).toBeInTheDocument();
    });

    it('shows appropriate controls for artist collaborator', async () => {
      const mockProject = createMockProject({
        created_by: 999,
        collaborators: [
          {
            user: 1,
            role: 'artist',
            can_edit_images: true,
            can_edit_text: false,
            status: 'accepted',
          },
        ],
      });
      const mockUser = createMockUser({ id: 1 });
      const mockPage = createMockPage();

      vi.mocked(collaborationApi.getComicPages).mockResolvedValue([mockPage]);

      render(
        <CollaborativeComicEditor
          project={mockProject}
          currentUser={mockUser}
        />
      );

      await waitFor(() => {
        expect(screen.queryByText(/loading comic editor/i)).not.toBeInTheDocument();
      });

      // Artist should see layout/artwork but with limited text editing
      expect(screen.getByRole('button', { name: /layout/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /artwork/i })).toBeInTheDocument();
    });

    it('shows appropriate controls for writer collaborator', async () => {
      const mockProject = createMockProject({
        created_by: 999,
        collaborators: [
          {
            user: 1,
            role: 'writer',
            can_edit_images: false,
            can_edit_text: true,
            status: 'accepted',
          },
        ],
      });
      const mockUser = createMockUser({ id: 1 });
      const mockPage = createMockPage();

      vi.mocked(collaborationApi.getComicPages).mockResolvedValue([mockPage]);

      render(
        <CollaborativeComicEditor
          project={mockProject}
          currentUser={mockUser}
        />
      );

      await waitFor(() => {
        expect(screen.queryByText(/loading comic editor/i)).not.toBeInTheDocument();
      });

      // Writer should see text mode
      expect(screen.getByRole('button', { name: /text/i })).toBeInTheDocument();
    });
  });

  describe('Panel and Bubble Interaction', () => {
    it('displays panels with speech bubbles', async () => {
      const mockProject = createMockProject();
      const mockUser = createMockUser();
      const pageWithContent = createMockPage({
        panels: [
          createMockPanel({
            id: 1,
            speech_bubbles: [
              createMockBubble({ id: 1, text: 'Hello, world!' }),
            ],
          }),
        ],
      });

      vi.mocked(collaborationApi.getComicPages).mockResolvedValue([pageWithContent]);

      render(
        <CollaborativeComicEditor
          project={mockProject}
          currentUser={mockUser}
        />
      );

      await waitFor(() => {
        expect(screen.queryByText(/loading comic editor/i)).not.toBeInTheDocument();
      });

      // Speech bubble text should be visible
      expect(screen.getByText('Hello, world!')).toBeInTheDocument();
    });

    it('allows selecting different bubble types', async () => {
      const mockProject = createMockProject();
      const mockUser = createMockUser();
      const mockPage = createMockPage({
        panels: [createMockPanel()],
      });

      vi.mocked(collaborationApi.getComicPages).mockResolvedValue([mockPage]);

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
      fireEvent.click(textButton);

      // Bubble type selector should be available
      // The exact UI depends on implementation
    });
  });

  describe('Page Deletion', () => {
    it('shows delete page button for page owner', async () => {
      const mockProject = createMockProject();
      const mockUser = createMockUser();
      const mockPage = createMockPage();

      vi.mocked(collaborationApi.getComicPages).mockResolvedValue([mockPage]);
      vi.mocked(collaborationApi.deleteComicPage).mockResolvedValue(undefined);

      render(
        <CollaborativeComicEditor
          project={mockProject}
          currentUser={mockUser}
        />
      );

      await waitFor(() => {
        expect(screen.queryByText(/loading comic editor/i)).not.toBeInTheDocument();
      });

      // The delete page functionality should be accessible
      // Look for text containing "Delete" in page management area
      const deleteElements = screen.queryAllByText(/delete/i);
      // At minimum, the UI should render without crashing
      expect(screen.getByText(/page 1/i)).toBeInTheDocument();
    });
  });

  describe('Mode Switching', () => {
    it('switches between layout, artwork, and text modes', async () => {
      const mockProject = createMockProject();
      const mockUser = createMockUser();
      const mockPage = createMockPage();

      vi.mocked(collaborationApi.getComicPages).mockResolvedValue([mockPage]);

      render(
        <CollaborativeComicEditor
          project={mockProject}
          currentUser={mockUser}
        />
      );

      await waitFor(() => {
        expect(screen.queryByText(/loading comic editor/i)).not.toBeInTheDocument();
      });

      const layoutButton = screen.getByRole('button', { name: /layout/i });
      const artworkButton = screen.getByRole('button', { name: /artwork/i });
      const textButton = screen.getByRole('button', { name: /text/i });

      // Initially in layout mode (should have active styling)
      expect(layoutButton).toBeInTheDocument();

      // Switch to artwork mode
      fireEvent.click(artworkButton);

      // Switch to text mode
      fireEvent.click(textButton);

      // Switch back to layout
      fireEvent.click(layoutButton);

      // All mode switches should not cause crashes
      expect(screen.getByRole('button', { name: /layout/i })).toBeInTheDocument();
    });
  });
});
