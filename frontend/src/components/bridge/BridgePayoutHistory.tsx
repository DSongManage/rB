/**
 * Payout history table component.
 */

import React, { useEffect, useState } from 'react';
import { CheckCircle, Clock, XCircle, ExternalLink, RefreshCw } from 'lucide-react';
import { listPayouts } from '../../services/bridgeApi';
import type { BridgeDrain } from '../../types/bridge';

interface BridgePayoutHistoryProps {
  className?: string;
}

export const BridgePayoutHistory: React.FC<BridgePayoutHistoryProps> = ({
  className = '',
}) => {
  const [payouts, setPayouts] = useState<BridgeDrain[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPayouts = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listPayouts();
      setPayouts(data.payouts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load payouts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayouts();
  }, []);

  const statusConfig: Record<
    BridgeDrain['status'],
    { icon: React.ComponentType<{ className?: string }>; color: string; label: string }
  > = {
    pending: { icon: Clock, color: 'text-yellow-600', label: 'Pending' },
    processing: { icon: Clock, color: 'text-blue-600', label: 'Processing' },
    completed: { icon: CheckCircle, color: 'text-green-600', label: 'Completed' },
    failed: { icon: XCircle, color: 'text-red-600', label: 'Failed' },
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className={`bg-white rounded-lg border p-6 ${className}`}>
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="h-6 w-6 text-gray-400 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg border ${className}`}>
      <div className="p-4 border-b flex items-center justify-between">
        <h3 className="text-lg font-semibold">Payout History</h3>
        <button
          onClick={fetchPayouts}
          className="p-2 hover:bg-gray-100 rounded-md"
          title="Refresh"
        >
          <RefreshCw className="h-4 w-4 text-gray-500" />
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 text-sm">{error}</div>
      )}

      {payouts.length === 0 ? (
        <div className="p-8 text-center text-gray-500">
          <p>No payouts yet</p>
          <p className="text-sm mt-1">
            Payouts appear here when USDC is converted to USD
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">
                  Date
                </th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">
                  USDC Amount
                </th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">
                  USD Deposited
                </th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">
                  Fee
                </th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">
                  Status
                </th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">
                  Transaction
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {payouts.map((payout) => {
                const status = statusConfig[payout.status];
                const StatusIcon = status.icon;

                return (
                  <tr key={payout.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm">
                      {formatDate(payout.initiated_at)}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium">
                      ${Number(payout.usdc_amount).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-green-600">
                      ${Number(payout.usd_amount).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      ${Number(payout.fee_amount).toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      <div className={`inline-flex items-center gap-1 ${status.color}`}>
                        <StatusIcon className="h-4 w-4" />
                        <span className="text-sm">{status.label}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {payout.source_tx_signature && (
                        <a
                          href={`https://solscan.io/tx/${payout.source_tx_signature}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
                        >
                          View
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default BridgePayoutHistory;
