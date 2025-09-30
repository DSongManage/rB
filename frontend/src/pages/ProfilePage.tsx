import React, { useEffect, useRef, useState } from 'react';
import { Web3Auth, WEB3AUTH_NETWORK } from '@web3auth/modal';
import ProfileEditForm from '../components/ProfileEditForm';
import ProfileStatus from '../components/ProfileStatus';
import StatusEditForm from '../components/StatusEditForm';

type UserStatus = { user_id: number; username: string; wallet_address?: string } | null;
type UserProfile = {
  id: number;
  username: string;
  display_name: string;
  wallet_address?: string;
  avatar?: string;
  avatar_url?: string;
  banner?: string;
  banner_url?: string;
  location?: string;
  roles?: string[];
  genres?: string[];
  status?: string;
};
type Dashboard = { content_count: number; sales: number; tier?: string; fee?: number };

export default function ProfilePage() {
  const [user, setUser] = useState<UserStatus>(null);
  const [content, setContent] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [status, setStatus] = useState('');
  const [dash, setDash] = useState<Dashboard>({ content_count: 0, sales: 0 });
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [csrf, setCsrf] = useState('');
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const bannerInputRef = useRef<HTMLInputElement | null>(null);

  async function refreshStatus() {
    const d = await fetch('http://localhost:8000/api/auth/status/', { credentials:'include' }).then(r=>r.json());
    setUser(d);
    // Also refresh profile so header shows latest wallet
    fetch('http://localhost:8000/api/users/profile/', { credentials:'include' })
      .then(r=> r.ok ? r.json() : null)
      .then(setProfile)
      .catch(()=> {});
  }

  async function refreshCsrf() {
    const t = await fetch('http://localhost:8000/api/auth/csrf/', { credentials:'include' }).then(r=>r.json());
    setCsrf(t?.csrfToken || '');
    return t?.csrfToken || '';
  }

  useEffect(()=>{
    refreshStatus();
    refreshCsrf();
    fetch('http://localhost:8000/api/content/')
      .then(r=>r.json()).then(setContent);
    fetch('http://localhost:8000/api/dashboard/', { credentials:'include' })
      .then(r=> r.ok ? r.json() : {content_count:0, sales:0})
      .then(setDash)
      .catch(()=> setDash({content_count:0, sales:0}));
    fetch('http://localhost:8000/api/users/profile/', { credentials:'include' })
      .then(r=> r.ok ? r.json() : null)
      .then(setProfile)
      .catch(()=> setProfile(null));
  },[]);

  const runSearch = () => {
    if (!q.trim()) { setResults([]); return; }
    fetch(`http://localhost:8000/api/users/search/?q=${encodeURIComponent(q)}`)
      .then(r=>r.json()).then(setResults);
  };

  const linkWalletManual = async () => {
    const manual = prompt('Enter your Solana public address');
    if (!manual) return;
    const token = csrf || await refreshCsrf();
    const res = await fetch('http://localhost:8000/api/wallet/link/', {
      method:'POST', headers:{'Content-Type':'application/json', 'X-CSRFToken': token, 'X-Requested-With':'XMLHttpRequest'}, credentials:'include', body: JSON.stringify({wallet_address:manual})
    });
    if (res.ok) { setStatus('Wallet linked'); await refreshStatus(); } else { const t = await res.text(); setStatus(`Failed: ${t}`); }
  };

  const linkWalletWeb3Auth = async () => {
    try {
      setStatus('');
      const clientId = process.env.REACT_APP_WEB3AUTH_CLIENT_ID || '';
      if (!clientId) { setStatus('Missing Web3Auth client id'); return; }
      const web3auth = new Web3Auth({ clientId, web3AuthNetwork: WEB3AUTH_NETWORK.SAPPHIRE_DEVNET });
      await web3auth.init();
      await web3auth.connect();
      const info: any = await web3auth.getUserInfo();
      const idToken = info?.idToken || info?.id_token;
      if (!idToken) { setStatus('Could not obtain Web3Auth token'); return; }
      const token = csrf || await refreshCsrf();
      const res = await fetch('http://localhost:8000/api/wallet/link/', {
        method:'POST', headers:{'Content-Type':'application/json', 'X-CSRFToken': token, 'X-Requested-With':'XMLHttpRequest'}, credentials:'include', body: JSON.stringify({ web3auth_token: idToken })
      });
      if (res.ok) {
        const d = await res.json();
        setStatus('Wallet created and linked');
        await refreshStatus();
      } else {
        const t = await res.text();
        setStatus(`Failed: ${t}`);
      }
    } catch (e:any) {
      setStatus(`Error: ${e?.message || String(e)}`);
    }
  };

  const myContent = content.filter(c=> c.creator === user?.user_id);

  const onAvatarClick = () => {
    avatarInputRef.current?.click();
  };

  const onBannerClick = () => {
    bannerInputRef.current?.click();
  };

  const onAvatarSelected: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const token = csrf || await refreshCsrf();
    const fd = new FormData();
    fd.append('avatar', file);
    const res = await fetch('http://localhost:8000/api/users/profile/', {
      method: 'PATCH',
      headers: { 'X-CSRFToken': token, 'X-Requested-With': 'XMLHttpRequest' },
      credentials: 'include',
      body: fd,
    });
    if (res.ok) {
      setStatus('Avatar updated');
      await refreshStatus();
    } else {
      setStatus(`Failed: ${await res.text()}`);
    }
    e.target.value = '';
  };

  const onBannerSelected: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const token = csrf || await refreshCsrf();
    const fd = new FormData();
    fd.append('banner', file);
    const res = await fetch('http://localhost:8000/api/users/profile/', {
      method: 'PATCH',
      headers: { 'X-CSRFToken': token, 'X-Requested-With': 'XMLHttpRequest' },
      credentials: 'include',
      body: fd,
    });
    if (res.ok) {
      setStatus('Banner updated');
      await refreshStatus();
    } else {
      setStatus(`Failed: ${await res.text()}`);
    }
    e.target.value = '';
  };

  function InlineEditable({ value, placeholder, onSave, small }:{ value:string; placeholder:string; onSave:(val:string)=>void|Promise<void>; small?:boolean }){
    const [editing, setEditing] = useState(false);
    const [val, setVal] = useState(value);
    useEffect(()=> setVal(value), [value]);
    if (editing) {
      return (
        <form onSubmit={async (e)=>{ e.preventDefault(); await onSave(val.trim()); setEditing(false); }}>
          <input autoFocus value={val} onChange={(e)=>setVal(e.target.value)} placeholder={placeholder} style={{fontSize: small?12:18, fontWeight: small?400:600}} />
        </form>
      );
    }
    return (
      <div onClick={()=> setEditing(true)} style={{fontSize: small?12:18, fontWeight: small?400:600, color: small? '#94a3b8' : '#e5e7eb', cursor:'text'}}>
        {value || placeholder}
      </div>
    );
  }

  return (
    <div className="page" style={{maxWidth: 1100, margin: '0 auto'}}>
      <div style={{background:'var(--panel)', border:'1px solid var(--panel-border)', borderRadius:12, padding:16, marginBottom:16, display:'grid', gridTemplateColumns:'72px 1fr auto', gap:16, alignItems:'center', backgroundImage: (profile?.banner || profile?.banner_url)? `url(${profile?.banner || profile?.banner_url})` : undefined, backgroundSize:'cover', backgroundPosition:'center', cursor:(profile? 'pointer':'default')}} onClick={onBannerClick}>
        <div onClick={(e)=>{ e.stopPropagation(); onAvatarClick(); }} style={{width:56, height:56, borderRadius:12, background:'#111', overflow:'hidden', display:'grid', placeItems:'center', color:'var(--accent)', fontWeight:700, cursor:'pointer'}} title="Click to upload avatar">
          {(profile?.avatar || profile?.avatar_url) ? (<img src={(profile?.avatar || profile?.avatar_url) as string} alt="avatar" style={{width:'100%', height:'100%', objectFit:'cover'}} />) : ((user?.username||'?').slice(0,1).toUpperCase())}
        </div>
        <div>
          <InlineEditable
            value={profile?.display_name || user?.username || ''}
            placeholder="Display name"
            onSave={async (val)=>{
              const token = csrf || await refreshCsrf();
              const res = await fetch('http://localhost:8000/api/users/profile/', {
                method:'PATCH', headers:{'X-CSRFToken': token, 'X-Requested-With':'XMLHttpRequest', 'Content-Type':'application/json'}, credentials:'include', body: JSON.stringify({display_name: val})
              });
              if (res.ok) { await refreshStatus(); }
            }}
          />
          <InlineEditable
            small
            value={profile?.location || ''}
            placeholder="Location (e.g., New York, NY)"
            onSave={async (val)=>{
              const token = csrf || await refreshCsrf();
              const res = await fetch('http://localhost:8000/api/users/profile/', {
                method:'PATCH', headers:{'X-CSRFToken': token, 'X-Requested-With':'XMLHttpRequest', 'Content-Type':'application/json'}, credentials:'include', body: JSON.stringify({location: val})
              });
              if (res.ok) { await refreshStatus(); }
            }}
          />
          <div style={{marginTop:4}}>
            <ProfileStatus status={profile?.status} />
          </div>
          <div style={{fontSize:12, color:'#94a3b8'}}>@{profile?.username || user?.username || ''}</div>
          <div style={{marginTop:6}}>
            {(() => {
              const w = profile?.wallet_address || user?.wallet_address || '';
              if (!w) return <span style={{fontSize:12, color:'#94a3b8'}}>Wallet: Not linked</span>;
              const short = `${w.slice(0,4)}...${w.slice(-4)}`;
              return (
                <span className="chip" title={w}>
                  <span>{short}</span>
                  <button onClick={()=> navigator.clipboard.writeText(w)}>Copy</button>
                </span>
              );
            })()}
          </div>
        </div>
        <div style={{display:'flex', gap:8}}>
          <button onClick={linkWalletWeb3Auth} style={{background:'#f59e0b', color:'#111827', border:'none', padding:'8px 12px', borderRadius:8, fontWeight:600}}> {user?.wallet_address? 'Update with Web3Auth' : 'Link with Web3Auth'} </button>
          <button onClick={linkWalletManual} style={{background:'transparent', border:'1px solid #334155', color:'#cbd5e1', padding:'8px 12px', borderRadius:8}}>Use my address</button>
        </div>
      </div>
      {/* Hidden file inputs for avatar/banner */}
      <input ref={avatarInputRef} onChange={onAvatarSelected} type="file" accept="image/jpeg,image/png,image/webp" style={{display:'none'}} />
      <input ref={bannerInputRef} onChange={onBannerSelected} type="file" accept="image/jpeg,image/png,image/webp" style={{display:'none'}} />

      <div style={{display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:12, marginBottom:16}}>
        <StatCard label="Content" value={String(dash.content_count)} />
        <StatCard label="Sales (USD)" value={`$${dash.sales}`} />
        <StatCard label="Tier" value={dash.tier || '—'} />
        <StatCard label="Fee" value={dash.fee != null ? `${dash.fee}%` : '—'} />
      </div>

      <div style={{display:'grid', gridTemplateColumns:'360px 1fr', gap:16}}>
        <div style={{background:'var(--panel)', border:'1px solid var(--panel-border)', borderRadius:12, padding:16}}>
          <div style={{display:'grid', gridTemplateColumns:'1fr auto', alignItems:'baseline'}}>
            <div style={{fontWeight:600, color:'var(--text)', marginBottom:8}}>Profile settings</div>
            <a href="/collaborators" style={{fontSize:12}}>Open Collaborators Search →</a>
          </div>
          <div style={{marginBottom:12}}>
            <StatusEditForm initialStatus={profile?.status} onSaved={refreshStatus} />
          </div>
          <ProfileEditForm initialDisplayName={profile?.display_name || ''} onSaved={refreshStatus} />
          <div style={{marginTop:8, fontSize:12, color:'#94a3b8'}}>{status}</div>
        </div>
        <div style={{background:'var(--panel)', border:'1px solid var(--panel-border)', borderRadius:12, padding:16}}>
          <div style={{fontWeight:600, color:'#e5e7eb'}}>Your works (NFTs)</div>
          <div className="yt-grid" style={{marginTop:12}}>
            {myContent.map((it)=> (
              <div key={it.id} className="card">
                <div className="card-title">{it.title}</div>
                <div className="yt-meta">Type: {it.content_type} • Genre: {it.genre}</div>
              </div>
            ))}
            {myContent.length === 0 && (
              <div style={{fontSize:12, color:'#94a3b8'}}>No works yet</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({label, value}:{label:string; value:string}) {
  return (
    <div style={{background:'var(--panel)', border:'1px solid var(--panel-border)', borderRadius:12, padding:12}}>
      <div style={{fontSize:12, color:'#9ca3af'}}>{label}</div>
      <div style={{fontSize:18, fontWeight:700, color:'var(--text)', marginTop:4}}>{value}</div>
    </div>
  );
}
