import React, { useState } from 'react';
import { useBetaMode } from '../hooks/useBetaMode';

type Props = {
  contentId: number;
};

export default function MintButton({ contentId }: Props) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState<string>('1000000');
  const { isSolanaDevnet, getNetworkLabel } = useBetaMode();

  const parseLamports = (): number | null => {
    const trimmed = (amount || '').trim();
    if (!trimmed) return null;
    // Require positive integer lamports
    if (!/^\d+$/.test(trimmed)) return null;
    const val = Number(trimmed);
    if (!Number.isFinite(val) || val <= 0) return null;
    return val;
  };

  async function onClick() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const lamports = parseLamports();
      if (!lamports) {
        throw new Error('Enter a valid lamports amount (> 0)');
      }
      const res = await fetch('/api/mint/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ content_id: contentId, sale_amount: lamports }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Mint failed');
      }
      setResult(typeof data?.tx_sig === 'string' ? data.tx_sig : 'ok');
    } catch (e: any) {
      setError(e?.message || 'Mint failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      {isSolanaDevnet && (
        <div style={{
          padding: '8px 12px',
          backgroundColor: '#dbeafe',
          color: '#1e40af',
          borderRadius: '6px',
          fontSize: '12px',
          marginBottom: '12px',
          border: '1px solid #3b82f6',
        }}>
          🌐 <strong>Devnet:</strong> Using Solana devnet - NFTs are test-only
        </div>
      )}

      <div style={{ marginBottom: 8 }}>
        <label style={{ fontSize: 12, color: '#94a3b8' }}>
          Sale amount (lamports):
          <input
            value={amount}
            onChange={(e)=> setAmount(e.target.value)}
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="1000000"
            style={{ marginLeft: 8 }}
          />
        </label>
      </div>
      <button onClick={onClick} disabled={loading || !parseLamports()}>
        {loading ? 'Minting…' : `Mint (${getNetworkLabel()})`}
      </button>
      {result && <div>tx: {result}</div>}
      {error && <div style={{ color: 'red' }}>error: {error}</div>}
    </div>
  );
}


