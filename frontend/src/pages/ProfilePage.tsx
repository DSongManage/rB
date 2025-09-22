import React, { useEffect, useState } from 'react';
import ProfileEditForm from '../components/ProfileEditForm';

type UserStatus = { user_id: number; username: string; wallet_address?: string } | null;
type UserProfile = { id:number; username:string; display_name:string; wallet_address?:string };
type Dashboard = { content_count: number; sales: number; tier?: string; fee?: number };

export default function ProfilePage() {
  const [user, setUser] = useState<UserStatus>(null);
  const [content, setContent] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [status, setStatus] = useState('');
  const [dash, setDash] = useState<Dashboard>({ content_count: 0, sales: 0 });
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(()=>{
    fetch('http://localhost:8000/api/auth/status/', { credentials:'include' })
      .then(r=>r.json()).then(d=> setUser(d));
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

  const linkWallet = async () => {
    const manual = prompt('Enter your Solana public address');
    if (!manual) return;
    const res = await fetch('http://localhost:8000/api/wallet/link/', {
      method:'POST', headers:{'Content-Type':'application/json'}, credentials:'include', body: JSON.stringify({wallet_address:manual})
    });
    if (res.ok) { setStatus('Wallet linked'); setUser(u=> u? {...u, wallet_address: manual } : u); } else { setStatus('Failed to link wallet'); }
  };

  const myContent = content.filter(c=> c.creator === user?.user_id);

  return (
    <div className="page" style={{maxWidth: 1100, margin: '0 auto'}}>
      <div style={{background:'#0f172a', border:'1px solid #1f2937', borderRadius:12, padding:16, marginBottom:16, display:'grid', gridTemplateColumns:'72px 1fr auto', gap:16, alignItems:'center'}}>
        <div style={{width:56, height:56, borderRadius:12, background:'#111827', display:'grid', placeItems:'center', color:'#f59e0b', fontWeight:700}}>{(user?.username||'?').slice(0,1).toUpperCase()}</div>
        <div>
          <div style={{fontSize:18, fontWeight:600, color:'#e5e7eb'}}>{profile?.display_name || user?.username || '—'}</div>
          <div style={{fontSize:12, color:'#94a3b8'}}>@{profile?.username || user?.username || ''}</div>
          <div style={{fontSize:12, color:'#94a3b8'}}>Wallet: {user?.wallet_address || 'Not linked'}</div>
        </div>
        <div style={{display:'flex', gap:8}}>
          <button onClick={linkWallet} style={{background:'#f59e0b', color:'#111827', border:'none', padding:'8px 12px', borderRadius:8, fontWeight:600}}> {user?.wallet_address? 'Update wallet' : 'Link wallet'} </button>
        </div>
      </div>

      <div style={{display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:12, marginBottom:16}}>
        <StatCard label="Content" value={String(dash.content_count)} />
        <StatCard label="Sales (USD)" value={`$${dash.sales}`} />
        <StatCard label="Tier" value={dash.tier || '—'} />
        <StatCard label="Fee" value={dash.fee != null ? `${dash.fee}%` : '—'} />
      </div>

      <div style={{display:'grid', gridTemplateColumns:'360px 1fr', gap:16}}>
        <div style={{background:'#0f172a', border:'1px solid #1f2937', borderRadius:12, padding:16}}>
          <div style={{fontWeight:600, color:'#e5e7eb', marginBottom:8}}>Search collaborators</div>
          <div style={{display:'flex', gap:8}}>
            <input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Search by username" style={{flex:1}} />
            <button onClick={runSearch}>Search</button>
          </div>
          <div style={{marginTop:12}}>
            {results.length === 0 ? (
              <div style={{fontSize:12, color:'#94a3b8'}}>No results</div>
            ) : (
              <ul style={{listStyle:'none', padding:0, margin:0, display:'grid', gap:8}}>
                {results.map(r=> (
                  <li key={r.id} style={{background:'#0b1220', border:'1px solid #1f2937', borderRadius:8, padding:10, display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                    <div style={{display:'flex', alignItems:'center', gap:10}}>
                      <div style={{width:28, height:28, borderRadius:8, background:'#111827', display:'grid', placeItems:'center', color:'#f59e0b', fontWeight:700}}>{(r.username||'?').slice(0,1).toUpperCase()}</div>
                      <div style={{color:'#e5e7eb', fontWeight:500}}>{r.username}</div>
                    </div>
                    <div style={{fontSize:12, color:'#94a3b8'}}>{r.wallet_address || ''}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div style={{marginTop:16}}>
            <div style={{fontWeight:600, color:'#e5e7eb', marginBottom:8}}>Edit profile</div>
            <ProfileEditForm initialDisplayName={''} />
          </div>
          <div style={{marginTop:8, fontSize:12, color:'#94a3b8'}}>{status}</div>
        </div>
        <div style={{background:'#0f172a', border:'1px solid #1f2937', borderRadius:12, padding:16}}>
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
    <div style={{background:'#0f172a', border:'1px solid #1f2937', borderRadius:12, padding:12}}>
      <div style={{fontSize:12, color:'#94a3b8'}}>{label}</div>
      <div style={{fontSize:18, fontWeight:700, color:'#e5e7eb', marginTop:4}}>{value}</div>
    </div>
  );
}
