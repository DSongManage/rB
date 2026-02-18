/**
 * Bridge.xyz TypeScript types for USDC -> USD off-ramp functionality.
 */

// KYC Status
export type KYCStatus = 'not_started' | 'pending' | 'approved' | 'rejected' | 'incomplete';

// Payout destination options
export type PayoutDestination = 'wallet' | 'bridge' | 'split';

// Bridge Customer
export interface BridgeCustomer {
  id: number;
  bridge_customer_id: string;
  kyc_status: KYCStatus;
  kyc_link: string;
  kyc_completed_at: string | null;
  created_at: string;
  updated_at: string;
}

// External Account (Bank Account)
export interface BridgeExternalAccount {
  id: number;
  bridge_external_account_id: string;
  account_name: string;
  bank_name: string;
  last_four: string;
  account_type: 'checking' | 'savings';
  is_active: boolean;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

// Liquidation Address
export interface BridgeLiquidationAddress {
  id: number;
  bridge_liquidation_address_id: string;
  solana_address: string;
  external_account: BridgeExternalAccount;
  is_active: boolean;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
}

// Drain (Off-ramp transaction)
export interface BridgeDrain {
  id: number;
  bridge_drain_id: string;
  usdc_amount: string;
  usd_amount: string;
  fee_amount: string;
  source_tx_signature: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  initiated_at: string;
  completed_at: string | null;
  liquidation_address: BridgeLiquidationAddress;
  created_at: string;
  updated_at: string;
}

// Payout Preferences
export interface PayoutPreferences {
  payout_destination: PayoutDestination;
  bridge_payout_percentage: number;
  pending_bridge_amount: string;
}

// Bridge Onboarding Status
export interface BridgeOnboardingStatus {
  has_bridge_customer: boolean;
  kyc_status: KYCStatus | null;
  kyc_link: string | null;
  has_bank_account: boolean;
  has_liquidation_address: boolean;
  is_fully_setup: boolean;
  payout_destination: PayoutDestination;
  bridge_payout_percentage: number;
  pending_bridge_amount: string;
}

// Manual bank account input (matches Bridge.xyz US account requirements)
export interface ManualBankAccountInput {
  account_number: string;
  routing_number: string;
  checking_or_savings: 'checking' | 'savings';
  account_owner_name: string;
  first_name: string;
  last_name: string;
  street_line_1: string;
  street_line_2?: string;
  city: string;
  state: string;
  postal_code: string;
}

// API Response types
export interface BridgeCustomerResponse {
  message: string;
  customer: BridgeCustomer;
}

export interface KYCLinkResponse {
  url: string;
  kyc_status: KYCStatus;
}

export interface KYCStatusResponse {
  kyc_status: KYCStatus;
  kyc_completed_at: string | null;
}

export interface ExternalAccountsResponse {
  accounts: BridgeExternalAccount[];
}

export interface ExternalAccountResponse {
  message: string;
  account: BridgeExternalAccount;
}

export interface LiquidationAddressesResponse {
  addresses: BridgeLiquidationAddress[];
}

export interface LiquidationAddressResponse {
  message: string;
  address: BridgeLiquidationAddress;
}

export interface PayoutsResponse {
  payouts: BridgeDrain[];
}

export interface PayoutPreferencesUpdateResponse {
  message: string;
  payout_destination: PayoutDestination;
  bridge_payout_percentage: number;
}

export interface BridgeErrorResponse {
  error: string;
  detail?: string;
}
