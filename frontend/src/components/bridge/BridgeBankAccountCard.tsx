/**
 * Bank account card component for displaying linked accounts.
 */

import React, { useState } from 'react';
import { Building, Star, Trash2, MoreVertical } from 'lucide-react';
import { deleteBankAccount, setDefaultBankAccount } from '../../services/bridgeApi';
import type { BridgeExternalAccount } from '../../types/bridge';

interface BridgeBankAccountCardProps {
  account: BridgeExternalAccount;
  onUpdate?: () => void;
}

export const BridgeBankAccountCard: React.FC<BridgeBankAccountCardProps> = ({
  account,
  onUpdate,
}) => {
  const [loading, setLoading] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSetDefault = async () => {
    setLoading(true);
    setError(null);
    try {
      await setDefaultBankAccount(account.id);
      onUpdate?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set default');
    } finally {
      setLoading(false);
      setShowMenu(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to remove this bank account?')) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await deleteBankAccount(account.id);
      onUpdate?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete account');
    } finally {
      setLoading(false);
      setShowMenu(false);
    }
  };

  return (
    <div className="bg-white rounded-lg border p-4 relative">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-gray-100 rounded-lg">
            <Building className="h-5 w-5 text-gray-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium">{account.account_name}</span>
              {account.is_default && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                  <Star className="h-3 w-3" />
                  Default
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500">
              {account.bank_name || 'Bank Account'} &bull; {account.account_type}
            </p>
            {account.last_four && (
              <p className="text-xs text-gray-400 mt-1">
                ****{account.last_four}
              </p>
            )}
          </div>
        </div>

        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1 hover:bg-gray-100 rounded"
            disabled={loading}
          >
            <MoreVertical className="h-5 w-5 text-gray-400" />
          </button>

          {showMenu && (
            <div className="absolute right-0 mt-1 w-48 bg-white rounded-md shadow-lg border z-10">
              {!account.is_default && (
                <button
                  onClick={handleSetDefault}
                  disabled={loading}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  <Star className="h-4 w-4" />
                  Set as Default
                </button>
              )}
              <button
                onClick={handleDelete}
                disabled={loading}
                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Remove Account
              </button>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-3 p-2 bg-red-50 text-red-700 rounded text-sm">
          {error}
        </div>
      )}

      {/* Click outside to close menu */}
      {showMenu && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setShowMenu(false)}
        />
      )}
    </div>
  );
};

export default BridgeBankAccountCard;
