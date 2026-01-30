import React, { useCallback, useState } from 'react';
import { API_URL } from '../config';

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
      const { Web3Auth } = await import('@web3auth/modal');
      const { CHAIN_NAMESPACES } = await import('@web3auth/base');
      const { SolanaPrivateKeyProvider } = await import('@web3auth/solana-provider');
      
      const clientId = import.meta.env.VITE_WEB3AUTH_CLIENT_ID || '';
      if (!clientId) {
        setMsg('Missing VITE_WEB3AUTH_CLIENT_ID');
        setLoading(false);
        return;
      }
      
      const solanaNetwork = import.meta.env.VITE_SOLANA_NETWORK || 'devnet';
      const chainConfig = {
        chainNamespace: CHAIN_NAMESPACES.SOLANA,
        chainId: solanaNetwork === 'mainnet-beta' ? '0x1' : '0x3',
        rpcTarget: import.meta.env.VITE_SOLANA_RPC_URL || (solanaNetwork === 'mainnet-beta' ? 'https://api.mainnet-beta.solana.com' : 'https://api.devnet.solana.com'),
      };
      
      const privateKeyProvider = new SolanaPrivateKeyProvider({
        config: { chainConfig },
      });

      const web3auth = new Web3Auth({
        clientId,
        chainConfig,
        privateKeyProvider,
      });
      await web3auth.init();
      const provider: any = await web3auth.connect();
      const userInfo: any = await web3auth.getUserInfo();
      // Attempt to read the Solana devnet public key for manual capture
      try {
        const accounts: string[] = await (provider?.request?.({ method: 'solana_accounts' }) || web3auth.provider?.request?.({ method: 'solana_accounts' }));
        if (Array.isArray(accounts) && accounts.length > 0) {
          // eslint-disable-next-line no-console
          console.log('[Web3Auth][Devnet] solana pubkey:', accounts[0]);
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('Could not query solana_accounts from provider', e);
      }
      const idToken = userInfo?.idToken || userInfo?.id_token;
      if (!idToken) {
        setMsg('Could not obtain Web3Auth token');
        setLoading(false);
        return;
      }
      // Create or fetch account and establish a session in one step
      const csrfResp = await fetch(`${API_URL}/api/auth/csrf/`, { credentials: 'include' }).then(r=>r.json()).catch(()=>({ csrfToken: '' }));
      const csrf = csrfResp?.csrfToken || '';
      const loginRes = await fetch(`${API_URL}/auth/web3/`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrf, 'X-Requested-With': 'XMLHttpRequest' },
        body: JSON.stringify({ token: idToken })
      });
      if (!loginRes.ok) {
        const t = await loginRes.text();
        setMsg(`Login failed: ${t}`);
        setLoading(false);
        return;
      }
      // Check auth status and optionally link wallet if missing
      const st = await fetch(`${API_URL}/api/auth/status/`, { credentials:'include' }).then(r=>r.json()).catch(()=>({ authenticated:false }));
      if (st?.authenticated) {
        if (!st.wallet_address) {
          try {
            await fetch(`${API_URL}/api/wallet/link/`, {
              method:'POST', credentials:'include',
              headers:{ 'Content-Type':'application/json', 'X-CSRFToken': csrf, 'X-Requested-With': 'XMLHttpRequest' },
              body: JSON.stringify({ web3auth_token: idToken })
            });
          } catch {}
        }
        setMsg('Signed in with Web3Auth');
      } else {
        setMsg('Signed in, but session not detected yet. Refresh the page.');
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
      const res = await fetch(`${API_URL}/api/users/signup/`, {
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
        Continue with Web3Auth to create your account and sign in automatically. You can link or change your wallet later.
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
          <button type="submit" disabled={loading}>{loading ? 'Creating…' : 'Create account with my wallet (no session)'}</button>
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


