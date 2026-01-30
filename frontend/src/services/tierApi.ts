/**
 * Creator Tier API Service
 */

import { API_URL as API_BASE } from '../config';

export interface TierProgress {
  tier: string;
  fee_rate: string;
  fee_percent: string;
  lifetime_project_sales: string;
  next_level: string | null;
  next_threshold: string | null;
  progress_to_next: string | null;
  is_founding: boolean;
  founding_slot: {
    project: string;
    claimed_at: string;
    qualifying_amount: string;
  } | null;
}

export interface FoundingStatus {
  slots_total: number;
  slots_claimed: number;
  slots_remaining: number;
  threshold: string;
  is_open: boolean;
}

export interface CreatorTierPublic {
  username: string;
  tier: string;
  fee_percent: string;
  is_founding: boolean;
}

async function fetchWithAuth(url: string): Promise<Response> {
  return fetch(url, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function getMyTierProgress(): Promise<TierProgress> {
  const res = await fetchWithAuth(`${API_BASE}/api/tiers/my-progress/`);
  if (!res.ok) throw new Error('Failed to fetch tier progress');
  return res.json();
}

export async function getFoundingStatus(): Promise<FoundingStatus> {
  const res = await fetch(`${API_BASE}/api/tiers/founding-status/`);
  if (!res.ok) throw new Error('Failed to fetch founding status');
  return res.json();
}

export async function getCreatorTier(username: string): Promise<CreatorTierPublic> {
  const res = await fetch(`${API_BASE}/api/tiers/creator/${username}/`);
  if (!res.ok) throw new Error('Failed to fetch creator tier');
  return res.json();
}
