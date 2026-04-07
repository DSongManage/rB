/**
 * Campaign API Service
 *
 * Provides functions for managing fundraising campaigns, contributions,
 * and campaign updates. Campaigns use PDA1 (0% fee) for funding,
 * then transfer to PDA2 (3% fee on release) for production.
 */

import { API_URL as API_BASE } from '../config';

// ===== TypeScript Interfaces =====

export interface CampaignTier {
  id?: number;
  title: string;
  description: string;
  minimum_amount: string;
  max_backers?: number | null;
  current_backers?: number;
  order?: number;
  is_available?: boolean;
}

export interface CampaignMediaItem {
  id: number;
  image: string;
  caption: string;
  order: number;
  created_at: string;
}

export interface Campaign {
  id: number;
  title: string;
  description: string;
  pitch_html?: string;
  cover_image?: string;
  content_type: 'book' | 'comic' | 'art';
  campaign_type: 'collaborative' | 'solo';
  funding_goal: string;
  current_amount: string;
  backer_count: number;
  deadline: string;
  status: 'draft' | 'active' | 'funded' | 'transferred' | 'completed' | 'failed' | 'reclaimable' | 'reclaimed' | 'cancelled';
  creator_username: string;
  creator_display_name: string;
  funding_percentage: number;
  is_goal_met: boolean;
  chapter_count?: number;
  chapters_published?: number;
  amount_per_chapter?: string;
  tier_count?: number;
  tiers?: CampaignTier[];
  media?: CampaignMediaItem[];
  project_id?: number;
  project_title?: string;
  campaign_pda?: string;
  escrow_pda?: string;
  funded_at?: string;
  escrow_creation_deadline?: string;
  escrow_dormancy_deadline?: string;
  completed_at?: string;
  contribution_count?: number;
  user_contribution?: string;
  created_at: string;
  updated_at?: string;
}

export interface CampaignContribution {
  id: number;
  amount: string;
  status: 'pending' | 'confirmed' | 'reclaimed' | 'transferred';
  backer_username: string;
  transaction_signature: string;
  created_at: string;
}

export interface CampaignUpdate {
  id: number;
  title: string;
  body: string;
  author_username: string;
  created_at: string;
}

export interface ContributionIntentResponse {
  contribution_id: number;
  amount: string;
  campaign_id: number;
  campaign_title: string;
  has_sufficient_balance: boolean;
  current_balance: string;
  wallet_balance?: string;
  has_wallet_balance?: boolean;
  fee: string;
  fee_note: string;
  on_chain: boolean;
  // Sponsored transaction (when on_chain=true)
  serialized_transaction?: string;
  serialized_message?: string;
  blockhash?: string;
  user_pubkey?: string;
  platform_pubkey?: string;
  amount_lamports?: number;
}

export interface ContributionConfirmResponse {
  contribution_id: number;
  amount: string;
  campaign_status: string;
  current_amount: string;
  funding_percentage: number;
  is_goal_met: boolean;
  transaction_signature?: string;
}

// ===== Helper =====

/**
 * Get fresh CSRF token from API (matches collaborationApi pattern)
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

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorMessage = `Request failed: ${response.statusText}`;
    try {
      const errorData = await response.json();
      if (errorData.error) {
        errorMessage = errorData.error;
      } else if (errorData.detail) {
        errorMessage = errorData.detail;
      } else if (typeof errorData === 'object') {
        const fieldErrors = Object.entries(errorData)
          .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`)
          .join('; ');
        if (fieldErrors) errorMessage = fieldErrors;
      }
    } catch {
      // JSON parsing failed, use default message
    }
    throw new Error(errorMessage);
  }
  return response.json();
}

// ===== Campaign CRUD =====

export const campaignApi = {
  async getCampaigns(): Promise<Campaign[]> {
    const res = await fetch(`${API_BASE}/api/campaigns/`, {
      credentials: 'include',
    });
    return handleResponse<Campaign[]>(res);
  },

  async getCampaign(id: number): Promise<Campaign> {
    const res = await fetch(`${API_BASE}/api/campaigns/${id}/`, {
      credentials: 'include',
    });
    return handleResponse<Campaign>(res);
  },

  async createCampaign(data: {
    title: string;
    description: string;
    pitch_html?: string;
    content_type: string;
    campaign_type: string;
    funding_goal: string;
    deadline: string;
    chapter_count?: number;
    project_id?: number;
    cover_image?: File;
    tiers?: CampaignTier[];
    collaborator_allocations?: { collaborator_role_id: number; username: string; role: string; amount: string }[];
    production_costs?: string;
  }): Promise<Campaign> {
    const csrfToken = await getFreshCsrfToken();
    const formData = new FormData();
    formData.append('title', data.title);
    formData.append('description', data.description);
    if (data.pitch_html) formData.append('pitch_html', data.pitch_html);
    formData.append('content_type', data.content_type);
    formData.append('campaign_type', data.campaign_type);
    formData.append('funding_goal', data.funding_goal);
    formData.append('deadline', data.deadline);
    if (data.chapter_count) formData.append('chapter_count', String(data.chapter_count));
    if (data.project_id) formData.append('project_id', String(data.project_id));
    if (data.cover_image) formData.append('cover_image', data.cover_image);
    if (data.tiers && data.tiers.length > 0) formData.append('tiers_json', JSON.stringify(data.tiers));
    if (data.collaborator_allocations) formData.append('collaborator_allocations', JSON.stringify(data.collaborator_allocations));
    if (data.production_costs) formData.append('production_costs', data.production_costs);

    const res = await fetch(`${API_BASE}/api/campaigns/`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'X-CSRFToken': csrfToken },
      body: formData,
    });
    return handleResponse<Campaign>(res);
  },

  async updateCampaign(id: number, data: Partial<Campaign>): Promise<Campaign> {
    const csrfToken = await getFreshCsrfToken();
    const res = await fetch(`${API_BASE}/api/campaigns/${id}/`, {
      method: 'PATCH',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': csrfToken,
      },
      body: JSON.stringify(data),
    });
    return handleResponse<Campaign>(res);
  },

  // ===== Campaign Actions =====

  async launchCampaign(id: number): Promise<Campaign> {
    const csrfToken = await getFreshCsrfToken();
    const res = await fetch(`${API_BASE}/api/campaigns/${id}/launch/`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': csrfToken,
      },
    });
    return handleResponse<Campaign>(res);
  },

  async cancelCampaign(id: number): Promise<Campaign> {
    const csrfToken = await getFreshCsrfToken();
    const res = await fetch(`${API_BASE}/api/campaigns/${id}/cancel/`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': csrfToken,
      },
    });
    return handleResponse<Campaign>(res);
  },

  async transferToEscrow(id: number): Promise<Campaign> {
    const csrfToken = await getFreshCsrfToken();
    const res = await fetch(`${API_BASE}/api/campaigns/${id}/transfer-to-escrow/`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': csrfToken,
      },
    });
    return handleResponse<Campaign>(res);
  },

  // ===== Contributions =====

  async getContributions(campaignId: number): Promise<CampaignContribution[]> {
    const res = await fetch(`${API_BASE}/api/campaigns/${campaignId}/contributions/`, {
      credentials: 'include',
    });
    return handleResponse<CampaignContribution[]>(res);
  },

  async createContributionIntent(campaignId: number, amount: string): Promise<ContributionIntentResponse> {
    const csrfToken = await getFreshCsrfToken();
    const res = await fetch(`${API_BASE}/api/payment/campaign-intent/`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': csrfToken,
      },
      body: JSON.stringify({ campaign_id: campaignId, amount }),
    });
    return handleResponse<ContributionIntentResponse>(res);
  },

  async submitSignedContribution(
    contributionId: number,
    serializedMessage: string,
    userSignature: string,
  ): Promise<ContributionConfirmResponse> {
    const csrfToken = await getFreshCsrfToken();
    const res = await fetch(`${API_BASE}/api/payment/campaign-submit-signed/`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken },
      body: JSON.stringify({
        contribution_id: contributionId,
        serialized_message: serializedMessage,
        user_signature: userSignature,
      }),
    });
    return handleResponse<ContributionConfirmResponse>(res);
  },

  async confirmContribution(contributionId: number, transactionSignature?: string): Promise<ContributionConfirmResponse> {
    const csrfToken = await getFreshCsrfToken();
    const res = await fetch(`${API_BASE}/api/payment/campaign-confirm/`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': csrfToken,
      },
      body: JSON.stringify({
        contribution_id: contributionId,
        transaction_signature: transactionSignature || '',
      }),
    });
    return handleResponse<ContributionConfirmResponse>(res);
  },

  // ===== Updates =====

  async getUpdates(campaignId: number): Promise<CampaignUpdate[]> {
    const res = await fetch(`${API_BASE}/api/campaigns/${campaignId}/updates/`, {
      credentials: 'include',
    });
    return handleResponse<CampaignUpdate[]>(res);
  },

  async postUpdate(campaignId: number, title: string, body: string): Promise<CampaignUpdate> {
    const csrfToken = await getFreshCsrfToken();
    const res = await fetch(`${API_BASE}/api/campaigns/${campaignId}/updates/`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': csrfToken,
      },
      body: JSON.stringify({ title, body }),
    });
    return handleResponse<CampaignUpdate>(res);
  },

  // ===== Tiers =====

  async getTiers(campaignId: number): Promise<CampaignTier[]> {
    const res = await fetch(`${API_BASE}/api/campaigns/${campaignId}/tiers/`, {
      credentials: 'include',
    });
    return handleResponse<CampaignTier[]>(res);
  },

  async addTier(campaignId: number, tier: CampaignTier): Promise<CampaignTier> {
    const csrfToken = await getFreshCsrfToken();
    const res = await fetch(`${API_BASE}/api/campaigns/${campaignId}/tiers/`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken },
      body: JSON.stringify(tier),
    });
    return handleResponse<CampaignTier>(res);
  },

  async deleteTier(campaignId: number, tierId: number): Promise<void> {
    const csrfToken = await getFreshCsrfToken();
    await fetch(`${API_BASE}/api/campaigns/${campaignId}/tiers/`, {
      method: 'DELETE',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken },
      body: JSON.stringify({ tier_id: tierId }),
    });
  },

  // ===== Media Gallery =====

  async getMedia(campaignId: number): Promise<CampaignMediaItem[]> {
    const res = await fetch(`${API_BASE}/api/campaigns/${campaignId}/media/`, {
      credentials: 'include',
    });
    return handleResponse<CampaignMediaItem[]>(res);
  },

  async uploadMedia(campaignId: number, file: File, caption?: string): Promise<CampaignMediaItem> {
    const csrfToken = await getFreshCsrfToken();
    const formData = new FormData();
    formData.append('image', file);
    if (caption) formData.append('caption', caption);
    const res = await fetch(`${API_BASE}/api/campaigns/${campaignId}/media/`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'X-CSRFToken': csrfToken },
      body: formData,
    });
    return handleResponse<CampaignMediaItem>(res);
  },

  async deleteMedia(campaignId: number, mediaId: number): Promise<void> {
    const csrfToken = await getFreshCsrfToken();
    await fetch(`${API_BASE}/api/campaigns/${campaignId}/media/`, {
      method: 'DELETE',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken },
      body: JSON.stringify({ media_id: mediaId }),
    });
  },

  // ===== My Campaigns (for profile page) =====

  async getMyCampaigns(): Promise<Campaign[]> {
    const res = await fetch(`${API_BASE}/api/campaigns/my-campaigns/`, {
      credentials: 'include',
    });
    return handleResponse<Campaign[]>(res);
  },

  // ===== Reclaim =====

  async reclaimContribution(campaignId: number): Promise<{ contribution_id: number; refund_amount: string; status: string }> {
    const csrfToken = await getFreshCsrfToken();
    const res = await fetch(`${API_BASE}/api/campaigns/${campaignId}/reclaim/`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken },
    });
    return handleResponse(res);
  },

  // ===== Escrow Status =====

  async getEscrowStatus(campaignId: number): Promise<any> {
    const res = await fetch(`${API_BASE}/api/campaigns/${campaignId}/escrow-status/`, {
      credentials: 'include',
    });
    return handleResponse(res);
  },

  // ===== Discovery =====

  async discoverCampaigns(filters?: {
    type?: string;
    content_type?: string;
  }): Promise<Campaign[]> {
    const params = new URLSearchParams();
    if (filters?.type) params.set('type', filters.type);
    if (filters?.content_type) params.set('content_type', filters.content_type);
    const query = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(`${API_BASE}/api/campaigns/discover/${query}`, {
      credentials: 'include',
    });
    return handleResponse<Campaign[]>(res);
  },

  /**
   * Create a campaign + project atomically.
   * Used by the unified campaign wizard — creates CollaborativeProject, Campaign,
   * team roles, milestones with relative deadlines, and reward tiers in one call.
   */
  async createCampaignProject(data: {
    title: string;
    description: string;
    content_type: string;
    pitch_html?: string;
    deadline: string;
    production_costs?: string;
    cover_image?: File;
    team: {
      user_id: number | null;
      username?: string;
      role: string;
      contract_type: string;
      total_amount: string;
      milestones: {
        title: string;
        description?: string;
        amount: string;
        days_after_funding: number;
        milestone_type?: string;
      }[];
    }[];
    tiers: CampaignTier[];
  }): Promise<{ campaign_id: number; project_id: number; funding_goal: string; status: string }> {
    const csrfToken = await getFreshCsrfToken();
    const formData = new FormData();
    formData.append('title', data.title);
    formData.append('description', data.description);
    formData.append('content_type', data.content_type);
    if (data.pitch_html) formData.append('pitch_html', data.pitch_html);
    formData.append('deadline', data.deadline);
    if (data.production_costs) formData.append('production_costs', data.production_costs);
    if (data.cover_image) formData.append('cover_image', data.cover_image);
    formData.append('team', JSON.stringify(data.team));
    formData.append('tiers', JSON.stringify(data.tiers));

    const res = await fetch(`${API_BASE}/api/campaigns/create-with-project/`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'X-CSRFToken': csrfToken },
      body: formData,
    });
    return handleResponse(res);
  },
};

export default campaignApi;
