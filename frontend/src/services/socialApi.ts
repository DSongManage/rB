/**
 * Social Engagement API Service
 *
 * Provides functions for managing likes, comments, ratings, and creator reviews.
 */

import { API_URL as API_BASE } from '../config';

// ===== TypeScript Interfaces =====

export interface ContentLike {
  id: number;
  user: number;
  username: string;
  user_avatar: string;
  content: number;
  created_at: string;
}

export interface ContentComment {
  id: number;
  content: number;
  author: number;
  author_username: string;
  author_avatar: string;
  text: string;
  parent_comment: number | null;
  edited: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
  replies_count: number;
  can_delete: boolean;
  can_edit: boolean;
  thread_depth: number;
  replies?: ContentComment[];
}

export interface ContentRating {
  id: number;
  user: number;
  username: string;
  user_avatar: string;
  content: number;
  rating: number;
  review_text: string;
  created_at: string;
  updated_at: string;
}

export interface CreatorReview {
  id: number;
  reviewer: number;
  reviewer_username: string;
  reviewer_avatar: string;
  creator: number;
  creator_username: string;
  rating: number;
  review_text: string;
  verification_type: 'purchase' | 'collaboration';
  verification_display: string;
  response_text: string;
  response_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface LikeToggleResponse {
  liked: boolean;
  like_count: number;
}

export interface CanReviewResponse {
  can_review: boolean;
  verification_type: 'purchase' | 'collaboration' | null;
  reason: string | null;
}

export interface FollowStatusResponse {
  following: boolean;
  follower_count: number;
}

export interface FollowUser {
  id: number;
  username: string;
  display_name: string;
  avatar: string | null;
  bio: string | null;
  followed_at: string;
}

export interface FeedItem {
  id: number;
  title: string;
  content_type: string;
  genre: string;
  price_usd: string;
  cover_image: string | null;
  view_count: number;
  like_count: number;
  created_at: string;
  creator: {
    id: number;
    username: string;
    display_name: string;
    avatar: string | null;
  };
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

// ===== Helper Functions =====

// CSRF token cache to prevent rate limiting
let cachedCsrfToken: string | null = null;
let csrfTokenExpiry: number = 0;
const CSRF_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Get CSRF token from cookies (fallback)
 */
function getCsrfFromCookie(): string {
  const match = document.cookie.match(/csrftoken=([^;]+)/);
  return match ? match[1] : '';
}

/**
 * Get CSRF token with caching to prevent rate limiting
 */
async function getCsrfToken(): Promise<string> {
  const now = Date.now();

  // Return cached token if still valid
  if (cachedCsrfToken && now < csrfTokenExpiry) {
    return cachedCsrfToken;
  }

  // Try to get from cookie first (fastest)
  const cookieToken = getCsrfFromCookie();
  if (cookieToken && cookieToken.length === 64) {
    cachedCsrfToken = cookieToken;
    csrfTokenExpiry = now + CSRF_CACHE_DURATION;
    return cookieToken;
  }

  // Fetch fresh token from API
  try {
    const response = await fetch(`${API_BASE}/api/auth/csrf/`, {
      credentials: 'include',
    });
    if (response.ok) {
      const data = await response.json();
      const token = data?.csrfToken || '';
      if (token) {
        cachedCsrfToken = token;
        csrfTokenExpiry = now + CSRF_CACHE_DURATION;
        return token;
      }
    }
  } catch (error) {
    console.error('Failed to fetch CSRF token:', error);
  }

  // Final fallback to cookie even if not 64 chars
  return getCsrfFromCookie();
}

async function getAuthHeaders(): Promise<HeadersInit> {
  const csrfToken = await getCsrfToken();
  return {
    'Content-Type': 'application/json',
    'X-CSRFToken': csrfToken,
    'X-Requested-With': 'XMLHttpRequest',
  };
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || error.detail || 'Request failed');
  }
  return response.json();
}

// ===== Content Likes =====

export async function toggleLike(contentId: number): Promise<LikeToggleResponse> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/api/content/${contentId}/like/`, {
    method: 'POST',
    headers,
    credentials: 'include',
  });
  return handleResponse<LikeToggleResponse>(response);
}

export async function getLikeStatus(contentId: number): Promise<LikeToggleResponse> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/api/content/${contentId}/like/`, {
    method: 'GET',
    headers,
    credentials: 'include',
  });
  return handleResponse<LikeToggleResponse>(response);
}

// ===== Content Comments =====

export async function getContentComments(
  contentId: number,
  page: number = 1,
  topLevelOnly: boolean = true
): Promise<PaginatedResponse<ContentComment>> {
  const params = new URLSearchParams({
    content: contentId.toString(),
    page: page.toString(),
    top_level: topLevelOnly.toString(),
  });

  const response = await fetch(`${API_BASE}/api/content-comments/?${params}`, {
    credentials: 'include',
  });
  return handleResponse<PaginatedResponse<ContentComment>>(response);
}

export async function getCommentReplies(commentId: number): Promise<ContentComment[]> {
  const response = await fetch(`${API_BASE}/api/content-comments/${commentId}/replies/`, {
    credentials: 'include',
  });
  return handleResponse<ContentComment[]>(response);
}

export async function createComment(
  contentId: number,
  text: string,
  parentCommentId?: number
): Promise<ContentComment> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/api/content-comments/`, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify({
      content: contentId,
      text,
      parent_comment: parentCommentId || null,
    }),
  });
  return handleResponse<ContentComment>(response);
}

export async function updateComment(
  commentId: number,
  text: string
): Promise<ContentComment> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/api/content-comments/${commentId}/`, {
    method: 'PATCH',
    headers,
    credentials: 'include',
    body: JSON.stringify({ text }),
  });
  return handleResponse<ContentComment>(response);
}

export async function deleteComment(commentId: number): Promise<void> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/api/content-comments/${commentId}/`, {
    method: 'DELETE',
    headers,
    credentials: 'include',
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || error.detail || 'Request failed');
  }
}

// ===== Content Ratings =====

export async function getContentRatings(
  contentId: number,
  page: number = 1
): Promise<PaginatedResponse<ContentRating>> {
  const params = new URLSearchParams({
    content: contentId.toString(),
    page: page.toString(),
  });

  const response = await fetch(`${API_BASE}/api/content-ratings/?${params}`, {
    credentials: 'include',
  });
  return handleResponse<PaginatedResponse<ContentRating>>(response);
}

export async function getMyRating(contentId: number): Promise<ContentRating | null> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/api/content-ratings/mine/?content=${contentId}`, {
    headers,
    credentials: 'include',
  });

  if (!response.ok) {
    if (response.status === 404) return null;
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || error.detail || 'Request failed');
  }

  const data = await response.json();
  return data || null;
}

export async function submitRating(
  contentId: number,
  rating: number,
  reviewText?: string
): Promise<ContentRating> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/api/content-ratings/`, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify({
      content: contentId,
      rating,
      review_text: reviewText || '',
    }),
  });
  return handleResponse<ContentRating>(response);
}

// ===== Creator Reviews =====

export async function getCreatorReviews(
  username: string,
  page: number = 1
): Promise<PaginatedResponse<CreatorReview>> {
  const params = new URLSearchParams({
    creator: username,
    page: page.toString(),
  });

  const response = await fetch(`${API_BASE}/api/creator-reviews/?${params}`, {
    credentials: 'include',
  });
  return handleResponse<PaginatedResponse<CreatorReview>>(response);
}

export async function canReviewCreator(userId: number): Promise<CanReviewResponse> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/api/creator-reviews/can-review/${userId}/`, {
    headers,
    credentials: 'include',
  });
  return handleResponse<CanReviewResponse>(response);
}

export async function submitCreatorReview(
  creatorId: number,
  rating: number,
  reviewText?: string
): Promise<CreatorReview> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/api/creator-reviews/`, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify({
      creator: creatorId,
      rating,
      review_text: reviewText || '',
    }),
  });
  return handleResponse<CreatorReview>(response);
}

export async function respondToReview(
  reviewId: number,
  responseText: string
): Promise<CreatorReview> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/api/creator-reviews/${reviewId}/respond/`, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify({ response_text: responseText }),
  });
  return handleResponse<CreatorReview>(response);
}

// ===== User Following =====

export async function followUser(username: string): Promise<FollowStatusResponse> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/api/users/${username}/follow/`, {
    method: 'POST',
    headers,
    credentials: 'include',
  });
  return handleResponse<FollowStatusResponse>(response);
}

export async function unfollowUser(username: string): Promise<FollowStatusResponse> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/api/users/${username}/follow/`, {
    method: 'DELETE',
    headers,
    credentials: 'include',
  });
  return handleResponse<FollowStatusResponse>(response);
}

export async function getFollowStatus(username: string): Promise<FollowStatusResponse> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/api/users/${username}/follow/`, {
    method: 'GET',
    headers,
    credentials: 'include',
  });
  return handleResponse<FollowStatusResponse>(response);
}

export async function getFollowers(
  username: string,
  page: number = 1
): Promise<PaginatedResponse<FollowUser>> {
  const params = new URLSearchParams({ page: page.toString() });
  const response = await fetch(`${API_BASE}/api/users/${username}/followers/?${params}`, {
    credentials: 'include',
  });
  return handleResponse<PaginatedResponse<FollowUser>>(response);
}

export async function getFollowing(
  username: string,
  page: number = 1
): Promise<PaginatedResponse<FollowUser>> {
  const params = new URLSearchParams({ page: page.toString() });
  const response = await fetch(`${API_BASE}/api/users/${username}/following/?${params}`, {
    credentials: 'include',
  });
  return handleResponse<PaginatedResponse<FollowUser>>(response);
}

export async function getFollowingFeed(
  page: number = 1
): Promise<PaginatedResponse<FeedItem>> {
  const headers = await getAuthHeaders();
  const params = new URLSearchParams({ page: page.toString() });
  const response = await fetch(`${API_BASE}/api/feed/following/?${params}`, {
    headers,
    credentials: 'include',
  });
  return handleResponse<PaginatedResponse<FeedItem>>(response);
}

// ===== Default Export =====

export const socialApi = {
  // Likes
  toggleLike,
  getLikeStatus,

  // Comments
  getContentComments,
  getCommentReplies,
  createComment,
  updateComment,
  deleteComment,

  // Ratings
  getContentRatings,
  getMyRating,
  submitRating,

  // Creator Reviews
  getCreatorReviews,
  canReviewCreator,
  submitCreatorReview,
  respondToReview,

  // Following
  followUser,
  unfollowUser,
  getFollowStatus,
  getFollowers,
  getFollowing,
  getFollowingFeed,
};

export default socialApi;
