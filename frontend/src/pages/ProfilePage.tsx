import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PreviewModal from '../components/PreviewModal';
import { Web3Auth } from '@web3auth/modal';
import { CHAIN_NAMESPACES } from '@web3auth/base';
import { SolanaPrivateKeyProvider } from '@web3auth/solana-provider';
import ProfileEditForm from '../components/ProfileEditForm';
import ProfileStatus from '../components/ProfileStatus';
import StatusEditForm from '../components/StatusEditForm';
import { API_URL } from '../config';

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
  const navigate = useNavigate();
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
  const [notifications, setNotifications] = useState<any[]>([]);

  async function refreshStatus() {
    const d = await fetch(`${API_URL}/api/auth/status/`, { credentials:'include' }).then(r=>r.json());
    setUser(d);
  }

  async function refreshCsrf() {
    const t = await fetch(`${API_URL}/api/auth/csrf/`, { credentials:'include' }).then(r=>r.json());
    setCsrf(t?.csrfToken || '');
    return t?.csrfToken || '';
  }

  useEffect(()=>{
    // Use AbortController for cleanup
    const abortController = new AbortController();
    const signal = abortController.signal;

    // Batch all API calls efficiently with Promise.all
    Promise.all([
      fetch(`${API_URL}/api/auth/status/`, { credentials:'include', signal }).then(r => r.json()),
      fetch(`${API_URL}/api/auth/csrf/`, { credentials:'include', signal }).then(r => r.json()),
      fetch(`${API_URL}/api/users/profile/`, { credentials:'include', signal }).then(r => r.ok ? r.json() : null),
      fetch(`${API_URL}/api/content/`, { credentials: 'include', signal }).then(r => r.json()),
      fetch(`${API_URL}/api/dashboard/`, { credentials:'include', signal }).then(r => r.ok ? r.json() : {content_count:0, sales:0}),
      fetch(`${API_URL}/api/notifications/`, { credentials:'include', signal }).then(r => r.ok ? r.json() : [])
    ])
      .then(([authData, csrfData, profileData, contentData, dashData, notifData]) => {
        // Set all state at once
        setUser(authData);
        setCsrf(csrfData?.csrfToken || '');
        setProfile(profileData);

        // Handle paginated content response
        if (contentData && Array.isArray(contentData.results)) {
          setContent(contentData.results);
        } else if (Array.isArray(contentData)) {
          setContent(contentData);
        } else {
          setContent([]);
        }

        setDash(dashData);
        setNotifications(notifData);
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          console.error('Error loading profile data:', err);
          // Set fallback values on error
          setContent([]);
          setDash({content_count:0, sales:0});
          setNotifications([]);
        }
      });

    // Cleanup: abort requests if component unmounts
    return () => abortController.abort();
  },[]);

  const runSearch = () => {
    if (!q.trim()) { setResults([]); return; }
    fetch(`${API_URL}/api/users/search/?q=${encodeURIComponent(q)}`)
      .then(r=>r.json()).then(setResults);
  };

  const linkWalletManual = async () => {
    const manual = prompt('Enter your Solana public address');
    if (!manual) return;
    const token = csrf || await refreshCsrf();
    const res = await fetch(`${API_URL}/api/wallet/link/`, {
      method:'POST', headers:{'Content-Type':'application/json', 'X-CSRFToken': token, 'X-Requested-With':'XMLHttpRequest'}, credentials:'include', body: JSON.stringify({wallet_address:manual})
    });
    if (res.ok) { setStatus('Wallet linked'); await refreshStatus(); } else { const t = await res.text(); setStatus(`Failed: ${t}`); }
  };

  const linkWalletWeb3Auth = async () => {
    try {
      setStatus('');
      const clientId = import.meta.env.VITE_WEB3AUTH_CLIENT_ID || '';
      if (!clientId) { setStatus('Missing Web3Auth client id'); return; }
      const chainConfig = {
        chainNamespace: CHAIN_NAMESPACES.SOLANA,
        chainId: "0x3", // Solana devnet
        rpcTarget: "https://api.devnet.solana.com",
      };
      
      const privateKeyProvider = new SolanaPrivateKeyProvider({
        config: { chainConfig },
      });

      const web3auth = new Web3Auth({
        clientId,
        chainConfig,
        privateKeyProvider,
        web3AuthNetwork: 'sapphire_devnet',
      });
      await web3auth.init();
      await web3auth.connect();
      const info: any = await web3auth.getUserInfo();
      const idToken = info?.idToken || info?.id_token;
      if (!idToken) { setStatus('Could not obtain Web3Auth token'); return; }
      const token = csrf || await refreshCsrf();
      const res = await fetch(`${API_URL}/api/wallet/link/`, {
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

  const myContent = Array.isArray(content) ? content.filter(c=> c.creator === user?.user_id) : [];
  const [inventory, setInventory] = useState<any[]>([]);
  useEffect(()=>{
    fetch(`${API_URL}/api/content/?inventory_status=minted&mine=1`, { credentials:'include' })
      .then(r=> r.ok? r.json(): [])
      .then(data => {
        // Handle paginated response from DRF
        if (data && Array.isArray(data.results)) {
          setInventory(data.results);
        } else if (Array.isArray(data)) {
          setInventory(data);
        } else {
          setInventory([]);
        }
      })
      .catch(()=> setInventory([]));
  }, [status]);
  const [showPreview, setShowPreview] = useState(false);
  const [previewItem, setPreviewItem] = useState<any>(null);
  const openPreview = async (id:number) => {
    console.log('Opening preview for content:', id);
    try {
      const response = await fetch(`${API_URL}/api/content/${id}/preview/`, { credentials: 'include' });
      console.log('Preview response:', response.status, response.statusText);
      if (!response.ok) {
        console.error('Preview fetch failed');
        return;
      }
      const d = await response.json();
      console.log('Preview data:', d);
      if (d) {
        setPreviewItem(d);
        setShowPreview(true);
      }
    } catch (err) {
      console.error('Preview fetch error:', err);
    }
  };

  const onAvatarClick = () => {
    avatarInputRef.current?.click();
  };

  const onBannerClick = () => {
    bannerInputRef.current?.click();
  };

  const onAvatarSelected: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    console.log('Uploading avatar:', file.name, file.type, file.size);
    const token = csrf || await refreshCsrf();
    const fd = new FormData();
    fd.append('avatar', file);
    const res = await fetch(`${API_URL}/api/users/profile/`, {
      method: 'PATCH',
      headers: { 'X-CSRFToken': token, 'X-Requested-With': 'XMLHttpRequest' },
      credentials: 'include',
      body: fd,
    });
    console.log('Avatar upload response:', res.status, res.statusText);
    if (res.ok) {
      const data = await res.json();
      console.log('Avatar upload data:', data);
      setStatus('Avatar updated');
      await refreshStatus();
    } else {
      const text = await res.text();
      console.error('Avatar upload failed:', text);
      setStatus(`Failed: ${text}`);
    }
    e.target.value = '';
  };

  const onBannerSelected: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const token = csrf || await refreshCsrf();
    const fd = new FormData();
    fd.append('banner', file);
    const res = await fetch(`${API_URL}/api/users/profile/`, {
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
          {(profile?.avatar || profile?.avatar_url) ? (<img src={(profile?.avatar || profile?.avatar_url) as string} alt="avatar" style={{width:'100%', height:'100%', objectFit:'cover'}} onError={(e) => { if (profile) { profile.avatar = undefined; profile.avatar_url = undefined; } e.currentTarget.style.display = 'none'; }} />) : ((user?.username||'?').slice(0,1).toUpperCase())}
        </div>
        <div>
          <InlineEditable
            value={profile?.display_name || user?.username || ''}
            placeholder="Display name"
            onSave={async (val)=>{
              const token = csrf || await refreshCsrf();
              const res = await fetch(`${API_URL}/api/users/profile/`, {
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
              const res = await fetch(`${API_URL}/api/users/profile/`, {
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
        <div style={{display:'flex', gap:8, alignItems:'center'}}>
          {!user?.wallet_address && (
            <div style={{fontSize:13, color:'#94a3b8', fontStyle:'italic'}}>
              ⏳ Wallet being created automatically...
            </div>
          )}
          <button onClick={linkWalletManual} style={{background:'transparent', border:'1px solid #334155', color:'#cbd5e1', padding:'8px 12px', borderRadius:8}}>Connect your own wallet</button>
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

      {/* Collaboration Invites Section */}
      {notifications.length > 0 && (
        <div style={{background:'var(--panel)', border:'1px solid var(--panel-border)', borderRadius:12, padding:16, marginBottom:16}}>
          <div style={{fontWeight:600, color:'var(--text)', marginBottom:12, fontSize:16}}>
            Collaboration Invites ({notifications.length})
          </div>
          <div style={{display:'grid', gap:12}}>
            {notifications.map((notif) => (
              <div key={notif.id} style={{background:'#1e293b', border:'1px solid #334155', borderRadius:8, padding:12, display:'grid', gridTemplateColumns:'48px 1fr auto', gap:12, alignItems:'center'}}>
                {/* Sender Avatar */}
                <div style={{width:48, height:48, borderRadius:8, background: notif.sender_avatar ? `url(${notif.sender_avatar})` : '#111', backgroundSize:'cover', display:'grid', placeItems:'center', color:'#f59e0b', fontWeight:700}}>
                  {!notif.sender_avatar && notif.sender_username.slice(0,1).toUpperCase()}
                </div>
                
                {/* Invite Details */}
                <div>
                  <div style={{fontSize:14, fontWeight:600, color:'#f8fafc', marginBottom:4}}>
                    @{notif.sender_username} <span style={{fontWeight:400, color:'#94a3b8'}}>wants to collaborate</span>
                  </div>
                  <div style={{fontSize:12, color:'#cbd5e1', marginBottom:6}}>
                    {notif.message}
                  </div>
                  <div style={{fontSize:11, color:'#f59e0b', fontWeight:600}}>
                    Revenue Split: {notif.equity_percent}% for you
                  </div>
                </div>
                
                {/* Actions */}
                <div style={{display:'flex', gap:8}}>
                  <button
                    onClick={async () => {
                      // TODO: Implement accept logic
                      const token = csrf || await refreshCsrf();
                      const res = await fetch(`${API_URL}/api/invite/${notif.id}/accept/`, {
                        method: 'POST',
                        headers: {'X-CSRFToken': token, 'X-Requested-With':'XMLHttpRequest'},
                        credentials: 'include',
                      });
                      if (res.ok) {
                        setNotifications(notifications.filter(n => n.id !== notif.id));
                        setStatus('Invite accepted!');
                      }
                    }}
                    style={{background:'#10b981', color:'#fff', border:'none', padding:'6px 12px', borderRadius:6, fontSize:12, fontWeight:600, cursor:'pointer'}}
                  >
                    Accept
                  </button>
                  <button
                    onClick={async () => {
                      // TODO: Implement decline logic
                      const token = csrf || await refreshCsrf();
                      const res = await fetch(`${API_URL}/api/invite/${notif.id}/decline/`, {
                        method: 'POST',
                        headers: {'X-CSRFToken': token, 'X-Requested-With':'XMLHttpRequest'},
                        credentials: 'include',
                      });
                      if (res.ok) {
                        setNotifications(notifications.filter(n => n.id !== notif.id));
                        setStatus('Invite declined.');
                      }
                    }}
                    style={{background:'transparent', color:'#94a3b8', border:'1px solid #334155', padding:'6px 12px', borderRadius:6, fontSize:12, fontWeight:600, cursor:'pointer'}}
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
          <div style={{fontWeight:600, color:'#e5e7eb', marginBottom:12}}>Inventory (Minted)</div>
          <div style={{display:'flex', flexDirection:'column', gap:12}}>
            {inventory.map((it)=> (
              <div key={it.id} className="card" style={{display:'grid', gridTemplateColumns:'100px 1fr auto', gap:16, alignItems:'center', padding:12}}>
                <div style={{width:100, height:133, background:'#111', borderRadius:8, overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', border:'1px solid var(--panel-border)'}} onClick={()=> openPreview(it.id)}>
                  <img
                    src={it.teaser_link}
                    alt="cover"
                    style={{width:'100%', height:'100%', objectFit:'cover'}}
                    onError={(e)=>{
                      const img = e.currentTarget;
                      const parent = img.parentElement;
                      if (img && parent) {
                        img.style.display='none';
                        parent.textContent='No Cover';
                        parent.style.fontSize='11px';
                        parent.style.color='#666';
                      }
                    }}
                  />
                </div>
                <div style={{minWidth: 0, cursor:'pointer'}} onClick={()=> openPreview(it.id)}>
                  <div className="card-title" style={{fontSize:16, marginBottom:4}}>{it.title}</div>
                  <div className="yt-meta" style={{marginBottom:4}}>Type: {it.content_type} • Genre: {it.genre}</div>
                  <div className="yt-meta" style={{overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize:11}}>
                    Contract: {it.nft_contract ? `${it.nft_contract.slice(0, 8)}...${it.nft_contract.slice(-6)}` : '-'}
                  </div>
                </div>
                {it.content_type === 'book' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/studio?editContent=${it.id}`);
                    }}
                    style={{
                      background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                      border: 'none',
                      borderRadius: 6,
                      padding: '8px 16px',
                      color: '#fff',
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontSize: 12,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Edit Book
                  </button>
                )}
              </div>
            ))}
            {inventory.length === 0 && (
              <div style={{fontSize:12, color:'#94a3b8', textAlign:'center', padding:20}}>Nothing minted yet</div>
            )}
          </div>
        </div>
        {showPreview && previewItem && (
          <PreviewModal
            open={showPreview}
            onClose={()=> setShowPreview(false)}
            teaserUrl={`${API_URL}/api/content/${previewItem.id}/teaser/`}
            contentType={previewItem.content_type}
            contentId={previewItem.id}
            price={previewItem.price_usd}
            editions={previewItem.editions}
          />
        )}
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
