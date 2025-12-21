/**
 * Library API Service
 *
 * Provides functions for accessing user's library and reading progress.
 */

import { API_URL as API_BASE } from '../config';

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
  teaser_link?: string | null;
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
 * Get fresh CSRF token from API
 * This is more reliable than reading from cookies
 */
async function getFreshCsrfToken(): Promise<string> {
  try {
    const response = await fetch(`${API_BASE}/api/auth/csrf/`, {
      credentials: 'include',
    });
    const data = await response.json();
    return data?.csrfToken || '';
  } catch (error) {
    console.error('Failed to fetch CSRF token:', error);
    return '';
  }
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
    const csrfToken = await getFreshCsrfToken();
    const response = await fetch(`${API_BASE}/api/reading-progress/`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': csrfToken,
        'X-Requested-With': 'XMLHttpRequest',
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
