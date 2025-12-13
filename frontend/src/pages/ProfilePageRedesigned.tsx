import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PreviewModal from '../components/PreviewModal';
import { WalletManagementPanel } from '../components/WalletManagementPanel';
import { InviteResponseModal } from '../components/collaboration/InviteResponseModal';
import { collaborationApi, CollaborativeProject, CollaboratorRole } from '../services/collaborationApi';
import { API_URL } from '../config';
import {
  Settings, MapPin, Wallet, CheckCircle, BookOpen, Users,
  BarChart3, FileText, Eye, DollarSign, Palette, Film, Music, X,
  Check, XCircle
} from 'lucide-react';

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

type TabType = 'content' | 'collaborations' | 'analytics';

export default function ProfilePageRedesigned() {
  const navigate = useNavigate();
  const [user, setUser] = useState<UserStatus>(null);
  const [content, setContent] = useState<any[]>([]);
  const [status, setStatus] = useState('');
  const [dash, setDash] = useState<Dashboard>({ content_count: 0, sales: 0 });
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [csrf, setCsrf] = useState('');
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('content');
  const [inventory, setInventory] = useState<any[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [previewItem, setPreviewItem] = useState<any>(null);

  // Collaboration invite state
  const [pendingInvites, setPendingInvites] = useState<{ project: CollaborativeProject; invite: CollaboratorRole }[]>([]);
  const [selectedInviteProjectId, setSelectedInviteProjectId] = useState<number | null>(null);
  // Active collaborations state
  const [collaborations, setCollaborations] = useState<any[]>([]);
  const [collaborationsLoading, setCollaborationsLoading] = useState(false);
  // Processing state for accept/decline buttons
  const [processingInvites, setProcessingInvites] = useState<Set<number>>(new Set());

  async function refreshStatus() {
    const d = await fetch(`${API_URL}/api/auth/status/`, { credentials: 'include' }).then(r => r.json());
    setUser(d);
  }

  async function refreshCsrf() {
    const r = await fetch(`${API_URL}/api/auth/csrf/`, { credentials: 'include' });
    const j = await r.json();
    const token = j?.csrfToken || '';
    setCsrf(token);
    return token;
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

  async function loadCollaborations() {
    setCollaborationsLoading(true);
    try {
      const projects = await collaborationApi.getCollaborativeProjects();
      setCollaborations(projects);
    } catch (err) {
      console.error('Failed to load collaborations:', err);
      setCollaborations([]);
    } finally {
      setCollaborationsLoading(false);
    }
  }

  // Accept invitation handler
  async function handleAcceptInvite(projectId: number, e: React.MouseEvent) {
    e.stopPropagation();
    setProcessingInvites(prev => new Set(prev).add(projectId));
    try {
      await collaborationApi.acceptInvitation(projectId);
      setStatus('Invitation accepted!');
      // Refresh both lists
      await Promise.all([loadPendingInvites(), loadCollaborations()]);
    } catch (err: any) {
      console.error('Failed to accept invitation:', err);
      setStatus(`Failed to accept: ${err.message || 'Unknown error'}`);
    } finally {
      setProcessingInvites(prev => {
        const newSet = new Set(prev);
        newSet.delete(projectId);
        return newSet;
      });
    }
  }

  // Decline invitation handler
  async function handleDeclineInvite(projectId: number, e: React.MouseEvent) {
    e.stopPropagation();
    setProcessingInvites(prev => new Set(prev).add(projectId));
    try {
      await collaborationApi.declineInvitation(projectId);
      setStatus('Invitation declined');
      // Refresh both lists
      await Promise.all([loadPendingInvites(), loadCollaborations()]);
    } catch (err: any) {
      console.error('Failed to decline invitation:', err);
      setStatus(`Failed to decline: ${err.message || 'Unknown error'}`);
    } finally {
      setProcessingInvites(prev => {
        const newSet = new Set(prev);
        newSet.delete(projectId);
        return newSet;
      });
    }
  }

  // Helper function to get content type icon
  function getContentTypeIcon(contentType: string, size: number = 24) {
    switch (contentType) {
      case 'book':
        return <BookOpen size={size} />;
      case 'music':
        return <Music size={size} />;
      case 'video':
        return <Film size={size} />;
      case 'art':
      default:
        return <Palette size={size} />;
    }
  }

  useEffect(() => {
    const abortController = new AbortController();
    const signal = abortController.signal;

    Promise.all([
      fetch(`${API_URL}/api/auth/status/`, { credentials: 'include', signal }).then(r => r.json()),
      fetch(`${API_URL}/api/content/`, { credentials: 'include', signal }).then(r => r.json()),
      fetch(`${API_URL}/api/auth/csrf/`, { credentials: 'include', signal }).then(r => r.json()),
      fetch(`${API_URL}/api/users/profile/`, { credentials: 'include', signal }).then(r => r.ok ? r.json() : null),
      fetch(`${API_URL}/api/dashboard/`, { credentials: 'include', signal }).then(r => r.ok ? r.json() : { content_count: 0, sales: 0 }),
    ])
      .then(([userResp, contentResp, csrfResp, profileResp, dashResp]) => {
        setUser(userResp);
        if (Array.isArray(contentResp.results)) setContent(contentResp.results);
        else if (Array.isArray(contentResp)) setContent(contentResp);
        setCsrf(csrfResp?.csrfToken || '');
        setProfile(profileResp);
        setDash(dashResp);

        // Load pending collaboration invites and active collaborations
        loadPendingInvites();
        loadCollaborations();
      })
      .catch(() => { });

    return () => abortController.abort();
  }, []);

  useEffect(() => {
    fetch(`${API_URL}/api/content/?inventory_status=minted&mine=1`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        if (data && Array.isArray(data.results)) {
          setInventory(data.results);
        } else if (Array.isArray(data)) {
          setInventory(data);
        } else {
          setInventory([]);
        }
      })
      .catch(() => setInventory([]));
  }, [status]);

  const onAvatarClick = () => {
    avatarInputRef.current?.click();
  };

  const onAvatarSelected: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const token = csrf || await refreshCsrf();
    const fd = new FormData();
    fd.append('avatar', file);
    const res = await fetch(`${API_URL}/api/users/profile/`, {
      method: 'PATCH',
      headers: { 'X-CSRFToken': token, 'X-Requested-With': 'XMLHttpRequest' },
      credentials: 'include',
      body: fd,
    });
    if (res.ok) {
      setStatus('Avatar updated');
      await refreshStatus();
      const profileResp = await fetch(`${API_URL}/api/users/profile/`, { credentials: 'include' });
      if (profileResp.ok) setProfile(await profileResp.json());
    } else {
      setStatus(`Failed: ${await res.text()}`);
    }
    e.target.value = '';
  };

  const openPreview = (contentId: number) => {
    const item = inventory.find(i => i.id === contentId);
    if (item) {
      setPreviewItem(item);
      setShowPreview(true);
    }
  };

  const shortenAddress = (addr: string) => {
    if (!addr || addr.length < 12) return addr;
    return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
  };

  return (
    <div style={{
      maxWidth: 1200,
      margin: '0 auto',
      padding: '40px 24px',
    }}>
      {/* Hidden file input for avatar */}
      <input ref={avatarInputRef} onChange={onAvatarSelected} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} />

      {/* HERO SECTION */}
      <div style={{
        background: '#0f172a',
        border: '1px solid #1e293b',
        borderRadius: 16,
        padding: 32,
        marginBottom: 24,
        position: 'relative',
      }}>
        {/* Settings Button - Top Right */}
        <button
          onClick={() => setShowSettingsModal(true)}
          style={{
            position: 'absolute',
            top: 24,
            right: 24,
            background: 'transparent',
            border: '1px solid #334155',
            color: '#cbd5e1',
            width: 40,
            height: 40,
            borderRadius: 8,
            display: 'grid',
            placeItems: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#1e293b';
            e.currentTarget.style.borderColor = '#475569';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.borderColor = '#334155';
          }}
          title="Settings"
        >
          <Settings size={20} />
        </button>

        {/* Avatar + User Info */}
        <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', marginBottom: 32 }}>
          <div
            onClick={onAvatarClick}
            style={{
              width: 120,
              height: 120,
              borderRadius: '50%',
              background: profile?.avatar || profile?.avatar_url ? `url(${profile?.avatar || profile?.avatar_url})` : '#1e293b',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              display: 'grid',
              placeItems: 'center',
              color: '#f59e0b',
              fontWeight: 700,
              fontSize: 48,
              cursor: 'pointer',
              border: '3px solid #1e293b',
              flexShrink: 0,
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#f59e0b';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#1e293b';
            }}
            title="Click to upload avatar"
          >
            {!(profile?.avatar || profile?.avatar_url) && (user?.username || '?').slice(0, 1).toUpperCase()}
          </div>

          <div style={{ flex: 1 }}>
            <div style={{
              fontSize: 32,
              fontWeight: 700,
              color: '#f8fafc',
              marginBottom: 8,
            }}>
              {profile?.display_name || user?.username || 'User'}
            </div>

            {profile?.location && (
              <div style={{
                fontSize: 15,
                color: '#94a3b8',
                marginBottom: 8,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}>
                <MapPin size={16} /> {profile.location}
              </div>
            )}

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              fontSize: 14,
              color: '#cbd5e1',
            }}>
              {profile?.status && (
                <>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}>
                    <span style={{ color: '#10b981', fontSize: 12 }}>●</span>
                    {profile.status}
                  </span>
                  <span style={{ color: '#475569' }}>•</span>
                </>
              )}
              <span style={{ color: '#94a3b8' }}>@{profile?.username || user?.username || ''}</span>
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
        }}>
          <StatCard label="Content" value={String(dash.content_count)} />
          <StatCard label="Sales (USDC)" value={`$${dash.sales}`} />
          <StatCard label="Tier" value={dash.tier || 'Basic'} />
          <StatCard label="Fee" value={dash.fee != null ? `${dash.fee}%` : '10%'} />
        </div>
      </div>

      {/* WALLET STATUS CARD - Compact */}
      <div style={{
        background: profile?.wallet_address ? '#0f172a' : '#1e293b',
        border: profile?.wallet_address ? '1px solid #10b981' : '1px solid #334155',
        borderRadius: 12,
        padding: '16px 20px',
        marginBottom: 24,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ color: profile?.wallet_address ? '#10b981' : '#94a3b8' }}>
            {profile?.wallet_address ? <CheckCircle size={24} /> : <Wallet size={24} />}
          </div>
          <div>
            <div style={{
              fontSize: 14,
              fontWeight: 600,
              color: '#f8fafc',
              marginBottom: profile?.wallet_address ? 4 : 0,
            }}>
              {profile?.wallet_address ? 'Wallet Connected' : 'Wallet Setup Required'}
            </div>
            {profile?.wallet_address && (
              <div style={{
                fontSize: 13,
                color: '#94a3b8',
                fontFamily: 'monospace',
              }}>
                {shortenAddress(profile.wallet_address)}
              </div>
            )}
          </div>
        </div>

        <button
          onClick={() => setShowWalletModal(true)}
          style={{
            background: profile?.wallet_address ? 'transparent' : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
            border: profile?.wallet_address ? '1px solid #334155' : 'none',
            color: '#fff',
            padding: '8px 16px',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            if (profile?.wallet_address) {
              e.currentTarget.style.background = '#1e293b';
              e.currentTarget.style.borderColor = '#475569';
            } else {
              e.currentTarget.style.transform = 'translateY(-2px)';
            }
          }}
          onMouseLeave={(e) => {
            if (profile?.wallet_address) {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.borderColor = '#334155';
            } else {
              e.currentTarget.style.transform = 'translateY(0)';
            }
          }}
        >
          {profile?.wallet_address ? 'Manage' : 'Connect Wallet'}
        </button>
      </div>

      {/* PENDING COLLABORATION INVITES */}
      {pendingInvites.length > 0 && (
        <div style={{
          background: '#0f172a',
          border: '1px solid #f59e0b40',
          borderRadius: 16,
          padding: 24,
          marginBottom: 24,
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 20,
          }}>
            <span style={{
              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              padding: '6px 14px',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 700,
              color: '#000',
            }}>
              {pendingInvites.length}
            </span>
            <span style={{ fontSize: 18, fontWeight: 700, color: '#f8fafc' }}>
              Collaboration Invites
            </span>
          </div>

          <div style={{ display: 'grid', gap: 16 }}>
            {pendingInvites.map(({ project, invite }) => {
              const isProcessing = processingInvites.has(project.id);
              return (
              <div key={project.id} style={{
                background: '#1e293b',
                border: '1px solid #334155',
                borderRadius: 12,
                padding: 20,
                opacity: isProcessing ? 0.7 : 1,
                transition: 'all 0.2s',
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                  {/* Project Type Icon */}
                  <div style={{
                    width: 56,
                    height: 56,
                    borderRadius: 12,
                    background: '#f59e0b20',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#f59e0b',
                    flexShrink: 0,
                  }}>
                    {getContentTypeIcon(project.content_type, 28)}
                  </div>

                  {/* Invite Details */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 17, fontWeight: 700, color: '#f8fafc', marginBottom: 6 }}>
                      {project.title}
                    </div>
                    <div style={{ fontSize: 14, color: '#94a3b8', marginBottom: 10 }}>
                      <span style={{ color: '#cbd5e1' }}>@{project.created_by_username}</span> invited you as{' '}
                      <span style={{ color: '#f59e0b', fontWeight: 600 }}>{invite.role}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 20, fontSize: 13 }}>
                      <div>
                        <span style={{ color: '#64748b' }}>Revenue Split:</span>{' '}
                        <span style={{ color: '#10b981', fontWeight: 700 }}>{invite.revenue_percentage}%</span>
                      </div>
                      <div>
                        <span style={{ color: '#64748b' }}>Team:</span>{' '}
                        <span style={{ color: '#e2e8f0' }}>{project.total_collaborators} people</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div style={{
                  display: 'flex',
                  gap: 12,
                  marginTop: 16,
                  paddingTop: 16,
                  borderTop: '1px solid #334155',
                }}>
                  <button
                    onClick={(e) => handleAcceptInvite(project.id, e)}
                    disabled={isProcessing}
                    style={{
                      flex: 1,
                      background: '#10b981',
                      color: '#fff',
                      border: 'none',
                      padding: '12px 20px',
                      borderRadius: 10,
                      fontSize: 14,
                      fontWeight: 700,
                      cursor: isProcessing ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                    }}
                  >
                    <Check size={18} />
                    {isProcessing ? 'Processing...' : 'Accept Invite'}
                  </button>
                  <button
                    onClick={(e) => handleDeclineInvite(project.id, e)}
                    disabled={isProcessing}
                    style={{
                      background: 'transparent',
                      color: '#ef4444',
                      border: '1px solid #ef4444',
                      padding: '12px 20px',
                      borderRadius: 10,
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: isProcessing ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                    }}
                  >
                    <XCircle size={18} />
                    Decline
                  </button>
                  <button
                    onClick={() => setSelectedInviteProjectId(project.id)}
                    disabled={isProcessing}
                    style={{
                      background: 'transparent',
                      color: '#94a3b8',
                      border: '1px solid #334155',
                      padding: '12px 20px',
                      borderRadius: 10,
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: isProcessing ? 'not-allowed' : 'pointer',
                    }}
                  >
                    View Details
                  </button>
                </div>
              </div>
            );
            })}
          </div>
        </div>
      )}

      {/* TABS NAVIGATION */}
      <div style={{
        display: 'flex',
        gap: 4,
        borderBottom: '1px solid #1e293b',
        marginBottom: 32,
      }}>
        <Tab
          icon={<BookOpen size={18} />}
          label="My Content"
          active={activeTab === 'content'}
          onClick={() => setActiveTab('content')}
        />
        <Tab
          icon={<Users size={18} />}
          label="Collaborations"
          active={activeTab === 'collaborations'}
          onClick={() => setActiveTab('collaborations')}
        />
        <Tab
          icon={<BarChart3 size={18} />}
          label="Analytics"
          active={activeTab === 'analytics'}
          onClick={() => setActiveTab('analytics')}
        />
      </div>

      {/* TAB CONTENT */}
      {activeTab === 'content' && (
        <div>
          {inventory.length === 0 ? (
            <EmptyState
              icon={<FileText size={64} />}
              title="No content yet"
              description="Create your first piece of content to get started"
              actionLabel="+ Create Content"
              onAction={() => navigate('/upload')}
            />
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: 24,
            }}>
              {inventory.map((item) => (
                <ContentCard
                  key={item.id}
                  item={item}
                  onView={() => openPreview(item.id)}
                  onEdit={() => navigate(`/studio?editContent=${item.id}`)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'collaborations' && (
        <div>
          {/* Loading state */}
          {collaborationsLoading && (
            <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
              Loading collaborations...
            </div>
          )}

          {/* Active Collaborations Section - includes both pending invites and active projects */}
          {!collaborationsLoading && (pendingInvites.length > 0 || collaborations.length > 0) && (
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#e2e8f0', marginBottom: 16 }}>
                Active Collaborations ({pendingInvites.length + collaborations.length})
              </h3>
              <div style={{ display: 'grid', gap: 12 }}>
                {/* Pending Invites - shown first with invite status */}
                {pendingInvites.map(({ project, invite }) => {
                  const isProcessing = processingInvites.has(project.id);
                  return (
                    <div
                      key={`invite-${project.id}`}
                      style={{
                        background: '#1e293b',
                        border: '1px solid #f59e0b40',
                        borderRadius: 12,
                        padding: 16,
                        cursor: 'pointer',
                        opacity: isProcessing ? 0.7 : 1,
                        transition: 'all 0.2s',
                      }}
                      onClick={() => !isProcessing && setSelectedInviteProjectId(project.id)}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{
                          width: 40,
                          height: 40,
                          borderRadius: 8,
                          background: '#f59e0b20',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#f59e0b',
                          flexShrink: 0,
                        }}>
                          {getContentTypeIcon(project.content_type, 20)}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, color: '#f8fafc', marginBottom: 2 }}>{project.title}</div>
                          <div style={{ fontSize: 13, color: '#94a3b8' }}>
                            {project.total_collaborators} collaborator{project.total_collaborators !== 1 ? 's' : ''} · {invite.revenue_percentage}% revenue
                          </div>
                        </div>
                        {/* Action buttons */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <button
                            onClick={(e) => handleAcceptInvite(project.id, e)}
                            disabled={isProcessing}
                            style={{
                              background: '#10b981',
                              color: '#fff',
                              border: 'none',
                              padding: '8px 12px',
                              borderRadius: 6,
                              fontWeight: 600,
                              cursor: isProcessing ? 'not-allowed' : 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                              fontSize: 13,
                              transition: 'all 0.2s',
                            }}
                            title="Accept invitation"
                          >
                            <Check size={16} />
                            {isProcessing ? '...' : 'Accept'}
                          </button>
                          <button
                            onClick={(e) => handleDeclineInvite(project.id, e)}
                            disabled={isProcessing}
                            style={{
                              background: 'transparent',
                              color: '#ef4444',
                              border: '1px solid #ef4444',
                              padding: '8px 12px',
                              borderRadius: 6,
                              fontWeight: 600,
                              cursor: isProcessing ? 'not-allowed' : 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                              fontSize: 13,
                              transition: 'all 0.2s',
                            }}
                            title="Decline invitation"
                          >
                            <XCircle size={16} />
                            Deny
                          </button>
                          <div style={{
                            background: '#f59e0b20',
                            color: '#f59e0b',
                            padding: '4px 12px',
                            borderRadius: 12,
                            fontSize: 12,
                            fontWeight: 600,
                            marginLeft: 4,
                          }}>
                            Invite
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Active Collaborations */}
                {collaborations.map((project: any) => (
                  <div
                    key={`collab-${project.id}`}
                    style={{
                      background: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: 12,
                      padding: 16,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                    onClick={() => navigate(`/collaborations/${project.id}`)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{
                        width: 40,
                        height: 40,
                        borderRadius: 8,
                        background: project.status === 'active' ? '#10b98120' : '#64748b20',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: project.status === 'active' ? '#10b981' : '#94a3b8',
                        flexShrink: 0,
                      }}>
                        {getContentTypeIcon(project.content_type, 20)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, color: '#f8fafc', marginBottom: 2 }}>{project.title}</div>
                        <div style={{ fontSize: 13, color: '#94a3b8' }}>
                          {project.total_collaborators} collaborator{project.total_collaborators !== 1 ? 's' : ''} · {project.status}
                        </div>
                      </div>
                      <div style={{
                        background: project.status === 'active' ? '#10b98120' : '#64748b20',
                        color: project.status === 'active' ? '#10b981' : '#94a3b8',
                        padding: '4px 12px',
                        borderRadius: 12,
                        fontSize: 12,
                        fontWeight: 600,
                        textTransform: 'capitalize',
                      }}>
                        {project.status === 'active' ? 'Active' : project.status}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty State - only show if no invites and no collaborations */}
          {!collaborationsLoading && pendingInvites.length === 0 && collaborations.length === 0 && (
            <EmptyState
              icon={<Users size={64} />}
              title="No collaborations yet"
              description="Find collaborators to work on projects together"
              actionLabel="Find Collaborators"
              onAction={() => navigate('/collaborators')}
            />
          )}

          {/* Find Collaborators button - always show if there are collaborations */}
          {!collaborationsLoading && (pendingInvites.length > 0 || collaborations.length > 0) && (
            <div style={{ textAlign: 'center', marginTop: 24 }}>
              <button
                onClick={() => navigate('/collaborators')}
                style={{
                  background: 'transparent',
                  border: '1px solid #334155',
                  color: '#94a3b8',
                  padding: '10px 24px',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                Find More Collaborators
              </button>
            </div>
          )}
        </div>
      )}

      {activeTab === 'analytics' && (
        <EmptyState
          icon={<BarChart3 size={64} />}
          title="No analytics yet"
          description="Analytics will appear here once you have sales"
          actionLabel={null}
          onAction={() => { }}
        />
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <SettingsModal
          profile={profile}
          csrf={csrf}
          onClose={() => setShowSettingsModal(false)}
          onSave={async () => {
            setShowSettingsModal(false);
            setStatus('Settings saved');
            const profileResp = await fetch(`${API_URL}/api/users/profile/`, { credentials: 'include' });
            if (profileResp.ok) setProfile(await profileResp.json());
          }}
        />
      )}

      {/* Wallet Modal */}
      {showWalletModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(4px)',
          display: 'grid',
          placeItems: 'center',
          zIndex: 2000,
        }} onClick={() => setShowWalletModal(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '90%', maxWidth: 600 }}>
            <WalletManagementPanel
              walletAddress={profile?.wallet_address || null}
              walletProvider={profile?.wallet_provider || null}
              onWalletUpdate={async () => {
                setShowWalletModal(false);
                const profileResp = await fetch(`${API_URL}/api/users/profile/`, { credentials: 'include' });
                if (profileResp.ok) setProfile(await profileResp.json());
              }}
            />
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {showPreview && previewItem && (
        <PreviewModal
          open={showPreview}
          onClose={() => setShowPreview(false)}
          teaserUrl={previewItem.teaser_link}
          contentType={previewItem.content_type}
          contentId={previewItem.id}
          price={previewItem.price_usd}
          editions={previewItem.editions}
        />
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

      {/* Status Message */}
      {status && (
        <div style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          background: '#10b981',
          color: '#fff',
          padding: '12px 20px',
          borderRadius: 8,
          fontSize: 14,
          fontWeight: 600,
          boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
          zIndex: 1000,
        }}>
          {status}
        </div>
      )}
    </div>
  );
}

// Stat Card Component
function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      background: '#1e293b',
      border: '1px solid #334155',
      borderRadius: 12,
      padding: '16px 20px',
      transition: 'all 0.2s',
      cursor: 'default',
    }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.15)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      <div style={{
        fontSize: 12,
        color: '#94a3b8',
        marginBottom: 4,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        fontWeight: 600,
      }}>
        {label}
      </div>
      <div style={{
        fontSize: 24,
        fontWeight: 700,
        color: '#f8fafc',
      }}>
        {value}
      </div>
    </div>
  );
}

// Tab Component
function Tab({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'transparent',
        border: 'none',
        borderBottom: active ? '2px solid #f59e0b' : '2px solid transparent',
        color: active ? '#f59e0b' : '#94a3b8',
        padding: '12px 20px',
        fontSize: 15,
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'all 0.2s',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.color = '#cbd5e1';
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.color = '#94a3b8';
        }
      }}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

// Content Card Component
function ContentCard({ item, onView, onEdit }: { item: any; onView: () => void; onEdit: () => void }) {
  return (
    <div style={{
      background: '#0f172a',
      border: '1px solid #1e293b',
      borderRadius: 16,
      overflow: 'hidden',
      cursor: 'pointer',
      transition: 'all 0.2s',
    }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-4px)';
        e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.25)';
        e.currentTarget.style.borderColor = '#334155';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'none';
        e.currentTarget.style.borderColor = '#1e293b';
      }}
    >
      {/* Cover Image */}
      <div
        onClick={onView}
        style={{
          width: '100%',
          paddingTop: '56.25%', // 16:9 ratio
          background: item.teaser_link ? `url(${item.teaser_link})` : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          position: 'relative',
        }}
      >
        {!item.teaser_link && (
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            color: 'rgba(255,255,255,0.3)',
          }}>
            {item.content_type === 'book' ? <BookOpen size={48} /> : item.content_type === 'art' ? <Palette size={48} /> : item.content_type === 'film' ? <Film size={48} /> : <Music size={48} />}
          </div>
        )}
      </div>

      {/* Card Content */}
      <div style={{ padding: 16 }}>
        <div style={{
          fontSize: 16,
          fontWeight: 600,
          color: '#f8fafc',
          marginBottom: 8,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          lineHeight: 1.4,
        }}>
          {item.title}
        </div>

        <div style={{
          fontSize: 13,
          color: '#94a3b8',
          marginBottom: 12,
        }}>
          {item.content_type} {item.genre && `• ${item.genre}`}
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          fontSize: 13,
          color: '#cbd5e1',
          marginBottom: 16,
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Eye size={14} /> 0
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <DollarSign size={14} /> ${item.price_usd || 0}
          </span>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={onEdit}
            style={{
              flex: 1,
              background: 'transparent',
              border: '1px solid #334155',
              color: '#cbd5e1',
              padding: '8px 16px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#1e293b';
              e.currentTarget.style.borderColor = '#475569';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.borderColor = '#334155';
            }}
          >
            Edit
          </button>
          <button
            onClick={onView}
            style={{
              flex: 1,
              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              border: 'none',
              color: '#fff',
              padding: '8px 16px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            View
          </button>
        </div>
      </div>
    </div>
  );
}

// Empty State Component
function EmptyState({ icon, title, description, actionLabel, onAction }: {
  icon: React.ReactNode;
  title: string;
  description: string;
  actionLabel: string | null;
  onAction: () => void;
}) {
  return (
    <div style={{
      textAlign: 'center',
      padding: '80px 24px',
    }}>
      <div style={{ color: '#475569', marginBottom: 24 }}>{icon}</div>
      <div style={{
        fontSize: 24,
        fontWeight: 600,
        color: '#f8fafc',
        marginBottom: 12,
      }}>
        {title}
      </div>
      <div style={{
        fontSize: 15,
        color: '#94a3b8',
        marginBottom: 32,
        maxWidth: 400,
        margin: '0 auto 32px',
      }}>
        {description}
      </div>
      {actionLabel && (
        <button
          onClick={onAction}
          style={{
            background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
            border: 'none',
            color: '#fff',
            padding: '12px 24px',
            borderRadius: 8,
            fontSize: 15,
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 4px 16px rgba(245, 158, 11, 0.3)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

// Settings Modal Component
function SettingsModal({ profile, csrf, onClose, onSave }: {
  profile: UserProfile | null;
  csrf: string;
  onClose: () => void;
  onSave: () => void;
}) {
  const [displayName, setDisplayName] = useState(profile?.display_name || '');
  const [location, setLocation] = useState(profile?.location || '');
  const [status, setStatus] = useState(profile?.status || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/users/profile/`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrf,
          'X-Requested-With': 'XMLHttpRequest',
        },
        credentials: 'include',
        body: JSON.stringify({
          display_name: displayName,
          location: location,
          status: status,
        }),
      });

      if (res.ok) {
        onSave();
      }
    } catch (e) {
      console.error('Save failed:', e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.75)',
      backdropFilter: 'blur(4px)',
      display: 'grid',
      placeItems: 'center',
      zIndex: 2000,
    }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: '#0f172a',
        border: '1px solid #1e293b',
        borderRadius: 16,
        padding: 32,
        width: '90%',
        maxWidth: 500,
      }}>
        <div style={{
          fontSize: 24,
          fontWeight: 700,
          color: '#f8fafc',
          marginBottom: 24,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <span>Profile Settings</span>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: 4,
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <X size={24} />
          </button>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{
            display: 'block',
            fontSize: 13,
            fontWeight: 600,
            color: '#cbd5e1',
            marginBottom: 8,
          }}>
            Display Name
          </label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your display name"
            style={{
              width: '100%',
              background: '#1e293b',
              border: '1px solid #334155',
              borderRadius: 8,
              padding: '10px 14px',
              color: '#f8fafc',
              fontSize: 14,
            }}
          />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{
            display: 'block',
            fontSize: 13,
            fontWeight: 600,
            color: '#cbd5e1',
            marginBottom: 8,
          }}>
            Location
          </label>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g., New York, NY"
            style={{
              width: '100%',
              background: '#1e293b',
              border: '1px solid #334155',
              borderRadius: 8,
              padding: '10px 14px',
              color: '#f8fafc',
              fontSize: 14,
            }}
          />
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={{
            display: 'block',
            fontSize: 13,
            fontWeight: 600,
            color: '#cbd5e1',
            marginBottom: 8,
          }}>
            Availability Status
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            style={{
              width: '100%',
              background: '#1e293b',
              border: '1px solid #334155',
              borderRadius: 8,
              padding: '10px 14px',
              color: '#f8fafc',
              fontSize: 14,
            }}
          >
            <option value="Open Node">Open Node</option>
            <option value="Mint-Ready Partner">Mint-Ready Partner</option>
            <option value="Chain Builder">Chain Builder</option>
            <option value="Selective Forge">Selective Forge</option>
            <option value="Linked Capacity">Linked Capacity</option>
            <option value="Partial Protocol">Partial Protocol</option>
            <option value="Locked Chain">Locked Chain</option>
            <option value="Sealed Vault">Sealed Vault</option>
            <option value="Exclusive Mint">Exclusive Mint</option>
          </select>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              background: 'transparent',
              border: '1px solid #334155',
              color: '#cbd5e1',
              padding: '12px',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              flex: 1,
              background: saving ? '#6b7280' : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              border: 'none',
              color: '#fff',
              padding: '12px',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: saving ? 'not-allowed' : 'pointer',
            }}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
