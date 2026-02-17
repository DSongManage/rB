/**
 * Payment API Service
 *
 * Handles all API calls for the dual payment system:
 * - Balance management
 * - Purchase intents
 * - Coinbase Onramp
 * - Direct crypto payments
 */

import { API_URL } from '../config';

// Get CSRF token
async function getCsrfToken(): Promise<string> {
  const response = await fetch(`${API_URL}/api/auth/csrf/`, {
    credentials: 'include',
  });
  const data = await response.json();
  return data.csrfToken;
}

// Helper for API calls
async function apiCall<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_URL}${endpoint}`;
  const csrfToken = await getCsrfToken();

  const response = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken': csrfToken,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || error.message || 'Request failed');
  }

  return response.json();
}

// Types
export interface BalanceResponse {
  balance: string;
  display_balance: string;
  last_synced: string | null;
  sync_status: 'synced' | 'syncing' | 'stale' | 'error' | 'no_wallet';
  is_stale: boolean;
  message?: string;
  error?: string;
}

export interface PaymentOption {
  method: 'balance' | 'coinbase' | 'direct_crypto';
  available: boolean;
  label: string;
  description: string;
  primary: boolean;
  minimum_add?: string;
  explanation?: string;
}

export interface PurchaseIntentResponse {
  intent_id: number;
  item: {
    title: string;
    price: string;
    display_price: string;
  };
  total_amount: string;
  display_total: string;
  balance: {
    current: string;
    display: string;
    sufficient: boolean;
    after_purchase: string | null;
  };
  payment_options: PaymentOption[];
  expires_at: string;
}

export interface PaymentMethodSelectionResponse {
  intent_id: number;
  payment_method: string;
  status: string;
  next_step: {
    action: string;
    endpoint: string;
    description: string;
  };
}

export interface BalancePaymentResponse {
  intent_id: number;
  status: string;
  serialized_transaction: string;
  serialized_message: string;
  blockhash: string;
  platform_pubkey: string;
  user_pubkey: string;
  amount: string;
  recipient: string;
  instructions: string;
  submit_endpoint: string;
}

export interface SponsoredPaymentSubmitResponse {
  intent_id: number;
  status: string;
  message: string;
  signature: string;
}

export interface CoinbaseWidgetConfig {
  appId: string;
  destinationWallets?: Array<{
    address: string;
    blockchains: string[];
    assets: string[];
  }>;
  defaultAsset: string;
  defaultNetwork: string;
  presetCryptoAmount: number;
  defaultExperience: string;
  handlingRequestedUrls: boolean;
  partnerUserId: string;
  sessionId: string;
  sessionToken?: string;
  metadata?: Record<string, string>;
}

export interface CoinbaseOnrampResponse {
  widget_config: CoinbaseWidgetConfig;
  transaction_id: number;
  charge_id: string;
  minimum_amount: string;
  amount_to_add: string;
  explanation: string;
}

export interface DirectCryptoPaymentResponse {
  payment_id: number;
  payment_address: string;
  expected_amount: string;
  display_amount: string;
  payment_memo: string;
  qr_code_data: string;
  expires_at: string;
  expires_in_seconds: number;
  instructions: string;
  intent_id: number;
  item: string;
}

export interface PaymentStatusResponse {
  intent_id: number;
  status: string;
  payment_method?: string;
  item?: string;
  total_amount?: string;
  created_at?: string;
  expires_at?: string;
  is_expired?: boolean;
  purchase_id?: number;
  nft_mint_address?: string;
  failure_reason?: string;
  solana_tx_signature?: string;
}

// API Functions
export const paymentApi = {
  // Balance Management
  async getBalance(): Promise<BalanceResponse> {
    return apiCall<BalanceResponse>('/api/balance/');
  },

  async syncBalance(): Promise<BalanceResponse> {
    return apiCall<BalanceResponse>('/api/balance/sync/', {
      method: 'POST',
    });
  },

  async checkBalanceSufficiency(amount: string): Promise<{
    balance: string;
    display_balance: string;
    amount: string;
    sufficient: boolean;
    remaining_after: string;
    shortfall: string;
  }> {
    return apiCall('/api/balance/check/', {
      method: 'POST',
      body: JSON.stringify({ amount }),
    });
  },

  // Purchase Intent
  async createIntent(data: {
    chapter_id?: number;
    content_id?: number;
    cart?: boolean;
  }): Promise<PurchaseIntentResponse> {
    return apiCall<PurchaseIntentResponse>('/api/payment/intent/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async selectPaymentMethod(
    intentId: number,
    method: 'balance' | 'coinbase' | 'direct_crypto'
  ): Promise<PaymentMethodSelectionResponse> {
    return apiCall<PaymentMethodSelectionResponse>(
      `/api/payment/intent/${intentId}/select/`,
      {
        method: 'POST',
        body: JSON.stringify({ method }),
      }
    );
  },

  async payWithBalance(intentId: number): Promise<BalancePaymentResponse> {
    return apiCall<BalancePaymentResponse>(
      `/api/payment/intent/${intentId}/pay-with-balance/`,
      { method: 'POST' }
    );
  },

  async submitSponsoredPayment(
    intentId: number,
    signedTransaction: string,
    userSignatureIndex: number
  ): Promise<SponsoredPaymentSubmitResponse> {
    return apiCall<SponsoredPaymentSubmitResponse>(
      `/api/payment/intent/${intentId}/submit/`,
      {
        method: 'POST',
        body: JSON.stringify({
          signed_transaction: signedTransaction,
          user_signature_index: userSignatureIndex,
        }),
      }
    );
  },

  // Legacy - deprecated
  async confirmBalancePayment(
    intentId: number,
    signature: string
  ): Promise<{ intent_id: number; status: string; message: string; signature: string }> {
    return apiCall(`/api/payment/intent/${intentId}/confirm/`, {
      method: 'POST',
      body: JSON.stringify({ signature }),
    });
  },

  async getIntentStatus(intentId: number): Promise<PaymentStatusResponse> {
    return apiCall<PaymentStatusResponse>(
      `/api/payment/intent/${intentId}/status/`
    );
  },

  // Coinbase Onramp
  async initiateCoinbaseOnramp(intentId: number): Promise<CoinbaseOnrampResponse> {
    return apiCall<CoinbaseOnrampResponse>(
      `/api/coinbase/onramp/${intentId}/`,
      { method: 'POST' }
    );
  },

  async getCoinbaseStatus(transactionId: number): Promise<{
    transaction_id: number;
    charge_id: string;
    status: string;
    fiat_amount: string;
    usdc_amount: string | null;
    created_at: string;
    completed_at?: string;
    solana_tx_signature?: string;
    failure_reason?: string;
    intent_id?: number;
    intent_status?: string;
  }> {
    return apiCall(`/api/coinbase/status/${transactionId}/`);
  },

  async completeCoinbaseOnramp(transactionId: number): Promise<{
    transaction_id: number;
    status: string;
    message: string;
  }> {
    return apiCall(`/api/coinbase/complete/${transactionId}/`, {
      method: 'POST',
    });
  },

  // Direct Crypto
  async initiateDirectCrypto(intentId: number): Promise<DirectCryptoPaymentResponse> {
    return apiCall<DirectCryptoPaymentResponse>(
      `/api/direct-crypto/initiate/${intentId}/`,
      { method: 'POST' }
    );
  },

  async getDirectCryptoStatus(paymentId: number): Promise<{
    payment_id: number;
    status: string;
    expected_amount: string;
    payment_memo: string;
    payment_address: string;
    created_at: string;
    expires_at: string;
    is_expired: boolean;
    expires_in_seconds?: number;
    detected_at?: string;
    from_wallet?: string;
    confirmed_at?: string;
    received_amount?: string;
    solana_tx_signature?: string;
    failure_reason?: string;
    intent_id: number;
    intent_status: string;
    purchase_id?: number;
  }> {
    return apiCall(`/api/direct-crypto/status/${paymentId}/`);
  },

  async cancelDirectCrypto(paymentId: number): Promise<{
    payment_id: number;
    status: string;
    message: string;
  }> {
    return apiCall(`/api/direct-crypto/cancel/${paymentId}/`, {
      method: 'POST',
    });
  },
};

export default paymentApi;
