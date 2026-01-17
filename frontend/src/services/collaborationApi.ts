/**
 * Collaboration API Service
 *
 * Provides functions for managing collaborative projects, invitations,
 * sections, and communication between collaborators.
 */

import { API_URL as API_BASE } from '../config';

// ===== TypeScript Interfaces =====

export interface CopyrightPreview {
  copyright_line: string;
  blockchain_message: string;
  full_text: string;
}

export interface CanMintStatus {
  can_mint: boolean;
  blockers: string[];
}

export interface CollaborativeProject {
  id: number;
  title: string;
  content_type: 'book' | 'music' | 'video' | 'art' | 'comic';
  description: string;
  status: 'draft' | 'active' | 'ready_for_mint' | 'minted' | 'cancelled';
  milestones: Milestone[];
  price_usd: number;
  editions: number;
  teaser_percent: number;
  watermark_preview: boolean;
  authors_note?: string;
  estimated_earnings?: { [userId: number]: number };
  copyright_preview?: CopyrightPreview;
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
  is_solo: boolean;
  cover_image?: string | null;
  // Pre-mint gate fields
  has_active_dispute: boolean;
  has_active_breach: boolean;
  can_mint_status?: CanMintStatus;
}

export interface CollaborativeProjectListItem {
  id: number;
  title: string;
  content_type: string;
  status: string;
  created_by: number;
  created_by_username: string;
  total_collaborators: number;
  created_at: string;
  updated_at: string;
  price_usd: number;
  is_solo: boolean;
  cover_image?: string | null;
}

// Contract task interface for task-based collaboration
export interface ContractTask {
  id: number;
  title: string;
  description: string;
  deadline: string;
  status: 'pending' | 'in_progress' | 'complete' | 'signed_off' | 'cancelled';
  order: number;
  marked_complete_at?: string;
  marked_complete_by?: number;
  marked_complete_by_username?: string;
  completion_notes?: string;
  signed_off_at?: string;
  signed_off_by?: number;
  signed_off_by_username?: string;
  signoff_notes?: string;
  rejection_notes?: string;
  rejected_at?: string;
  is_overdue: boolean;
  days_until_deadline?: number;
  created_at: string;
  updated_at: string;
}

// Role definition for standard roles
export interface RoleDefinition {
  id: number;
  name: string;
  category: 'creator' | 'contributor' | 'reviewer' | 'technical' | 'management';
  description: string;
  applicable_to_book: boolean;
  applicable_to_art: boolean;
  applicable_to_music: boolean;
  applicable_to_video: boolean;
  default_permissions: {
    create: string[];
    edit: { scope: string; types: string[] };
    review: string[];
  };
  ui_components: string[];
  icon: string;
  color: string;
  is_active: boolean;
}

export interface CollaboratorRole {
  id: number;
  user: number;
  username: string;
  display_name: string;
  avatar_url?: string;
  role: string;
  revenue_percentage: number;
  status: 'invited' | 'accepted' | 'declined' | 'exited';
  invited_at: string;
  accepted_at?: string;
  // Legacy permission flags (still supported)
  can_edit_text: boolean;
  can_edit_images: boolean;
  can_edit_audio: boolean;
  can_edit_video: boolean;
  can_edit: string[];
  // New role-based permission fields
  role_definition_id?: number;
  role_definition_details?: RoleDefinition;
  permissions?: {
    create?: string[];
    edit?: { scope: string; types: string[] };
    review?: string[];
  };
  effective_role_name?: string;
  effective_permissions?: {
    create: string[];
    edit: { scope: string; types: string[] };
    review: string[];
  };
  ui_components?: string[];
  // Approval tracking
  approved_current_version: boolean;
  approved_revenue_split: boolean;
  // Counter-proposal fields
  proposed_percentage?: number;
  counter_message?: string;
  // Deadline and accountability fields
  delivery_deadline?: string;
  deadline_extended_at?: string;
  deadline_extension_reason?: string;
  sections_due?: number[];
  // Multi-party governance fields
  is_lead: boolean;
  can_invite_others: boolean;
  voting_weight: number;
  // Contract task fields
  contract_tasks: ContractTask[];
  tasks_total: number;
  tasks_signed_off: number;
  all_tasks_complete: boolean;
  has_active_breach: boolean;
  cancellation_eligible: boolean;
  contract_version: number;
  contract_locked_at?: string;
  // Warranty of originality
  warranty_of_originality_acknowledged: boolean;
  warranty_acknowledged_at?: string;
}

export interface ProjectSection {
  id: number;
  section_type: 'text' | 'image' | 'audio' | 'video';
  title: string;
  content_html?: string;
  synopsis?: string;
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

export interface ContractTaskData {
  title: string;
  description?: string;
  deadline: string;
}

export interface InviteCollaboratorData {
  user_id: number;
  role: string;
  role_definition_id?: number;
  revenue_percentage: number;
  can_edit_text?: boolean;
  can_edit_images?: boolean;
  can_edit_audio?: boolean;
  can_edit_video?: boolean;
  tasks?: ContractTaskData[];
}

export interface CreateProjectData {
  title: string;
  content_type: 'book' | 'music' | 'video' | 'art' | 'comic';
  description?: string;
  milestones?: Milestone[];
  is_solo?: boolean;
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
    const csrfToken = await getFreshCsrfToken();
    const response = await fetch(`${API_BASE}/api/collaborative-projects/`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': csrfToken,
        'X-Requested-With': 'XMLHttpRequest',
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
   * Get all pending collaboration invites for the current user
   * Returns projects where user has status='invited'
   */
  async getPendingInvites(): Promise<{ project: CollaborativeProject; invite: CollaboratorRole }[]> {
    const response = await fetch(`${API_BASE}/api/collaborative-projects/pending_invites/`, {
      method: 'GET',
      credentials: 'include',
    });

    return handleResponse<{ project: CollaborativeProject; invite: CollaboratorRole }[]>(response);
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
        'X-CSRFToken': await getFreshCsrfToken(),
        'X-Requested-With': 'XMLHttpRequest',
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
        'X-CSRFToken': await getFreshCsrfToken(),
        'X-Requested-With': 'XMLHttpRequest',
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
          'X-CSRFToken': await getFreshCsrfToken(),
        'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify(data),
      }
    );

    return handleResponse<CollaboratorRole>(response);
  },

  /**
   * Accept invitation to collaborate
   * @param projectId - The project to accept invitation for
   * @param warrantyAcknowledged - Whether the collaborator acknowledges warranty of originality
   */
  async acceptInvitation(projectId: number, warrantyAcknowledged: boolean = true): Promise<CollaboratorRole> {
    const response = await fetch(
      `${API_BASE}/api/collaborative-projects/${projectId}/accept_invitation/`,
      {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': await getFreshCsrfToken(),
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({
          warranty_of_originality_acknowledged: warrantyAcknowledged,
        }),
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
          'X-CSRFToken': await getFreshCsrfToken(),
        'X-Requested-With': 'XMLHttpRequest',
        },
      }
    );

    return handleResponse<{ message: string }>(response);
  },

  /**
   * Submit counter-proposal for collaboration invitation
   */
  async counterProposeInvite(
    projectId: number,
    data: { proposed_percentage: number; message: string }
  ): Promise<{ message: string; invitation: CollaboratorRole }> {
    const response = await fetch(
      `${API_BASE}/api/collaborative-projects/${projectId}/counter_propose/`,
      {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': await getFreshCsrfToken(),
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify(data),
      }
    );

    return handleResponse<{ message: string; invitation: CollaboratorRole }>(response);
  },

  /**
   * Respond to a counter-proposal (accept or decline)
   * Only project creator can call this
   */
  async respondToCounterProposal(
    projectId: number,
    data: { collaborator_id: number; action: 'accept' | 'decline'; message?: string }
  ): Promise<{ message: string; project: CollaborativeProject }> {
    const response = await fetch(
      `${API_BASE}/api/collaborative-projects/${projectId}/respond-to-counter-proposal/`,
      {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': await getFreshCsrfToken(),
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify(data),
      }
    );

    return handleResponse<{ message: string; project: CollaborativeProject }>(response);
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
          'X-CSRFToken': await getFreshCsrfToken(),
        'X-Requested-With': 'XMLHttpRequest',
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
          'X-CSRFToken': await getFreshCsrfToken(),
        'X-Requested-With': 'XMLHttpRequest',
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
        'X-CSRFToken': await getFreshCsrfToken(),
        'X-Requested-With': 'XMLHttpRequest',
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
        'X-CSRFToken': await getFreshCsrfToken(),
        'X-Requested-With': 'XMLHttpRequest',
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
        'X-CSRFToken': await getFreshCsrfToken(),
        'X-Requested-With': 'XMLHttpRequest',
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
          'X-CSRFToken': await getFreshCsrfToken(),
        'X-Requested-With': 'XMLHttpRequest',
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
        'X-CSRFToken': await getFreshCsrfToken(),
        'X-Requested-With': 'XMLHttpRequest',
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
          'X-CSRFToken': await getFreshCsrfToken(),
        'X-Requested-With': 'XMLHttpRequest',
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
          'X-CSRFToken': await getFreshCsrfToken(),
        'X-Requested-With': 'XMLHttpRequest',
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
        'X-CSRFToken': await getFreshCsrfToken(),
        'X-Requested-With': 'XMLHttpRequest',
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
        'X-CSRFToken': await getFreshCsrfToken(),
        'X-Requested-With': 'XMLHttpRequest',
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
          'X-CSRFToken': await getFreshCsrfToken(),
        'X-Requested-With': 'XMLHttpRequest',
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
          'X-CSRFToken': await getFreshCsrfToken(),
        'X-Requested-With': 'XMLHttpRequest',
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
          'X-CSRFToken': await getFreshCsrfToken(),
        'X-Requested-With': 'XMLHttpRequest',
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
          'X-CSRFToken': await getFreshCsrfToken(),
        'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify(data),
      }
    );

    return handleResponse<CollaborativeProject>(response);
  },

  /**
   * Set the NFT price for a project (project owner only)
   */
  async setPrice(
    projectId: number,
    priceUsd: number
  ): Promise<CollaborativeProject> {
    const response = await fetch(
      `${API_BASE}/api/collaborative-projects/${projectId}/set_price/`,
      {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': await getFreshCsrfToken(),
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({ price_usd: priceUsd }),
      }
    );

    return handleResponse<CollaborativeProject>(response);
  },

  /**
   * Update customization settings (price, editions, teaser)
   * Only project owner can update these settings.
   * Updating these settings resets revenue split approvals.
   */
  async updateCustomization(
    projectId: number,
    settings: {
      price_usd?: number;
      editions?: number;
      teaser_percent?: number;
      watermark_preview?: boolean;
      authors_note?: string;
    }
  ): Promise<CollaborativeProject> {
    const response = await fetch(
      `${API_BASE}/api/collaborative-projects/${projectId}/update_customization/`,
      {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': await getFreshCsrfToken(),
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify(settings),
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
          'X-CSRFToken': await getFreshCsrfToken(),
        'X-Requested-With': 'XMLHttpRequest',
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
          'X-CSRFToken': await getFreshCsrfToken(),
        'X-Requested-With': 'XMLHttpRequest',
        },
      }
    );

    return handleResponse<CollaborativeProject>(response);
  },

  // ===== Proposals & Voting =====

  /**
   * Get all proposals for a project
   */
  async getProposals(projectId: number): Promise<Proposal[]> {
    const response = await fetch(
      `${API_BASE}/api/collaborative-projects/${projectId}/proposals/`,
      {
        method: 'GET',
        credentials: 'include',
      }
    );

    return handleResponse<Proposal[]>(response);
  },

  /**
   * Create a new proposal
   */
  async createProposal(
    projectId: number,
    data: CreateProposalData
  ): Promise<Proposal> {
    const response = await fetch(
      `${API_BASE}/api/collaborative-projects/${projectId}/proposals/`,
      {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': await getFreshCsrfToken(),
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify(data),
      }
    );

    return handleResponse<Proposal>(response);
  },

  /**
   * Cast a vote on a proposal
   */
  async castVote(
    projectId: number,
    proposalId: number,
    data: { vote: 'approve' | 'reject' | 'abstain'; comment?: string }
  ): Promise<ProposalVote> {
    const response = await fetch(
      `${API_BASE}/api/collaborative-projects/${projectId}/proposals/${proposalId}/vote/`,
      {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': await getFreshCsrfToken(),
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify(data),
      }
    );

    return handleResponse<ProposalVote>(response);
  },

  /**
   * Cancel a proposal (only proposer or owner can cancel)
   */
  async cancelProposal(projectId: number, proposalId: number): Promise<{ message: string }> {
    const response = await fetch(
      `${API_BASE}/api/collaborative-projects/${projectId}/proposals/${proposalId}/cancel/`,
      {
        method: 'POST',
        credentials: 'include',
        headers: {
          'X-CSRFToken': await getFreshCsrfToken(),
          'X-Requested-With': 'XMLHttpRequest',
        },
      }
    );

    return handleResponse<{ message: string }>(response);
  },

  // ===== Collaborator Ratings =====

  /**
   * Submit a rating for a collaborator
   */
  async rateCollaborator(
    projectId: number,
    ratedUserId: number,
    data: CollaboratorRatingData
  ): Promise<CollaboratorRating> {
    const response = await fetch(
      `${API_BASE}/api/collaborative-projects/${projectId}/rate_collaborator/`,
      {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': await getFreshCsrfToken(),
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({ rated_user_id: ratedUserId, ...data }),
      }
    );

    return handleResponse<CollaboratorRating>(response);
  },

  /**
   * Get ratings for a user
   */
  async getUserRatings(userId: number): Promise<{
    ratings: CollaboratorRating[];
    average_scores: {
      quality: number;
      deadline: number;
      communication: number;
      would_collab_again: number;
      overall: number;
    };
    total_projects: number;
  }> {
    const response = await fetch(
      `${API_BASE}/api/users/${userId}/ratings/`,
      {
        method: 'GET',
        credentials: 'include',
      }
    );

    return handleResponse(response);
  },

  // ===== Comic Page Management =====

  /**
   * Get all pages for a comic project
   */
  async getComicPages(projectId: number): Promise<ComicPage[]> {
    const response = await fetch(
      `${API_BASE}/api/comic-pages/?project=${projectId}`,
      {
        method: 'GET',
        credentials: 'include',
      }
    );
    return handleResponse<ComicPage[]>(response);
  },

  /**
   * Get a single comic page with panels and bubbles
   */
  async getComicPage(pageId: number): Promise<ComicPage> {
    const response = await fetch(
      `${API_BASE}/api/comic-pages/${pageId}/`,
      {
        method: 'GET',
        credentials: 'include',
      }
    );
    return handleResponse<ComicPage>(response);
  },

  /**
   * Create a new comic page
   */
  async createComicPage(data: CreateComicPageData): Promise<ComicPage> {
    const response = await fetch(`${API_BASE}/api/comic-pages/`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': await getFreshCsrfToken(),
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify(data),
    });
    return handleResponse<ComicPage>(response);
  },

  /**
   * Update a comic page
   */
  async updateComicPage(pageId: number, data: Partial<CreateComicPageData>): Promise<ComicPage> {
    const response = await fetch(`${API_BASE}/api/comic-pages/${pageId}/`, {
      method: 'PATCH',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': await getFreshCsrfToken(),
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify(data),
    });
    return handleResponse<ComicPage>(response);
  },

  /**
   * Delete a comic page
   */
  async deleteComicPage(pageId: number): Promise<void> {
    const response = await fetch(`${API_BASE}/api/comic-pages/${pageId}/`, {
      method: 'DELETE',
      credentials: 'include',
      headers: {
        'X-CSRFToken': await getFreshCsrfToken(),
        'X-Requested-With': 'XMLHttpRequest',
      },
    });
    if (!response.ok) {
      throw new Error(`Failed to delete page: ${response.statusText}`);
    }
  },

  /**
   * Reorder a comic page
   */
  async reorderComicPage(pageId: number, newPosition: number): Promise<{ status: string; new_position: number }> {
    const response = await fetch(`${API_BASE}/api/comic-pages/${pageId}/reorder/`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': await getFreshCsrfToken(),
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({ new_position: newPosition }),
    });
    return handleResponse(response);
  },

  // ===== Comic Panel Management =====

  /**
   * Get all panels for a comic page
   */
  async getComicPanels(pageId: number): Promise<ComicPanel[]> {
    const response = await fetch(
      `${API_BASE}/api/comic-panels/?page=${pageId}`,
      {
        method: 'GET',
        credentials: 'include',
      }
    );
    return handleResponse<ComicPanel[]>(response);
  },

  /**
   * Create a new comic panel
   */
  async createComicPanel(data: CreateComicPanelData): Promise<ComicPanel> {
    const response = await fetch(`${API_BASE}/api/comic-panels/`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': await getFreshCsrfToken(),
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify(data),
    });
    return handleResponse<ComicPanel>(response);
  },

  /**
   * Update a comic panel
   */
  async updateComicPanel(panelId: number, data: Partial<CreateComicPanelData>): Promise<ComicPanel> {
    const response = await fetch(`${API_BASE}/api/comic-panels/${panelId}/`, {
      method: 'PATCH',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': await getFreshCsrfToken(),
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify(data),
    });
    return handleResponse<ComicPanel>(response);
  },

  /**
   * Delete a comic panel
   */
  async deleteComicPanel(panelId: number): Promise<void> {
    const response = await fetch(`${API_BASE}/api/comic-panels/${panelId}/`, {
      method: 'DELETE',
      credentials: 'include',
      headers: {
        'X-CSRFToken': await getFreshCsrfToken(),
        'X-Requested-With': 'XMLHttpRequest',
      },
    });
    if (!response.ok) {
      throw new Error(`Failed to delete panel: ${response.statusText}`);
    }
  },

  /**
   * Upload artwork to a panel
   */
  async uploadPanelArtwork(panelId: number, artworkFile: File): Promise<ComicPanel> {
    const formData = new FormData();
    formData.append('artwork', artworkFile);

    const response = await fetch(`${API_BASE}/api/comic-panels/${panelId}/upload_artwork/`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'X-CSRFToken': await getFreshCsrfToken(),
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: formData,
    });
    return handleResponse<ComicPanel>(response);
  },

  /**
   * Batch update panel positions (for drag operations)
   */
  async batchUpdatePanelPositions(
    panels: Array<{
      id: number;
      x_percent?: number;
      y_percent?: number;
      width_percent?: number;
      height_percent?: number;
      z_index?: number;
      rotation?: number;
    }>
  ): Promise<{ updated: number[] }> {
    const response = await fetch(`${API_BASE}/api/comic-panels/batch_update_positions/`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': await getFreshCsrfToken(),
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({ panels }),
    });
    return handleResponse(response);
  },

  // ===== Speech Bubble Management =====

  /**
   * Get all speech bubbles for a panel
   */
  async getSpeechBubbles(panelId: number): Promise<SpeechBubble[]> {
    const response = await fetch(
      `${API_BASE}/api/speech-bubbles/?panel=${panelId}`,
      {
        method: 'GET',
        credentials: 'include',
      }
    );
    return handleResponse<SpeechBubble[]>(response);
  },

  /**
   * Create a new speech bubble
   */
  async createSpeechBubble(data: CreateSpeechBubbleData): Promise<SpeechBubble> {
    const response = await fetch(`${API_BASE}/api/speech-bubbles/`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': await getFreshCsrfToken(),
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify(data),
    });
    return handleResponse<SpeechBubble>(response);
  },

  /**
   * Update a speech bubble
   */
  async updateSpeechBubble(bubbleId: number, data: Partial<CreateSpeechBubbleData>): Promise<SpeechBubble> {
    const response = await fetch(`${API_BASE}/api/speech-bubbles/${bubbleId}/`, {
      method: 'PATCH',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': await getFreshCsrfToken(),
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify(data),
    });
    return handleResponse<SpeechBubble>(response);
  },

  /**
   * Delete a speech bubble
   */
  async deleteSpeechBubble(bubbleId: number): Promise<void> {
    const response = await fetch(`${API_BASE}/api/speech-bubbles/${bubbleId}/`, {
      method: 'DELETE',
      credentials: 'include',
      headers: {
        'X-CSRFToken': await getFreshCsrfToken(),
        'X-Requested-With': 'XMLHttpRequest',
      },
    });
    if (!response.ok) {
      throw new Error(`Failed to delete bubble: ${response.statusText}`);
    }
  },

  /**
   * Batch create speech bubbles
   */
  async batchCreateSpeechBubbles(bubbles: CreateSpeechBubbleData[]): Promise<{ created: SpeechBubble[] }> {
    const response = await fetch(`${API_BASE}/api/speech-bubbles/batch_create/`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': await getFreshCsrfToken(),
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({ bubbles }),
    });
    return handleResponse(response);
  },

  /**
   * Batch update speech bubble positions
   */
  async batchUpdateBubblePositions(
    bubbles: Array<{
      id: number;
      x_percent?: number;
      y_percent?: number;
      width_percent?: number;
      height_percent?: number;
      z_index?: number;
    }>
  ): Promise<{ updated: number[] }> {
    const response = await fetch(`${API_BASE}/api/speech-bubbles/batch_update_positions/`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': await getFreshCsrfToken(),
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({ bubbles }),
    });
    return handleResponse(response);
  },

  // ===== Divider Line Management (Line-based Panel Layout) =====

  /**
   * Get divider lines for a page
   */
  async getDividerLines(pageId: number): Promise<DividerLine[]> {
    const response = await fetch(`${API_BASE}/api/divider-lines/?page=${pageId}`, {
      method: 'GET',
      credentials: 'include',
    });
    return handleResponse<DividerLine[]>(response);
  },

  /**
   * Create a new divider line
   */
  async createDividerLine(data: CreateDividerLineData): Promise<DividerLine> {
    const response = await fetch(`${API_BASE}/api/divider-lines/`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': await getFreshCsrfToken(),
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify(data),
    });
    return handleResponse<DividerLine>(response);
  },

  /**
   * Update a divider line
   */
  async updateDividerLine(lineId: number, data: Partial<CreateDividerLineData>): Promise<DividerLine> {
    const response = await fetch(`${API_BASE}/api/divider-lines/${lineId}/`, {
      method: 'PATCH',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': await getFreshCsrfToken(),
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify(data),
    });
    return handleResponse<DividerLine>(response);
  },

  /**
   * Delete a divider line
   */
  async deleteDividerLine(lineId: number): Promise<void> {
    const response = await fetch(`${API_BASE}/api/divider-lines/${lineId}/`, {
      method: 'DELETE',
      credentials: 'include',
      headers: {
        'X-CSRFToken': await getFreshCsrfToken(),
        'X-Requested-With': 'XMLHttpRequest',
      },
    });
    if (!response.ok) {
      throw new Error(`Failed to delete divider line: ${response.statusText}`);
    }
  },

  /**
   * Batch create divider lines (for applying templates)
   */
  async batchCreateDividerLines(
    pageId: number,
    lines: Omit<CreateDividerLineData, 'page'>[],
    clearExisting: boolean = false
  ): Promise<{ created: DividerLine[] }> {
    const response = await fetch(`${API_BASE}/api/divider-lines/batch_create/`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': await getFreshCsrfToken(),
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({ page: pageId, lines, clear_existing: clearExisting }),
    });
    return handleResponse(response);
  },

  /**
   * Batch update divider lines
   */
  async batchUpdateDividerLines(
    lines: Array<{
      id: number;
      line_type?: LineType;
      start_x?: number;
      start_y?: number;
      end_x?: number;
      end_y?: number;
      control1_x?: number;
      control1_y?: number;
      control2_x?: number;
      control2_y?: number;
      thickness?: number;
      color?: string;
      order?: number;
    }>
  ): Promise<{ updated: number[] }> {
    const response = await fetch(`${API_BASE}/api/divider-lines/batch_update/`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': await getFreshCsrfToken(),
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({ lines }),
    });
    return handleResponse(response);
  },

  // ===== Comic Series Management =====

  /**
   * Get all comic series for current user
   */
  async getComicSeries(): Promise<ComicSeriesListItem[]> {
    const response = await fetch(`${API_BASE}/api/comic-series/`, {
      method: 'GET',
      credentials: 'include',
    });
    return handleResponse<ComicSeriesListItem[]>(response);
  },

  /**
   * Get a single comic series with details
   */
  async getComicSeriesDetail(seriesId: number): Promise<ComicSeries> {
    const response = await fetch(`${API_BASE}/api/comic-series/${seriesId}/`, {
      method: 'GET',
      credentials: 'include',
    });
    return handleResponse<ComicSeries>(response);
  },

  /**
   * Create a new comic series
   */
  async createComicSeries(data: CreateComicSeriesData): Promise<ComicSeries> {
    const response = await fetch(`${API_BASE}/api/comic-series/`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': await getFreshCsrfToken(),
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify(data),
    });
    return handleResponse<ComicSeries>(response);
  },

  /**
   * Update a comic series
   */
  async updateComicSeries(seriesId: number, data: Partial<CreateComicSeriesData>): Promise<ComicSeries> {
    const response = await fetch(`${API_BASE}/api/comic-series/${seriesId}/`, {
      method: 'PATCH',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': await getFreshCsrfToken(),
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify(data),
    });
    return handleResponse<ComicSeries>(response);
  },

  /**
   * Delete a comic series
   */
  async deleteComicSeries(seriesId: number): Promise<void> {
    const response = await fetch(`${API_BASE}/api/comic-series/${seriesId}/`, {
      method: 'DELETE',
      credentials: 'include',
      headers: {
        'X-CSRFToken': await getFreshCsrfToken(),
        'X-Requested-With': 'XMLHttpRequest',
      },
    });
    if (!response.ok) {
      throw new Error(`Failed to delete series: ${response.statusText}`);
    }
  },

  /**
   * Publish an entire comic series
   */
  async publishComicSeries(seriesId: number): Promise<{ content_id: number; message: string }> {
    const response = await fetch(`${API_BASE}/api/comic-series/${seriesId}/publish/`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'X-CSRFToken': await getFreshCsrfToken(),
        'X-Requested-With': 'XMLHttpRequest',
      },
    });
    return handleResponse(response);
  },

  // ===== Comic Issue Management =====

  /**
   * Get all comic issues (optionally filtered by series or project)
   */
  async getComicIssues(params?: { series?: number; project?: number }): Promise<ComicIssueListItem[]> {
    let url = `${API_BASE}/api/comic-issues/`;
    if (params) {
      const queryParams = new URLSearchParams();
      if (params.series) queryParams.append('series', params.series.toString());
      if (params.project) queryParams.append('project', params.project.toString());
      if (queryParams.toString()) url += `?${queryParams.toString()}`;
    }
    const response = await fetch(url, {
      method: 'GET',
      credentials: 'include',
    });
    return handleResponse<ComicIssueListItem[]>(response);
  },

  /**
   * Get a single comic issue with pages
   */
  async getComicIssueDetail(issueId: number): Promise<ComicIssue> {
    const response = await fetch(`${API_BASE}/api/comic-issues/${issueId}/`, {
      method: 'GET',
      credentials: 'include',
    });
    return handleResponse<ComicIssue>(response);
  },

  /**
   * Create a new comic issue
   */
  async createComicIssue(data: CreateComicIssueData): Promise<ComicIssue> {
    const response = await fetch(`${API_BASE}/api/comic-issues/`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': await getFreshCsrfToken(),
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify(data),
    });
    return handleResponse<ComicIssue>(response);
  },

  /**
   * Update a comic issue
   */
  async updateComicIssue(issueId: number, data: Partial<CreateComicIssueData>): Promise<ComicIssue> {
    const response = await fetch(`${API_BASE}/api/comic-issues/${issueId}/`, {
      method: 'PATCH',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': await getFreshCsrfToken(),
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify(data),
    });
    return handleResponse<ComicIssue>(response);
  },

  /**
   * Delete a comic issue
   */
  async deleteComicIssue(issueId: number): Promise<void> {
    const response = await fetch(`${API_BASE}/api/comic-issues/${issueId}/`, {
      method: 'DELETE',
      credentials: 'include',
      headers: {
        'X-CSRFToken': await getFreshCsrfToken(),
        'X-Requested-With': 'XMLHttpRequest',
      },
    });
    if (!response.ok) {
      throw new Error(`Failed to delete issue: ${response.statusText}`);
    }
  },

  /**
   * Prepare a comic issue for minting (validates and generates preview)
   */
  async prepareComicIssue(issueId: number): Promise<{ ready: boolean; preview_data: any; errors?: string[] }> {
    const response = await fetch(`${API_BASE}/api/comic-issues/${issueId}/prepare/`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'X-CSRFToken': await getFreshCsrfToken(),
        'X-Requested-With': 'XMLHttpRequest',
      },
    });
    return handleResponse(response);
  },

  /**
   * Publish a single comic issue
   */
  async publishComicIssue(issueId: number): Promise<{ content_id: number; message: string }> {
    const response = await fetch(`${API_BASE}/api/comic-issues/${issueId}/publish/`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'X-CSRFToken': await getFreshCsrfToken(),
        'X-Requested-With': 'XMLHttpRequest',
      },
    });
    return handleResponse(response);
  },

  /**
   * Get pages for a specific issue
   */
  async getComicIssuePages(issueId: number): Promise<ComicPage[]> {
    const response = await fetch(`${API_BASE}/api/comic-pages/?issue=${issueId}`, {
      method: 'GET',
      credentials: 'include',
    });
    return handleResponse<ComicPage[]>(response);
  },

  // ===== Artwork Library =====

  /**
   * Get all artwork in a project's library
   */
  async getArtworkLibrary(projectId: number): Promise<ArtworkLibraryItem[]> {
    const response = await fetch(
      `${API_BASE}/api/collaborative-projects/${projectId}/artwork-library/`,
      {
        method: 'GET',
        credentials: 'include',
      }
    );
    return handleResponse<ArtworkLibraryItem[]>(response);
  },

  /**
   * Upload artwork to project library
   */
  async uploadArtworkToLibrary(
    projectId: number,
    file: File,
    title?: string
  ): Promise<ArtworkLibraryItem> {
    const formData = new FormData();
    formData.append('file', file);
    if (title) formData.append('title', title);

    const response = await fetch(
      `${API_BASE}/api/collaborative-projects/${projectId}/artwork-library/`,
      {
        method: 'POST',
        credentials: 'include',
        headers: {
          'X-CSRFToken': await getFreshCsrfToken(),
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: formData,
      }
    );
    return handleResponse<ArtworkLibraryItem>(response);
  },

  /**
   * Delete artwork from project library
   */
  async deleteArtworkFromLibrary(artworkId: number): Promise<void> {
    const response = await fetch(`${API_BASE}/api/artwork-library/${artworkId}/`, {
      method: 'DELETE',
      credentials: 'include',
      headers: {
        'X-CSRFToken': await getFreshCsrfToken(),
        'X-Requested-With': 'XMLHttpRequest',
      },
    });
    if (!response.ok) {
      throw new Error(`Failed to delete artwork: ${response.statusText}`);
    }
  },

  /**
   * Apply artwork from library to a panel
   */
  async applyArtworkToPanel(
    artworkId: number,
    data: {
      panel_id?: number;
      page_id?: number;
      bounds?: { x: number; y: number; width: number; height: number };
    }
  ): Promise<ComicPanel> {
    const response = await fetch(
      `${API_BASE}/api/artwork-library/${artworkId}/apply-to-panel/`,
      {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': await getFreshCsrfToken(),
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify(data),
      }
    );
    return handleResponse<ComicPanel>(response);
  },
};

// ===== Additional TypeScript Interfaces =====

export interface Proposal {
  id: number;
  proposal_type: string;
  title: string;
  description: string;
  proposal_data: Record<string, any>;
  status: 'pending' | 'approved' | 'rejected' | 'expired' | 'cancelled';
  voting_threshold: 'majority' | 'unanimous' | 'owner_decides';
  proposer_id: number;
  proposer_username: string;
  expires_at?: string;
  resolved_at?: string;
  created_at: string;
  votes: ProposalVote[];
  vote_counts: {
    approve: number;
    reject: number;
    abstain: number;
    total: number;
  };
  total_voters: number;
}

export interface ProposalVote {
  id: number;
  voter_id: number;
  voter_username: string;
  vote: 'approve' | 'reject' | 'abstain';
  comment?: string;
  voted_at: string;
}

export interface CreateProposalData {
  proposal_type: string;
  title: string;
  description?: string;
  proposal_data: Record<string, any>;
  voting_threshold?: 'majority' | 'unanimous' | 'owner_decides';
  expires_in_days?: number;
}

export interface CollaboratorRating {
  id: number;
  project_id: number;
  project_title: string;
  rater_id: number;
  rater_username: string;
  rated_user_id: number;
  rated_user_username: string;
  quality_score: number;
  deadline_score: number;
  communication_score: number;
  would_collab_again: number;
  average_score: number;
  private_note?: string;
  public_feedback?: string;
  created_at: string;
}

export interface CollaboratorRatingData {
  quality_score: number;
  deadline_score: number;
  communication_score: number;
  would_collab_again: number;
  private_note?: string;
  public_feedback?: string;
}

// ===== Comic Book Collaboration Interfaces =====

export type BubbleType =
  | 'oval' | 'thought' | 'shout' | 'whisper' | 'narrative' | 'caption' | 'radio' | 'burst'
  // New manga/western types
  | 'flash'     // Manga radial sunburst with speed lines
  | 'wavy'      // Nervous/trembling outline for fear/hesitation
  | 'angry'     // Small hostile spikes around edge
  | 'poof'      // Sound effect cloud (POOF/BAM)
  | 'electric'; // Lightning bolt edges for shock
export type BubbleStyle = 'manga' | 'western' | 'custom';
export type PointerDirection = 'none' | 'top' | 'bottom' | 'left' | 'right' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
export type TailType = 'straight' | 'curved' | 'dots';
export type BorderStyle = 'solid' | 'dashed' | 'none' | 'jagged' | 'wavy';
export type ArtworkFit = 'contain' | 'cover' | 'fill';
export type PageFormat = 'standard' | 'manga' | 'webtoon' | 'custom';

export interface SpeechBubble {
  id: number;
  panel: number;
  bubble_type: BubbleType;
  x_percent: number;
  y_percent: number;
  width_percent: number;
  height_percent: number;
  z_index: number;
  text: string;
  font_family: string;
  font_size: number;
  font_color: string;
  font_weight: 'normal' | 'bold';
  font_style: 'normal' | 'italic';
  text_align: 'left' | 'center' | 'right';
  background_color: string;
  border_color: string;
  border_width: number;
  pointer_direction: PointerDirection;
  pointer_position: number;
  // Draggable tail fields
  tail_end_x_percent: number;  // Where tail tip points (% of panel width)
  tail_end_y_percent: number;  // Where tail tip points (% of panel height)
  tail_type: TailType;         // 'straight', 'curved', or 'dots' for thought bubbles
  // Style preset system (manga vs western)
  bubble_style: BubbleStyle;       // 'manga', 'western', or 'custom'
  speed_lines_enabled: boolean;    // Radial speed lines (manga emphasis)
  halftone_shadow: boolean;        // Halftone dot pattern shadow (western)
  writer?: number;
  writer_username?: string;
  order: number;
  created_at: string;
  updated_at: string;
}

export interface ComicPanel {
  id: number;
  page: number;
  x_percent: number;
  y_percent: number;
  width_percent: number;
  height_percent: number;
  z_index: number;
  border_style: BorderStyle;
  border_width: number;
  border_color: string;
  border_radius: number;
  background_color: string;
  rotation: number;
  skew_x: number;  // Horizontal skew for diagonal effect (-45 to 45)
  skew_y: number;  // Vertical skew for diagonal effect (-45 to 45)
  artwork?: string;
  artwork_fit: ArtworkFit;
  artist?: number;
  artist_username?: string;
  order: number;
  speech_bubbles: SpeechBubble[];
  created_at: string;
  updated_at: string;
}

// Divider Line types for line-based panel layout
export type LineType = 'straight' | 'bezier';

export interface DividerLine {
  id: number;
  page: number;
  line_type: LineType;
  start_x: number;
  start_y: number;
  end_x: number;
  end_y: number;
  control1_x?: number | null;
  control1_y?: number | null;
  control2_x?: number | null;
  control2_y?: number | null;
  thickness?: number | null;
  color?: string | null;
  order: number;
  created_at: string;
  updated_at: string;
}

export interface CreateDividerLineData {
  page: number;
  line_type?: LineType;
  start_x: number;
  start_y: number;
  end_x: number;
  end_y: number;
  control1_x?: number;
  control1_y?: number;
  control2_x?: number;
  control2_y?: number;
  thickness?: number;
  color?: string;
}

// Page orientation types
export type PageOrientation = 'portrait' | 'landscape' | 'square' | 'webtoon' | 'manga_b5' | 'social_square' | 'social_story';

export interface ComicPage {
  id: number;
  project?: number | null;
  issue?: number | null;
  page_number: number;
  page_format: PageFormat;
  canvas_width: number;
  canvas_height: number;
  background_image?: string;
  background_color: string;
  // Line-based layout fields
  orientation: PageOrientation;
  gutter_mode: boolean;
  default_gutter_width: number;
  default_line_color: string;
  layout_version: number;
  // Content
  panels: ComicPanel[];
  divider_lines: DividerLine[];
  created_at: string;
  updated_at: string;
}

export interface ComicPageListItem {
  id: number;
  project: number;
  page_number: number;
  page_format: PageFormat;
  panel_count: number;
}

export interface CreateComicPageData {
  project?: number;
  issue?: number;
  page_format?: PageFormat;
  canvas_width?: number;
  canvas_height?: number;
  background_color?: string;
}

export interface CreateComicPanelData {
  page: number;
  x_percent?: number;
  y_percent?: number;
  width_percent?: number;
  height_percent?: number;
  z_index?: number;
  border_style?: BorderStyle;
  border_width?: number;
  border_color?: string;
  border_radius?: number;
  background_color?: string;
  rotation?: number;
  skew_x?: number;
  skew_y?: number;
  artwork_fit?: ArtworkFit;
}

export interface CreateSpeechBubbleData {
  panel: number;
  bubble_type?: BubbleType;
  x_percent?: number;
  y_percent?: number;
  width_percent?: number;
  height_percent?: number;
  z_index?: number;
  text?: string;
  font_family?: string;
  font_size?: number;
  font_color?: string;
  font_weight?: 'normal' | 'bold';
  font_style?: 'normal' | 'italic';
  text_align?: 'left' | 'center' | 'right';
  background_color?: string;
  border_color?: string;
  border_width?: number;
  pointer_direction?: PointerDirection;
  pointer_position?: number;
  // Draggable tail fields
  tail_end_x_percent?: number;
  tail_end_y_percent?: number;
  tail_type?: TailType;
  // Style system fields
  bubble_style?: BubbleStyle;
  speed_lines_enabled?: boolean;
  halftone_shadow?: boolean;
}

// ===== Comic Series & Issue Interfaces =====

export interface ComicSeries {
  id: number;
  creator: number;
  creator_username: string;
  title: string;
  synopsis: string;
  cover_image?: string | null;
  is_published: boolean;
  published_content?: number | null;
  issue_count: number;
  total_pages: number;
  created_at: string;
  updated_at: string;
  issues?: ComicIssue[];
}

export interface ComicSeriesListItem {
  id: number;
  creator: number;
  creator_username: string;
  title: string;
  cover_image?: string | null;
  is_published: boolean;
  issue_count: number;
  created_at: string;
  updated_at: string;
}

export interface ComicIssue {
  id: number;
  series?: number | null;
  series_title?: string | null;
  project?: number | null;
  project_title?: string | null;
  title: string;
  issue_number: number;
  synopsis: string;
  cover_image?: string | null;
  price: number;
  is_published: boolean;
  is_listed: boolean;
  published_content?: number | null;
  page_count: number;
  created_at: string;
  updated_at: string;
  pages?: ComicPage[];
}

export interface ComicIssueListItem {
  id: number;
  series?: number | null;
  project?: number | null;
  title: string;
  issue_number: number;
  cover_image?: string | null;
  price: number;
  is_published: boolean;
  is_listed: boolean;
  page_count: number;
  created_at: string;
  updated_at: string;
}

export interface CreateComicSeriesData {
  title: string;
  synopsis?: string;
}

export interface CreateComicIssueData {
  series?: number;
  project?: number;
  title: string;
  issue_number?: number;
  synopsis?: string;
  price?: number;
}

// ===== Artwork Library Interfaces =====

export interface ArtworkLibraryItem {
  id: number;
  project: number;
  file: string;
  file_url: string;
  thumbnail?: string;
  thumbnail_url: string;
  title: string;
  filename: string;
  width: number;
  height: number;
  file_size: number;
  uploader: number;
  uploader_username: string;
  usage_count: number;
  created_at: string;
  updated_at: string;
}
