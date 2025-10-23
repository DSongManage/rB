import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Web3Auth } from '@web3auth/modal';
import { CHAIN_NAMESPACES, WALLET_ADAPTERS } from '@web3auth/base';
import { SolanaPrivateKeyProvider } from '@web3auth/solana-provider';
import { OpenloginAdapter } from '@web3auth/openlogin-adapter';

// Use relative URLs - setupProxy.js proxies to backend

type Step = 'account' | 'wallet' | 'done';

type WalletChoice = 'web3auth' | 'own' | 'later';

export default function AuthPage() {
  // Use relative URLs so CRA proxy keeps same-origin in dev
  const apiBase = '';
  const [csrf, setCsrf] = useState('');
  const [mode, setMode] = useState<'login'|'register'>('register');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [msg, setMsg] = useState('');

  const [step, setStep] = useState<Step>('account');
  const [walletChoice, setWalletChoice] = useState<WalletChoice>('web3auth');
  const [ownWallet, setOwnWallet] = useState('');
  const [walletStatus, setWalletStatus] = useState('');
  const navigate = useNavigate();
  const [web3authInstance, setWeb3authInstance] = useState<any>(null);

  const refreshCsrf = async () => {
    try {
      const r = await fetch(`${apiBase}/api/auth/csrf/`, { credentials:'include' });
      const d = await r.json();
      const token = d?.csrfToken || '';
      setCsrf(token);
      return token;
    } catch {
      setCsrf('');
      return '';
    }
  };

  useEffect(()=>{ refreshCsrf(); },[]);

  const ensureAuthenticated = async () => {
    try {
      const st = await fetch(`${apiBase}/api/auth/status/`, { credentials:'include' });
      const data = await st.json();
      if (data?.authenticated) return true;
      // Try programmatic login with provided credentials
      const form = new URLSearchParams();
      form.set('login', username);
      form.set('password', password);
      form.set('next', '/');
      const res = await fetch(`${apiBase}/accounts/login/`, {
        method:'POST', credentials:'include', headers:{ 'Content-Type':'application/x-www-form-urlencoded', 'X-CSRFToken': csrf, 'X-Requested-With': 'XMLHttpRequest' }, body:String(form)
      });
      if (res.ok) {
        await refreshCsrf();
        return true;
      }
    } catch (_) {}
    return false;
  };

  const submitAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg('');
    
    // Refresh CSRF token right before submission to avoid stale token issues
    const freshCsrf = await refreshCsrf();
    if (!freshCsrf) {
      setMsg('Failed to get CSRF token. Please refresh the page.');
      return;
    }
    
    const form = new URLSearchParams();
    form.set('username', username);
    form.set('email', email);
    form.set('password1', password);
    form.set('password2', password2);
    form.set('next', '/');
    
    const res = await fetch(`${apiBase}/accounts/signup/`, {
      method:'POST', credentials:'include', headers:{ 'Content-Type':'application/x-www-form-urlencoded', 'X-CSRFToken': freshCsrf }, body:String(form)
    });
    
    // Check if response is a redirect (302) - success
    if (res.redirected || res.status === 302) {
      // Refresh CSRF after signup (token may rotate) and ensure session is authenticated
      await refreshCsrf();
      const ok = await ensureAuthenticated();
      if (!ok) {
        setMsg('Signed up, but session is not authenticated. Please try signing in.');
        return;
      }
      if (walletChoice === 'web3auth' || walletChoice === 'own') {
        setStep('wallet');
      } else {
        setStep('done');
      }
    } else {
      // Got HTML error page - parse for errors
      const text = await res.text();
      if (text.includes('username') && text.includes('already')) {
        setMsg('Username already exists. Please choose a different username.');
      } else if (text.includes('email') && text.includes('already')) {
        setMsg('Email already exists. Please use a different email or sign in.');
      } else if (text.includes('email') && text.includes('invalid')) {
        setMsg('Invalid email address. Please enter a valid email.');
      } else if (text.includes('password') && text.includes('too common')) {
        setMsg('Password is too common. Please choose a stronger password.');
      } else if (text.includes('password') && text.includes('too short')) {
        setMsg('Password is too short. Please use at least 8 characters.');
      } else if (text.includes('password')) {
        setMsg('Passwords do not match or are invalid.');
      } else {
        setMsg('Signup failed. Please check your information and try again.');
      }
    }
  };

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg('');
    // Get fresh CSRF token
    const freshCsrf = await refreshCsrf();
    if (!freshCsrf) {
      setMsg('Failed to get CSRF token. Please refresh the page.');
      return;
    }
    // Submit via top-level form to ensure cookies set reliably even if proxy is flaky
    const f = document.createElement('form');
    f.method = 'POST';
    f.action = `${apiBase}/accounts/login/` || '/accounts/login/';
    f.style.display = 'none';
    const add = (name:string, value:string) => { const i = document.createElement('input'); i.type='hidden'; i.name=name; i.value=value; f.appendChild(i); };
    add('login', username);
    add('password', password);
    add('next', '/');
    add('csrfmiddlewaretoken', freshCsrf);
    document.body.appendChild(f);
    f.submit();
  };

  const linkWalletWithWeb3Auth = async () => {
    setWalletStatus('Initializing Web3Auth...');
    try {
      if (!csrf) { await refreshCsrf(); }
      const authOk = await ensureAuthenticated();
      if (!authOk) { setWalletStatus('Error: Please sign in again, then retry.'); return; }
      const clientId = import.meta.env.VITE_WEB3AUTH_CLIENT_ID || '';
      console.log('[Web3Auth Debug] Client ID loaded:', clientId ? 'YES (length: ' + clientId.length + ')' : 'NO');
      if (!clientId) { setWalletStatus('Error: Missing Web3Auth client ID. Please contact support.'); return; }
      
      const chainConfig = {
        chainNamespace: CHAIN_NAMESPACES.SOLANA,
        chainId: "0x3", // Solana devnet
        rpcTarget: "https://api.devnet.solana.com",
      };
      
      const privateKeyProvider = new SolanaPrivateKeyProvider({
        config: { chainConfig },
      });

      setWalletStatus('Connecting to Web3Auth...');
      const web3auth = new Web3Auth({
        clientId,
        web3AuthNetwork: 'sapphire_devnet',
        chainConfig,
        privateKeyProvider,
        uiConfig: {
          appName: 'renaissBlock',
          mode: 'dark',
          theme: {
            primary: '#f59e0b',
          },
        },
      });
      
      // Configure and add OpenLogin adapter
      const openloginAdapter = new OpenloginAdapter({
        privateKeyProvider,
        adapterSettings: {
          network: 'sapphire_devnet',
          clientId,
        },
      });
      web3auth.configureAdapter(openloginAdapter);
      console.log('[Web3Auth Debug] OpenLogin adapter configured');
      
      setWalletStatus('Initializing Web3Auth modal...');
      try {
        // CRITICAL: Use initModal() instead of init() for Web3Auth Modal!
        await web3auth.initModal();
        console.log('[Web3Auth Debug] Modal init successful, status:', web3auth.status);
        console.log('[Web3Auth Debug] Connected:', web3auth.connected);
        console.log('[Web3Auth Debug] Provider:', !!web3auth.provider);
      } catch (initError: any) {
        console.error('[Web3Auth Debug] Modal init failed:', initError);
        setWalletStatus(`Error during init: ${initError?.message || String(initError)}`);
        return;
      }
      
      // IMPORTANT: If already connected, logout first to force fresh login
      if (web3auth.connected) {
        console.log('[Web3Auth Debug] Already connected, logging out to force fresh login...');
        try {
          await web3auth.logout();
          console.log('[Web3Auth Debug] Logged out successfully');
        } catch (logoutError) {
          console.warn('[Web3Auth Debug] Logout failed (may not matter):', logoutError);
        }
      }
      
      // Now show modal for fresh login choice
      setWalletStatus('Opening Web3Auth modal...');
      console.log('[Web3Auth Debug] Attempting to connect, status:', web3auth.status);
      console.log('[Web3Auth Debug] Available adapters:', Object.keys(web3auth.walletAdapters || {}));
      
      try {
        // Use connect() to show modal with all login options
        // User can choose which social account to use
        const provider = await web3auth.connect();
        console.log('[Web3Auth Debug] Connect successful, provider:', !!provider);
      } catch (connectError: any) {
        console.error('[Web3Auth Debug] Connect failed:', connectError);
        console.error('[Web3Auth Debug] Full error:', connectError);
        setWalletStatus(`Error: ${connectError?.message || String(connectError)}`);
        return;
      }
      
      const userInfo: any = await web3auth.getUserInfo();
      const idToken = userInfo?.idToken || userInfo?.id_token;
      if (!idToken) { setWalletStatus('Error: Could not obtain Web3Auth token'); return; }
      
      setWalletStatus('Linking wallet to your account...');
      const res = await fetch('/api/wallet/link/', {
        method:'POST', credentials:'include', headers:{ 'Content-Type':'application/json', 'X-CSRFToken': csrf, 'X-Requested-With': 'XMLHttpRequest' }, body: JSON.stringify({ web3auth_token: idToken })
      });
      if (res.ok) {
        setWalletStatus('✅ Wallet created and linked successfully!');
        setTimeout(() => setStep('done'), 1500);
      } else {
        const t = await res.text();
        setWalletStatus(`Error linking wallet: ${t}`);
      }
    } catch (e: any) {
      setWalletStatus(`Error: ${e?.message || String(e)}`);
    }
  };

  const continueWithWeb3Auth = async () => {
    setWalletStatus('Initializing Web3Auth...');
    try {
      if (!csrf) { await refreshCsrf(); }
      const clientId = import.meta.env.VITE_WEB3AUTH_CLIENT_ID || '';
      if (!clientId) { setWalletStatus('Error: Missing Web3Auth client ID'); return; }

      const chainConfig = {
        chainNamespace: CHAIN_NAMESPACES.SOLANA,
        chainId: "0x3",
        rpcTarget: "https://api.devnet.solana.com",
      };
      const privateKeyProvider = new SolanaPrivateKeyProvider({
        config: { chainConfig },
      });
      
      setWalletStatus('Connecting to Web3Auth...');
      const web3auth = new Web3Auth({ 
        clientId,
        web3AuthNetwork: 'sapphire_devnet',
        chainConfig, 
        privateKeyProvider,
        uiConfig: {
          appName: 'renaissBlock',
          mode: 'dark',
          theme: {
            primary: '#f59e0b',
          },
        },
      });

      // Configure and add OpenLogin adapter
      const openloginAdapter = new OpenloginAdapter({
        privateKeyProvider,
        adapterSettings: {
          network: 'sapphire_devnet',
          clientId,
        },
      });
      web3auth.configureAdapter(openloginAdapter);

      setWalletStatus('Initializing Web3Auth modal...');
      await web3auth.initModal();
      
      setWalletStatus('Opening Web3Auth modal...');
      await web3auth.connect();
      
      const userInfo: any = await web3auth.getUserInfo();
      const idToken = userInfo?.idToken || userInfo?.id_token;
      if (!idToken) { setWalletStatus('Error: Could not obtain Web3Auth token'); return; }

      setWalletStatus('Signing you in...');
      // Create a session using Web3Auth on the backend
      const res = await fetch('/auth/web3/', {
        method:'POST', credentials:'include',
        headers:{ 'Content-Type':'application/json', 'X-CSRFToken': csrf, 'X-Requested-With': 'XMLHttpRequest' },
        body: JSON.stringify({ token: idToken })
      });
      if (!res.ok) {
        const t = await res.text();
        setWalletStatus(`Login failed: ${t}`);
        return;
      }
      await refreshCsrf();
      // Poll auth status once
      const st = await fetch('/api/auth/status/', { credentials:'include' }).then(r=>r.json()).catch(()=>({authenticated:false}));
      if (st?.authenticated) {
        // If no wallet present, attempt linking via token (optional)
        if (!st.wallet_address && idToken) {
          try {
            await fetch('/api/wallet/link/', {
              method:'POST', credentials:'include',
              headers:{ 'Content-Type':'application/json', 'X-CSRFToken': csrf, 'X-Requested-With': 'XMLHttpRequest' },
              body: JSON.stringify({ web3auth_token: idToken })
            });
          } catch {}
        }
        setWalletStatus('✅ Signed in successfully!');
        setTimeout(() => navigate('/profile'), 1000);
      } else {
        setWalletStatus('Signed in, but session not detected yet. Please refresh the page.');
      }
    } catch (e: any) {
      setWalletStatus(`Error: ${e?.message || String(e)}`);
    }
  };

  const linkOwnWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    setWalletStatus('');
    if (!csrf) { await refreshCsrf(); }
    const authOk = await ensureAuthenticated();
    if (!authOk) { setWalletStatus('Please sign in again, then retry.'); return; }
    const res = await fetch('/api/wallet/link/', {
      method:'POST', credentials:'include', headers:{ 'Content-Type':'application/json', 'X-CSRFToken': csrf, 'X-Requested-With': 'XMLHttpRequest' }, body: JSON.stringify({ wallet_address: ownWallet })
    });
    if (res.ok) {
      setWalletStatus('Wallet linked');
      setStep('done');
    } else {
      const t = await res.text();
      setWalletStatus(`Failed: ${t}`);
    }
  };

  const AccountStep = (
    <div className="page" style={{maxWidth:480, margin:'40px auto'}}>
      <div style={{display:'flex', gap:8, marginBottom:16}}>
        <button className={mode==='login'? 'chip active':'chip'} onClick={()=>setMode('login')}>Sign in</button>
        <button className={mode==='register'? 'chip active':'chip'} onClick={()=>setMode('register')}>Create account</button>
      </div>

      {mode==='login' ? (
        <div style={{display:'grid', gap:12}}>
          <form onSubmit={signIn} style={{display:'grid', gap:12}}>
            <input value={username} onChange={(e)=>setUsername(e.target.value)} placeholder="Username" required />
            <input type="password" value={password} onChange={(e)=>setPassword(e.target.value)} placeholder="Password" required />
            <button type="submit" style={{marginTop:6}}>Sign in</button>
          </form>
          <div style={{display:'grid', gap:8}}>
            <div style={{height:1, background:'#243048', margin:'6px 0'}}/>
            <button type="button" onClick={continueWithWeb3Auth} style={{display:'inline-flex', alignItems:'center', justifyContent:'center', gap:8}}>
              <span>Continue with Web3Auth</span>
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={submitAccount} style={{display:'grid', gap:12}}>
          <input value={username} onChange={(e)=>setUsername(e.target.value)} placeholder="Username" required />
          <input type="email" value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="Email" required />
          <input type="password" value={password} onChange={(e)=>setPassword(e.target.value)} placeholder="Password" required />
          <input type="password" value={password2} onChange={(e)=>setPassword2(e.target.value)} placeholder="Confirm password" required />

          <div style={{display:'grid', gap:8, marginTop:8}}>
            <label style={{display:'flex', alignItems:'center', gap:8, fontSize:13, color:'#cbd5e1'}}>
              <input type="checkbox" checked={walletChoice==='web3auth'} onChange={(e)=> setWalletChoice(e.target.checked? 'web3auth' : 'later')} />
              Set up a free Web3Auth wallet for me
              <Link to="/wallet-info" style={{marginLeft:6, color:'#60a5fa'}}>Learn more</Link>
            </label>
            <div style={{display:'flex', gap:12, fontSize:13}}>
              <button type="button" onClick={()=> setWalletChoice('own')} style={{background:'transparent', border:'none', color:'#94a3b8', textDecoration:'underline', cursor:'pointer'}}>I’ll use my own wallet</button>
              <button type="button" onClick={()=> setWalletChoice('later')} style={{background:'transparent', border:'none', color:'#94a3b8', textDecoration:'underline', cursor:'pointer'}}>I’ll set up a wallet later</button>
            </div>
            {walletChoice==='own' && (
              <input value={ownWallet} onChange={(e)=>setOwnWallet(e.target.value)} placeholder="Your Solana wallet address" />
            )}
          </div>

          <button type="submit" style={{marginTop:6}}>Create account</button>
        </form>
      )}

      <div style={{marginTop:10, fontSize:12, color:'#94a3b8'}}>{msg || 'Your session is secured with CSRF & cookies.'}</div>
    </div>
  );

  const WalletStep = (
    <div className="page" style={{maxWidth:480, margin:'40px auto'}}>
      <div style={{fontWeight:700, color:'#e5e7eb', marginBottom:8}}>Create your wallet</div>
      {walletChoice==='web3auth' && (
        <div style={{display:'grid', gap:10}}>
          <div style={{fontSize:13, color:'#94a3b8'}}>We’ll create a keyless, non-custodial wallet using Web3Auth.</div>
          <button onClick={linkWalletWithWeb3Auth}>Continue</button>
          <div style={{display:'flex', gap:12}}>
            <button onClick={()=> setStep('account')} style={{background:'transparent', border:'none', color:'#94a3b8', textDecoration:'underline', cursor:'pointer'}}>Back to account</button>
            <button onClick={()=> setStep('done')} style={{background:'transparent', border:'none', color:'#94a3b8', textDecoration:'underline', cursor:'pointer'}}>Skip for now</button>
          </div>
          <div style={{fontSize:12, color:'#94a3b8'}}>{walletStatus}</div>
        </div>
      )}
      {walletChoice==='own' && (
        <form onSubmit={linkOwnWallet} style={{display:'grid', gap:10}}>
          <input value={ownWallet} onChange={(e)=>setOwnWallet(e.target.value)} placeholder="Your Solana wallet address" />
          <div style={{display:'flex', gap:8}}>
            <button type="submit">Link wallet</button>
            <button type="button" onClick={()=> setStep('account')} style={{background:'transparent', border:'none', color:'#94a3b8', textDecoration:'underline', cursor:'pointer'}}>Back</button>
            <button type="button" onClick={()=> setStep('done')} style={{background:'transparent', border:'none', color:'#94a3b8', textDecoration:'underline', cursor:'pointer'}}>Skip</button>
          </div>
          <div style={{fontSize:12, color:'#94a3b8'}}>{walletStatus}</div>
        </form>
      )}
    </div>
  );

  const DoneStep = (
    <div className="page" style={{maxWidth:480, margin:'40px auto', textAlign:'center'}}>
      <div style={{fontSize:18, fontWeight:700, color:'#e5e7eb', marginBottom:8}}>You’re all set</div>
      <div style={{fontSize:13, color:'#94a3b8', marginBottom:16}}>Welcome to renaissBlock. You can link or update your wallet anytime from your profile.</div>
      <div style={{display:'flex', gap:8, justifyContent:'center'}}>
        <button onClick={()=> navigate('/')}>Go to Home</button>
        <button onClick={()=> navigate('/profile')}>Go to Profile</button>
      </div>
    </div>
  );

  const stepIndex = step === 'account' ? 0 : step === 'wallet' ? 1 : 2;
  const stepLabels = ['Account', 'Wallet', 'Done'];

  const Stepper = (
    <div style={{display:'flex', justifyContent:'center', gap:16, alignItems:'center', maxWidth:800, margin:'24px auto', padding:'0 20px'}}>
      {stepLabels.map((label, i)=> {
        const current = i === stepIndex;
        const completed = i < stepIndex;
        return (
          <div key={label} style={{flex: 1, maxWidth: 200}}>
            <div style={{display:'flex', flexDirection:'column', alignItems:'center', gap:8}}>
              <div style={{width:32, height:32, borderRadius:999, border:'2px solid ' + (current || completed ? '#f59e0b' : '#334155'), background: current? '#f59e0b': completed? '#f59e0b' : 'transparent', color: current || completed? '#111':'#94a3b8', display:'grid', placeItems:'center', fontSize:14, fontWeight:700, transition: 'all 0.3s'}}>{i+1}</div>
              <div style={{fontSize:13, color: current? '#f59e0b' : completed? '#cbd5e1' : '#64748b', fontWeight: current? 700:500, textAlign:'center'}}>{label}</div>
            </div>
            <div style={{height:2, marginTop:8, borderRadius:999, background: current? 'linear-gradient(90deg, #f59e0b 0%, rgba(245,158,11,0.3) 100%)' : completed ? '#f59e0b' : '#334155', transition: 'all 0.3s'}} />
          </div>
        );
      })}
    </div>
  );

  return (
    <div>
      {Stepper}
      {step==='account' && AccountStep}
      {step==='wallet' && WalletStep}
      {step==='done' && DoneStep}
    </div>
  );
}
