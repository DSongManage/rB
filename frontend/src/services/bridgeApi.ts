/**
 * Bridge.xyz API service for USDC -> USD off-ramp functionality.
 *
 * Provides methods for:
 * - Customer/KYC management
 * - Bank account linking
 * - Liquidation address management
 * - Payout preferences
 * - Payout history
 */

import { API_URL } from '../config';
import type {
  BridgeOnboardingStatus,
  BridgeCustomerResponse,
  KYCLinkResponse,
  KYCStatusResponse,
  ExternalAccountsResponse,
  ExternalAccountResponse,
  LiquidationAddressesResponse,
  LiquidationAddressResponse,
  PayoutsResponse,
  PayoutPreferences,
  PayoutPreferencesUpdateResponse,
  ManualBankAccountInput,
  PayoutDestination,
} from '../types/bridge';

/**
 * Get CSRF token for authenticated requests.
 */
async function getCsrfToken(): Promise<string> {
  const response = await fetch(`${API_URL}/api/auth/csrf/`, {
    credentials: 'include',
  });
  const data = await response.json();
  return data?.csrfToken || '';
}

/**
 * Make authenticated POST request.
 */
async function postRequest<T>(endpoint: string, body?: object): Promise<T> {
  const csrf = await getCsrfToken();

  const response = await fetch(`${API_URL}${endpoint}`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken': csrf,
      'X-Requested-With': 'XMLHttpRequest',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Request failed: ${response.status}`);
  }

  return response.json();
}

/**
 * Make authenticated DELETE request.
 */
async function deleteRequest<T>(endpoint: string): Promise<T> {
  const csrf = await getCsrfToken();

  const response = await fetch(`${API_URL}${endpoint}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken': csrf,
      'X-Requested-With': 'XMLHttpRequest',
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Request failed: ${response.status}`);
  }

  return response.json();
}

// =============================================================================
// Onboarding Status
// =============================================================================

/**
 * Get complete Bridge onboarding status.
 * Returns KYC status, bank account status, liquidation address status, and preferences.
 */
export async function getBridgeOnboardingStatus(): Promise<BridgeOnboardingStatus> {
  const response = await fetch(`${API_URL}/api/bridge/status/`, {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Failed to get Bridge onboarding status');
  }

  return response.json();
}

// =============================================================================
// Customer / KYC
// =============================================================================

/**
 * Create a Bridge customer for the current user.
 * This is the first step in Bridge onboarding.
 */
export async function createBridgeCustomer(): Promise<BridgeCustomerResponse> {
  return postRequest('/api/bridge/customer/create/');
}

/**
 * Get the KYC verification link.
 * Opens Bridge's hosted KYC flow in a new tab/window.
 */
export async function getKYCLink(): Promise<KYCLinkResponse> {
  const response = await fetch(`${API_URL}/api/bridge/kyc/link/`, {
    credentials: 'include',
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to get KYC link');
  }

  return response.json();
}

/**
 * Get current KYC status.
 * Useful for polling after user returns from KYC flow.
 */
export async function getKYCStatus(): Promise<KYCStatusResponse> {
  const response = await fetch(`${API_URL}/api/bridge/kyc/status/`, {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Failed to get KYC status');
  }

  return response.json();
}

// =============================================================================
// External Accounts (Bank Accounts)
// =============================================================================

/**
 * List all linked bank accounts.
 */
export async function listBankAccounts(): Promise<ExternalAccountsResponse> {
  const response = await fetch(`${API_URL}/api/bridge/accounts/`, {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Failed to list bank accounts');
  }

  return response.json();
}

/**
 * Link a bank account using Plaid.
 * @param plaidProcessorToken Token from Plaid Link flow
 */
export async function linkBankAccountPlaid(
  plaidProcessorToken: string
): Promise<ExternalAccountResponse> {
  return postRequest('/api/bridge/accounts/plaid/', {
    plaid_processor_token: plaidProcessorToken,
  });
}

/**
 * Link a bank account with manual entry.
 * @param accountData Bank account details
 */
export async function linkBankAccountManual(
  accountData: ManualBankAccountInput
): Promise<ExternalAccountResponse> {
  return postRequest('/api/bridge/accounts/manual/', accountData);
}

/**
 * Delete a linked bank account.
 * @param accountId ID of the account to delete
 */
export async function deleteBankAccount(
  accountId: number
): Promise<{ message: string }> {
  return deleteRequest(`/api/bridge/accounts/${accountId}/`);
}

/**
 * Set a bank account as default for new liquidation addresses.
 * @param accountId ID of the account to set as default
 */
export async function setDefaultBankAccount(
  accountId: number
): Promise<ExternalAccountResponse> {
  return postRequest(`/api/bridge/accounts/${accountId}/default/`);
}

// =============================================================================
// Liquidation Addresses
// =============================================================================

/**
 * List all liquidation addresses.
 */
export async function listLiquidationAddresses(): Promise<LiquidationAddressesResponse> {
  const response = await fetch(`${API_URL}/api/bridge/liquidation-addresses/`, {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Failed to list liquidation addresses');
  }

  return response.json();
}

/**
 * Create a new liquidation address.
 * @param externalAccountId Optional - ID of bank account to link. Uses default if not provided.
 */
export async function createLiquidationAddress(
  externalAccountId?: number
): Promise<LiquidationAddressResponse> {
  const body = externalAccountId ? { external_account_id: externalAccountId } : undefined;
  return postRequest('/api/bridge/liquidation-addresses/create/', body);
}

/**
 * Set a liquidation address as primary for receiving payouts.
 * @param addressId ID of the address to set as primary
 */
export async function setPrimaryLiquidationAddress(
  addressId: number
): Promise<LiquidationAddressResponse> {
  return postRequest(`/api/bridge/liquidation-addresses/${addressId}/primary/`);
}

// =============================================================================
// Payouts
// =============================================================================

/**
 * List payout history (drains).
 */
export async function listPayouts(): Promise<PayoutsResponse> {
  const response = await fetch(`${API_URL}/api/bridge/payouts/`, {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Failed to list payouts');
  }

  return response.json();
}

// =============================================================================
// Payout Preferences
// =============================================================================

/**
 * Get current payout preferences.
 */
export async function getPayoutPreferences(): Promise<PayoutPreferences> {
  const response = await fetch(`${API_URL}/api/bridge/preferences/`, {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Failed to get payout preferences');
  }

  return response.json();
}

/**
 * Update payout preferences.
 * @param destination Where to send payouts: 'wallet', 'bridge', or 'split'
 * @param percentage Percentage to send to Bridge (1-100). Only used when destination is 'split'.
 */
export async function updatePayoutPreferences(
  destination: PayoutDestination,
  percentage: number = 100
): Promise<PayoutPreferencesUpdateResponse> {
  return postRequest('/api/bridge/preferences/update/', {
    payout_destination: destination,
    bridge_payout_percentage: percentage,
  });
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Look up bank name from routing number.
 * Returns { valid, bank_name, routing_number } or { valid: false, error }.
 */
export async function lookupRoutingNumber(routingNumber: string): Promise<{
  valid: boolean;
  bank_name?: string;
  error?: string;
}> {
  const response = await fetch(
    `${API_URL}/api/bridge/routing-lookup/?routing_number=${routingNumber}`,
    { credentials: 'include' }
  );
  return response.json();
}

/**
 * Check if Bridge is fully set up for the user.
 * Useful for showing/hiding payout options.
 */
export async function isBridgeFullySetup(): Promise<boolean> {
  try {
    const status = await getBridgeOnboardingStatus();
    return status.is_fully_setup;
  } catch {
    return false;
  }
}

/**
 * Open KYC verification in a new window.
 * Returns the window reference for monitoring.
 */
export async function openKYCFlow(): Promise<Window | null> {
  const { url } = await getKYCLink();
  if (url) {
    return window.open(url, '_blank', 'width=600,height=700');
  }
  return null;
}

/**
 * Open bank account linking flow.
 * This is a placeholder for Plaid Link integration.
 * In production, this would:
 * 1. Get a Plaid Link token from the backend
 * 2. Open Plaid Link in a modal
 * 3. Send the processor token to link the account
 *
 * For MVP, this opens a prompt for manual bank account entry.
 */
export async function openBankLinkingFlow(): Promise<void> {
  // For MVP, we'll use a simple approach - this would be replaced with Plaid Link
  // For now, just return a resolved promise as the manual entry is handled in the UI
  return Promise.resolve();
}

/**
 * Poll KYC status until approved or rejected.
 * @param intervalMs Polling interval in milliseconds (default: 3000)
 * @param maxAttempts Maximum polling attempts (default: 100)
 * @param onStatusChange Callback when status changes
 */
export async function pollKYCStatus(
  intervalMs: number = 3000,
  maxAttempts: number = 100,
  onStatusChange?: (status: KYCStatusResponse) => void
): Promise<KYCStatusResponse> {
  let attempts = 0;
  let lastStatus: string | null = null;

  return new Promise((resolve, reject) => {
    const poll = async () => {
      try {
        const status = await getKYCStatus();

        // Notify on status change
        if (status.kyc_status !== lastStatus) {
          lastStatus = status.kyc_status;
          onStatusChange?.(status);
        }

        // Check for terminal states
        if (status.kyc_status === 'approved' || status.kyc_status === 'rejected') {
          resolve(status);
          return;
        }

        // Continue polling
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(poll, intervalMs);
        } else {
          reject(new Error('KYC status polling timed out'));
        }
      } catch (error) {
        reject(error);
      }
    };

    poll();
  });
}
