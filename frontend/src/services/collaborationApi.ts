/**
 * Collaboration API Service
 *
 * Provides functions for managing collaborative projects, invitations,
 * sections, and communication between collaborators.
 */

const API_BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000';

// ===== TypeScript Interfaces =====

export interface CollaborativeProject {
  id: number;
  title: string;
  content_type: 'book' | 'music' | 'video' | 'art';
  description: string;
  status: 'draft' | 'active' | 'ready_for_mint' | 'minted' | 'cancelled';
  milestones: Milestone[];
  created_by: number;
  created_by_username: string;
  created_at: string;
  updated_at: string;
  collaborators: CollaboratorRole[];
  sections: ProjectSection[];
  recent_comments: ProjectComment[];
  is_fully_approved: boolean;
  total_collaborators: number;
  progress_percentage: number;
}

export interface CollaborativeProjectListItem {
  id: number;
  title: string;
  content_type: string;
  status: string;
  created_by_username: string;
  total_collaborators: number;
  created_at: string;
}

export interface CollaboratorRole {
  id: number;
  user: number;
  username: string;
  display_name: string;
  role: string;
  revenue_percentage: number;
  status: 'invited' | 'accepted' | 'declined' | 'exited';
  invited_at: string;
  accepted_at?: string;
  can_edit_text: boolean;
  can_edit_images: boolean;
  can_edit_audio: boolean;
  can_edit_video: boolean;
  can_edit: string[];
  approved_current_version: boolean;
  approved_revenue_split: boolean;
}

export interface ProjectSection {
  id: number;
  section_type: 'text' | 'image' | 'audio' | 'video';
  title: string;
  content_html?: string;
  media_file?: string;
  owner: number;
  owner_username: string;
  order: number;
  created_at: string;
  updated_at: string;
}

export interface CommentReaction {
  id: number;
  user_id: number;
  username: string;
  emoji: string;
}

export interface ProjectComment {
  id: number;
  author: number;
  author_username: string;
  author_avatar: string;
  content: string;
  parent_comment?: number;
  section?: number;
  section_title?: string;
  resolved: boolean;
  resolved_by?: number;
  resolved_by_username?: string;
  resolved_at?: string;
  created_at: string;
  updated_at?: string;
  edited: boolean;
  edit_history?: Array<{
    content: string;
    edited_at: string;
  }>;
  replies_count: number;
  replies?: ProjectComment[];
  reactions?: CommentReaction[];
  attachments?: Array<{
    id: number;
    filename: string;
    file_url: string;
    file_size: number;
  }>;
  mentions?: number[]; // User IDs mentioned in the comment
}

export interface Milestone {
  id?: string;
  title: string;
  description?: string;
  due_date?: string;
  completed: boolean;
}

export interface RevenueSplit {
  user_id: number;
  percentage: number;
}

export interface InviteCollaboratorData {
  user_id: number;
  role: string;
  revenue_percentage: number;
  can_edit_text?: boolean;
  can_edit_images?: boolean;
  can_edit_audio?: boolean;
  can_edit_video?: boolean;
}

export interface CreateProjectData {
  title: string;
  content_type: 'book' | 'music' | 'video' | 'art';
  description?: string;
  milestones?: Milestone[];
}

export interface CreateSectionData {
  project: number;
  section_type: 'text' | 'image' | 'audio' | 'video';
  title: string;
  content_html?: string;
  media_file?: File;
  order?: number;
}

export interface CreateCommentData {
  project: number;
  content: string;
  section?: number;
  parent_comment?: number;
  mentions?: number[];
  attachments?: File[];
}

// ===== Helper Functions =====

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

/**
 * Handle API errors with detailed messages
 */
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorMessage = `Request failed: ${response.statusText}`;
    try {
      const errorData = await response.json();
      if (errorData.error) {
        errorMessage = errorData.error;
      } else if (errorData.detail) {
        errorMessage = errorData.detail;
      }
    } catch {
      // Response body not JSON, use status text
    }
    throw new Error(errorMessage);
  }
  return response.json();
}

// ===== API Functions =====

export const collaborationApi = {
  // ===== Project Management =====

  /**
   * Create a new collaborative project
   */
  async createCollaborativeProject(data: CreateProjectData): Promise<CollaborativeProject> {
    const response = await fetch(`${API_BASE}/api/collaborative-projects/`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCsrfToken(),
      },
      body: JSON.stringify(data),
    });

    return handleResponse<CollaborativeProject>(response);
  },

  /**
   * Get all collaborative projects for current user
   */
  async getCollaborativeProjects(): Promise<CollaborativeProjectListItem[]> {
    const response = await fetch(`${API_BASE}/api/collaborative-projects/`, {
      method: 'GET',
      credentials: 'include',
    });

    return handleResponse<CollaborativeProjectListItem[]>(response);
  },

  /**
   * Get single project with full details
   */
  async getCollaborativeProject(id: number): Promise<CollaborativeProject> {
    const response = await fetch(`${API_BASE}/api/collaborative-projects/${id}/`, {
      method: 'GET',
      credentials: 'include',
    });

    return handleResponse<CollaborativeProject>(response);
  },

  /**
   * Update collaborative project
   */
  async updateCollaborativeProject(
    id: number,
    data: Partial<CreateProjectData>
  ): Promise<CollaborativeProject> {
    const response = await fetch(`${API_BASE}/api/collaborative-projects/${id}/`, {
      method: 'PATCH',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCsrfToken(),
      },
      body: JSON.stringify(data),
    });

    return handleResponse<CollaborativeProject>(response);
  },

  /**
   * Delete collaborative project
   */
  async deleteCollaborativeProject(id: number): Promise<void> {
    const response = await fetch(`${API_BASE}/api/collaborative-projects/${id}/`, {
      method: 'DELETE',
      credentials: 'include',
      headers: {
        'X-CSRFToken': getCsrfToken(),
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to delete project: ${response.statusText}`);
    }
  },

  // ===== Collaboration Actions =====

  /**
   * Invite a collaborator to the project
   */
  async inviteCollaborator(
    projectId: number,
    data: InviteCollaboratorData
  ): Promise<CollaboratorRole> {
    const response = await fetch(
      `${API_BASE}/api/collaborative-projects/${projectId}/invite_collaborator/`,
      {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': getCsrfToken(),
        },
        body: JSON.stringify(data),
      }
    );

    return handleResponse<CollaboratorRole>(response);
  },

  /**
   * Accept invitation to collaborate
   */
  async acceptInvitation(projectId: number): Promise<CollaboratorRole> {
    const response = await fetch(
      `${API_BASE}/api/collaborative-projects/${projectId}/accept_invitation/`,
      {
        method: 'POST',
        credentials: 'include',
        headers: {
          'X-CSRFToken': getCsrfToken(),
        },
      }
    );

    return handleResponse<CollaboratorRole>(response);
  },

  /**
   * Decline invitation to collaborate
   */
  async declineInvitation(projectId: number): Promise<{ message: string }> {
    const response = await fetch(
      `${API_BASE}/api/collaborative-projects/${projectId}/decline_invitation/`,
      {
        method: 'POST',
        credentials: 'include',
        headers: {
          'X-CSRFToken': getCsrfToken(),
        },
      }
    );

    return handleResponse<{ message: string }>(response);
  },

  /**
   * Propose new revenue split percentages
   */
  async proposeRevenueSplit(
    projectId: number,
    splits: RevenueSplit[]
  ): Promise<CollaborativeProject> {
    const response = await fetch(
      `${API_BASE}/api/collaborative-projects/${projectId}/propose_revenue_split/`,
      {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': getCsrfToken(),
        },
        body: JSON.stringify({ splits }),
      }
    );

    return handleResponse<CollaborativeProject>(response);
  },

  // ===== Approval System =====

  /**
   * Approve current version for minting
   */
  async approveCurrentVersion(projectId: number): Promise<CollaborativeProject> {
    const response = await fetch(
      `${API_BASE}/api/collaborative-projects/${projectId}/approve_version/`,
      {
        method: 'POST',
        credentials: 'include',
        headers: {
          'X-CSRFToken': getCsrfToken(),
        },
      }
    );

    return handleResponse<CollaborativeProject>(response);
  },

  /**
   * Get approval status for a project
   */
  async getApprovalStatus(projectId: number): Promise<{
    is_fully_approved: boolean;
    pending_approvals: string[];
  }> {
    const project = await this.getCollaborativeProject(projectId);

    const pendingApprovals = project.collaborators
      .filter(
        (c) =>
          c.status === 'accepted' &&
          (!c.approved_current_version || !c.approved_revenue_split)
      )
      .map((c) => c.username);

    return {
      is_fully_approved: project.is_fully_approved,
      pending_approvals: pendingApprovals,
    };
  },

  /**
   * Get project preview (combined sections)
   */
  async getProjectPreview(projectId: number): Promise<{
    title: string;
    content_type: string;
    sections: any[];
  }> {
    const response = await fetch(
      `${API_BASE}/api/collaborative-projects/${projectId}/preview/`,
      {
        method: 'GET',
        credentials: 'include',
      }
    );

    return handleResponse(response);
  },

  // ===== Section Management =====

  /**
   * Create a new project section
   */
  async createProjectSection(data: CreateSectionData): Promise<ProjectSection> {
    const formData = new FormData();
    formData.append('project', data.project.toString());
    formData.append('section_type', data.section_type);
    formData.append('title', data.title);
    if (data.content_html) {
      formData.append('content_html', data.content_html);
    }
    if (data.media_file) {
      formData.append('media_file', data.media_file);
    }
    if (data.order !== undefined) {
      formData.append('order', data.order.toString());
    }

    const response = await fetch(`${API_BASE}/api/project-sections/`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'X-CSRFToken': getCsrfToken(),
      },
      body: formData,
    });

    return handleResponse<ProjectSection>(response);
  },

  /**
   * Update project section
   */
  async updateProjectSection(
    id: number,
    data: Partial<CreateSectionData>
  ): Promise<ProjectSection> {
    const formData = new FormData();
    if (data.section_type) {
      formData.append('section_type', data.section_type);
    }
    if (data.title) {
      formData.append('title', data.title);
    }
    if (data.content_html !== undefined) {
      formData.append('content_html', data.content_html);
    }
    if (data.media_file) {
      formData.append('media_file', data.media_file);
    }
    if (data.order !== undefined) {
      formData.append('order', data.order.toString());
    }

    const response = await fetch(`${API_BASE}/api/project-sections/${id}/`, {
      method: 'PATCH',
      credentials: 'include',
      headers: {
        'X-CSRFToken': getCsrfToken(),
      },
      body: formData,
    });

    return handleResponse<ProjectSection>(response);
  },

  /**
   * Delete project section
   */
  async deleteProjectSection(id: number): Promise<void> {
    const response = await fetch(`${API_BASE}/api/project-sections/${id}/`, {
      method: 'DELETE',
      credentials: 'include',
      headers: {
        'X-CSRFToken': getCsrfToken(),
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to delete section: ${response.statusText}`);
    }
  },

  /**
   * Get all sections for a project
   */
  async getProjectSections(projectId: number): Promise<ProjectSection[]> {
    const response = await fetch(
      `${API_BASE}/api/project-sections/?project=${projectId}`,
      {
        method: 'GET',
        credentials: 'include',
      }
    );

    return handleResponse<ProjectSection[]>(response);
  },

  // ===== Communication =====

  /**
   * Add a comment to project or section
   */
  async addComment(data: CreateCommentData): Promise<ProjectComment> {
    // Use FormData if there are attachments
    if (data.attachments && data.attachments.length > 0) {
      const formData = new FormData();
      formData.append('project', data.project.toString());
      formData.append('content', data.content);
      if (data.section) formData.append('section', data.section.toString());
      if (data.parent_comment) formData.append('parent_comment', data.parent_comment.toString());
      if (data.mentions) formData.append('mentions', JSON.stringify(data.mentions));

      data.attachments.forEach((file, index) => {
        formData.append(`attachment_${index}`, file);
      });

      const response = await fetch(`${API_BASE}/api/project-comments/`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'X-CSRFToken': getCsrfToken(),
        },
        body: formData,
      });

      return handleResponse<ProjectComment>(response);
    }

    // Regular JSON request without attachments
    const response = await fetch(`${API_BASE}/api/project-comments/`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCsrfToken(),
      },
      body: JSON.stringify(data),
    });

    return handleResponse<ProjectComment>(response);
  },

  /**
   * Get comments for a project or section
   */
  async getComments(projectId: number, sectionId?: number): Promise<ProjectComment[]> {
    let url = `${API_BASE}/api/project-comments/?project=${projectId}`;
    if (sectionId) {
      url += `&section=${sectionId}`;
    }

    const response = await fetch(url, {
      method: 'GET',
      credentials: 'include',
    });

    return handleResponse<ProjectComment[]>(response);
  },

  /**
   * Resolve a comment
   */
  async resolveComment(commentId: number): Promise<ProjectComment> {
    const response = await fetch(
      `${API_BASE}/api/project-comments/${commentId}/resolve/`,
      {
        method: 'POST',
        credentials: 'include',
        headers: {
          'X-CSRFToken': getCsrfToken(),
        },
      }
    );

    return handleResponse<ProjectComment>(response);
  },

  /**
   * Unresolve a comment
   */
  async unresolveComment(commentId: number): Promise<ProjectComment> {
    const response = await fetch(
      `${API_BASE}/api/project-comments/${commentId}/unresolve/`,
      {
        method: 'POST',
        credentials: 'include',
        headers: {
          'X-CSRFToken': getCsrfToken(),
        },
      }
    );

    return handleResponse<ProjectComment>(response);
  },

  /**
   * Update a comment
   */
  async updateComment(commentId: number, content: string): Promise<ProjectComment> {
    const response = await fetch(`${API_BASE}/api/project-comments/${commentId}/`, {
      method: 'PATCH',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCsrfToken(),
      },
      body: JSON.stringify({ content }),
    });

    return handleResponse<ProjectComment>(response);
  },

  /**
   * Delete a comment
   */
  async deleteComment(commentId: number): Promise<void> {
    const response = await fetch(`${API_BASE}/api/project-comments/${commentId}/`, {
      method: 'DELETE',
      credentials: 'include',
      headers: {
        'X-CSRFToken': getCsrfToken(),
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to delete comment: ${response.statusText}`);
    }
  },

  /**
   * Add reaction to a comment
   */
  async addReaction(commentId: number, emoji: string): Promise<CommentReaction> {
    const response = await fetch(
      `${API_BASE}/api/project-comments/${commentId}/add-reaction/`,
      {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': getCsrfToken(),
        },
        body: JSON.stringify({ emoji }),
      }
    );

    return handleResponse<CommentReaction>(response);
  },

  /**
   * Remove reaction from a comment
   */
  async removeReaction(commentId: number, reactionId: number): Promise<void> {
    const response = await fetch(
      `${API_BASE}/api/project-comments/${commentId}/remove-reaction/`,
      {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': getCsrfToken(),
        },
        body: JSON.stringify({ reaction_id: reactionId }),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to remove reaction: ${response.statusText}`);
    }
  },

  /**
   * Get comment thread (with replies)
   */
  async getCommentThread(commentId: number): Promise<ProjectComment> {
    const response = await fetch(
      `${API_BASE}/api/project-comments/${commentId}/thread/`,
      {
        method: 'GET',
        credentials: 'include',
      }
    );

    return handleResponse<ProjectComment>(response);
  },

  /**
   * Get comments by section
   */
  async getCommentsBySection(
    projectId: number,
    includeResolved: boolean = false
  ): Promise<{ [sectionId: string]: ProjectComment[] }> {
    let url = `${API_BASE}/api/project-comments/by-section/?project=${projectId}`;
    if (includeResolved) {
      url += '&include_resolved=true';
    }

    const response = await fetch(url, {
      method: 'GET',
      credentials: 'include',
    });

    return handleResponse<{ [sectionId: string]: ProjectComment[] }>(response);
  },

  /**
   * Get unresolved comment count
   */
  async getUnresolvedCommentCount(projectId: number): Promise<number> {
    const comments = await this.getComments(projectId);
    return comments.filter(c => !c.resolved).length;
  },

  // ===== Minting Workflow =====

  /**
   * Request approval from specific collaborators
   */
  async requestApproval(
    projectId: number,
    data: {
      collaborator_ids: number[];
      message?: string;
      deadline_days?: number;
    }
  ): Promise<{ message: string; notifications_sent: number }> {
    const response = await fetch(
      `${API_BASE}/api/collaborative-projects/${projectId}/request_approval/`,
      {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': getCsrfToken(),
        },
        body: JSON.stringify(data),
      }
    );

    return handleResponse<{ message: string; notifications_sent: number }>(response);
  },

  /**
   * Approve project (both content and revenue split)
   */
  async approveProject(
    projectId: number,
    data: {
      approve_content: boolean;
      approve_revenue: boolean;
      feedback?: string;
    }
  ): Promise<CollaborativeProject> {
    const response = await fetch(
      `${API_BASE}/api/collaborative-projects/${projectId}/approve_project/`,
      {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': getCsrfToken(),
        },
        body: JSON.stringify(data),
      }
    );

    return handleResponse<CollaborativeProject>(response);
  },

  /**
   * Mint project as NFT
   */
  async mintProject(
    projectId: number,
    forceMint: boolean = false
  ): Promise<{
    success: boolean;
    nft_id: string;
    token_id: string;
    contract_address: string;
    ipfs_hash: string;
    transaction_hash: string;
  }> {
    const response = await fetch(
      `${API_BASE}/api/collaborative-projects/${projectId}/mint/`,
      {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': getCsrfToken(),
        },
        body: JSON.stringify({ force_mint: forceMint }),
      }
    );

    return handleResponse<{
      success: boolean;
      nft_id: string;
      token_id: string;
      contract_address: string;
      ipfs_hash: string;
      transaction_hash: string;
    }>(response);
  },

  /**
   * Get minting status for a project
   */
  async getMintingStatus(projectId: number): Promise<{
    status: 'not_started' | 'validating' | 'uploading' | 'creating_contract' | 'minting' | 'completed' | 'error';
    stage: string;
    progress: number;
    error?: string;
    nft_data?: {
      id: string;
      token_id: string;
      contract_address: string;
      ipfs_hash: string;
    };
  }> {
    const response = await fetch(
      `${API_BASE}/api/collaborative-projects/${projectId}/minting-status/`,
      {
        method: 'GET',
        credentials: 'include',
      }
    );

    return handleResponse(response);
  },

  /**
   * Cancel approval (reset approval status)
   */
  async cancelApproval(projectId: number): Promise<CollaborativeProject> {
    const response = await fetch(
      `${API_BASE}/api/collaborative-projects/${projectId}/cancel_approval/`,
      {
        method: 'POST',
        credentials: 'include',
        headers: {
          'X-CSRFToken': getCsrfToken(),
        },
      }
    );

    return handleResponse<CollaborativeProject>(response);
  },
};
