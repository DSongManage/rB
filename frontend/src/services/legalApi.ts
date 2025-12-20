/**
 * Legal API service for fetching and accepting legal documents.
 */

import { API_URL } from '../config';

export type DocumentType = 'tos' | 'privacy' | 'creator_agreement' | 'content_policy' | 'dmca' | 'cookie_policy';

export interface LegalDocument {
  document_type: DocumentType;
  document_type_display: string;
  version: string;
  content: string;
  effective_date: string;
  summary_of_changes: string;
}

export interface AcceptanceStatus {
  accepted: boolean;
  version: string | null;
  accepted_at: string | null;
  display_name?: string;
}

export interface PendingAcceptance {
  document_type: DocumentType;
  version: string;
  document_id: number;
}

/**
 * Fetch a legal document by type.
 */
export async function getLegalDocument(documentType: DocumentType): Promise<LegalDocument> {
  const response = await fetch(`${API_URL}/api/legal/documents/${documentType}/`, {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch legal document: ${documentType}`);
  }

  return response.json();
}

/**
 * Accept a legal document.
 */
export async function acceptLegalDocument(documentType: DocumentType): Promise<{
  accepted: boolean;
  document_type: DocumentType;
  version: string;
  accepted_at: string;
}> {
  // Get CSRF token
  const csrfRes = await fetch(`${API_URL}/api/auth/csrf/`, { credentials: 'include' });
  const csrfData = await csrfRes.json();
  const csrf = csrfData?.csrfToken || '';

  const response = await fetch(`${API_URL}/api/legal/accept/`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken': csrf,
      'X-Requested-With': 'XMLHttpRequest',
    },
    body: JSON.stringify({ document_type: documentType }),
  });

  if (!response.ok) {
    throw new Error(`Failed to accept legal document: ${documentType}`);
  }

  return response.json();
}

/**
 * Check acceptance status for a specific document type.
 */
export async function checkAcceptance(documentType: DocumentType): Promise<AcceptanceStatus> {
  const response = await fetch(
    `${API_URL}/api/legal/check-acceptance/?document_type=${documentType}`,
    { credentials: 'include' }
  );

  if (!response.ok) {
    throw new Error(`Failed to check acceptance: ${documentType}`);
  }

  return response.json();
}

/**
 * Check acceptance status for all document types.
 */
export async function checkAllAcceptances(): Promise<Record<DocumentType, AcceptanceStatus>> {
  const response = await fetch(`${API_URL}/api/legal/check-acceptance/`, {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Failed to check all acceptances');
  }

  return response.json();
}

/**
 * Get list of documents pending user acceptance.
 */
export async function getPendingAcceptances(): Promise<{
  pending: PendingAcceptance[];
  has_pending: boolean;
}> {
  const response = await fetch(`${API_URL}/api/legal/pending-acceptances/`, {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Failed to get pending acceptances');
  }

  return response.json();
}

/**
 * Check if user has accepted the creator agreement.
 */
export async function getCreatorAgreementStatus(): Promise<{
  has_accepted: boolean;
  accepted_at: string | null;
  version: string | null;
}> {
  const response = await fetch(`${API_URL}/api/legal/creator-agreement-status/`, {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Failed to get creator agreement status');
  }

  return response.json();
}
