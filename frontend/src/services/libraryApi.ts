/**
 * Library API Service
 *
 * Provides functions for accessing user's library and reading progress.
 */

const API_BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000';

export interface LibraryItem {
  id: number;
  title: string;
  creator: string;
  thumbnail: string;
  content_type: string;
  purchased_at: string;
  progress: number;
}

export interface Library {
  books: LibraryItem[];
  art: LibraryItem[];
  film: LibraryItem[];
  music: LibraryItem[];
}

export interface FullContent {
  id: number;
  title: string;
  content_html: string;
  creator: string;
  content_type: string;
  owned: boolean;
}

export interface ReadingProgress {
  id?: number;
  user?: number;
  content: number;
  progress_percentage: number;
  last_position: string;
  last_read_at?: string;
  created_at?: string;
}

/**
 * Get CSRF token from cookies
 */
function getCsrfToken(): string {
  const name = 'csrftoken';
  const cookies = document.cookie.split(';');
  for (let cookie of cookies) {
    const [key, value] = cookie.trim().split('=');
    if (key === name) return value;
  }
  return '';
}

export const libraryApi = {
  /**
   * Get user's library grouped by content type
   */
  async getLibrary(): Promise<Library> {
    const response = await fetch(`${API_BASE}/api/library/`, {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch library: ${response.statusText}`);
    }

    return response.json();
  },

  /**
   * Get full content for owned items
   */
  async getFullContent(contentId: number): Promise<FullContent> {
    const response = await fetch(`${API_BASE}/api/content/${contentId}/full/`, {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) {
      if (response.status === 403) {
        throw new Error('You do not own this content');
      }
      throw new Error(`Failed to fetch content: ${response.statusText}`);
    }

    return response.json();
  },

  /**
   * Update reading progress for content
   */
  async updateProgress(
    contentId: number,
    progressPercentage: number,
    lastPosition: string = ''
  ): Promise<ReadingProgress> {
    const response = await fetch(`${API_BASE}/api/reading-progress/`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCsrfToken(),
      },
      body: JSON.stringify({
        content_id: contentId,
        progress_percentage: progressPercentage,
        last_position: lastPosition,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to update progress: ${response.statusText}`);
    }

    return response.json();
  },

  /**
   * Get reading progress for specific content
   */
  async getProgress(contentId: number): Promise<ReadingProgress> {
    const response = await fetch(`${API_BASE}/api/reading-progress/${contentId}/`, {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch progress: ${response.statusText}`);
    }

    return response.json();
  },

  /**
   * Get all reading progress for user
   */
  async getAllProgress(): Promise<ReadingProgress[]> {
    const response = await fetch(`${API_BASE}/api/reading-progress/`, {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch all progress: ${response.statusText}`);
    }

    return response.json();
  },
};
