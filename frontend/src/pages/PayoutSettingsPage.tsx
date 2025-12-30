/**
 * Payout Settings Page
 * Full configuration page for Bridge.xyz integration and payout preferences.
 */

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Plus, RefreshCw } from 'lucide-react';
import {
  BridgeKYCStatus,
  BridgeBankAccountCard,
  BridgePayoutPreferences,
  BridgePayoutHistory,
} from '../components/bridge';
import {
  getBridgeOnboardingStatus,
  listBankAccounts,
  createLiquidationAddress,
  openBankLinkingFlow,
} from '../services/bridgeApi';
import type {
  BridgeOnboardingStatus,
  BridgeExternalAccount,
} from '../types/bridge';

export const PayoutSettingsPage: React.FC = () => {
  const [status, setStatus] = useState<BridgeOnboardingStatus | null>(null);
  const [bankAccounts, setBankAccounts] = useState<BridgeExternalAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [linkingBank, setLinkingBank] = useState(false);
  const [creatingAddress, setCreatingAddress] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [statusData, accountsData] = await Promise.all([
        getBridgeOnboardingStatus(),
        listBankAccounts().catch(() => ({ accounts: [] })),
      ]);
      setStatus(statusData);
      setBankAccounts(accountsData.accounts || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load payout settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleLinkBankAccount = async () => {
    setLinkingBank(true);
    try {
      await openBankLinkingFlow();
      // Refresh data after linking
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to link bank account');
    } finally {
      setLinkingBank(false);
    }
  };

  const handleCreateLiquidationAddress = async () => {
    const defaultAccount = bankAccounts.find((a) => a.is_default) || bankAccounts[0];
    if (!defaultAccount) {
      setError('Please link a bank account first');
      return;
    }

    setCreatingAddress(true);
    try {
      await createLiquidationAddress(defaultAccount.id);
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create payout address');
    } finally {
      setCreatingAddress(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="flex items-center justify-center py-16">
            <RefreshCw className="h-8 w-8 text-gray-400 animate-spin" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            to="/profile"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Profile
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Payout Settings</h1>
          <p className="mt-2 text-gray-600">
            Configure how you receive your earnings from sales.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
            {error}
            <button
              onClick={() => setError(null)}
              className="ml-2 text-red-800 underline"
            >
              Dismiss
            </button>
          </div>
        )}

        <div className="space-y-6">
          {/* Step 1: KYC Verification */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Step 1: Identity Verification
            </h2>
            <BridgeKYCStatus
              status={status?.kyc_status || null}
              hasCustomer={status?.has_bridge_customer || false}
              onStatusChange={fetchData}
            />
          </section>

          {/* Step 2: Bank Accounts */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                Step 2: Bank Accounts
              </h2>
              {status?.kyc_status === 'approved' && (
                <button
                  onClick={handleLinkBankAccount}
                  disabled={linkingBank}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  <Plus className="h-4 w-4" />
                  {linkingBank ? 'Linking...' : 'Link Bank Account'}
                </button>
              )}
            </div>

            {status?.kyc_status !== 'approved' ? (
              <div className="bg-gray-100 rounded-lg p-6 text-center text-gray-500">
                <p>Complete identity verification to link bank accounts.</p>
              </div>
            ) : bankAccounts.length === 0 ? (
              <div className="bg-white rounded-lg border p-6 text-center">
                <p className="text-gray-600 mb-4">
                  No bank accounts linked yet. Link a bank account to receive
                  direct deposits.
                </p>
                <button
                  onClick={handleLinkBankAccount}
                  disabled={linkingBank}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" />
                  {linkingBank ? 'Linking...' : 'Link Your First Bank Account'}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {bankAccounts.map((account) => (
                  <BridgeBankAccountCard
                    key={account.id}
                    account={account}
                    onUpdate={fetchData}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Step 3: Liquidation Address */}
          {status?.kyc_status === 'approved' && bankAccounts.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Step 3: Payout Address
              </h2>

              {!status?.has_liquidation_address ? (
                <div className="bg-white rounded-lg border p-6">
                  <p className="text-gray-600 mb-4">
                    Create a payout address to enable automatic USDC to USD
                    conversion. Once created, earnings sent to this address will
                    automatically be converted and deposited to your default bank
                    account.
                  </p>
                  <button
                    onClick={handleCreateLiquidationAddress}
                    disabled={creatingAddress}
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {creatingAddress ? 'Creating...' : 'Create Payout Address'}
                  </button>
                </div>
              ) : (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-green-800">
                    <svg
                      className="h-5 w-5"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span className="font-medium">Payout address active</span>
                  </div>
                  <p className="mt-2 text-sm text-green-700">
                    Your payout address is set up and ready to receive USDC. Funds
                    will automatically convert to USD and deposit to your bank.
                  </p>
                </div>
              )}
            </section>
          )}

          {/* Payout Preferences */}
          {status && (
            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Payout Preferences
              </h2>
              <BridgePayoutPreferences
                currentPreferences={{
                  payout_destination: status.payout_destination,
                  bridge_payout_percentage: status.bridge_payout_percentage,
                  pending_bridge_amount: status.pending_bridge_amount,
                }}
                isFullySetup={status.is_fully_setup}
                onUpdate={fetchData}
              />
            </section>
          )}

          {/* Payout History */}
          {status?.is_fully_setup && (
            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Payout History
              </h2>
              <BridgePayoutHistory />
            </section>
          )}

          {/* Info Section */}
          <section className="bg-blue-50 rounded-lg p-6">
            <h3 className="font-semibold text-blue-900 mb-2">
              How Direct Bank Deposits Work
            </h3>
            <ul className="space-y-2 text-sm text-blue-800">
              <li className="flex items-start gap-2">
                <span className="text-blue-600">1.</span>
                Complete identity verification (KYC) - usually takes a few minutes
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600">2.</span>
                Link your bank account securely via Plaid
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600">3.</span>
                Create a payout address to receive automatic conversions
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600">4.</span>
                Choose your payout preference (wallet, bank, or split)
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600">5.</span>
                Earnings above $10 are automatically converted and deposited
              </li>
            </ul>
            <p className="mt-4 text-xs text-blue-600">
              Powered by Bridge.xyz. Funds typically arrive within 1-2 business
              days.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default PayoutSettingsPage;
