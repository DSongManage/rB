import React, { useCallback, useState } from 'react';

export default function SignupForm() {
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [msg, setMsg] = useState('');
  const [usingOwnWallet, setUsingOwnWallet] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');
  const [loading, setLoading] = useState(false);

  const createWithWeb3Auth = useCallback(async () => {
    setMsg('');
    setLoading(true);
    try {
      const { Web3Auth, WEB3AUTH_NETWORK } = await import('@web3auth/modal');
      const clientId = process.env.REACT_APP_WEB3AUTH_CLIENT_ID || '';
      if (!clientId) {
        setMsg('Missing REACT_APP_WEB3AUTH_CLIENT_ID');
        setLoading(false);
        return;
      }
      const web3auth = new Web3Auth({
        clientId,
        web3AuthNetwork: WEB3AUTH_NETWORK.SAPPHIRE_DEVNET,
      });
      await web3auth.init();
      await web3auth.connect();
      const userInfo: any = await web3auth.getUserInfo();
      const idToken = userInfo?.idToken || userInfo?.id_token;
      if (!idToken) {
        setMsg('Could not obtain Web3Auth token');
        setLoading(false);
        return;
      }
      const res = await fetch('http://localhost:8000/api/users/signup/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, display_name: displayName, web3auth_token: idToken })
      });
      if (res.ok) {
        const data = await res.json();
        setMsg(`Created @${data.username} with a new Web3Auth wallet`);
      } else {
        const t = await res.text();
        setMsg(`Failed: ${t}`);
      }
    } catch (e: any) {
      setMsg(`Error: ${e?.message || String(e)}`);
    } finally {
      setLoading(false);
    }
  }, [username, displayName]);

  const submitOwnWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg('');
    setLoading(true);
    try {
      const res = await fetch('http://localhost:8000/api/users/signup/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, display_name: displayName, wallet_address: walletAddress })
      });
      if (res.ok) {
        const data = await res.json();
        setMsg(`Created @${data.username} using your wallet`);
      } else {
        const t = await res.text();
        setMsg(`Failed: ${t}`);
      }
    } catch (e: any) {
      setMsg(`Error: ${e?.message || String(e)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{display:'grid', gap:12}}>
      <div style={{fontSize:14, color:'#cbd5e1'}}>
        By default, we’ll set you up with a Web3Auth wallet (keyless, non-custodial). You can also choose “I’ll use my own wallet”.
      </div>
      <div style={{display:'grid', gap:8}}>
        <input value={username} onChange={(e)=>setUsername(e.target.value)} placeholder="@handle (optional)" />
        <input value={displayName} onChange={(e)=>setDisplayName(e.target.value)} placeholder="Display name" />
      </div>

      {!usingOwnWallet && (
        <button onClick={createWithWeb3Auth} disabled={loading}>
          {loading ? 'Creating with Web3Auth…' : 'Create account with Web3Auth (recommended)'}
        </button>
      )}

      {usingOwnWallet && (
        <form onSubmit={submitOwnWallet} style={{display:'grid', gap:8}}>
          <input value={walletAddress} onChange={(e)=>setWalletAddress(e.target.value)} placeholder="Your Solana wallet address" />
          <button type="submit" disabled={loading}>{loading ? 'Creating…' : 'Create account with my wallet'}</button>
        </form>
      )}

      <button
        type="button"
        style={{background:'transparent', border:'none', color:'#94a3b8', textDecoration:'underline', cursor:'pointer', justifySelf:'start'}}
        onClick={()=> setUsingOwnWallet(v=>!v)}
      >
        {usingOwnWallet ? 'Use Web3Auth instead' : "I’ll use my own wallet"}
      </button>

      <div style={{fontSize:12, color:'#94a3b8'}}>
        {msg || 'Handle is permanent; display name can be edited later.'}
      </div>
    </div>
  );
}


