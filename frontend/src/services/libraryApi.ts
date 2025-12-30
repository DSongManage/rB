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
  comics: LibraryItem[];
}

// Comic Reader Data Types
export interface SpeechBubbleData {
  id: number;
  bubble_type: string;
  x_percent: number;
  y_percent: number;
  width_percent: number;
  height_percent: number;
  z_index: number;
  text: string;
  font_family: string;
  font_size: number;
  font_color: string;
  font_weight: string;
  font_style: string;
  text_align: string;
  background_color: string;
  border_color: string;
  border_width: number;
  pointer_direction: string;
  pointer_position: number;
  order: number;
}

export interface ComicPanelData {
  id: number;
  x_percent: number;
  y_percent: number;
  width_percent: number;
  height_percent: number;
  z_index: number;
  border_style: string;
  border_width: number;
  border_color: string;
  border_radius: number;
  background_color: string;
  rotation: number;
  skew_x: number;
  skew_y: number;
  artwork?: string;
  artwork_fit: string;
  order: number;
  speech_bubbles: SpeechBubbleData[];
}

export interface ComicPageData {
  id: number;
  page_number: number;
  page_format: string;
  canvas_width: number;
  canvas_height: number;
  background_image?: string;
  background_color: string;
  panels: ComicPanelData[];
}

export interface ComicReaderData {
  content_id: number;
  title: string;
  creator: string;
  total_pages: number;
  pages: ComicPageData[];
}

export interface ComicPreviewData {
  content_id: number;
  title: string;
  creator: string;
  total_pages: number;
  preview_pages: number;
  pages: ComicPageData[];
  is_preview: boolean;
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

  /**
   * Get comic reader data (pages, panels, speech bubbles) for owned comics
   */
  async getComicReaderData(contentId: number): Promise<ComicReaderData> {
    const response = await fetch(`${API_BASE}/api/content/${contentId}/comic-reader-data/`, {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) {
      if (response.status === 403) {
        throw new Error('You do not own this content');
      }
      if (response.status === 404) {
        throw new Error('Comic data not found');
      }
      throw new Error(`Failed to fetch comic data: ${response.statusText}`);
    }

    return response.json();
  },

  /**
   * Get comic preview data (limited pages for non-owners)
   */
  async getComicPreviewData(contentId: number): Promise<ComicPreviewData> {
    const response = await fetch(`${API_BASE}/api/content/${contentId}/comic-preview/`, {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Comic data not found');
      }
      throw new Error(`Failed to fetch comic preview: ${response.statusText}`);
    }

    return response.json();
  },
};
