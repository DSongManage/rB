import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import PreviewModal from '../components/PreviewModal';
import { WalletManagementPanel } from '../components/WalletManagementPanel';
import { InviteResponseModal } from '../components/collaboration/InviteResponseModal';
import { collaborationApi, CollaborativeProject, CollaboratorRole } from '../services/collaborationApi';
import { API_URL } from '../config';
import {
  Settings, MapPin, Wallet, CheckCircle, BookOpen, Users,
  BarChart3, FileText, Eye, DollarSign, Palette, Film, Music, X,
  Check, XCircle, Plus, Trash2, ExternalLink, Edit2, Briefcase,
  ChevronDown, ChevronUp, TrendingUp, Clock
} from 'lucide-react';

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

// Sales analytics types
type SalesSummary = {
  total_earnings_usdc: number;
  solo_earnings: number;
  collaboration_earnings: number;
  content_count: number;
  collaboration_count: number;
  total_sales: number;
};
// Transaction within a content sale
type SaleTransaction = {
  id: number;
  buyer: string;
  amount: number;
  percentage: number;
  date: string;
  tx_signature: string | null;
};

type ContentSale = {
  id: string;
  title: string;
  content_type: string;
  price: number;
  editions_remaining: number;
  role: string;
  percentage: number;
  total_earnings: number;
  sales_count: number;
  is_collaborative: boolean;
  transactions: SaleTransaction[];
};

// CollabSale now has same structure as ContentSale
type CollabSale = ContentSale;

type RecentTransaction = {
  id: string | number;
  type: 'collaboration' | 'solo';
  title: string;
  buyer: string;
  amount: number;
  role: string;
  percentage: number;
  date: string;
  tx_signature: string | null;
};
type SalesAnalytics = {
  summary: SalesSummary;
  content_sales: ContentSale[];
  collaboration_sales: CollabSale[];
  recent_transactions: RecentTransaction[];
};

type TabType = 'content' | 'collaborations' | 'portfolio' | 'analytics';
type ContentFilterType = 'all' | 'book' | 'art' | 'music' | 'film';

export default function ProfilePageRedesigned() {
  const navigate = useNavigate();
  const [user, setUser] = useState<UserStatus>(null);
  const [content, setContent] = useState<any[]>([]);
  const [status, setStatus] = useState('');
  const [dash, setDash] = useState<Dashboard>({ content_count: 0, sales: 0 });
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [csrf, setCsrf] = useState('');
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const bannerInputRef = useRef<HTMLInputElement | null>(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);

  // External portfolio state
  const [externalPortfolio, setExternalPortfolio] = useState<ExternalPortfolioItem[]>([]);
  const [portfolioModalOpen, setPortfolioModalOpen] = useState(false);
  const [editingPortfolioItem, setEditingPortfolioItem] = useState<ExternalPortfolioItem | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('content');
  const [contentFilter, setContentFilter] = useState<ContentFilterType>('all');
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

  // Sales analytics state
  const [salesAnalytics, setSalesAnalytics] = useState<SalesAnalytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [expandedAnalyticsCards, setExpandedAnalyticsCards] = useState<Set<string>>(new Set());

  // Toggle expanded state for an analytics card
  const toggleAnalyticsCard = (cardId: string) => {
    setExpandedAnalyticsCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(cardId)) {
        newSet.delete(cardId);
      } else {
        newSet.add(cardId);
      }
      return newSet;
    });
  };

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

  async function loadSalesAnalytics() {
    setAnalyticsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/sales-analytics/`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setSalesAnalytics(data);
      }
    } catch (err) {
      console.error('Failed to load sales analytics:', err);
    } finally {
      setAnalyticsLoading(false);
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

        // Load pending collaboration invites, active collaborations, external portfolio, and analytics
        loadPendingInvites();
        loadCollaborations();
        loadExternalPortfolio();
        loadSalesAnalytics();
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

  const onBannerClick = () => {
    bannerInputRef.current?.click();
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
      {/* Hidden file inputs for avatar and banner */}
      <input ref={avatarInputRef} onChange={onAvatarSelected} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} />
      <input ref={bannerInputRef} onChange={onBannerSelected} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} />

      {/* HERO SECTION */}
      <div
        onClick={onBannerClick}
        style={{
          background: (profile?.banner || profile?.banner_url)
            ? `linear-gradient(rgba(15,23,42,0.7), rgba(15,23,42,0.9)), url(${profile?.banner || profile?.banner_url}) center/cover`
            : '#0f172a',
          border: '1px solid #1e293b',
          borderRadius: 16,
          padding: 32,
          marginBottom: 24,
          position: 'relative',
          cursor: 'pointer',
        }}
        title="Click to update banner"
      >
        {/* Top Right Buttons */}
        <div style={{
          position: 'absolute',
          top: 24,
          right: 24,
          display: 'flex',
          gap: 8,
        }}>
          {/* View Public Profile Button */}
          <Link
            to={`/profile/${profile?.username || user?.username}`}
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'rgba(245,158,11,0.15)',
              border: '1px solid rgba(245,158,11,0.3)',
              color: '#f59e0b',
              height: 40,
              padding: '0 14px',
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              cursor: 'pointer',
              textDecoration: 'none',
              fontSize: 13,
              fontWeight: 600,
              transition: 'all 0.2s',
            }}
          >
            <Eye size={18} />
            View Public Profile
          </Link>

          {/* Settings Button */}
          <button
            onClick={(e) => { e.stopPropagation(); setShowSettingsModal(true); }}
            style={{
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
        </div>

        {/* Avatar + User Info */}
        <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', marginBottom: 16 }}>
          <div
            onClick={(e) => { e.stopPropagation(); onAvatarClick(); }}
            style={{
              width: 100,
              height: 100,
              borderRadius: '50%',
              overflow: 'hidden',
              cursor: 'pointer',
              border: '3px solid #1e293b',
              flexShrink: 0,
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#1e293b',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#f59e0b';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#1e293b';
            }}
            title="Click to upload avatar"
          >
            {(profile?.avatar || profile?.avatar_url) ? (
              <img
                src={profile?.avatar || profile?.avatar_url}
                alt={profile?.display_name || user?.username || 'Avatar'}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
              />
            ) : (
              <span style={{ color: '#f59e0b', fontWeight: 700, fontSize: 40 }}>
                {(user?.username || '?').slice(0, 1).toUpperCase()}
              </span>
            )}
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
        marginBottom: 16,
      }}>
        <Tab
          icon={<BookOpen size={18} />}
          label="My Content"
          count={inventory.length}
          active={activeTab === 'content'}
          onClick={() => setActiveTab('content')}
        />
        <Tab
          icon={<Users size={18} />}
          label="Collaborations"
          count={pendingInvites.length + collaborations.length}
          active={activeTab === 'collaborations'}
          onClick={() => setActiveTab('collaborations')}
        />
        <Tab
          icon={<Briefcase size={18} />}
          label="External Portfolio"
          active={activeTab === 'portfolio'}
          onClick={() => setActiveTab('portfolio')}
        />
        <Tab
          icon={<BarChart3 size={18} />}
          label="Analytics"
          active={activeTab === 'analytics'}
          onClick={() => setActiveTab('analytics')}
        />
      </div>

      {/* Content Type Sub-filters */}
      {activeTab === 'content' && inventory.length > 0 && (
        <div style={{
          display: 'flex',
          gap: 8,
          marginBottom: 24,
          flexWrap: 'wrap',
        }}>
          <FilterChip
            label="All"
            count={inventory.length}
            active={contentFilter === 'all'}
            onClick={() => setContentFilter('all')}
          />
          <FilterChip
            label="Books"
            count={inventory.filter(i => i.content_type === 'book').length}
            active={contentFilter === 'book'}
            onClick={() => setContentFilter('book')}
          />
          <FilterChip
            label="Art"
            count={inventory.filter(i => i.content_type === 'art').length}
            active={contentFilter === 'art'}
            onClick={() => setContentFilter('art')}
          />
          <FilterChip
            label="Music"
            count={inventory.filter(i => i.content_type === 'music').length}
            active={contentFilter === 'music'}
            onClick={() => setContentFilter('music')}
          />
          <FilterChip
            label="Film"
            count={inventory.filter(i => i.content_type === 'film' || i.content_type === 'video').length}
            active={contentFilter === 'film'}
            onClick={() => setContentFilter('film')}
          />
        </div>
      )}

      {/* TAB CONTENT */}
      {activeTab === 'content' && (
        <div>
          {inventory.length === 0 ? (
            <EmptyState
              icon={<FileText size={64} />}
              title="No content yet"
              description="Create your first piece of content to get started"
              actionLabel="+ Create Content"
              onAction={() => navigate('/studio')}
            />
          ) : (
            (() => {
              const filteredInventory = contentFilter === 'all'
                ? inventory
                : contentFilter === 'film'
                  ? inventory.filter(i => i.content_type === 'film' || i.content_type === 'video')
                  : inventory.filter(i => i.content_type === contentFilter);

              return filteredInventory.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 24px', color: '#64748b' }}>
                  <FileText size={48} style={{ marginBottom: 16, opacity: 0.5 }} />
                  <div style={{ fontSize: 16, fontWeight: 600, color: '#94a3b8' }}>
                    No {contentFilter} content yet
                  </div>
                </div>
              ) : (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                  gap: 24,
                }}>
                  {filteredInventory.map((item) => (
                    <ContentCard
                      key={item.id}
                      item={item}
                      onView={() => openPreview(item.id)}
                      onEdit={() => navigate(`/studio?editContent=${item.id}`)}
                    />
                  ))}
                </div>
              );
            })()
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

      {/* External Portfolio Tab */}
      {activeTab === 'portfolio' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <div>
              <h3 style={{ color: '#f8fafc', fontSize: 18, fontWeight: 700, margin: 0 }}>External Portfolio</h3>
              <p style={{ color: '#94a3b8', fontSize: 14, margin: '4px 0 0' }}>
                Showcase your past work and external projects on your public profile
              </p>
            </div>
            <button
              onClick={() => { setEditingPortfolioItem(null); setPortfolioModalOpen(true); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                color: '#000',
                border: 'none',
                padding: '10px 18px',
                borderRadius: 8,
                fontWeight: 600,
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              <Plus size={18} />
              Add Project
            </button>
          </div>

          {externalPortfolio.length === 0 ? (
            <EmptyState
              icon={<Briefcase size={64} />}
              title="No portfolio items yet"
              description="Add your past work, side projects, or external collaborations to showcase on your public profile"
              actionLabel="+ Add Your First Project"
              onAction={() => { setEditingPortfolioItem(null); setPortfolioModalOpen(true); }}
            />
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: 20,
            }}>
              {externalPortfolio.map(item => (
                <div key={item.id} style={{
                  background: '#0f172a',
                  border: '1px solid #1e293b',
                  borderRadius: 16,
                  overflow: 'hidden',
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
                  <div style={{
                    width: '100%',
                    paddingTop: '56.25%',
                    background: item.image_url
                      ? `url(${item.image_url}) center/cover`
                      : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    position: 'relative',
                  }}>
                    {!item.image_url && (
                      <div style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'grid',
                        placeItems: 'center',
                        color: 'rgba(255,255,255,0.3)',
                        fontSize: 48,
                        fontWeight: 700,
                      }}>
                        {item.project_type?.charAt(0).toUpperCase() || 'P'}
                      </div>
                    )}
                    {/* Project Type Badge */}
                    <div style={{
                      position: 'absolute',
                      top: 12,
                      left: 12,
                      background: '#f59e0b',
                      color: '#000',
                      padding: '4px 10px',
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                    }}>
                      {item.project_type || 'Project'}
                    </div>
                  </div>

                  {/* Card Content */}
                  <div style={{ padding: 16 }}>
                    <div style={{
                      fontSize: 16,
                      fontWeight: 600,
                      color: '#f8fafc',
                      marginBottom: 4,
                    }}>
                      {item.title}
                    </div>
                    {item.role && (
                      <div style={{
                        fontSize: 13,
                        color: '#f59e0b',
                        marginBottom: 8,
                      }}>
                        {item.role}
                      </div>
                    )}
                    {item.description && (
                      <div style={{
                        fontSize: 13,
                        color: '#94a3b8',
                        marginBottom: 12,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                      }}>
                        {item.description}
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div style={{ display: 'flex', gap: 8 }}>
                      {item.external_url && (
                        <a
                          href={item.external_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            flex: 1,
                            background: 'rgba(59,130,246,0.15)',
                            border: '1px solid rgba(59,130,246,0.3)',
                            color: '#60a5fa',
                            padding: '8px 16px',
                            borderRadius: 8,
                            fontSize: 13,
                            fontWeight: 600,
                            cursor: 'pointer',
                            textDecoration: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                          }}
                        >
                          <ExternalLink size={14} />
                          View
                        </a>
                      )}
                      <button
                        onClick={() => { setEditingPortfolioItem(item); setPortfolioModalOpen(true); }}
                        style={{
                          background: 'transparent',
                          border: '1px solid #334155',
                          color: '#cbd5e1',
                          padding: '8px 12px',
                          borderRadius: 8,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => deletePortfolioItem(item.id)}
                        style={{
                          background: 'transparent',
                          border: '1px solid rgba(239,68,68,0.3)',
                          color: '#ef4444',
                          padding: '8px 12px',
                          borderRadius: 8,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'analytics' && (
        <div>
          {/* Sales Overview Card */}
          <div style={{
            background: '#0f172a',
            border: '1px solid #1e293b',
            borderRadius: 16,
            padding: 24,
            marginBottom: 24,
          }}>
            <h3 style={{
              fontSize: 18,
              fontWeight: 700,
              color: '#f8fafc',
              marginBottom: 20,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}>
              <DollarSign size={20} style={{ color: '#10b981' }} />
              Sales Overview
            </h3>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 16,
            }}>
              <div style={{ background: '#1e293b', borderRadius: 12, padding: 20 }}>
                <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Total Earnings
                </div>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#10b981' }}>
                  ${salesAnalytics?.summary.total_earnings_usdc.toFixed(2) || dash.sales.toFixed(2)}
                </div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>USDC</div>
              </div>

              <div style={{ background: '#1e293b', borderRadius: 12, padding: 20 }}>
                <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Solo Content
                </div>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#60a5fa' }}>
                  ${salesAnalytics?.summary.solo_earnings.toFixed(2) || '0.00'}
                </div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>{salesAnalytics?.summary.content_count || 0} items</div>
              </div>

              <div style={{ background: '#1e293b', borderRadius: 12, padding: 20 }}>
                <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Collaborations
                </div>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#f59e0b' }}>
                  ${salesAnalytics?.summary.collaboration_earnings.toFixed(2) || '0.00'}
                </div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>{salesAnalytics?.summary.collaboration_count || 0} projects</div>
              </div>

              <div style={{ background: '#1e293b', borderRadius: 12, padding: 20 }}>
                <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Total Sales
                </div>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#f8fafc' }}>
                  {salesAnalytics?.summary.total_sales || 0}
                </div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>transactions</div>
              </div>
            </div>
          </div>

          {/* Content Performance - Expandable Cards */}
          {salesAnalytics && (salesAnalytics.content_sales.length > 0 || salesAnalytics.collaboration_sales.length > 0) && (
            <div style={{
              background: '#0f172a',
              border: '1px solid #1e293b',
              borderRadius: 16,
              padding: 24,
              marginBottom: 24,
            }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#f8fafc', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <TrendingUp size={18} style={{ color: '#60a5fa' }} />
                Earnings Breakdown
              </h3>
              <p style={{ fontSize: 12, color: '#64748b', marginBottom: 16 }}>
                Click any item to see individual transactions
              </p>

              {/* Solo Content Sales */}
              {salesAnalytics.content_sales.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 13, color: '#60a5fa', marginBottom: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <BookOpen size={14} />
                    Solo Content ({salesAnalytics.content_sales.length})
                  </div>
                  {salesAnalytics.content_sales.map((item) => {
                    const isExpanded = expandedAnalyticsCards.has(item.id);
                    return (
                      <div key={item.id} style={{ marginBottom: 8 }}>
                        <div
                          onClick={() => toggleAnalyticsCard(item.id)}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '12px 16px',
                            background: '#1e293b',
                            borderRadius: isExpanded ? '8px 8px 0 0' : 8,
                            cursor: 'pointer',
                            transition: 'background 0.2s',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#334155')}
                          onMouseLeave={e => (e.currentTarget.style.background = '#1e293b')}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            {getContentTypeIcon(item.content_type, 18)}
                            <div>
                              <div style={{ fontSize: 14, fontWeight: 600, color: '#f8fafc' }}>{item.title}</div>
                              <div style={{ fontSize: 12, color: '#64748b' }}>
                                {item.sales_count} sale{item.sales_count !== 1 ? 's' : ''} • {item.role} • ${item.price.toFixed(2)} price
                              </div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: 16, fontWeight: 700, color: '#10b981' }}>${item.total_earnings.toFixed(2)}</div>
                              <div style={{ fontSize: 11, color: '#64748b' }}>{item.percentage}% split</div>
                            </div>
                            {isExpanded ? <ChevronUp size={18} color="#64748b" /> : <ChevronDown size={18} color="#64748b" />}
                          </div>
                        </div>
                        {/* Expanded transaction list */}
                        {isExpanded && item.transactions && item.transactions.length > 0 && (
                          <div style={{
                            background: '#0f172a',
                            border: '1px solid #334155',
                            borderTop: 'none',
                            borderRadius: '0 0 8px 8px',
                            padding: '12px 16px',
                          }}>
                            <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                              Transaction History
                            </div>
                            {item.transactions.map((tx, idx) => (
                              <div key={tx.id || idx} style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '8px 0',
                                borderBottom: idx < item.transactions.length - 1 ? '1px solid #1e293b' : 'none',
                              }}>
                                <div>
                                  <div style={{ fontSize: 13, color: '#f8fafc' }}>
                                    Purchased by <span style={{ color: '#60a5fa' }}>@{tx.buyer}</span>
                                  </div>
                                  <div style={{ fontSize: 11, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <Clock size={10} />
                                    {new Date(tx.date).toLocaleDateString()} {new Date(tx.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </div>
                                  {tx.tx_signature && (
                                    <div style={{ fontSize: 10, color: '#475569', fontFamily: 'monospace' }}>TX: {tx.tx_signature}</div>
                                  )}
                                </div>
                                <div style={{ fontSize: 14, fontWeight: 600, color: '#10b981' }}>+${tx.amount.toFixed(2)}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Collaboration Sales */}
              {salesAnalytics.collaboration_sales.length > 0 && (
                <div>
                  <div style={{ fontSize: 13, color: '#f59e0b', marginBottom: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Users size={14} />
                    Collaborations ({salesAnalytics.collaboration_sales.length})
                  </div>
                  {salesAnalytics.collaboration_sales.map((item) => {
                    const isExpanded = expandedAnalyticsCards.has(item.id);
                    return (
                      <div key={item.id} style={{ marginBottom: 8 }}>
                        <div
                          onClick={() => toggleAnalyticsCard(item.id)}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '12px 16px',
                            background: '#1e293b',
                            borderRadius: isExpanded ? '8px 8px 0 0' : 8,
                            borderLeft: '3px solid #f59e0b',
                            cursor: 'pointer',
                            transition: 'background 0.2s',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#334155')}
                          onMouseLeave={e => (e.currentTarget.style.background = '#1e293b')}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            {getContentTypeIcon(item.content_type, 18)}
                            <div>
                              <div style={{ fontSize: 14, fontWeight: 600, color: '#f8fafc' }}>{item.title}</div>
                              <div style={{ fontSize: 12, color: '#64748b' }}>
                                {item.role} • {item.percentage}% split • {item.sales_count} sale{item.sales_count !== 1 ? 's' : ''}
                              </div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: 16, fontWeight: 700, color: '#f59e0b' }}>${item.total_earnings.toFixed(2)}</div>
                              <div style={{ fontSize: 11, color: '#64748b' }}>your share</div>
                            </div>
                            {isExpanded ? <ChevronUp size={18} color="#64748b" /> : <ChevronDown size={18} color="#64748b" />}
                          </div>
                        </div>
                        {/* Expanded transaction list */}
                        {isExpanded && item.transactions && item.transactions.length > 0 && (
                          <div style={{
                            background: '#0f172a',
                            border: '1px solid #334155',
                            borderTop: 'none',
                            borderRadius: '0 0 8px 8px',
                            padding: '12px 16px',
                          }}>
                            <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                              Transaction History
                            </div>
                            {item.transactions.map((tx, idx) => (
                              <div key={tx.id || idx} style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '8px 0',
                                borderBottom: idx < item.transactions.length - 1 ? '1px solid #1e293b' : 'none',
                              }}>
                                <div>
                                  <div style={{ fontSize: 13, color: '#f8fafc' }}>
                                    Purchased by <span style={{ color: '#60a5fa' }}>@{tx.buyer}</span>
                                  </div>
                                  <div style={{ fontSize: 11, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <Clock size={10} />
                                    {new Date(tx.date).toLocaleDateString()} {new Date(tx.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </div>
                                  {tx.tx_signature && (
                                    <div style={{ fontSize: 10, color: '#475569', fontFamily: 'monospace' }}>TX: {tx.tx_signature}</div>
                                  )}
                                </div>
                                <div style={{ fontSize: 14, fontWeight: 600, color: '#f59e0b' }}>+${tx.amount.toFixed(2)}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Recent Transactions */}
          {salesAnalytics && salesAnalytics.recent_transactions.length > 0 && (
            <div style={{
              background: '#0f172a',
              border: '1px solid #1e293b',
              borderRadius: 16,
              padding: 24,
            }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#f8fafc', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileText size={18} style={{ color: '#a78bfa' }} />
                Recent Transactions
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {salesAnalytics.recent_transactions.map((tx) => (
                  <div key={tx.id} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px 16px',
                    background: '#1e293b',
                    borderRadius: 8,
                  }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#f8fafc' }}>{tx.title}</div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>
                        Bought by @{tx.buyer} • {tx.role} ({tx.percentage}%) • {new Date(tx.date).toLocaleDateString()}
                      </div>
                      {tx.tx_signature && (
                        <div style={{ fontSize: 11, color: '#475569', fontFamily: 'monospace' }}>TX: {tx.tx_signature}</div>
                      )}
                    </div>
                    <div style={{
                      fontSize: 16,
                      fontWeight: 700,
                      color: tx.type === 'collaboration' ? '#f59e0b' : '#10b981',
                    }}>
                      +${tx.amount.toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* No Sales Yet Notice */}
          {(!salesAnalytics || salesAnalytics.summary.total_sales === 0) && !analyticsLoading && (
            <div style={{
              textAlign: 'center',
              padding: '40px 24px',
              background: '#0f172a',
              border: '1px solid #1e293b',
              borderRadius: 16,
            }}>
              <BarChart3 size={48} style={{ color: '#475569', marginBottom: 16 }} />
              <div style={{ fontSize: 16, fontWeight: 600, color: '#94a3b8', marginBottom: 8 }}>
                No sales yet
              </div>
              <div style={{ fontSize: 14, color: '#64748b' }}>
                Once you start making sales, you'll see detailed breakdowns here
              </div>
            </div>
          )}

          {/* Loading State */}
          {analyticsLoading && (
            <div style={{
              textAlign: 'center',
              padding: '40px 24px',
              background: '#0f172a',
              border: '1px solid #1e293b',
              borderRadius: 16,
            }}>
              <div style={{ fontSize: 14, color: '#94a3b8' }}>Loading analytics...</div>
            </div>
          )}
        </div>
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

      {/* Portfolio Item Modal */}
      {portfolioModalOpen && (
        <PortfolioItemModal
          item={editingPortfolioItem}
          onClose={() => { setPortfolioModalOpen(false); setEditingPortfolioItem(null); }}
          onSave={savePortfolioItem}
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

// Tab Component
function Tab({ icon, label, count, active, onClick }: { icon: React.ReactNode; label: string; count?: number; active: boolean; onClick: () => void }) {
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
      {count !== undefined && count > 0 && (
        <span style={{
          background: active ? '#f59e0b' : '#334155',
          color: active ? '#000' : '#94a3b8',
          padding: '2px 8px',
          borderRadius: 10,
          fontSize: 12,
          fontWeight: 700,
          marginLeft: 4,
        }}>
          {count}
        </span>
      )}
    </button>
  );
}

// Filter Chip Component
function FilterChip({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  if (count === 0 && !active && label !== 'All') return null;

  return (
    <button
      onClick={onClick}
      style={{
        background: active ? '#f59e0b' : '#1e293b',
        border: active ? 'none' : '1px solid #334155',
        color: active ? '#000' : '#94a3b8',
        padding: '6px 14px',
        borderRadius: 20,
        fontSize: 13,
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'all 0.2s',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.borderColor = '#475569';
          e.currentTarget.style.color = '#e2e8f0';
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.borderColor = '#334155';
          e.currentTarget.style.color = '#94a3b8';
        }
      }}
    >
      {label}
      <span style={{
        background: active ? 'rgba(0,0,0,0.2)' : '#334155',
        padding: '1px 6px',
        borderRadius: 8,
        fontSize: 11,
      }}>
        {count}
      </span>
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

// Portfolio Item Modal Component
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
        maxHeight: '90vh',
        overflow: 'auto',
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
          <span>{item ? 'Edit Portfolio Item' : 'Add Portfolio Item'}</span>
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

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 20 }}>
            <label style={{
              display: 'block',
              fontSize: 13,
              fontWeight: 600,
              color: '#cbd5e1',
              marginBottom: 8,
            }}>
              Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="Project title"
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
              Project Type
            </label>
            <select
              value={projectType}
              onChange={(e) => setProjectType(e.target.value)}
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
              <option value="book">Book</option>
              <option value="art">Art</option>
              <option value="music">Music</option>
              <option value="video">Video</option>
              <option value="film">Film</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{
              display: 'block',
              fontSize: 13,
              fontWeight: 600,
              color: '#cbd5e1',
              marginBottom: 8,
            }}>
              Your Role
            </label>
            <input
              type="text"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="e.g., Author, Illustrator, Producer"
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
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Brief description of the project"
              style={{
                width: '100%',
                background: '#1e293b',
                border: '1px solid #334155',
                borderRadius: 8,
                padding: '10px 14px',
                color: '#f8fafc',
                fontSize: 14,
                resize: 'vertical',
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
              External URL
            </label>
            <input
              type="url"
              value={externalUrl}
              onChange={(e) => setExternalUrl(e.target.value)}
              placeholder="https://..."
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
              Date (optional)
            </label>
            <input
              type="date"
              value={createdDate}
              onChange={(e) => setCreatedDate(e.target.value)}
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

          <div style={{ display: 'flex', gap: 12 }}>
            <button
              type="button"
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
              type="submit"
              style={{
                flex: 1,
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                border: 'none',
                color: '#fff',
                padding: '12px',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
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
