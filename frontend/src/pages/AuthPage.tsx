import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Web3Auth } from '@web3auth/modal';
import { CHAIN_NAMESPACES, WALLET_ADAPTERS } from '@web3auth/base';
import { SolanaPrivateKeyProvider } from '@web3auth/solana-provider';
import { OpenloginAdapter } from '@web3auth/openlogin-adapter';
import { API_URL } from '../config';
import { useAuth } from '../hooks/useAuth';
// CircleWalletSetup removed - Web3Auth handles wallet creation automatically

type Step = 'account' | 'wallet' | 'done';

type WalletChoice = 'web3auth' | 'own' | 'later';

export default function AuthPage() {
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
  const { refreshAuth } = useAuth();

  // Beta invite code handling
  const [searchParams] = useSearchParams();
  const [inviteCode, setInviteCode] = useState('');
  const [inviteValid, setInviteValid] = useState<boolean | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [validatingInvite, setValidatingInvite] = useState(false);
  const [tosAccepted, setTosAccepted] = useState(false);

  const refreshCsrf = async () => {
    try {
      const r = await fetch(`${API_URL}/api/auth/csrf/`, { credentials:'include' });
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

  // Validate invite code from URL parameter
  useEffect(() => {
    const inviteParam = searchParams.get('invite');
    if (inviteParam) {
      setInviteCode(inviteParam);
      setMode('register'); // Switch to register mode if invite code is present
      validateInviteCode(inviteParam);
    }
  }, [searchParams]);

  const validateInviteCode = async (code: string) => {
    if (!code || code.trim() === '') {
      setInviteValid(null);
      return;
    }

    setValidatingInvite(true);
    try {
      const response = await fetch(`${API_URL}/api/beta/validate/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ invite_code: code.trim().toUpperCase() }),
      });

      const data = await response.json();

      if (data.valid) {
        setInviteValid(true);
        setInviteEmail(data.email || '');
        // Pre-populate email if provided by invite
        if (data.email && !email) {
          setEmail(data.email);
        }
      } else {
        setInviteValid(false);
        setMsg(data.error || 'Invalid invite code');
      }
    } catch (error) {
      console.error('Invite validation error:', error);
      setInviteValid(false);
      setMsg('Failed to validate invite code');
    } finally {
      setValidatingInvite(false);
    }
  };

  const ensureAuthenticated = async () => {
    try {
      const st = await fetch(`${API_URL}/api/auth/status/`, { credentials:'include' });
      const data = await st.json();
      if (data?.authenticated) return true;
      // Try programmatic login with provided credentials using custom endpoint
      const res = await fetch(`${API_URL}/api/users/login/`, {
        method:'POST',
        credentials:'include',
        headers:{
          'Content-Type':'application/json',
          'X-CSRFToken': csrf,
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify({
          username: username,
          password: password
        })
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

    // Beta mode: require invite code
    if (!inviteCode || inviteCode.trim() === '') {
      setMsg('Beta invite code is required. Please request access from the beta page.');
      return;
    }

    if (!inviteValid) {
      setMsg('Please provide a valid beta invite code.');
      return;
    }

    // Refresh CSRF token right before submission to avoid stale token issues
    const freshCsrf = await refreshCsrf();
    if (!freshCsrf) {
      setMsg('Failed to get CSRF token. Please refresh the page.');
      return;
    }

    // Validate password match
    if (password !== password2) {
      setMsg('Passwords do not match');
      return;
    }

    if (!password || password.length < 6) {
      setMsg('Password must be at least 6 characters');
      return;
    }

    // Require ToS acceptance
    if (!tosAccepted) {
      setMsg('Please accept the Terms of Service and Privacy Policy to create an account.');
      return;
    }

    // Use DRF signup endpoint with invite code
    try {
      const res = await fetch(`${API_URL}/api/users/signup/`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': freshCsrf,
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({
          username: username,
          email: email || inviteEmail, // Use invite email if not provided
          invite_code: inviteCode.trim().toUpperCase(),
          password: password,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        // Signup successful
        await refreshCsrf();
        const ok = await ensureAuthenticated();
        if (!ok) {
          setMsg('Signed up successfully! Please sign in with your credentials.');
          setMode('login');
          return;
        }
        // Refresh auth state after successful signup and login
        refreshAuth();
        // Circle W3S creates wallet automatically in background
        // Skip wallet step and go directly to done
        if (walletChoice === 'web3auth') {
          // Show success message that wallet is being created
          setMsg('Account created! Your Solana wallet is being set up automatically.');
          setStep('done');
        } else if (walletChoice === 'own') {
          // User wants to link their own wallet
          setStep('wallet');
        } else {
          // No wallet setup - go to home
          window.location.href = '/';
        }
      } else {
        // Handle errors from DRF
        if (data.invite_code) {
          setMsg(Array.isArray(data.invite_code) ? data.invite_code[0] : data.invite_code);
        } else if (data.email) {
          setMsg(Array.isArray(data.email) ? data.email[0] : data.email);
        } else if (data.username) {
          setMsg(Array.isArray(data.username) ? data.username[0] : data.username);
        } else if (data.error) {
          setMsg(data.error);
        } else {
          setMsg('Signup failed. Please check your information and try again.');
        }
      }
    } catch (error) {
      console.error('Signup error:', error);
      setMsg('Network error. Please try again.');
    }
  };

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg('');
    // Get fresh CSRF token
    const freshCsrf = await refreshCsrf();
    console.log('[Login] Got CSRF token:', freshCsrf ? 'yes' : 'no');
    if (!freshCsrf) {
      setMsg('Failed to get CSRF token. Please refresh the page.');
      return;
    }

    try {
      // Use custom DRF login endpoint
      console.log('[Login] Sending login request...');
      const res = await fetch(`${API_URL}/api/users/login/`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': freshCsrf,
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({
          username: username,
          password: password,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        // Login successful
        setMsg('Login successful! Redirecting...');

        // Wait a moment for session to be fully established, then hard reload to profile
        // Hard reload ensures fresh auth state check
        setTimeout(() => {
          window.location.href = '/profile';
        }, 500);
      } else {
        // Show error from backend
        setMsg(data.error || 'Invalid username or password');
      }
    } catch (error) {
      console.error('Login error:', error);
      setMsg('Network error. Please try again.');
    }
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
      web3auth.configureAdapter(openloginAdapter as any);
      console.log('[Web3Auth Debug] OpenLogin adapter configured');
      
      setWalletStatus('Initializing Web3Auth modal...');
      try {
        // CRITICAL: Use initModal() instead of init() for Web3Auth Modal!
        await web3auth.initModal();
        console.log('[Web3Auth Debug] Modal init successful, status:', web3auth.status);
        console.log('[Web3Auth Debug] Connected:', web3auth.connected);
        console.log('[Web3Auth Debug] Provider:', !!web3auth.provider);
      } catch (initError) {
        console.error('[Web3Auth Debug] Modal init failed:', initError);
        setWalletStatus(`Error during init: ${initError instanceof Error ? initError.message : String(initError)}`);
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
      } catch (connectError) {
        console.error('[Web3Auth Debug] Connect failed:', connectError);
        console.error('[Web3Auth Debug] Full error:', connectError);
        setWalletStatus(`Error: ${connectError instanceof Error ? connectError.message : String(connectError)}`);
        return;
      }
      
      const userInfo: any = await web3auth.getUserInfo();
      const idToken = userInfo?.idToken || userInfo?.id_token;
      if (!idToken) { setWalletStatus('Error: Could not obtain Web3Auth token'); return; }
      
      setWalletStatus('Linking wallet to your account...');
      const res = await fetch(`${API_URL}/api/wallet/link/`, {
        method:'POST', credentials:'include', headers:{ 'Content-Type':'application/json', 'X-CSRFToken': csrf, 'X-Requested-With': 'XMLHttpRequest' }, body: JSON.stringify({ web3auth_token: idToken })
      });
      if (res.ok) {
        setWalletStatus('✅ Wallet created and linked successfully!');
        // Redirect to profile after wallet setup
        setTimeout(() => window.location.href = '/profile', 1500);
      } else {
        const t = await res.text();
        setWalletStatus(`Error linking wallet: ${t}`);
      }
    } catch (e) {
      setWalletStatus(`Error: ${e instanceof Error ? e.message : String(e)}`);
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
      web3auth.configureAdapter(openloginAdapter as any);

      setWalletStatus('Initializing Web3Auth modal...');
      await web3auth.initModal();
      
      setWalletStatus('Opening Web3Auth modal...');
      await web3auth.connect();
      
      const userInfo: any = await web3auth.getUserInfo();
      const idToken = userInfo?.idToken || userInfo?.id_token;
      if (!idToken) { setWalletStatus('Error: Could not obtain Web3Auth token'); return; }

      setWalletStatus('Signing you in...');
      // Create a session using Web3Auth on the backend
      const res = await fetch(`${API_URL}/auth/web3/`, {
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
      const st = await fetch(`${API_URL}/api/auth/status/`, { credentials:'include' }).then(r=>r.json()).catch(()=>({authenticated:false}));
      if (st?.authenticated) {
        // If no wallet present, attempt linking via token (optional)
        if (!st.wallet_address && idToken) {
          try {
            await fetch(`${API_URL}/api/wallet/link/`, {
              method:'POST', credentials:'include',
              headers:{ 'Content-Type':'application/json', 'X-CSRFToken': csrf, 'X-Requested-With': 'XMLHttpRequest' },
              body: JSON.stringify({ web3auth_token: idToken })
            });
          } catch {}
        }
        setWalletStatus('✅ Signed in successfully!');
        setTimeout(() => window.location.href = '/profile', 1000);
      } else {
        setWalletStatus('Signed in, but session not detected yet. Please refresh the page.');
      }
    } catch (e) {
      setWalletStatus(`Error: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const linkOwnWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    setWalletStatus('');
    if (!csrf) { await refreshCsrf(); }
    const authOk = await ensureAuthenticated();
    if (!authOk) { setWalletStatus('Please sign in again, then retry.'); return; }
    const res = await fetch(`${API_URL}/api/wallet/link/`, {
      method:'POST', credentials:'include', headers:{ 'Content-Type':'application/json', 'X-CSRFToken': csrf, 'X-Requested-With': 'XMLHttpRequest' }, body: JSON.stringify({ wallet_address: ownWallet })
    });
    if (res.ok) {
      setWalletStatus('Wallet linked');
      // Redirect to profile after wallet setup
      setTimeout(() => window.location.href = '/profile', 500);
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
        </div>
      ) : (
        <form onSubmit={submitAccount} style={{display:'grid', gap:12}}>
          {/* Beta Invite Code */}
          <div style={{display:'grid', gap:6}}>
            <input
              value={inviteCode}
              onChange={(e)=> {
                const code = e.target.value;
                setInviteCode(code);
                if (code.trim().length >= 8) {
                  validateInviteCode(code);
                }
              }}
              placeholder="Beta Invite Code (required)"
              required
              style={{
                border: inviteValid === true ? '1px solid #10b981' : inviteValid === false ? '1px solid #ef4444' : undefined
              }}
            />
            {validatingInvite && (
              <div style={{fontSize:12, color:'#94a3b8'}}>Validating invite code...</div>
            )}
            {inviteValid === true && (
              <div style={{fontSize:12, color:'#10b981'}}>✓ Valid invite code for {inviteEmail}</div>
            )}
            {inviteValid === false && (
              <div style={{fontSize:12, color:'#ef4444'}}>✗ Invalid or expired invite code</div>
            )}
          </div>

          <input value={username} onChange={(e)=>setUsername(e.target.value)} placeholder="Username" required />
          <input
            type="email"
            value={email}
            onChange={(e)=>setEmail(e.target.value)}
            placeholder={inviteEmail ? `Email (${inviteEmail})` : "Email"}
            required
          />
          <input type="password" value={password} onChange={(e)=>setPassword(e.target.value)} placeholder="Password" required />
          <input type="password" value={password2} onChange={(e)=>setPassword2(e.target.value)} placeholder="Confirm password" required />

          {/* Terms of Service Acceptance */}
          <div style={{marginTop:12, padding:12, background:'rgba(255,255,255,0.03)', borderRadius:8, border:'1px solid #334155'}}>
            <label style={{display:'flex', alignItems:'flex-start', gap:10, fontSize:13, color:'#cbd5e1', cursor:'pointer'}}>
              <input
                type="checkbox"
                checked={tosAccepted}
                onChange={(e)=> setTosAccepted(e.target.checked)}
                required
                style={{marginTop:3}}
              />
              <span>
                I agree to the{' '}
                <a href="/legal/terms" target="_blank" rel="noopener noreferrer" style={{color:'#f59e0b', textDecoration:'none'}}>
                  Terms of Service
                </a>{' '}
                and{' '}
                <a href="/legal/privacy" target="_blank" rel="noopener noreferrer" style={{color:'#f59e0b', textDecoration:'none'}}>
                  Privacy Policy
                </a>
              </span>
            </label>
          </div>

          <div style={{display:'grid', gap:8, marginTop:8}}>
            <label style={{display:'flex', alignItems:'center', gap:8, fontSize:13, color:'#cbd5e1'}}>
              <input type="checkbox" checked={walletChoice==='web3auth'} onChange={(e)=> setWalletChoice(e.target.checked? 'web3auth' : 'later')} />
              Set up a free Solana wallet for me (automatically created)
              <Link to="/wallet-info" style={{marginLeft:6, color:'#60a5fa'}}>Learn more</Link>
            </label>
            <div style={{display:'flex', gap:12, fontSize:13}}>
              <button type="button" onClick={()=> setWalletChoice('own')} style={{background:'transparent', border:'none', color:'#94a3b8', textDecoration:'underline', cursor:'pointer'}}>I'll use my own wallet</button>
              <button type="button" onClick={()=> setWalletChoice('later')} style={{background:'transparent', border:'none', color:'#94a3b8', textDecoration:'underline', cursor:'pointer'}}>I'll set up a wallet later</button>
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
          <div style={{fontSize:13, color:'#94a3b8'}}>We'll automatically create a Solana wallet for you. No seed phrases needed!</div>
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
      <div>
        <div style={{fontSize:18, fontWeight:700, color:'#e5e7eb', marginBottom:8}}>
          Welcome to renaissBlock! 🎉
        </div>
        <div style={{fontSize:13, color:'#94a3b8', marginBottom:16}}>
          {walletChoice === 'web3auth'
            ? 'Your Web3Auth wallet has been created automatically. You can now receive NFTs and payments!'
            : 'You can link a wallet anytime from your profile to receive NFTs and payments.'}
        </div>
        <div style={{display:'flex', gap:8, justifyContent:'center'}}>
          <button onClick={()=> window.location.href = '/'}>Go to Home</button>
          <button onClick={()=> window.location.href = '/profile'}>Go to Profile</button>
        </div>
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
      {/* Only show stepper on Create account flow */}
      {mode === 'register' && Stepper}
      {step==='account' && AccountStep}
      {step==='wallet' && WalletStep}
      {step==='done' && DoneStep}
    </div>
  );
}
