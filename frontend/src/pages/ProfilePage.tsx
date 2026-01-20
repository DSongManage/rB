import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
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
import { Eye, Plus, Trash2, ExternalLink, GripVertical, Edit2, Settings } from 'lucide-react';
import { useMobile } from '../hooks/useMobile';
import { useBalance } from '../contexts/BalanceContext';
import { SettingsModal } from '../components/settings/SettingsModal';

interface ExternalPortfolioItem {
  id: number;
  title: string;
  description: string;
  image: string | null;
  image_url: string | null;
  external_url: string;
  project_type: string;
  role: string;
  created_date: string | null;
  order: number;
}

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

  // External portfolio state
  const [externalPortfolio, setExternalPortfolio] = useState<ExternalPortfolioItem[]>([]);
  const [portfolioModalOpen, setPortfolioModalOpen] = useState(false);
  const [editingPortfolioItem, setEditingPortfolioItem] = useState<ExternalPortfolioItem | null>(null);
  const [activeTab, setActiveTab] = useState<'content' | 'collaborations' | 'portfolio' | 'analytics'>('content');
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const { isMobile, isPhone } = useMobile();
  const { displayBalance, loading: balanceLoading, syncStatus } = useBalance();

  // Helper to get balance value for StatCard
  const getBalanceValue = () => {
    if (syncStatus === 'no_wallet') return '—';
    if (balanceLoading) return '...';
    return displayBalance || '$0.00';
  };

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

  async function loadExternalPortfolio() {
    try {
      const res = await fetch(`${API_URL}/api/portfolio/`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setExternalPortfolio(data);
      }
    } catch (err) {
      console.error('Failed to load external portfolio:', err);
    }
  }

  async function deletePortfolioItem(id: number) {
    const token = csrf || await refreshCsrf();
    try {
      const res = await fetch(`${API_URL}/api/portfolio/${id}/`, {
        method: 'DELETE',
        headers: { 'X-CSRFToken': token, 'X-Requested-With': 'XMLHttpRequest' },
        credentials: 'include'
      });
      if (res.ok) {
        setExternalPortfolio(prev => prev.filter(item => item.id !== id));
        setStatus('Portfolio item deleted');
      }
    } catch (err) {
      console.error('Failed to delete portfolio item:', err);
      setStatus('Failed to delete item');
    }
  }

  async function savePortfolioItem(item: Partial<ExternalPortfolioItem>) {
    const token = csrf || await refreshCsrf();
    const isEdit = !!editingPortfolioItem;
    const url = isEdit
      ? `${API_URL}/api/portfolio/${editingPortfolioItem!.id}/`
      : `${API_URL}/api/portfolio/`;

    try {
      const res = await fetch(url, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: {
          'X-CSRFToken': token,
          'X-Requested-With': 'XMLHttpRequest',
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(item)
      });
      if (res.ok) {
        await loadExternalPortfolio();
        setPortfolioModalOpen(false);
        setEditingPortfolioItem(null);
        setStatus(isEdit ? 'Portfolio item updated' : 'Portfolio item added');
      }
    } catch (err) {
      console.error('Failed to save portfolio item:', err);
      setStatus('Failed to save item');
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

        // Also load pending collaboration invites and external portfolio
        loadPendingInvites();
        loadExternalPortfolio();
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
    <div className="page" style={{width: '100%'}}>
      {/* Profile Banner - Click to upload - Full width */}
      <div style={{
        background:'var(--panel)',
        border:'1px solid var(--panel-border)',
        borderRadius:16,
        padding: isPhone ? 16 : 24,
        marginBottom:24,
        display: isPhone ? 'flex' : 'grid',
        flexDirection: isPhone ? 'column' : undefined,
        gridTemplateColumns: isPhone ? undefined : (isMobile ? '80px 1fr' : '100px 1fr auto'),
        gap: isPhone ? 16 : 24,
        alignItems: isPhone ? 'center' : 'center',
        backgroundImage: (profile?.banner || profile?.banner_url)? `url(${profile?.banner || profile?.banner_url})` : 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
        backgroundSize:'cover',
        backgroundPosition:'center',
        cursor:(profile? 'pointer':'default'),
        position:'relative',
        minHeight: isPhone ? 'auto' : 180
      }} onClick={onBannerClick}>
        <div onClick={(e)=>{ e.stopPropagation(); onAvatarClick(); }} style={{width: isPhone ? 72 : 88, height: isPhone ? 72 : 88, borderRadius:16, background:'#111', overflow:'hidden', display:'grid', placeItems:'center', color:'var(--accent)', fontWeight:700, fontSize: isPhone ? 28 : 32, cursor:'pointer', border:'3px solid rgba(245,158,11,0.3)'}} title="Click to upload avatar">
          {(profile?.avatar || profile?.avatar_url) ? (<img src={(profile?.avatar || profile?.avatar_url) as string} alt="avatar" style={{width:'100%', height:'100%', objectFit:'cover'}} onError={(e) => { if (profile) { profile.avatar = undefined; profile.avatar_url = undefined; } e.currentTarget.style.display = 'none'; }} />) : ((user?.username||'?').slice(0,1).toUpperCase())}
        </div>
        <div style={{ textAlign: isPhone ? 'center' : 'left', width: isPhone ? '100%' : 'auto' }}>
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
        {/* View Public Profile Button */}
        <div onClick={(e) => e.stopPropagation()} style={{
          display: 'flex',
          flexDirection: isPhone ? 'row' : 'column',
          gap: 8,
          alignItems: isPhone ? 'center' : 'flex-end',
          justifyContent: isPhone ? 'center' : 'flex-start',
          width: isPhone ? '100%' : 'auto',
          marginTop: isPhone ? 8 : 0,
          ...(isMobile && !isPhone ? { position: 'absolute' as const, top: 16, right: 16 } : {})
        }}>
          <Link
            to={`/profile/${profile?.username || user?.username}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'rgba(245,158,11,0.15)',
              color: '#f59e0b',
              border: '1px solid rgba(245,158,11,0.3)',
              padding: isPhone ? '6px 10px' : '8px 14px',
              borderRadius: 8,
              fontSize: isPhone ? 12 : 13,
              fontWeight: 600,
              textDecoration: 'none',
              transition: 'all 0.2s ease'
            }}
          >
            <Eye size={isPhone ? 14 : 16} />
            {isPhone ? 'Public' : 'View Public Profile'}
          </Link>
          <button
            onClick={(e) => { e.stopPropagation(); setSettingsModalOpen(true); }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'transparent',
              color: '#94a3b8',
              border: '1px solid #334155',
              padding: isPhone ? '6px 10px' : '8px 14px',
              borderRadius: 8,
              fontSize: isPhone ? 12 : 13,
              fontWeight: 500,
              cursor: 'pointer'
            }}
          >
            <Settings size={isPhone ? 14 : 16} />
            Settings
          </button>
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

      <div style={{display:'grid', gridTemplateColumns: isPhone ? 'repeat(2, 1fr)' : 'repeat(5, 1fr)', gap: isPhone ? 12 : 20, marginBottom:24}}>
        <StatCard label="Balance" value={getBalanceValue()} />
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

      <div style={{display:'grid', gridTemplateColumns:'minmax(320px, 400px) 1fr', gap:24}}>
        <div style={{background:'var(--panel)', border:'1px solid var(--panel-border)', borderRadius:12, padding:20}}>
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
        <div style={{background:'var(--panel)', border:'1px solid var(--panel-border)', borderRadius:12, padding:24}}>
          {/* Tabbed Interface */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 20, borderBottom: '1px solid #334155', paddingBottom: 16 }}>
            {[
              { key: 'content', label: 'My Content', count: inventory.length },
              { key: 'collaborations', label: 'Collaborations', count: 0 },
              { key: 'portfolio', label: 'External Portfolio', count: externalPortfolio.length },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as typeof activeTab)}
                style={{
                  background: activeTab === tab.key ? 'rgba(245,158,11,0.15)' : 'transparent',
                  color: activeTab === tab.key ? '#f59e0b' : '#94a3b8',
                  border: activeTab === tab.key ? '1px solid rgba(245,158,11,0.3)' : '1px solid transparent',
                  padding: '8px 16px',
                  borderRadius: 8,
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  transition: 'all 0.2s ease'
                }}
              >
                {tab.label}
                <span style={{
                  background: activeTab === tab.key ? '#f59e0b' : '#475569',
                  color: activeTab === tab.key ? '#000' : '#e5e7eb',
                  fontSize: 11,
                  padding: '2px 6px',
                  borderRadius: 4,
                  fontWeight: 700
                }}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* My Content Tab */}
          {activeTab === 'content' && (
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
          )}

          {/* Collaborations Tab */}
          {activeTab === 'collaborations' && (
            <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
              <p style={{ marginBottom: 16 }}>View and manage your collaborations</p>
              <Link
                to="/collaborations"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  background: '#f59e0b',
                  color: '#000',
                  padding: '10px 20px',
                  borderRadius: 8,
                  fontWeight: 600,
                  textDecoration: 'none'
                }}
              >
                Go to Collaborations Dashboard
              </Link>
            </div>
          )}

          {/* External Portfolio Tab */}
          {activeTab === 'portfolio' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <p style={{ color: '#94a3b8', fontSize: 13, margin: 0 }}>
                  Showcase your past work and external projects
                </p>
                <button
                  onClick={() => { setEditingPortfolioItem(null); setPortfolioModalOpen(true); }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    background: '#f59e0b',
                    color: '#000',
                    border: 'none',
                    padding: '8px 14px',
                    borderRadius: 8,
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: 'pointer'
                  }}
                >
                  <Plus size={16} />
                  Add Project
                </button>
              </div>
              {externalPortfolio.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>
                  <p style={{ marginBottom: 8 }}>No external portfolio items yet</p>
                  <p style={{ fontSize: 13 }}>Add your past work to showcase on your public profile</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: 12 }}>
                  {externalPortfolio.map(item => (
                    <div key={item.id} style={{
                      display: 'grid',
                      gridTemplateColumns: '80px 1fr auto',
                      gap: 16,
                      alignItems: 'center',
                      padding: 12,
                      background: '#1e293b',
                      borderRadius: 8,
                      border: '1px solid #334155'
                    }}>
                      <div style={{
                        width: 80,
                        height: 80,
                        borderRadius: 8,
                        background: item.image_url ? `url(${item.image_url}) center/cover` : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff',
                        fontSize: 24
                      }}>
                        {!item.image_url && item.project_type?.charAt(0).toUpperCase()}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ color: '#f1f5f9', fontWeight: 600, marginBottom: 4 }}>{item.title}</div>
                        {item.role && <div style={{ color: '#f59e0b', fontSize: 13, marginBottom: 4 }}>{item.role}</div>}
                        {item.description && (
                          <div style={{ color: '#94a3b8', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {item.description}
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {item.external_url && (
                          <a
                            href={item.external_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: 36,
                              height: 36,
                              borderRadius: 6,
                              background: 'rgba(59,130,246,0.15)',
                              color: '#60a5fa',
                              border: 'none'
                            }}
                          >
                            <ExternalLink size={16} />
                          </a>
                        )}
                        <button
                          onClick={() => { setEditingPortfolioItem(item); setPortfolioModalOpen(true); }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 36,
                            height: 36,
                            borderRadius: 6,
                            background: 'rgba(245,158,11,0.15)',
                            color: '#f59e0b',
                            border: 'none',
                            cursor: 'pointer'
                          }}
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => deletePortfolioItem(item.id)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 36,
                            height: 36,
                            borderRadius: 6,
                            background: 'rgba(239,68,68,0.15)',
                            color: '#ef4444',
                            border: 'none',
                            cursor: 'pointer'
                          }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
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

      {/* External Portfolio Add/Edit Modal */}
      {portfolioModalOpen && (
        <PortfolioItemModal
          item={editingPortfolioItem}
          onClose={() => { setPortfolioModalOpen(false); setEditingPortfolioItem(null); }}
          onSave={savePortfolioItem}
        />
      )}

      {/* Settings Modal */}
      <SettingsModal
        open={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
      />
    </div>
  );
}

function StatCard({label, value}:{label:string; value:string}) {
  return (
    <div style={{background:'var(--panel)', border:'1px solid var(--panel-border)', borderRadius:12, padding:16}}>
      <div style={{fontSize:13, color:'#9ca3af', marginBottom:8}}>{label}</div>
      <div style={{fontSize:24, fontWeight:700, color:'var(--text)'}}>{value}</div>
    </div>
  );
}

function PortfolioItemModal({
  item,
  onClose,
  onSave
}: {
  item: ExternalPortfolioItem | null;
  onClose: () => void;
  onSave: (item: Partial<ExternalPortfolioItem>) => void;
}) {
  const [title, setTitle] = useState(item?.title || '');
  const [description, setDescription] = useState(item?.description || '');
  const [externalUrl, setExternalUrl] = useState(item?.external_url || '');
  const [projectType, setProjectType] = useState(item?.project_type || 'book');
  const [role, setRole] = useState(item?.role || '');
  const [createdDate, setCreatedDate] = useState(item?.created_date || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      title,
      description,
      external_url: externalUrl,
      project_type: projectType,
      role,
      created_date: createdDate || null
    });
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        background: '#1e293b',
        borderRadius: 16,
        padding: 24,
        width: '100%',
        maxWidth: 500,
        maxHeight: '90vh',
        overflow: 'auto',
        border: '1px solid #334155'
      }}>
        <h2 style={{ color: '#f1f5f9', fontSize: 20, fontWeight: 700, margin: '0 0 20px' }}>
          {item ? 'Edit Portfolio Item' : 'Add Portfolio Item'}
        </h2>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', color: '#94a3b8', fontSize: 13, marginBottom: 6 }}>
              Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              required
              style={{
                width: '100%',
                background: '#0f172a',
                border: '1px solid #334155',
                borderRadius: 8,
                padding: '10px 12px',
                color: '#f1f5f9',
                fontSize: 14
              }}
              placeholder="Project title"
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', color: '#94a3b8', fontSize: 13, marginBottom: 6 }}>
              Project Type
            </label>
            <select
              value={projectType}
              onChange={e => setProjectType(e.target.value)}
              style={{
                width: '100%',
                background: '#0f172a',
                border: '1px solid #334155',
                borderRadius: 8,
                padding: '10px 12px',
                color: '#f1f5f9',
                fontSize: 14
              }}
            >
              <option value="book">Book</option>
              <option value="art">Art</option>
              <option value="music">Music</option>
              <option value="video">Video</option>
              <option value="film">Film</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', color: '#94a3b8', fontSize: 13, marginBottom: 6 }}>
              Your Role
            </label>
            <input
              type="text"
              value={role}
              onChange={e => setRole(e.target.value)}
              style={{
                width: '100%',
                background: '#0f172a',
                border: '1px solid #334155',
                borderRadius: 8,
                padding: '10px 12px',
                color: '#f1f5f9',
                fontSize: 14
              }}
              placeholder="e.g., Author, Illustrator, Producer"
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', color: '#94a3b8', fontSize: 13, marginBottom: 6 }}>
              Description
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              style={{
                width: '100%',
                background: '#0f172a',
                border: '1px solid #334155',
                borderRadius: 8,
                padding: '10px 12px',
                color: '#f1f5f9',
                fontSize: 14,
                resize: 'vertical'
              }}
              placeholder="Brief description of the project"
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', color: '#94a3b8', fontSize: 13, marginBottom: 6 }}>
              External URL
            </label>
            <input
              type="url"
              value={externalUrl}
              onChange={e => setExternalUrl(e.target.value)}
              style={{
                width: '100%',
                background: '#0f172a',
                border: '1px solid #334155',
                borderRadius: 8,
                padding: '10px 12px',
                color: '#f1f5f9',
                fontSize: 14
              }}
              placeholder="https://..."
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', color: '#94a3b8', fontSize: 13, marginBottom: 6 }}>
              Date (optional)
            </label>
            <input
              type="date"
              value={createdDate}
              onChange={e => setCreatedDate(e.target.value)}
              style={{
                width: '100%',
                background: '#0f172a',
                border: '1px solid #334155',
                borderRadius: 8,
                padding: '10px 12px',
                color: '#f1f5f9',
                fontSize: 14
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                background: 'transparent',
                color: '#94a3b8',
                border: '1px solid #334155',
                padding: '12px 20px',
                borderRadius: 8,
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{
                flex: 1,
                background: '#f59e0b',
                color: '#000',
                border: 'none',
                padding: '12px 20px',
                borderRadius: 8,
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              {item ? 'Save Changes' : 'Add Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
