/**
 * Book API Service
 *
 * Provides functions for managing book projects and chapters.
 */

import { API_URL as API_BASE } from '../config';

export interface Chapter {
  id: number;
  title: string;
  content_html: string;
  order: number;
  created_at: string;
  updated_at: string;
  is_published: boolean;
}

export interface BookProject {
  id: number;
  title: string;
  description: string;
  cover_image?: string | null;
  cover_image_url?: string | null;
  chapters: Chapter[];
  chapter_count: number;
  created_at: string;
  updated_at: string;
  is_published: boolean;
  target_chapter_id?: number; // Set when loading by content ID of a specific chapter
}

export interface ContentResponse {
  content_id: number;
  message: string;
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

export const bookApi = {
  /**
   * Create a new book project
   */
  async createProject(title: string, description: string): Promise<BookProject> {
    const csrfToken = await getFreshCsrfToken();
    const response = await fetch(`${API_BASE}/api/book-projects/`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': csrfToken,
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({ title, description }),
    });

    if (!response.ok) {
      throw new Error(`Failed to create project: ${response.statusText}`);
    }

    return response.json();
  },

  /**
   * Get all book projects for the current user
   */
  async getProjects(): Promise<BookProject[]> {
    const response = await fetch(`${API_BASE}/api/book-projects/`, {
      method: 'GET',
      credentials: 'include',
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch projects: ${response.statusText}`);
    }
    
    return response.json();
  },

  /**
   * Get a specific book project by ID
   */
  async getProject(id: number): Promise<BookProject> {
    const response = await fetch(`${API_BASE}/api/book-projects/${id}/`, {
      method: 'GET',
      credentials: 'include',
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch project: ${response.statusText}`);
    }
    
    return response.json();
  },

  /**
   * Update a book project
   */
  async updateProject(id: number, data: Partial<BookProject>): Promise<BookProject> {
    const csrfToken = await getFreshCsrfToken();
    const response = await fetch(`${API_BASE}/api/book-projects/${id}/`, {
      method: 'PATCH',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': csrfToken,
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`Failed to update project: ${response.statusText}`);
    }

    return response.json();
  },

  /**
   * Upload cover image for a book project
   */
  async uploadCoverImage(id: number, imageFile: File): Promise<BookProject> {
    const csrfToken = await getFreshCsrfToken();
    const formData = new FormData();
    formData.append('cover_image', imageFile);

    const response = await fetch(`${API_BASE}/api/book-projects/${id}/`, {
      method: 'PATCH',
      credentials: 'include',
      headers: {
        'X-CSRFToken': csrfToken,
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Failed to upload cover image: ${response.statusText}`);
    }

    return response.json();
  },

  /**
   * Delete a book project
   */
  async deleteProject(id: number): Promise<void> {
    const csrfToken = await getFreshCsrfToken();
    const response = await fetch(`${API_BASE}/api/book-projects/${id}/`, {
      method: 'DELETE',
      credentials: 'include',
      headers: {
        'X-CSRFToken': csrfToken,
        'X-Requested-With': 'XMLHttpRequest',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to delete project: ${response.statusText}`);
    }
  },

  /**
   * Create a new chapter in a project
   */
  async createChapter(projectId: number, title: string): Promise<Chapter> {
    const csrfToken = await getFreshCsrfToken();
    const response = await fetch(`${API_BASE}/api/book-projects/${projectId}/chapters/`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': csrfToken,
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({ title, content_html: '' }),
    });

    if (!response.ok) {
      throw new Error(`Failed to create chapter: ${response.statusText}`);
    }

    return response.json();
  },

  /**
   * Update a chapter
   */
  async updateChapter(id: number, data: Partial<Chapter>): Promise<Chapter> {
    const csrfToken = await getFreshCsrfToken();
    const response = await fetch(`${API_BASE}/api/chapters/${id}/`, {
      method: 'PATCH',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': csrfToken,
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`Failed to update chapter: ${response.statusText}`);
    }

    return response.json();
  },

  /**
   * Delete a chapter
   */
  async deleteChapter(id: number): Promise<void> {
    const csrfToken = await getFreshCsrfToken();
    const response = await fetch(`${API_BASE}/api/chapters/${id}/`, {
      method: 'DELETE',
      credentials: 'include',
      headers: {
        'X-CSRFToken': csrfToken,
        'X-Requested-With': 'XMLHttpRequest',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to delete chapter: ${response.statusText}`);
    }
  },

  /**
   * Publish a single chapter as Content/NFT
   */
  async publishChapter(chapterId: number): Promise<ContentResponse> {
    const csrfToken = await getFreshCsrfToken();
    const response = await fetch(`${API_BASE}/api/chapters/${chapterId}/publish/`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': csrfToken,
        'X-Requested-With': 'XMLHttpRequest',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to publish chapter: ${response.statusText}`);
    }

    return response.json();
  },

  /**
   * Publish entire book as Content/NFT
   */
  async publishBook(projectId: number): Promise<ContentResponse> {
    const csrfToken = await getFreshCsrfToken();
    const response = await fetch(`${API_BASE}/api/book-projects/${projectId}/publish/`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': csrfToken,
        'X-Requested-With': 'XMLHttpRequest',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to publish book: ${response.statusText}`);
    }

    return response.json();
  },

  /**
   * Get book project by its published content ID
   */
  async getProjectByContentId(contentId: number): Promise<BookProject> {
    const response = await fetch(`${API_BASE}/api/book-projects/by-content/${contentId}/`, {
      method: 'GET',
      credentials: 'include',
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch project by content: ${response.statusText}`);
    }
    
    return response.json();
  },

  /**
   * Prepare a chapter for minting (creates draft Content)
   */
  async prepareChapterForMint(chapterId: number): Promise<ContentResponse> {
    const csrfToken = await getFreshCsrfToken();
    const response = await fetch(`${API_BASE}/api/chapters/${chapterId}/prepare/`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': csrfToken,
        'X-Requested-With': 'XMLHttpRequest',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to prepare chapter: ${response.statusText}`);
    }

    return response.json();
  },

  /**
   * Prepare entire book for minting (creates draft Content)
   */
  async prepareBookForMint(projectId: number): Promise<ContentResponse> {
    const csrfToken = await getFreshCsrfToken();
    const response = await fetch(`${API_BASE}/api/book-projects/${projectId}/prepare/`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': csrfToken,
        'X-Requested-With': 'XMLHttpRequest',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to prepare book: ${response.statusText}`);
    }

    return response.json();
  },
};

