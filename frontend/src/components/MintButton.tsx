import React, { useState } from 'react';

type Props = {
  contentId: number;
};

export default function MintButton({ contentId }: Props) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/mint/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ content_id: contentId, sale_amount: 1_000_000 }),
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
      <button onClick={onClick} disabled={loading}>
        {loading ? 'Minting…' : 'Mint (devnet)'}
      </button>
      {result && <div>tx: {result}</div>}
      {error && <div style={{ color: 'red' }}>error: {error}</div>}
    </div>
  );
}


