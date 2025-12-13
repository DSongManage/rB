import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PreviewModal from '../components/PreviewModal';
import { Web3Auth } from '@web3auth/modal';
import { CHAIN_NAMESPACES } from '@web3auth/base';
import { SolanaPrivateKeyProvider } from '@web3auth/solana-provider';
import ProfileEditForm from '../components/ProfileEditForm';
import ProfileStatus from '../components/ProfileStatus';
import StatusEditForm from '../components/StatusEditForm';
import { WalletManagementPanel } from '../components/WalletManagementPanel';
import { InviteResponseModal } from '../components/collaboration/InviteResponseModal';
import { collaborationApi, CollaborativeProject, CollaboratorRole } from '../services/collaborationApi';
import { API_URL } from '../config';

type UserStatus = { user_id: number; username: string; wallet_address?: string } | null;
type UserProfile = {
  id: number;
  username: string;
  display_name: string;
  wallet_address?: string;
  wallet_provider?: 'web3auth' | 'external' | null;
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

  // Collaboration invite state
  const [pendingInvites, setPendingInvites] = useState<{ project: CollaborativeProject; invite: CollaboratorRole }[]>([]);
  const [selectedInviteProjectId, setSelectedInviteProjectId] = useState<number | null>(null);

  async function refreshStatus() {
    const d = await fetch(`${API_URL}/api/auth/status/`, { credentials:'include' }).then(r=>r.json());
    setUser(d);
  }

  async function refreshCsrf() {
    const t = await fetch(`${API_URL}/api/auth/csrf/`, { credentials:'include' }).then(r=>r.json());
    setCsrf(t?.csrfToken || '');
    return t?.csrfToken || '';
  }

  async function loadPendingInvites() {
    try {
      const invites = await collaborationApi.getPendingInvites();
      setPendingInvites(invites);
    } catch (err) {
      console.error('Failed to load pending invites:', err);
      setPendingInvites([]);
    }
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

        // Also load pending collaboration invites
        loadPendingInvites();
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
      {/* Profile Banner - Click to upload */}
      <div style={{background:'var(--panel)', border:'1px solid var(--panel-border)', borderRadius:12, padding:16, marginBottom:16, display:'grid', gridTemplateColumns:'72px 1fr', gap:16, alignItems:'center', backgroundImage: (profile?.banner || profile?.banner_url)? `url(${profile?.banner || profile?.banner_url})` : undefined, backgroundSize:'cover', backgroundPosition:'center', cursor:(profile? 'pointer':'default')}} onClick={onBannerClick}>
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
                  <button onClick={(e)=>{ e.stopPropagation(); navigator.clipboard.writeText(w); }}>Copy</button>
                </span>
              );
            })()}
          </div>
        </div>
      </div>
      {/* Hidden file inputs for avatar/banner */}
      <input ref={avatarInputRef} onChange={onAvatarSelected} type="file" accept="image/jpeg,image/png,image/webp" style={{display:'none'}} />
      <input ref={bannerInputRef} onChange={onBannerSelected} type="file" accept="image/jpeg,image/png,image/webp" style={{display:'none'}} />

      {/* Wallet Management Section */}
      <WalletManagementPanel
        walletAddress={profile?.wallet_address || null}
        walletProvider={profile?.wallet_provider || null}
        onWalletUpdate={refreshStatus}
      />

      <div style={{display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:12, marginBottom:16}}>
        <StatCard label="Content" value={String(dash.content_count)} />
        <StatCard label="Sales (USDC)" value={`$${dash.sales}`} />
        <StatCard label="Tier" value={dash.tier || '—'} />
        <StatCard label="Fee" value={dash.fee != null ? `${dash.fee}%` : '—'} />
      </div>

      {/* Collaboration Invites Section */}
      {pendingInvites.length > 0 && (
        <div style={{background:'var(--panel)', border:'1px solid #f59e0b40', borderRadius:12, padding:16, marginBottom:16}}>
          <div style={{fontWeight:600, color:'var(--text)', marginBottom:12, fontSize:16, display:'flex', alignItems:'center', gap:8}}>
            <span style={{
              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              padding: '4px 10px',
              borderRadius: 6,
              fontSize: 12,
              color: '#fff',
            }}>
              {pendingInvites.length}
            </span>
            Collaboration Invites
          </div>
          <div style={{display:'grid', gap:12}}>
            {pendingInvites.map(({ project, invite }) => (
              <div key={project.id} style={{background:'#1e293b', border:'1px solid #334155', borderRadius:8, padding:16}}>
                <div style={{display:'flex', alignItems:'flex-start', gap:12}}>
                  {/* Project Type Icon */}
                  <div style={{
                    width:48, height:48, borderRadius:10,
                    background:'#f59e0b20',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize:24, flexShrink:0
                  }}>
                    {project.content_type === 'book' ? '📖' :
                     project.content_type === 'music' ? '🎵' :
                     project.content_type === 'video' ? '🎬' : '🎨'}
                  </div>

                  {/* Invite Details */}
                  <div style={{flex:1, minWidth:0}}>
                    <div style={{fontSize:15, fontWeight:700, color:'#f8fafc', marginBottom:4}}>
                      {project.title}
                    </div>
                    <div style={{fontSize:13, color:'#94a3b8', marginBottom:8}}>
                      @{project.created_by_username} invited you as <span style={{color:'#f59e0b', fontWeight:600}}>{invite.role}</span>
                    </div>
                    <div style={{display:'flex', gap:16, fontSize:12}}>
                      <div>
                        <span style={{color:'#64748b'}}>Revenue Split:</span>{' '}
                        <span style={{color:'#10b981', fontWeight:700}}>{invite.revenue_percentage}%</span>
                      </div>
                      <div>
                        <span style={{color:'#64748b'}}>Collaborators:</span>{' '}
                        <span style={{color:'#e2e8f0'}}>{project.total_collaborators}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div style={{display:'flex', gap:8, marginTop:12, borderTop:'1px solid #334155', paddingTop:12}}>
                  <button
                    onClick={() => setSelectedInviteProjectId(project.id)}
                    style={{
                      flex:1, background:'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                      color:'#000', border:'none', padding:'10px 16px', borderRadius:8,
                      fontSize:13, fontWeight:700, cursor:'pointer',
                      display:'flex', alignItems:'center', justifyContent:'center', gap:6
                    }}
                  >
                    View Details & Respond
                  </button>
                  <button
                    onClick={() => navigate(`/collaborations`)}
                    style={{
                      background:'transparent', color:'#94a3b8',
                      border:'1px solid #334155', padding:'10px 16px', borderRadius:8,
                      fontSize:13, fontWeight:600, cursor:'pointer'
                    }}
                  >
                    Dashboard
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Invite Response Modal */}
      {selectedInviteProjectId && (
        <InviteResponseModal
          open={true}
          onClose={() => {
            setSelectedInviteProjectId(null);
            loadPendingInvites(); // Refresh after closing
          }}
          projectId={selectedInviteProjectId}
        />
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
          <ProfileEditForm
            initialDisplayName={profile?.display_name || ''}
            initialLocation={profile?.location || ''}
            initialRoles={profile?.roles || []}
            initialGenres={profile?.genres || []}
            onSaved={refreshStatus}
          />
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
