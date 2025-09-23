import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Web3Auth, WEB3AUTH_NETWORK } from '@web3auth/modal';

const BACKEND = 'http://localhost:8000';

type Step = 'account' | 'wallet' | 'done';

type WalletChoice = 'web3auth' | 'own' | 'later';

export default function AuthPage() {
  const [csrf, setCsrf] = useState('');
  const [mode, setMode] = useState<'login'|'register'>('register');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [msg, setMsg] = useState('');

  const [step, setStep] = useState<Step>('account');
  const [walletChoice, setWalletChoice] = useState<WalletChoice>('web3auth');
  const [ownWallet, setOwnWallet] = useState('');
  const [walletStatus, setWalletStatus] = useState('');
  const navigate = useNavigate();

  useEffect(()=>{
    fetch(`${BACKEND}/api/auth/csrf/`, { credentials:'include' })
      .then(r=>r.json())
      .then(d=> setCsrf(d?.csrfToken || ''))
      .catch(()=> setCsrf(''));
  },[]);

  const submitAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg('');
    const form = new URLSearchParams();
    form.set('username', username);
    form.set('password1', password);
    form.set('password2', password2);
    form.set('next', '/');
    const res = await fetch(`${BACKEND}/accounts/signup/`, {
      method:'POST', credentials:'include', headers:{ 'Content-Type':'application/x-www-form-urlencoded', 'X-CSRFToken': csrf }, body:String(form)
    });
    if (res.ok) {
      if (walletChoice === 'web3auth' || walletChoice === 'own') {
        setStep('wallet');
      } else {
        setStep('done');
      }
    } else {
      setMsg('Signup failed');
    }
  };

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg('');
    const form = new URLSearchParams();
    form.set('login', username);
    form.set('password', password);
    form.set('next', '/');
    const res = await fetch(`${BACKEND}/accounts/login/`, {
      method:'POST', credentials:'include', headers:{ 'Content-Type':'application/x-www-form-urlencoded', 'X-CSRFToken': csrf }, body:String(form)
    });
    if (res.ok) { navigate('/'); } else { setMsg('Sign in failed'); }
  };

  const linkWalletWithWeb3Auth = async () => {
    setWalletStatus('');
    try {
      const clientId = process.env.REACT_APP_WEB3AUTH_CLIENT_ID || '';
      if (!clientId) { setWalletStatus('Missing Web3Auth client id'); return; }
      const web3auth = new Web3Auth({ clientId, web3AuthNetwork: WEB3AUTH_NETWORK.SAPPHIRE_DEVNET });
      await web3auth.init();
      await web3auth.connect();
      const userInfo: any = await web3auth.getUserInfo();
      const idToken = userInfo?.idToken || userInfo?.id_token;
      if (!idToken) { setWalletStatus('Could not obtain Web3Auth token'); return; }
      const res = await fetch(`${BACKEND}/api/wallet/link/`, {
        method:'POST', credentials:'include', headers:{ 'Content-Type':'application/json', 'X-CSRFToken': csrf }, body: JSON.stringify({ web3auth_token: idToken })
      });
      if (res.ok) {
        setWalletStatus('Wallet created and linked');
        setStep('done');
      } else {
        const t = await res.text();
        setWalletStatus(`Failed: ${t}`);
      }
    } catch (e: any) {
      setWalletStatus(`Error: ${e?.message || String(e)}`);
    }
  };

  const linkOwnWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    setWalletStatus('');
    const res = await fetch(`${BACKEND}/api/wallet/link/`, {
      method:'POST', credentials:'include', headers:{ 'Content-Type':'application/json', 'X-CSRFToken': csrf }, body: JSON.stringify({ wallet_address: ownWallet })
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
        <form onSubmit={signIn} style={{display:'grid', gap:12}}>
          <input value={username} onChange={(e)=>setUsername(e.target.value)} placeholder="Username" required />
          <input type="password" value={password} onChange={(e)=>setPassword(e.target.value)} placeholder="Password" required />
          <button type="submit" style={{marginTop:6}}>Sign in</button>
        </form>
      ) : (
        <form onSubmit={submitAccount} style={{display:'grid', gap:12}}>
          <input value={username} onChange={(e)=>setUsername(e.target.value)} placeholder="Username" required />
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
        <button onClick={()=> navigate('/dashboard')}>Go to Dashboard</button>
      </div>
    </div>
  );

  const Stepper = (
    <div style={{display:'flex', gap:8, justifyContent:'center', marginTop:16}}>
      <span className={step==='account'?'chip active':'chip'} style={{cursor:'default'}} aria-current={step==='account'?'step':undefined}>Account</span>
      <span className={step==='wallet'?'chip active':'chip'} style={{cursor:'default'}} aria-current={step==='wallet'?'step':undefined}>Wallet</span>
      <span className={step==='done'?'chip active':'chip'} style={{cursor:'default'}} aria-current={step==='done'?'step':undefined}>Done</span>
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
