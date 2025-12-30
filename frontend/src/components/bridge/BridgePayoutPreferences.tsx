/**
 * Payout preferences form component.
 */

import React, { useState, useEffect } from 'react';
import { Wallet, Building2, GitBranch, Check } from 'lucide-react';
import { updatePayoutPreferences } from '../../services/bridgeApi';
import type { PayoutDestination, PayoutPreferences } from '../../types/bridge';

interface BridgePayoutPreferencesProps {
  currentPreferences: PayoutPreferences;
  isFullySetup: boolean;
  onUpdate?: () => void;
}

export const BridgePayoutPreferences: React.FC<BridgePayoutPreferencesProps> = ({
  currentPreferences,
  isFullySetup,
  onUpdate,
}) => {
  const [destination, setDestination] = useState<PayoutDestination>(
    currentPreferences.payout_destination
  );
  const [percentage, setPercentage] = useState(
    currentPreferences.bridge_payout_percentage
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset saved state when preferences change
  useEffect(() => {
    setSaved(false);
  }, [destination, percentage]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await updatePayoutPreferences(destination, percentage);
      setSaved(true);
      onUpdate?.();
      // Clear saved indicator after 2 seconds
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  const hasChanges =
    destination !== currentPreferences.payout_destination ||
    percentage !== currentPreferences.bridge_payout_percentage;

  const options: Array<{
    value: PayoutDestination;
    label: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    disabled?: boolean;
  }> = [
    {
      value: 'wallet',
      label: 'Web3 Wallet Only',
      description: 'All earnings go to your Web3Auth wallet as USDC.',
      icon: Wallet,
    },
    {
      value: 'bridge',
      label: 'Bank Account Only',
      description: 'All earnings automatically convert to USD and deposit to your bank.',
      icon: Building2,
      disabled: !isFullySetup,
    },
    {
      value: 'split',
      label: 'Split Between Both',
      description: 'Choose a percentage for each destination.',
      icon: GitBranch,
      disabled: !isFullySetup,
    },
  ];

  return (
    <div className="bg-white rounded-lg border p-6">
      <h3 className="text-lg font-semibold mb-4">Payout Destination</h3>
      <p className="text-gray-600 text-sm mb-6">
        Choose where your earnings should be sent when you make sales.
      </p>

      <div className="space-y-3">
        {options.map((option) => {
          const Icon = option.icon;
          const isSelected = destination === option.value;
          const isDisabled = option.disabled;

          return (
            <button
              key={option.value}
              onClick={() => !isDisabled && setDestination(option.value)}
              disabled={isDisabled}
              className={`w-full text-left p-4 rounded-lg border-2 transition-colors ${
                isSelected
                  ? 'border-blue-500 bg-blue-50'
                  : isDisabled
                  ? 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`p-2 rounded-lg ${
                    isSelected ? 'bg-blue-100' : 'bg-gray-100'
                  }`}
                >
                  <Icon
                    className={`h-5 w-5 ${
                      isSelected ? 'text-blue-600' : 'text-gray-500'
                    }`}
                  />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span
                      className={`font-medium ${
                        isSelected ? 'text-blue-900' : 'text-gray-900'
                      }`}
                    >
                      {option.label}
                    </span>
                    {isSelected && (
                      <Check className="h-5 w-5 text-blue-600" />
                    )}
                  </div>
                  <p
                    className={`text-sm mt-0.5 ${
                      isSelected ? 'text-blue-700' : 'text-gray-500'
                    }`}
                  >
                    {option.description}
                  </p>
                  {isDisabled && (
                    <p className="text-xs text-orange-600 mt-1">
                      Complete Bridge setup to enable this option
                    </p>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Split percentage slider */}
      {destination === 'split' && (
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-700">Split Ratio</span>
            <span className="text-sm text-gray-600">
              {percentage}% to Bank / {100 - percentage}% to Wallet
            </span>
          </div>
          <input
            type="range"
            min="10"
            max="100"
            step="10"
            value={percentage}
            onChange={(e) => setPercentage(Number(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>10% Bank</span>
            <span>100% Bank</span>
          </div>
        </div>
      )}

      {/* Pending amount notice */}
      {Number(currentPreferences.pending_bridge_amount) > 0 && (
        <div className="mt-4 p-3 bg-yellow-50 rounded-lg text-sm">
          <span className="font-medium text-yellow-800">
            ${Number(currentPreferences.pending_bridge_amount).toFixed(2)} USDC pending
          </span>
          <p className="text-yellow-700 mt-1">
            This amount is accumulating until it reaches the $10 minimum for bank deposit.
          </p>
        </div>
      )}

      {error && (
        <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="mt-6">
        <button
          onClick={handleSave}
          disabled={saving || !hasChanges}
          className={`px-4 py-2 rounded-md font-medium transition-colors ${
            saved
              ? 'bg-green-600 text-white'
              : hasChanges
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}
        >
          {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
};

export default BridgePayoutPreferences;
