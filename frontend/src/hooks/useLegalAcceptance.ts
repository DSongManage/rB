/**
 * Hook for checking and managing legal document acceptances.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  DocumentType,
  AcceptanceStatus,
  checkAcceptance,
  checkAllAcceptances,
  acceptLegalDocument,
  getCreatorAgreementStatus,
} from '../services/legalApi';

interface UseLegalAcceptanceResult {
  loading: boolean;
  error: string | null;
  hasAccepted: boolean;
  acceptance: AcceptanceStatus | null;
  accept: () => Promise<boolean>;
  refresh: () => Promise<void>;
}

/**
 * Check acceptance status for a specific document type.
 */
export function useLegalAcceptance(documentType: DocumentType): UseLegalAcceptanceResult {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acceptance, setAcceptance] = useState<AcceptanceStatus | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const status = await checkAcceptance(documentType);
      setAcceptance(status);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check acceptance');
    } finally {
      setLoading(false);
    }
  }, [documentType]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const accept = useCallback(async (): Promise<boolean> => {
    try {
      await acceptLegalDocument(documentType);
      await refresh();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept document');
      return false;
    }
  }, [documentType, refresh]);

  return {
    loading,
    error,
    hasAccepted: acceptance?.accepted ?? false,
    acceptance,
    accept,
    refresh,
  };
}

interface UseCreatorAgreementResult {
  loading: boolean;
  error: string | null;
  hasAccepted: boolean;
  acceptedAt: string | null;
  version: string | null;
  accept: () => Promise<boolean>;
  refresh: () => Promise<void>;
}

/**
 * Specifically check creator agreement status.
 * Used to gate publishing functionality.
 */
export function useCreatorAgreement(): UseCreatorAgreementResult {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<{
    has_accepted: boolean;
    accepted_at: string | null;
    version: string | null;
  } | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getCreatorAgreementStatus();
      setStatus(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check creator agreement');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const accept = useCallback(async (): Promise<boolean> => {
    try {
      await acceptLegalDocument('creator_agreement');
      await refresh();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept creator agreement');
      return false;
    }
  }, [refresh]);

  return {
    loading,
    error,
    hasAccepted: status?.has_accepted ?? false,
    acceptedAt: status?.accepted_at ?? null,
    version: status?.version ?? null,
    accept,
    refresh,
  };
}

interface UseAllAcceptancesResult {
  loading: boolean;
  error: string | null;
  acceptances: Record<DocumentType, AcceptanceStatus> | null;
  pendingTypes: DocumentType[];
  refresh: () => Promise<void>;
}

/**
 * Check acceptance status for all document types.
 */
export function useAllLegalAcceptances(): UseAllAcceptancesResult {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acceptances, setAcceptances] = useState<Record<DocumentType, AcceptanceStatus> | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await checkAllAcceptances();
      setAcceptances(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check acceptances');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const pendingTypes: DocumentType[] = acceptances
    ? (Object.entries(acceptances)
        .filter(([_, status]) => !status.accepted && status.version !== null)
        .map(([type]) => type as DocumentType))
    : [];

  return {
    loading,
    error,
    acceptances,
    pendingTypes,
    refresh,
  };
}

export default useLegalAcceptance;
