import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import PreviewModal from '../components/PreviewModal';
import { WalletManagementPanel } from '../components/WalletManagementPanel';
import { InviteResponseModal } from '../components/collaboration/InviteResponseModal';
import { collaborationApi, CollaborativeProject, CollaborativeProjectListItem, CollaboratorRole } from '../services/collaborationApi';
import { API_URL } from '../config';
import {
  MapPin, Wallet, CheckCircle, BookOpen, Users,
  BarChart3, FileText, Eye, DollarSign, Palette, Film, Music, X,
  Check, XCircle, Plus, Trash2, ExternalLink, Edit2, Briefcase,
  ChevronDown, ChevronUp, TrendingUp, Clock, UserCheck, Loader2, Settings,
  CheckSquare, Square, Shield
} from 'lucide-react';
import ArtManageModal from '../components/ArtManageModal';
import { getFollowing, unfollowUser, FollowUser } from '../services/socialApi';
import { BridgeOnboardingBanner } from '../components/bridge';
import { useMobile } from '../hooks/useMobile';

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
  bio?: string;
  is_private?: boolean;
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

type TabType = 'content' | 'collaborations' | 'portfolio' | 'analytics' | 'following';
type ContentFilterType = 'all' | 'book' | 'comic' | 'art';
// Note: 'music' and 'film' are coming soon - not included in MVP
type StatusFilterType = 'all' | 'published' | 'draft' | 'unpublished';

// Book project with chapters (from /api/book-projects/my-published/)
interface BookChapter {
  id: number;
  title: string;
  order: number;
  is_published: boolean;
  content_id: number | null;
  price_usd: number;
  view_count: number;
}

interface BookProject {
  id: number;
  title: string;
  cover_image_url: string | null;
  total_chapters: number;
  published_chapters: number;
  is_published: boolean;
  chapters: BookChapter[];
  total_views: number;
  total_price: number;
  updated_at: string;
}

export default function ProfilePageRedesigned() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isMobile, isPhone } = useMobile();
  const [user, setUser] = useState<UserStatus>(null);
  const [content, setContent] = useState<any[]>([]);
  const [status, setStatus] = useState('');
  const [dash, setDash] = useState<Dashboard>({ content_count: 0, sales: 0 });
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [csrf, setCsrf] = useState('');
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const bannerInputRef = useRef<HTMLInputElement | null>(null);
  const [showWalletModal, setShowWalletModal] = useState(false);

  // About section editing state
  const [editingAbout, setEditingAbout] = useState(false);
  const [editBio, setEditBio] = useState('');
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [editRoles, setEditRoles] = useState<string[]>([]);
  const [editGenres, setEditGenres] = useState<string[]>([]);
  const [editIsPrivate, setEditIsPrivate] = useState(true); // Default to private
  const [savingAbout, setSavingAbout] = useState(false);

  // Predefined options for roles and genres
  const ROLE_OPTIONS = [
    'Author', 'Artist', 'Illustrator', 'Manga Artist', 'Comic Artist',
    'Cover Designer', 'Editor', 'Proofreader', 'Narrator', 'Colorist',
    'Letterer', 'Writer', 'Researcher', 'Analyst'
  ];
  const GENRE_OPTIONS = [
    'Fantasy', 'Sci-Fi', 'Romance', 'Horror', 'Mystery', 'Thriller',
    'Manga', 'Webtoon', 'Comics', 'Non-Fiction', 'Finance', 'Business',
    'Self-Help', 'Biography', 'History', 'Action', 'Drama', 'Comedy',
    'Slice of Life', 'Isekai', 'LitRPG'
  ];

  // External portfolio state
  const [externalPortfolio, setExternalPortfolio] = useState<ExternalPortfolioItem[]>([]);
  const [portfolioModalOpen, setPortfolioModalOpen] = useState(false);
  const [editingPortfolioItem, setEditingPortfolioItem] = useState<ExternalPortfolioItem | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('content');
  const [contentFilter, setContentFilter] = useState<ContentFilterType>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilterType>('all');
  const [inventory, setInventory] = useState<any[]>([]);
  const [bookProjects, setBookProjects] = useState<BookProject[]>([]);
  const [soloProjects, setSoloProjects] = useState<CollaborativeProjectListItem[]>([]);
  const [expandedBooks, setExpandedBooks] = useState<Set<number>>(new Set());
  const [showPreview, setShowPreview] = useState(false);
  const [previewItem, setPreviewItem] = useState<any>(null);

  // Art manage modal state
  const [showManageModal, setShowManageModal] = useState(false);
  const [manageItem, setManageItem] = useState<any>(null);

  // Collaboration invite state
  const [pendingInvites, setPendingInvites] = useState<{ project: CollaborativeProject; invite: CollaboratorRole }[]>([]);
  const [selectedInviteProjectId, setSelectedInviteProjectId] = useState<number | null>(null);
  // Active collaborations state
  const [collaborations, setCollaborations] = useState<any[]>([]);
  const [collaborationsLoading, setCollaborationsLoading] = useState(false);
  // Processing state for accept/decline buttons
  const [processingInvites, setProcessingInvites] = useState<Set<number>>(new Set());
  // Warranty of originality acknowledgment tracking per invite
  const [warrantyAcknowledgedInvites, setWarrantyAcknowledgedInvites] = useState<Set<number>>(new Set());

  // Sales analytics state
  const [salesAnalytics, setSalesAnalytics] = useState<SalesAnalytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [expandedAnalyticsCards, setExpandedAnalyticsCards] = useState<Set<string>>(new Set());

  // Following state
  const [followingList, setFollowingList] = useState<FollowUser[]>([]);
  const [followingLoading, setFollowingLoading] = useState(false);
  const [unfollowingUsers, setUnfollowingUsers] = useState<Set<number>>(new Set());

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
      // Filter out solo projects - they should not appear in collaborations
      const collaborativeOnly = projects.filter((p: any) => !p.is_solo);
      setCollaborations(collaborativeOnly);
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

  async function loadFollowingList(usernameOverride?: string) {
    const username = usernameOverride || profile?.username;
    if (!username) return;
    setFollowingLoading(true);
    try {
      const response = await getFollowing(username);
      setFollowingList(response.results);
    } catch (err) {
      console.error('Failed to load following list:', err);
      setFollowingList([]);
    } finally {
      setFollowingLoading(false);
    }
  }

  async function handleUnfollow(username: string, userId: number) {
    setUnfollowingUsers(prev => new Set(prev).add(userId));
    try {
      await unfollowUser(username);
      // Remove from the list
      setFollowingList(prev => prev.filter(u => u.id !== userId));
      setStatus(`Unfollowed @${username}`);
    } catch (err) {
      console.error('Failed to unfollow:', err);
      setStatus('Failed to unfollow');
    } finally {
      setUnfollowingUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
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

    // Check if warranty has been acknowledged
    if (!warrantyAcknowledgedInvites.has(projectId)) {
      setStatus('Please acknowledge the warranty of originality before accepting');
      return;
    }

    setProcessingInvites(prev => new Set(prev).add(projectId));
    try {
      await collaborationApi.acceptInvitation(projectId, true);
      setStatus('Invitation accepted!');
      // Clear warranty state for this project
      setWarrantyAcknowledgedInvites(prev => {
        const newSet = new Set(prev);
        newSet.delete(projectId);
        return newSet;
      });
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

  // Handle URL tab parameter (e.g., /profile?tab=collaborations)
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && ['content', 'collaborations', 'portfolio', 'analytics', 'following'].includes(tabParam)) {
      setActiveTab(tabParam as TabType);
    }
  }, [searchParams]);

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
        setProfileLoading(false);

        // Load pending collaboration invites, active collaborations, external portfolio, analytics, and following
        loadPendingInvites();
        loadCollaborations();
        loadExternalPortfolio();
        loadSalesAnalytics();
        // Pass username directly since profile state won't be updated yet
        if (profileResp?.username) {
          loadFollowingList(profileResp.username);
        }
      })
      .catch(() => { setProfileLoading(false); });

    return () => abortController.abort();
  }, []);

  useEffect(() => {
    // Fetch all user content (both draft and minted) - books are handled separately
    fetch(`${API_URL}/api/content/?mine=1`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        let items: any[] = [];
        if (data && Array.isArray(data.results)) {
          items = data.results;
        } else if (Array.isArray(data)) {
          items = data;
        }
        // Filter out solo book content - these are fetched separately as book projects
        // BUT keep collaborative book content (is_collaborative=true) since those aren't in bookProjects
        setInventory(items.filter(item => item.content_type !== 'book' || item.is_collaborative));
      })
      .catch(() => setInventory([]));

    // Fetch published book projects (grouped by book, not individual chapters)
    fetch(`${API_URL}/api/book-projects/my-published/`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        if (Array.isArray(data)) {
          setBookProjects(data);
        } else {
          setBookProjects([]);
        }
      })
      .catch(() => setBookProjects([]));

    // Fetch solo projects (drafts created in solo studio - all content types)
    collaborationApi.getCollaborativeProjects()
      .then(projects => {
        // Filter to only solo projects (1 collaborator or marked as solo)
        const solo = projects.filter((p: any) => p.is_solo);
        setSoloProjects(solo);
      })
      .catch(() => setSoloProjects([]));
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

  const openReader = (contentId: number) => {
    // Owner viewing their own content - go directly to reader (full access)
    navigate(`/reader/${contentId}`);
  };

  const shortenAddress = (addr: string) => {
    if (!addr || addr.length < 12) return addr;
    return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
  };

  // About section editing handlers
  const startEditingAbout = () => {
    setEditBio(profile?.bio || '');
    setEditDisplayName(profile?.display_name || '');
    setEditLocation(profile?.location || '');
    setEditStatus(profile?.status || 'Available');
    setEditRoles(profile?.roles || []);
    setEditGenres(profile?.genres || []);
    setEditIsPrivate(profile?.is_private ?? true); // Default to private for new profiles
    setEditingAbout(true);
  };

  const cancelEditingAbout = () => {
    setEditingAbout(false);
  };

  const saveAbout = async () => {
    setSavingAbout(true);
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
          bio: editBio,
          display_name: editDisplayName,
          location: editLocation,
          status: editStatus,
          roles: editRoles,
          genres: editGenres,
          is_private: editIsPrivate,
        }),
      });

      if (res.ok) {
        const updatedProfile = await res.json();
        setProfile(updatedProfile);
        setEditingAbout(false);
        setStatus('Profile updated');
      } else {
        setStatus('Failed to save profile');
      }
    } catch (e) {
      console.error('Save failed:', e);
      setStatus('Failed to save profile');
    } finally {
      setSavingAbout(false);
    }
  };

  // Availability status options
  const statusOptions = [
    { value: 'Available', label: 'Available', description: 'Ready to start new collaborations' },
    { value: 'Open to Offers', label: 'Open to Offers', description: 'Will consider interesting projects' },
    { value: 'Selective', label: 'Selective', description: 'Only taking specific types of work' },
    { value: 'Booked', label: 'Booked', description: 'Currently busy, booking future work' },
    { value: 'Unavailable', label: 'Unavailable', description: 'Not accepting collaborations' },
    { value: 'On Hiatus', label: 'On Hiatus', description: 'Taking a break' },
  ];

  // Show loading skeleton while profile is loading
  if (profileLoading) {
    return (
      <div style={{
        maxWidth: 1200,
        margin: '0 auto',
        padding: isMobile ? '16px 12px' : '40px 24px',
      }}>
        {/* Loading skeleton for hero section */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--panel-border-strong)',
          borderRadius: isMobile ? 12 : 16,
          padding: isMobile ? 16 : 32,
          marginBottom: isMobile ? 16 : 24,
        }}>
          <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
            {/* Avatar skeleton */}
            <div style={{
              width: isPhone ? 80 : 100,
              height: isPhone ? 80 : 100,
              borderRadius: '50%',
              background: 'linear-gradient(90deg, var(--bg-card) 25%, var(--panel-border-strong) 50%, var(--bg-card) 75%)',
              backgroundSize: '200% 100%',
              animation: 'shimmer 1.5s infinite',
            }} />
            <div style={{ flex: 1 }}>
              {/* Name skeleton */}
              <div style={{
                width: 180,
                height: 32,
                borderRadius: 6,
                marginBottom: 12,
                background: 'linear-gradient(90deg, var(--bg-card) 25%, var(--panel-border-strong) 50%, var(--bg-card) 75%)',
                backgroundSize: '200% 100%',
                animation: 'shimmer 1.5s infinite',
              }} />
              {/* Username skeleton */}
              <div style={{
                width: 120,
                height: 20,
                borderRadius: 4,
                background: 'linear-gradient(90deg, var(--bg-card) 25%, var(--panel-border-strong) 50%, var(--bg-card) 75%)',
                backgroundSize: '200% 100%',
                animation: 'shimmer 1.5s infinite',
              }} />
            </div>
          </div>
        </div>
        {/* Wallet section skeleton */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--panel-border-strong)',
          borderRadius: 12,
          padding: '16px 20px',
          marginBottom: 24,
          height: 60,
        }} />
        <style>{`
          @keyframes shimmer {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div style={{
      maxWidth: 1200,
      margin: '0 auto',
      padding: isMobile ? '16px 12px' : '40px 24px',
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
            : 'var(--bg-card)',
          border: '1px solid var(--panel-border-strong)',
          borderRadius: isMobile ? 12 : 16,
          padding: isMobile ? 16 : 32,
          marginBottom: isMobile ? 16 : 24,
          position: 'relative',
          cursor: 'pointer',
        }}
        title="Click to update banner"
      >
        {/* Top Right Buttons */}
        <div style={{
          position: 'absolute',
          top: isMobile ? 12 : 24,
          right: isMobile ? 12 : 24,
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
              height: isMobile ? 36 : 40,
              padding: isMobile ? '0 10px' : '0 14px',
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              cursor: 'pointer',
              textDecoration: 'none',
              fontSize: isMobile ? 12 : 13,
              fontWeight: 600,
              transition: 'all 0.2s',
            }}
          >
            <Eye size={isMobile ? 16 : 18} />
            {isPhone ? 'Public' : 'View Public Profile'}
          </Link>
        </div>

        {/* Avatar + User Info */}
        <div style={{ display: 'flex', flexDirection: isPhone ? 'column' : 'row', gap: isPhone ? 12 : 24, alignItems: isPhone ? 'center' : 'flex-start', marginBottom: 16, marginTop: isPhone ? 32 : 0 }}>
          <div
            onClick={(e) => { e.stopPropagation(); onAvatarClick(); }}
            style={{
              width: isPhone ? 80 : 100,
              height: isPhone ? 80 : 100,
              borderRadius: '50%',
              overflow: 'hidden',
              cursor: 'pointer',
              border: '3px solid var(--bg-card)',
              flexShrink: 0,
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--bg-card)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#f59e0b';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--bg-card)';
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
              <span style={{ color: '#f59e0b', fontWeight: 700, fontSize: isPhone ? 32 : 40 }}>
                {(user?.username || '?').slice(0, 1).toUpperCase()}
              </span>
            )}
          </div>

          <div style={{ flex: 1, textAlign: isPhone ? 'center' : 'left' }}>
            {/* Hero text always uses white with text-shadow for readability over any banner image */}
            <div style={{
              fontSize: isPhone ? 24 : 32,
              fontWeight: 700,
              color: '#ffffff',
              marginBottom: 8,
              textShadow: '0 2px 4px rgba(0,0,0,0.5)',
            }}>
              {profile?.display_name || user?.username || 'User'}
            </div>

            {profile?.location && (
              <div style={{
                fontSize: isPhone ? 14 : 15,
                color: 'rgba(255,255,255,0.8)',
                marginBottom: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: isPhone ? 'center' : 'flex-start',
                gap: 6,
                textShadow: '0 1px 2px rgba(0,0,0,0.5)',
              }}>
                <MapPin size={16} /> {profile.location}
              </div>
            )}

            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: isPhone ? 'center' : 'flex-start',
              gap: 12,
              fontSize: 14,
              color: 'rgba(255,255,255,0.7)',
              flexWrap: 'wrap',
              textShadow: '0 1px 2px rgba(0,0,0,0.5)',
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
                  <span style={{ color: 'rgba(255,255,255,0.5)' }}>•</span>
                </>
              )}
              <span style={{ color: 'rgba(255,255,255,0.7)' }}>@{profile?.username || user?.username || ''}</span>
            </div>
          </div>
        </div>
      </div>

      {/* WALLET STATUS CARD - Compact */}
      <div style={{
        background: profile?.wallet_address ? 'var(--bg-card)' : 'var(--dropdown-hover)',
        border: profile?.wallet_address ? '1px solid #10b981' : '1px solid var(--panel-border-strong)',
        borderRadius: 12,
        padding: '16px 20px',
        marginBottom: 24,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ color: profile?.wallet_address ? '#10b981' : 'var(--text-muted)' }}>
            {profile?.wallet_address ? <CheckCircle size={24} /> : <Wallet size={24} />}
          </div>
          <div>
            <div style={{
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--text)',
              marginBottom: profile?.wallet_address ? 4 : 0,
            }}>
              {profile?.wallet_address ? 'Wallet Connected' : 'Wallet Setup Required'}
            </div>
            {profile?.wallet_address && (
              <div style={{
                fontSize: 13,
                color: 'var(--text-muted)',
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
            border: profile?.wallet_address ? '1px solid var(--panel-border-strong)' : 'none',
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
              e.currentTarget.style.background = 'var(--dropdown-hover)';
              e.currentTarget.style.borderColor = 'var(--border)';
            } else {
              e.currentTarget.style.transform = 'translateY(-2px)';
            }
          }}
          onMouseLeave={(e) => {
            if (profile?.wallet_address) {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.borderColor = 'var(--panel-border-strong)';
            } else {
              e.currentTarget.style.transform = 'translateY(0)';
            }
          }}
        >
          {profile?.wallet_address ? 'Manage' : 'Connect Wallet'}
        </button>
      </div>

      {/* ABOUT SECTION */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--panel-border-strong)',
        borderRadius: 16,
        padding: 24,
        marginBottom: 24,
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20,
        }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
            About
          </h3>
          {!editingAbout ? (
            <button
              onClick={startEditingAbout}
              style={{
                background: 'transparent',
                border: '1px solid var(--panel-border-strong)',
                color: 'var(--text-muted)',
                padding: '6px 12px',
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#f59e0b';
                e.currentTarget.style.color = '#f59e0b';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--panel-border-strong)';
                e.currentTarget.style.color = 'var(--text-muted)';
              }}
            >
              <Edit2 size={14} />
              Edit
            </button>
          ) : (
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={cancelEditingAbout}
                disabled={savingAbout}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--panel-border-strong)',
                  color: 'var(--text-muted)',
                  padding: '6px 12px',
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: savingAbout ? 'not-allowed' : 'pointer',
                  opacity: savingAbout ? 0.5 : 1,
                }}
              >
                Cancel
              </button>
              <button
                onClick={saveAbout}
                disabled={savingAbout}
                style={{
                  background: savingAbout ? '#6b7280' : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                  border: 'none',
                  color: '#fff',
                  padding: '6px 16px',
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: savingAbout ? 'not-allowed' : 'pointer',
                }}
              >
                {savingAbout ? 'Saving...' : 'Save'}
              </button>
            </div>
          )}
        </div>

        {editingAbout ? (
          /* Edit Mode */
          <div style={{ display: 'grid', gap: 20, maxWidth: '100%', overflow: 'hidden' }}>
            {/* Display Name */}
            <div>
              <label style={{
                display: 'block',
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--text-muted)',
                marginBottom: 8,
              }}>
                Display Name
              </label>
              <input
                type="text"
                value={editDisplayName}
                onChange={(e) => setEditDisplayName(e.target.value)}
                placeholder="Your display name"
                style={{
                  width: '100%',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--panel-border-strong)',
                  borderRadius: 8,
                  padding: '10px 14px',
                  color: 'var(--text)',
                  fontSize: 14,
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Location */}
            <div>
              <label style={{
                display: 'block',
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--text-muted)',
                marginBottom: 8,
              }}>
                Location
              </label>
              <input
                type="text"
                value={editLocation}
                onChange={(e) => setEditLocation(e.target.value)}
                placeholder="e.g., New York, NY"
                style={{
                  width: '100%',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--panel-border-strong)',
                  borderRadius: 8,
                  padding: '10px 14px',
                  color: 'var(--text)',
                  fontSize: 14,
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Availability Status */}
            <div>
              <label style={{
                display: 'block',
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--text-muted)',
                marginBottom: 8,
              }}>
                Availability Status
              </label>
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value)}
                style={{
                  width: '100%',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--panel-border-strong)',
                  borderRadius: 8,
                  padding: '10px 14px',
                  color: 'var(--text)',
                  fontSize: 14,
                  boxSizing: 'border-box',
                }}
              >
                {statusOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* Profile Visibility */}
            <div>
              <label style={{
                display: 'block',
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--text-muted)',
                marginBottom: 8,
              }}>
                Profile Visibility
              </label>
              <select
                value={editIsPrivate ? 'private' : 'public'}
                onChange={(e) => setEditIsPrivate(e.target.value === 'private')}
                style={{
                  width: '100%',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--panel-border-strong)',
                  borderRadius: 8,
                  padding: '10px 14px',
                  color: 'var(--text)',
                  fontSize: 14,
                  boxSizing: 'border-box',
                }}
              >
                <option value="private">Private - Hidden from Collaborators page</option>
                <option value="public">Public - Visible on Collaborators page</option>
              </select>
              <div style={{ fontSize: 12, color: 'var(--subtle)', marginTop: 6 }}>
                Private profiles won't appear in search results on the Collaborators page.
              </div>
            </div>

            {/* Roles */}
            <div>
              <label style={{
                display: 'block',
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--text-muted)',
                marginBottom: 8,
              }}>
                Your Roles <span style={{ color: 'var(--subtle)', fontWeight: 400 }}>(what you do)</span>
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, maxWidth: '100%', overflow: 'hidden' }}>
                {ROLE_OPTIONS.map((role) => {
                  const isSelected = editRoles.includes(role);
                  return (
                    <button
                      key={role}
                      type="button"
                      onClick={() => {
                        if (isSelected) {
                          setEditRoles(editRoles.filter(r => r !== role));
                        } else {
                          setEditRoles([...editRoles, role]);
                        }
                      }}
                      style={{
                        background: isSelected ? 'rgba(245, 158, 11, 0.2)' : 'var(--bg-card)',
                        border: `1px solid ${isSelected ? '#f59e0b' : 'var(--panel-border-strong)'}`,
                        color: isSelected ? '#fbbf24' : 'var(--text-muted)',
                        padding: '6px 12px',
                        borderRadius: 6,
                        fontSize: 13,
                        fontWeight: 500,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                    >
                      {role}
                    </button>
                  );
                })}
              </div>
              <div style={{ fontSize: 12, color: 'var(--subtle)', marginTop: 6 }}>
                Select all roles that apply to you. This helps collaborators find you.
              </div>
            </div>

            {/* Genres */}
            <div>
              <label style={{
                display: 'block',
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--text-muted)',
                marginBottom: 8,
              }}>
                Your Genres <span style={{ color: 'var(--subtle)', fontWeight: 400 }}>(what you create)</span>
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, maxWidth: '100%', overflow: 'hidden' }}>
                {GENRE_OPTIONS.map((genre) => {
                  const isSelected = editGenres.includes(genre);
                  return (
                    <button
                      key={genre}
                      type="button"
                      onClick={() => {
                        if (isSelected) {
                          setEditGenres(editGenres.filter(g => g !== genre));
                        } else {
                          setEditGenres([...editGenres, genre]);
                        }
                      }}
                      style={{
                        background: isSelected ? 'rgba(59, 130, 246, 0.2)' : 'var(--bg-card)',
                        border: `1px solid ${isSelected ? '#3b82f6' : 'var(--panel-border-strong)'}`,
                        color: isSelected ? '#60a5fa' : 'var(--text-muted)',
                        padding: '6px 12px',
                        borderRadius: 6,
                        fontSize: 13,
                        fontWeight: 500,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                    >
                      {genre}
                    </button>
                  );
                })}
              </div>
              <div style={{ fontSize: 12, color: 'var(--subtle)', marginTop: 6 }}>
                Select genres you work in or are interested in.
              </div>
            </div>

            {/* Bio */}
            <div>
              <label style={{
                display: 'block',
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--text-muted)',
                marginBottom: 8,
              }}>
                Bio
              </label>
              <textarea
                value={editBio}
                onChange={(e) => setEditBio(e.target.value)}
                placeholder="Tell the world about yourself, your work, and what you're looking for..."
                rows={4}
                style={{
                  width: '100%',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--panel-border-strong)',
                  borderRadius: 8,
                  padding: '10px 14px',
                  color: 'var(--text)',
                  fontSize: 14,
                  resize: 'vertical',
                  minHeight: 100,
                  lineHeight: 1.6,
                  boxSizing: 'border-box',
                }}
              />
              <div style={{ fontSize: 12, color: 'var(--subtle)', marginTop: 6 }}>
                Describe your experience, interests, and what kind of collaborations you're seeking.
              </div>
            </div>
          </div>
        ) : (
          /* View Mode */
          <div>
            {/* Bio */}
            {profile?.bio ? (
              <p style={{
                color: 'var(--text-muted)',
                fontSize: 15,
                lineHeight: 1.7,
                margin: 0,
                whiteSpace: 'pre-wrap',
              }}>
                {profile.bio}
              </p>
            ) : (
              <p style={{
                color: 'var(--subtle)',
                fontSize: 14,
                fontStyle: 'italic',
                margin: 0,
              }}>
                No bio yet. Click Edit to add a bio and tell others about yourself.
              </p>
            )}
          </div>
        )}
      </div>

      {/* PENDING COLLABORATION INVITES */}
      {pendingInvites.length > 0 && (
        <div style={{
          background: 'var(--bg-card)',
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
            <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>
              Collaboration Invites
            </span>
          </div>

          <div style={{ display: 'grid', gap: 16 }}>
            {pendingInvites.map(({ project, invite }) => {
              const isProcessing = processingInvites.has(project.id);
              return (
              <div key={project.id} style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--panel-border-strong)',
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
                    <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
                      {project.title}
                    </div>
                    <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 10 }}>
                      <span style={{ color: 'var(--text-muted)' }}>@{project.created_by_username}</span> invited you as{' '}
                      <span style={{ color: '#f59e0b', fontWeight: 600 }}>{invite.role}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 20, fontSize: 13 }}>
                      <div>
                        <span style={{ color: 'var(--subtle)' }}>Revenue Split:</span>{' '}
                        <span style={{ color: '#10b981', fontWeight: 700 }}>{invite.revenue_percentage}%</span>
                      </div>
                      <div>
                        <span style={{ color: 'var(--subtle)' }}>Team:</span>{' '}
                        <span style={{ color: '#e2e8f0' }}>{project.total_collaborators} people</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                {(() => {
                  // Check if there's a pending counter-proposal
                  const hasCounterProposal = invite.proposed_percentage !== null &&
                    invite.proposed_percentage !== undefined &&
                    Math.abs(Number(invite.proposed_percentage) - Number(invite.revenue_percentage)) > 0.001;

                  if (hasCounterProposal) {
                    // Pending counter-proposal state
                    return (
                      <div style={{
                        marginTop: 16,
                        paddingTop: 16,
                        borderTop: '1px solid var(--panel-border-strong)',
                      }}>
                        <div style={{
                          background: 'linear-gradient(135deg, #f59e0b10 0%, #fbbf2410 100%)',
                          border: '1px solid #f59e0b40',
                          borderRadius: 10,
                          padding: 16,
                          textAlign: 'center',
                        }}>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 8,
                            marginBottom: 8,
                          }}>
                            <Clock size={18} style={{ color: '#f59e0b' }} />
                            <span style={{ color: '#f59e0b', fontSize: 15, fontWeight: 600 }}>
                              Counter-Proposal Pending
                            </span>
                          </div>
                          <p style={{ margin: 0, color: '#fbbf24', fontSize: 13, lineHeight: 1.5 }}>
                            You proposed <strong>{invite.proposed_percentage}%</strong> revenue
                            (original offer: {invite.revenue_percentage}%)
                          </p>
                          <p style={{ margin: '6px 0 0', color: 'var(--text-muted)', fontSize: 12 }}>
                            Waiting for @{project.created_by_username} to respond
                          </p>
                          <button
                            onClick={(e) => handleDeclineInvite(project.id, e)}
                            disabled={isProcessing}
                            style={{
                              marginTop: 12,
                              background: 'transparent',
                              color: '#ef4444',
                              border: '1px solid #ef4444',
                              padding: '8px 16px',
                              borderRadius: 8,
                              fontSize: 13,
                              fontWeight: 600,
                              cursor: isProcessing ? 'not-allowed' : 'pointer',
                            }}
                          >
                            Withdraw & Decline
                          </button>
                        </div>
                      </div>
                    );
                  }

                  // Normal action buttons
                  const isWarrantyAcknowledged = warrantyAcknowledgedInvites.has(project.id);
                  return (
                    <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--panel-border-strong)' }}>
                      {/* Warranty of Originality Checkbox */}
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          setWarrantyAcknowledgedInvites(prev => {
                            const newSet = new Set(prev);
                            if (newSet.has(project.id)) {
                              newSet.delete(project.id);
                            } else {
                              newSet.add(project.id);
                            }
                            return newSet;
                          });
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 10,
                          padding: '10px 12px',
                          marginBottom: 12,
                          background: isWarrantyAcknowledged ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.05)',
                          border: `1px solid ${isWarrantyAcknowledged ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.2)'}`,
                          borderRadius: 8,
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                        }}
                      >
                        <div style={{ flexShrink: 0, marginTop: 2 }}>
                          {isWarrantyAcknowledged ? (
                            <CheckSquare size={18} style={{ color: '#10b981' }} />
                          ) : (
                            <Square size={18} style={{ color: 'var(--subtle)' }} />
                          )}
                        </div>
                        <div>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            marginBottom: 4,
                          }}>
                            <Shield size={14} style={{ color: isWarrantyAcknowledged ? '#10b981' : '#f59e0b' }} />
                            <span style={{
                              color: isWarrantyAcknowledged ? '#10b981' : '#f59e0b',
                              fontSize: 12,
                              fontWeight: 600,
                            }}>
                              Warranty of Originality
                            </span>
                          </div>
                          <div style={{ color: 'var(--text-muted)', fontSize: 11, lineHeight: 1.4 }}>
                            I acknowledge that my contributions will be original work and do not infringe on any third-party rights.
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div style={{ display: 'flex', gap: 12 }}>
                      <button
                        onClick={(e) => handleAcceptInvite(project.id, e)}
                        disabled={isProcessing || !isWarrantyAcknowledged}
                        style={{
                          flex: 1,
                          background: isWarrantyAcknowledged ? '#10b981' : 'var(--subtle)',
                          color: '#fff',
                          border: 'none',
                          padding: '12px 20px',
                          borderRadius: 10,
                          fontSize: 14,
                          fontWeight: 700,
                          cursor: (isProcessing || !isWarrantyAcknowledged) ? 'not-allowed' : 'pointer',
                          opacity: isWarrantyAcknowledged ? 1 : 0.6,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 8,
                        }}
                        title={!isWarrantyAcknowledged ? 'Please acknowledge the warranty of originality first' : 'Accept invitation'}
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
                          color: 'var(--text-muted)',
                          border: '1px solid var(--panel-border-strong)',
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
                })()}
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
        borderBottom: '1px solid var(--panel-border-strong)',
        marginBottom: 16,
        overflowX: isMobile ? 'auto' : 'visible',
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
      }}>
        <Tab
          icon={<BookOpen size={18} />}
          label="My Content"
          count={inventory.length + bookProjects.length + soloProjects.filter(c => c.status === 'draft').length}
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
        <Tab
          icon={<UserCheck size={18} />}
          label="Following"
          count={followingList.length}
          active={activeTab === 'following'}
          onClick={() => setActiveTab('following')}
        />
      </div>

      {/* Content Type Sub-filters + Create Button */}
      {activeTab === 'content' && (inventory.length > 0 || bookProjects.length > 0 || soloProjects.length > 0) && (
        <div style={{
          display: 'flex',
          flexDirection: isPhone ? 'column' : 'row',
          justifyContent: 'space-between',
          alignItems: isPhone ? 'stretch' : 'center',
          marginBottom: isMobile ? 16 : 24,
          gap: isPhone ? 12 : 16,
        }}>
          <div style={{
            display: 'flex',
            gap: 8,
            flexWrap: 'wrap',
            overflowX: isPhone ? 'auto' : 'visible',
            WebkitOverflowScrolling: 'touch',
            paddingBottom: isPhone ? 4 : 0,
          }}>
            <FilterChip
              label="All"
              count={
                // inventory + bookProjects + solo projects (draft only, minted shown via inventory)
                inventory.length + bookProjects.length + soloProjects.filter(p => p.status === 'draft').length
              }
              active={contentFilter === 'all'}
              onClick={() => setContentFilter('all')}
            />
            <FilterChip
              label="Books"
              count={
                bookProjects.length +
                soloProjects.filter(p => p.content_type === 'book' && p.status === 'draft').length
              }
              active={contentFilter === 'book'}
              onClick={() => setContentFilter('book')}
            />
            <FilterChip
              label="Comics"
              count={
                // Draft comics from soloProjects + published from inventory
                soloProjects.filter(p => p.content_type === 'comic' && p.status === 'draft').length +
                inventory.filter(i => i.content_type === 'comic' && i.inventory_status === 'minted').length
              }
              active={contentFilter === 'comic'}
              onClick={() => setContentFilter('comic')}
            />
            <FilterChip
              label="Art"
              count={
                inventory.filter(i => i.content_type === 'art').length +
                soloProjects.filter(p => p.content_type === 'art' && p.status === 'draft').length
              }
              active={contentFilter === 'art'}
              onClick={() => setContentFilter('art')}
            />
            {/* Music & Film coming soon - hidden from filters */}
            <div style={{ width: 1, height: 24, background: 'var(--dropdown-hover)', margin: '0 8px' }} />
            <FilterChip
              label="Published"
              count={
                // Published comics are in inventory (Content records), not soloProjects
                inventory.filter(i => i.inventory_status === 'minted').length +
                bookProjects.filter(b => b.published_chapters > 0 || b.is_published).length
              }
              active={statusFilter === 'published'}
              onClick={() => setStatusFilter(statusFilter === 'published' ? 'all' : 'published')}
            />
            <FilterChip
              label="Drafts"
              count={
                // Draft content from inventory (non-solo) + draft book projects + all draft solo projects
                inventory.filter(i => i.inventory_status === 'draft').length +
                bookProjects.filter(b => b.published_chapters === 0 && !b.is_published).length +
                soloProjects.filter(p => p.status === 'draft').length
              }
              active={statusFilter === 'draft'}
              onClick={() => setStatusFilter(statusFilter === 'draft' ? 'all' : 'draft')}
            />
            <FilterChip
              label="Unpublished"
              count={
                inventory.filter(i => i.inventory_status === 'delisted').length
              }
              active={statusFilter === 'unpublished'}
              onClick={() => setStatusFilter(statusFilter === 'unpublished' ? 'all' : 'unpublished')}
            />
          </div>
          <button
            onClick={() => navigate('/studio')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              color: '#000',
              border: 'none',
              padding: '10px 18px',
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s',
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(245,158,11,0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <Plus size={18} />
            Create
          </button>
        </div>
      )}

      {/* TAB CONTENT */}
      {activeTab === 'content' && (
        <div>
          {inventory.length === 0 && bookProjects.length === 0 && soloProjects.length === 0 ? (
            <EmptyState
              icon={<FileText size={64} />}
              title="No content yet"
              description="Create your first piece of content to get started"
              actionLabel="+ Create Content"
              onAction={() => navigate('/studio')}
            />
          ) : (
            (() => {
              // Filter non-book inventory based on content type filter
              // Note: music and film are coming soon, only book and art available
              // Comics: drafts shown via soloProjects, published shown via inventory
              let filteredInventory = contentFilter === 'all'
                ? inventory
                : contentFilter === 'book'
                  ? [] // Books shown via bookProjects
                  : contentFilter === 'comic'
                    ? inventory.filter(i => i.content_type === 'comic') // Published comics from inventory
                    : inventory.filter(i => i.content_type === contentFilter);

              // Apply status filter to inventory
              if (statusFilter === 'published') {
                filteredInventory = filteredInventory.filter(i => i.inventory_status === 'minted');
              } else if (statusFilter === 'draft') {
                filteredInventory = filteredInventory.filter(i => i.inventory_status === 'draft');
              } else if (statusFilter === 'unpublished') {
                filteredInventory = filteredInventory.filter(i => i.inventory_status === 'delisted');
              }

              // Filter book projects by content type
              let filteredBooks = contentFilter === 'all' || contentFilter === 'book'
                ? bookProjects
                : [];

              // Apply status filter to books
              if (statusFilter === 'published') {
                filteredBooks = filteredBooks.filter(b => b.published_chapters > 0 || b.is_published);
              } else if (statusFilter === 'draft') {
                filteredBooks = filteredBooks.filter(b => b.published_chapters === 0 && !b.is_published);
              }

              // Filter solo projects by content type
              // NOTE: Only show DRAFT projects from soloProjects.
              // Published/minted content is shown via inventory (Content records) to avoid duplication.
              let filteredSoloProjects = soloProjects.filter(p => p.status === 'draft');

              // Apply content type filter
              if (contentFilter !== 'all') {
                filteredSoloProjects = filteredSoloProjects.filter(p => p.content_type === contentFilter);
              }

              // Apply status filter to solo projects (only drafts remain)
              if (statusFilter === 'published' || statusFilter === 'unpublished') {
                // Published/unpublished content comes from inventory, not soloProjects
                filteredSoloProjects = [];
              }
              // statusFilter === 'draft' already handled above (only drafts included)

              const hasContent = filteredInventory.length > 0 || filteredBooks.length > 0 || filteredSoloProjects.length > 0;

              const filterLabel = statusFilter !== 'all'
                ? `${statusFilter} ${contentFilter}`
                : contentFilter;

              return !hasContent ? (
                <div style={{ textAlign: 'center', padding: '60px 24px', color: 'var(--subtle)' }}>
                  <FileText size={48} style={{ marginBottom: 16, opacity: 0.5 }} />
                  <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-muted)' }}>
                    No {filterLabel} content yet
                  </div>
                </div>
              ) : (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                  gap: 24,
                }}>
                  {/* Render book projects as grouped cards */}
                  {filteredBooks.map((book) => (
                    <BookProjectCard
                      key={`book-${book.id}`}
                      book={book}
                      expanded={expandedBooks.has(book.id)}
                      onToggleExpand={() => {
                        setExpandedBooks(prev => {
                          const newSet = new Set(prev);
                          if (newSet.has(book.id)) {
                            newSet.delete(book.id);
                          } else {
                            newSet.add(book.id);
                          }
                          return newSet;
                        });
                      }}
                      onViewChapter={(contentId) => openReader(contentId)}
                      onEditBook={() => navigate(`/studio?editBookProject=${book.id}`)}
                    />
                  ))}
                  {/* Render solo projects (all content types) */}
                  {filteredSoloProjects.map((project) => {
                    // Format date safely
                    const dateStr = project.updated_at || project.created_at;
                    let formattedDate = 'Recently';
                    if (dateStr) {
                      const date = new Date(dateStr);
                      if (!isNaN(date.getTime())) {
                        formattedDate = date.toLocaleDateString();
                      }
                    }

                    // Get the appropriate icon for the content type
                    const getIcon = () => {
                      switch (project.content_type) {
                        case 'comic': return <Palette size={48} />;
                        case 'book': return <BookOpen size={48} />;
                        case 'art': return <Palette size={48} />;
                        default: return <FileText size={48} />;
                      }
                    };

                    // Get the edit URL - solo projects are CollaborativeProject records
                    // so they should navigate to the collaboration project page
                    const getEditUrl = () => {
                      return `/studio/${project.id}`;
                    };

                    return (
                      <div
                        key={`solo-${project.id}`}
                        style={{
                          background: 'var(--bg-card)',
                          borderRadius: 12,
                          overflow: 'hidden',
                          border: '1px solid var(--panel-border-strong)',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                        }}
                        onClick={() => navigate(getEditUrl())}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = '#f59e0b';
                          e.currentTarget.style.transform = 'translateY(-2px)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = 'var(--panel-border-strong)';
                          e.currentTarget.style.transform = 'translateY(0)';
                        }}
                      >
                        {/* Thumbnail - show cover image if available */}
                        <div style={{
                          height: 160,
                          background: 'var(--bg-card)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'var(--subtle)',
                          overflow: 'hidden',
                        }}>
                          {project.cover_image ? (
                            <img
                              src={project.cover_image}
                              alt={project.title}
                              style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                              }}
                            />
                          ) : (
                            getIcon()
                          )}
                        </div>
                        <div style={{ padding: 16 }}>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            marginBottom: 8,
                          }}>
                            <span style={{
                              background: project.status === 'draft' ? 'var(--subtle)' : '#22c55e',
                              color: '#fff',
                              fontSize: 10,
                              fontWeight: 700,
                              padding: '2px 6px',
                              borderRadius: 4,
                              textTransform: 'uppercase',
                            }}>
                              {project.status}
                            </span>
                            <span style={{
                              background: '#f59e0b20',
                              color: '#f59e0b',
                              fontSize: 10,
                              fontWeight: 700,
                              padding: '2px 6px',
                              borderRadius: 4,
                              textTransform: 'uppercase',
                            }}>
                              {project.content_type}
                            </span>
                          </div>
                          <h4 style={{
                            margin: 0,
                            fontSize: 16,
                            fontWeight: 700,
                            color: '#e2e8f0',
                            marginBottom: 4,
                          }}>
                            {project.title}
                          </h4>
                          <div style={{ fontSize: 12, color: 'var(--subtle)' }}>
                            Updated {formattedDate}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {/* Render non-book content */}
                  {filteredInventory.map((item) => (
                    <ContentCard
                      key={item.id}
                      item={item}
                      onView={() => openReader(item.id)}
                      onEdit={() => {
                        // Comics with a source project should go to the collaborative project editor
                        if (item.content_type === 'comic' && item.source_project_id) {
                          navigate(`/studio/${item.source_project_id}?tab=content`);
                        } else {
                          navigate(`/studio?editContent=${item.id}`);
                        }
                      }}
                      onManage={() => {
                        setManageItem(item);
                        setShowManageModal(true);
                      }}
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
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
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
                        background: 'var(--bg-card)',
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
                          <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>{project.title}</div>
                          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                            {project.total_collaborators} collaborator{project.total_collaborators !== 1 ? 's' : ''} · {invite.revenue_percentage}% revenue
                          </div>
                        </div>
                        {/* Action buttons */}
                        {(() => {
                          // Check if there's a pending counter-proposal
                          const hasCounterProposal = invite.proposed_percentage !== null &&
                            invite.proposed_percentage !== undefined &&
                            Math.abs(Number(invite.proposed_percentage) - Number(invite.revenue_percentage)) > 0.001;

                          if (hasCounterProposal) {
                            // Pending counter-proposal state (compact)
                            return (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{
                                  background: '#f59e0b20',
                                  color: '#f59e0b',
                                  padding: '6px 12px',
                                  borderRadius: 6,
                                  fontSize: 12,
                                  fontWeight: 600,
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 6,
                                }}>
                                  <Clock size={14} />
                                  Pending ({invite.proposed_percentage}%)
                                </div>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeclineInvite(project.id, e);
                                  }}
                                  disabled={isProcessing}
                                  style={{
                                    background: 'transparent',
                                    color: '#ef4444',
                                    border: '1px solid #ef4444',
                                    padding: '6px 10px',
                                    borderRadius: 6,
                                    fontWeight: 600,
                                    cursor: isProcessing ? 'not-allowed' : 'pointer',
                                    fontSize: 12,
                                  }}
                                  title="Withdraw counter-proposal and decline"
                                >
                                  Withdraw
                                </button>
                              </div>
                            );
                          }

                          // Normal action buttons
                          const isWarrantyAcknowledgedCompact = warrantyAcknowledgedInvites.has(project.id);
                          return (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              {/* Warranty checkbox - compact version */}
                              <div
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setWarrantyAcknowledgedInvites(prev => {
                                    const newSet = new Set(prev);
                                    if (newSet.has(project.id)) {
                                      newSet.delete(project.id);
                                    } else {
                                      newSet.add(project.id);
                                    }
                                    return newSet;
                                  });
                                }}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  padding: '6px 10px',
                                  background: isWarrantyAcknowledgedCompact ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.05)',
                                  border: `1px solid ${isWarrantyAcknowledgedCompact ? 'rgba(16, 185, 129, 0.3)' : 'rgba(100, 116, 139, 0.3)'}`,
                                  borderRadius: 6,
                                  cursor: 'pointer',
                                  transition: 'all 0.2s',
                                }}
                                title="I acknowledge my contributions will be original work"
                              >
                                {isWarrantyAcknowledgedCompact ? (
                                  <CheckSquare size={14} style={{ color: '#10b981' }} />
                                ) : (
                                  <Square size={14} style={{ color: 'var(--subtle)' }} />
                                )}
                                <Shield size={12} style={{ color: isWarrantyAcknowledgedCompact ? '#10b981' : '#f59e0b' }} />
                              </div>
                              <button
                                onClick={(e) => handleAcceptInvite(project.id, e)}
                                disabled={isProcessing || !isWarrantyAcknowledgedCompact}
                                style={{
                                  background: isWarrantyAcknowledgedCompact ? '#10b981' : 'var(--subtle)',
                                  color: '#fff',
                                  border: 'none',
                                  padding: '8px 12px',
                                  borderRadius: 6,
                                  fontWeight: 600,
                                  cursor: (isProcessing || !isWarrantyAcknowledgedCompact) ? 'not-allowed' : 'pointer',
                                  opacity: isWarrantyAcknowledgedCompact ? 1 : 0.6,
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  fontSize: 13,
                                  transition: 'all 0.2s',
                                }}
                                title={!isWarrantyAcknowledgedCompact ? 'Check the warranty box first' : 'Accept invitation'}
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
                          );
                        })()}
                      </div>
                    </div>
                  );
                })}

                {/* Active Collaborations */}
                {collaborations.map((project: any) => (
                  <div
                    key={`collab-${project.id}`}
                    style={{
                      background: 'var(--bg-card)',
                      border: '1px solid var(--panel-border-strong)',
                      borderRadius: 12,
                      padding: 16,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                    onClick={() => navigate(`/studio/${project.id}`)}
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
                        color: project.status === 'active' ? '#10b981' : 'var(--text-muted)',
                        flexShrink: 0,
                      }}>
                        {getContentTypeIcon(project.content_type, 20)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>{project.title}</div>
                        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                          {project.total_collaborators} collaborator{project.total_collaborators !== 1 ? 's' : ''} · {project.status}
                        </div>
                      </div>
                      <div style={{
                        background: project.status === 'active' ? '#10b98120' : '#64748b20',
                        color: project.status === 'active' ? '#10b981' : 'var(--text-muted)',
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
                  border: '1px solid var(--panel-border-strong)',
                  color: 'var(--text-muted)',
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
              <h3 style={{ color: 'var(--text)', fontSize: 18, fontWeight: 700, margin: 0 }}>External Portfolio</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: '4px 0 0' }}>
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
                  background: 'var(--bg-card)',
                  border: '1px solid var(--panel-border-strong)',
                  borderRadius: 16,
                  overflow: 'hidden',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.25)';
                  e.currentTarget.style.borderColor = 'var(--panel-border-strong)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                  e.currentTarget.style.borderColor = 'var(--panel-border-strong)';
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
                      color: 'var(--text)',
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
                        color: 'var(--text-muted)',
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
                          border: '1px solid var(--panel-border-strong)',
                          color: 'var(--text-muted)',
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
            background: 'var(--bg-card)',
            border: '1px solid var(--panel-border-strong)',
            borderRadius: 16,
            padding: 24,
            marginBottom: 24,
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 20,
            }}>
              <h3 style={{
                fontSize: 18,
                fontWeight: 700,
                color: 'var(--text)',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}>
                <DollarSign size={20} style={{ color: '#10b981' }} />
                Sales Overview
              </h3>
              <Link
                to="/payout-settings"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 16px',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--panel-border-strong)',
                  borderRadius: 8,
                  color: 'var(--text-muted)',
                  fontSize: 14,
                  textDecoration: 'none',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--dropdown-hover)';
                  e.currentTarget.style.color = 'var(--text)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--dropdown-hover)';
                  e.currentTarget.style.color = 'var(--text-muted)';
                }}
              >
                <Settings size={16} />
                Payout Settings
              </Link>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 16,
            }}>
              <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 20 }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Total Earnings
                </div>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#10b981' }}>
                  ${salesAnalytics?.summary.total_earnings_usdc.toFixed(2) || dash.sales.toFixed(2)}
                </div>
                <div style={{ fontSize: 11, color: 'var(--subtle)', marginTop: 4 }}>USDC</div>
              </div>

              <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 20 }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Solo Content
                </div>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#60a5fa' }}>
                  ${salesAnalytics?.summary.solo_earnings.toFixed(2) || '0.00'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--subtle)', marginTop: 4 }}>{salesAnalytics?.summary.content_count || 0} items</div>
              </div>

              <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 20 }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Collaborations
                </div>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#f59e0b' }}>
                  ${salesAnalytics?.summary.collaboration_earnings.toFixed(2) || '0.00'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--subtle)', marginTop: 4 }}>{salesAnalytics?.summary.collaboration_count || 0} projects</div>
              </div>

              <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 20 }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Total Sales
                </div>
                <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text)' }}>
                  {salesAnalytics?.summary.total_sales || 0}
                </div>
                <div style={{ fontSize: 11, color: 'var(--subtle)', marginTop: 4 }}>transactions</div>
              </div>
            </div>
          </div>

          {/* Bridge Onboarding Banner */}
          <BridgeOnboardingBanner className="mb-6" />

          {/* Content Performance - Expandable Cards */}
          {salesAnalytics && (salesAnalytics.content_sales.length > 0 || salesAnalytics.collaboration_sales.length > 0) && (
            <div style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--panel-border-strong)',
              borderRadius: 16,
              padding: 24,
              marginBottom: 24,
            }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <TrendingUp size={18} style={{ color: '#60a5fa' }} />
                Earnings Breakdown
              </h3>
              <p style={{ fontSize: 12, color: 'var(--subtle)', marginBottom: 16 }}>
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
                            background: 'var(--bg-card)',
                            borderRadius: isExpanded ? '8px 8px 0 0' : 8,
                            cursor: 'pointer',
                            transition: 'background 0.2s',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'var(--dropdown-hover)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg-card)')}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            {getContentTypeIcon(item.content_type, 18)}
                            <div>
                              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{item.title}</div>
                              <div style={{ fontSize: 12, color: 'var(--subtle)' }}>
                                {item.sales_count} sale{item.sales_count !== 1 ? 's' : ''} • {item.role} • ${item.price.toFixed(2)} price
                              </div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: 16, fontWeight: 700, color: '#10b981' }}>${item.total_earnings.toFixed(2)}</div>
                              <div style={{ fontSize: 11, color: 'var(--subtle)' }}>{item.percentage}% split</div>
                            </div>
                            {isExpanded ? <ChevronUp size={18} color="var(--subtle)" /> : <ChevronDown size={18} color="var(--subtle)" />}
                          </div>
                        </div>
                        {/* Expanded transaction list */}
                        {isExpanded && item.transactions && item.transactions.length > 0 && (
                          <div style={{
                            background: 'var(--bg-card)',
                            border: '1px solid var(--panel-border-strong)',
                            borderTop: 'none',
                            borderRadius: '0 0 8px 8px',
                            padding: '12px 16px',
                          }}>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                              Transaction History
                            </div>
                            {item.transactions.map((tx, idx) => (
                              <div key={tx.id || idx} style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '8px 0',
                                borderBottom: idx < item.transactions.length - 1 ? '1px solid var(--panel-border-strong)' : 'none',
                              }}>
                                <div>
                                  <div style={{ fontSize: 13, color: 'var(--text)' }}>
                                    Purchased by <span style={{ color: '#60a5fa' }}>@{tx.buyer}</span>
                                  </div>
                                  <div style={{ fontSize: 11, color: 'var(--subtle)', display: 'flex', alignItems: 'center', gap: 4 }}>
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
                            background: 'var(--bg-card)',
                            borderRadius: isExpanded ? '8px 8px 0 0' : 8,
                            borderLeft: '3px solid #f59e0b',
                            cursor: 'pointer',
                            transition: 'background 0.2s',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'var(--dropdown-hover)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg-card)')}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            {getContentTypeIcon(item.content_type, 18)}
                            <div>
                              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{item.title}</div>
                              <div style={{ fontSize: 12, color: 'var(--subtle)' }}>
                                {item.role} • {item.percentage}% split • {item.sales_count} sale{item.sales_count !== 1 ? 's' : ''}
                              </div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: 16, fontWeight: 700, color: '#f59e0b' }}>${item.total_earnings.toFixed(2)}</div>
                              <div style={{ fontSize: 11, color: 'var(--subtle)' }}>your share</div>
                            </div>
                            {isExpanded ? <ChevronUp size={18} color="var(--subtle)" /> : <ChevronDown size={18} color="var(--subtle)" />}
                          </div>
                        </div>
                        {/* Expanded transaction list */}
                        {isExpanded && item.transactions && item.transactions.length > 0 && (
                          <div style={{
                            background: 'var(--bg-card)',
                            border: '1px solid var(--panel-border-strong)',
                            borderTop: 'none',
                            borderRadius: '0 0 8px 8px',
                            padding: '12px 16px',
                          }}>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                              Transaction History
                            </div>
                            {item.transactions.map((tx, idx) => (
                              <div key={tx.id || idx} style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '8px 0',
                                borderBottom: idx < item.transactions.length - 1 ? '1px solid var(--panel-border-strong)' : 'none',
                              }}>
                                <div>
                                  <div style={{ fontSize: 13, color: 'var(--text)' }}>
                                    Purchased by <span style={{ color: '#60a5fa' }}>@{tx.buyer}</span>
                                  </div>
                                  <div style={{ fontSize: 11, color: 'var(--subtle)', display: 'flex', alignItems: 'center', gap: 4 }}>
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
              background: 'var(--bg-card)',
              border: '1px solid var(--panel-border-strong)',
              borderRadius: 16,
              padding: 24,
            }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
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
                    background: 'var(--bg-card)',
                    borderRadius: 8,
                  }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{tx.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--subtle)' }}>
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
              background: 'var(--bg-card)',
              border: '1px solid var(--panel-border-strong)',
              borderRadius: 16,
            }}>
              <BarChart3 size={48} style={{ color: '#475569', marginBottom: 16 }} />
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>
                No sales yet
              </div>
              <div style={{ fontSize: 14, color: 'var(--subtle)' }}>
                Once you start making sales, you'll see detailed breakdowns here
              </div>
            </div>
          )}

          {/* Loading State */}
          {analyticsLoading && (
            <div style={{
              textAlign: 'center',
              padding: '40px 24px',
              background: 'var(--bg-card)',
              border: '1px solid var(--panel-border-strong)',
              borderRadius: 16,
            }}>
              <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>Loading analytics...</div>
            </div>
          )}
        </div>
      )}

      {/* Following Tab */}
      {activeTab === 'following' && (
        <div>
          {followingLoading ? (
            <div style={{
              textAlign: 'center',
              padding: '40px 24px',
              background: 'var(--bg-card)',
              border: '1px solid var(--panel-border-strong)',
              borderRadius: 16,
            }}>
              <Loader2 size={32} style={{ color: '#f59e0b', animation: 'spin 1s linear infinite' }} />
              <div style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 12 }}>Loading following...</div>
            </div>
          ) : followingList.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '40px 24px',
              background: 'var(--bg-card)',
              border: '1px solid var(--panel-border-strong)',
              borderRadius: 16,
            }}>
              <UserCheck size={48} style={{ color: '#475569', marginBottom: 16 }} />
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>
                Not following anyone yet
              </div>
              <div style={{ fontSize: 14, color: 'var(--subtle)' }}>
                Explore creators and follow them to see their latest work in your feed
              </div>
              <Link
                to="/collaborators"
                style={{
                  display: 'inline-block',
                  marginTop: 16,
                  padding: '10px 20px',
                  background: '#f59e0b',
                  color: '#111',
                  borderRadius: 8,
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                Discover Creators
              </Link>
            </div>
          ) : (
            <div style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--panel-border-strong)',
              borderRadius: 16,
              overflow: 'hidden',
            }}>
              <div style={{
                padding: '16px 20px',
                borderBottom: '1px solid var(--panel-border-strong)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
                  Following ({followingList.length})
                </h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {followingList.map((user, index) => (
                  <div
                    key={user.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '16px 20px',
                      borderBottom: index < followingList.length - 1 ? '1px solid var(--panel-border-strong)' : 'none',
                      transition: 'background 0.2s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--dropdown-hover)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <Link
                      to={`/profile/${user.username}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        textDecoration: 'none',
                        flex: 1,
                      }}
                    >
                      <div style={{
                        width: 48,
                        height: 48,
                        borderRadius: '50%',
                        background: user.avatar ? `url(${user.avatar}) center/cover` : '#374151',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 18,
                        fontWeight: 700,
                        color: '#f59e0b',
                        flexShrink: 0,
                      }}>
                        {!user.avatar && (user.username || '?').slice(0, 1).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>
                          {user.display_name || user.username}
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--subtle)' }}>
                          @{user.username}
                        </div>
                        {user.bio && (
                          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, maxWidth: 400 }}>
                            {user.bio.length > 80 ? user.bio.slice(0, 80) + '...' : user.bio}
                          </div>
                        )}
                      </div>
                    </Link>
                    <button
                      onClick={() => handleUnfollow(user.username, user.id)}
                      disabled={unfollowingUsers.has(user.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '8px 16px',
                        background: 'transparent',
                        border: '1px solid var(--panel-border-strong)',
                        borderRadius: 8,
                        color: 'var(--text-muted)',
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: unfollowingUsers.has(user.id) ? 'not-allowed' : 'pointer',
                        opacity: unfollowingUsers.has(user.id) ? 0.5 : 1,
                        transition: 'all 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        if (!unfollowingUsers.has(user.id)) {
                          e.currentTarget.style.borderColor = '#ef4444';
                          e.currentTarget.style.color = '#ef4444';
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'var(--panel-border-strong)';
                        e.currentTarget.style.color = 'var(--text-muted)';
                      }}
                    >
                      {unfollowingUsers.has(user.id) ? (
                        <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                      ) : (
                        <UserCheck size={14} />
                      )}
                      {unfollowingUsers.has(user.id) ? 'Unfollowing...' : 'Following'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
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

      {/* Art Manage Modal */}
      {showManageModal && manageItem && (
        <ArtManageModal
          isOpen={showManageModal}
          onClose={() => {
            setShowManageModal(false);
            setManageItem(null);
          }}
          item={manageItem}
          onUnpublished={() => {
            // Refresh inventory after unpublishing
            fetch(`${API_URL}/api/content/?mine=1`, { credentials: 'include' })
              .then(res => res.json())
              .then(items => {
                setInventory(items.filter((item: any) => item.content_type !== 'book' || item.is_collaborative));
              })
              .catch(() => {});
          }}
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
        color: active ? '#f59e0b' : 'var(--text-muted)',
        padding: '12px 16px',
        fontSize: 14,
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'all 0.2s',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        whiteSpace: 'nowrap',
        flexShrink: 0,
        minHeight: 44,
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.color = '#cbd5e1';
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.color = 'var(--text-muted)';
        }
      }}
    >
      {icon}
      <span>{label}</span>
      {count !== undefined && count > 0 && (
        <span style={{
          background: active ? '#f59e0b' : 'var(--dropdown-hover)',
          color: active ? '#000' : 'var(--text-muted)',
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
        background: active ? '#f59e0b' : 'var(--bg-card)',
        border: active ? 'none' : '1px solid var(--panel-border-strong)',
        color: active ? '#000' : 'var(--text-muted)',
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
          e.currentTarget.style.borderColor = 'var(--panel-border-strong)';
          e.currentTarget.style.color = 'var(--text-muted)';
        }
      }}
    >
      {label}
      <span style={{
        background: active ? 'rgba(0,0,0,0.2)' : 'var(--dropdown-hover)',
        padding: '1px 6px',
        borderRadius: 8,
        fontSize: 11,
      }}>
        {count}
      </span>
    </button>
  );
}

// Book Project Card Component - displays a book with its chapters grouped
function BookProjectCard({
  book,
  expanded,
  onToggleExpand,
  onViewChapter,
  onEditBook,
}: {
  book: BookProject;
  expanded: boolean;
  onToggleExpand: () => void;
  onViewChapter: (contentId: number) => void;
  onEditBook: () => void;
}) {
  const hasPublishedChapters = book.published_chapters > 0 || book.is_published;
  const firstPublishedChapter = book.chapters.find(ch => ch.is_published && ch.content_id);

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--panel-border-strong)',
      borderRadius: 16,
      overflow: 'hidden',
      transition: 'all 0.2s',
      position: 'relative',
    }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-4px)';
        e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.25)';
        e.currentTarget.style.borderColor = 'var(--panel-border-strong)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'none';
        e.currentTarget.style.borderColor = 'var(--panel-border-strong)';
      }}
    >
      {/* Cover Image */}
      <div
        onClick={onToggleExpand}
        style={{
          width: '100%',
          paddingTop: '56.25%', // 16:9 ratio
          background: book.cover_image_url ? `url(${book.cover_image_url})` : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          position: 'relative',
          cursor: 'pointer',
          opacity: hasPublishedChapters ? 1 : 0.7,
        }}
      >
        {!book.cover_image_url && (
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            color: 'rgba(255,255,255,0.3)',
          }}>
            <BookOpen size={48} />
          </div>
        )}
        {/* Status badge */}
        <div style={{
          position: 'absolute',
          top: 12,
          right: 12,
          background: hasPublishedChapters ? 'rgba(0,0,0,0.75)' : 'rgba(100, 116, 139, 0.9)',
          color: 'var(--text)',
          padding: '4px 10px',
          borderRadius: hasPublishedChapters ? 12 : 6,
          fontSize: hasPublishedChapters ? 12 : 11,
          fontWeight: 600,
          backdropFilter: 'blur(4px)',
          textTransform: hasPublishedChapters ? 'none' : 'uppercase',
          letterSpacing: hasPublishedChapters ? 'normal' : '0.5px',
        }}>
          {hasPublishedChapters
            ? `${book.published_chapters} chapter${book.published_chapters !== 1 ? 's' : ''}`
            : 'Draft'
          }
        </div>
      </div>

      {/* Card Content */}
      <div style={{ padding: 16 }}>
        <div style={{
          fontSize: 16,
          fontWeight: 600,
          color: 'var(--text)',
          marginBottom: 8,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          lineHeight: 1.4,
        }}>
          {book.title}
        </div>

        <div style={{
          fontSize: 13,
          color: 'var(--text-muted)',
          marginBottom: 12,
        }}>
          {hasPublishedChapters
            ? `book • ${book.published_chapters} of ${book.total_chapters} chapter${book.total_chapters !== 1 ? 's' : ''} published`
            : `book • ${book.total_chapters} chapter${book.total_chapters !== 1 ? 's' : ''} (unpublished)`
          }
        </div>

        {hasPublishedChapters && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            fontSize: 13,
            color: 'var(--text-muted)',
            marginBottom: 12,
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Eye size={14} /> {book.total_views}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <DollarSign size={14} /> ${book.total_price.toFixed(2)}
            </span>
          </div>
        )}

        {/* Expandable chapter list */}
        {book.total_chapters > 0 && (
          <>
            <button
              onClick={onToggleExpand}
              style={{
                width: '100%',
                background: 'var(--bg-card)',
                border: 'none',
                borderRadius: 8,
                padding: '8px 12px',
                color: 'var(--text-muted)',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: expanded ? 8 : 12,
              }}
            >
              <span>Chapters</span>
              {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {expanded && (
              <div style={{
                background: 'var(--bg-input)',
                borderRadius: 8,
                padding: 8,
                marginBottom: 12,
                maxHeight: 200,
                overflowY: 'auto',
              }}>
                {book.chapters.map((chapter, index) => (
                  <div
                    key={chapter.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 10px',
                      borderRadius: 6,
                      background: index % 2 === 0 ? 'transparent' : 'var(--nav-hover-bg)',
                      opacity: chapter.is_published ? 1 : 0.6,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 13,
                        color: 'var(--text)',
                        fontWeight: 500,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}>
                        Ch {chapter.order + 1}: {chapter.title}
                        {!chapter.is_published && (
                          <span style={{
                            fontSize: 9,
                            background: 'rgba(100, 116, 139, 0.5)',
                            color: 'var(--text-muted)',
                            padding: '2px 5px',
                            borderRadius: 3,
                            textTransform: 'uppercase',
                            letterSpacing: '0.3px',
                          }}>
                            Draft
                          </span>
                        )}
                      </div>
                      {chapter.is_published && (
                        <div style={{ fontSize: 11, color: 'var(--subtle)' }}>
                          ${chapter.price_usd.toFixed(2)} • {chapter.view_count} views
                        </div>
                      )}
                    </div>
                    {chapter.is_published && chapter.content_id && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onViewChapter(chapter.content_id!);
                        }}
                        style={{
                          background: 'transparent',
                          border: '1px solid var(--panel-border-strong)',
                          borderRadius: 6,
                          padding: '4px 10px',
                          color: 'var(--text-muted)',
                          fontSize: 11,
                          fontWeight: 500,
                          cursor: 'pointer',
                          marginLeft: 8,
                          flexShrink: 0,
                        }}
                      >
                        View
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={onEditBook}
            style={{
              flex: 1,
              background: 'transparent',
              border: '1px solid var(--panel-border-strong)',
              borderRadius: 10,
              padding: '10px 16px',
              color: 'var(--text-muted)',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            Edit
          </button>
          {hasPublishedChapters && firstPublishedChapter && (
            <button
              onClick={() => onViewChapter(firstPublishedChapter.content_id!)}
              style={{
                flex: 1,
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                border: 'none',
                borderRadius: 10,
                padding: '10px 16px',
                color: '#000',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              View
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Content Card Component
function ContentCard({ item, onView, onEdit, onManage }: { item: any; onView: () => void; onEdit: () => void; onManage?: () => void }) {
  const isPublished = item.inventory_status === 'minted';
  const isUnpublished = item.inventory_status === 'delisted';
  const isDraft = item.inventory_status === 'draft';
  // Published non-book/non-comic content (art, music, film) should show Manage instead of Edit
  // Comics and books need Edit button so creators can add new issues/chapters
  const isPublishedNonBook = isPublished && item.content_type !== 'book' && item.content_type !== 'comic';

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--panel-border-strong)',
      borderRadius: 16,
      overflow: 'hidden',
      cursor: 'pointer',
      transition: 'all 0.2s',
      position: 'relative',
    }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-4px)';
        e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.25)';
        e.currentTarget.style.borderColor = 'var(--panel-border-strong)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'none';
        e.currentTarget.style.borderColor = 'var(--panel-border-strong)';
      }}
    >
      {/* Status Badge */}
      {isDraft && (
        <div style={{
          position: 'absolute',
          top: 12,
          right: 12,
          background: 'rgba(100, 116, 139, 0.9)',
          color: 'var(--text)',
          padding: '4px 10px',
          borderRadius: 6,
          fontSize: 11,
          fontWeight: 600,
          zIndex: 1,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}>
          Draft
        </div>
      )}
      {isUnpublished && (
        <div style={{
          position: 'absolute',
          top: 12,
          right: 12,
          background: 'rgba(245, 158, 11, 0.9)',
          color: '#000',
          padding: '4px 10px',
          borderRadius: 6,
          fontSize: 11,
          fontWeight: 600,
          zIndex: 1,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}>
          Unpublished
        </div>
      )}

      {/* Cover Image */}
      <div
        onClick={isPublished || isUnpublished ? onView : onEdit}
        style={{
          width: '100%',
          paddingTop: '56.25%', // 16:9 ratio
          background: item.teaser_link ? `url(${item.teaser_link})` : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          position: 'relative',
          opacity: isDraft ? 0.7 : 1,
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
          color: 'var(--text)',
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
          color: 'var(--text-muted)',
          marginBottom: 12,
        }}>
          {item.content_type} {item.genre && `• ${item.genre}`}
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          fontSize: 13,
          color: 'var(--text-muted)',
          marginBottom: 16,
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Eye size={14} /> {item.view_count || 0}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <DollarSign size={14} /> ${item.price_usd || 0}
          </span>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: 8 }}>
          {isPublishedNonBook ? (
            // Published art/music/film: Show Manage button instead of Edit
            <button
              onClick={(e) => {
                e.stopPropagation();
                onManage?.();
              }}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                background: 'transparent',
                border: '1px solid var(--panel-border-strong)',
                color: 'var(--text-muted)',
                padding: '8px 16px',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--dropdown-hover)';
                e.currentTarget.style.borderColor = '#475569';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.borderColor = 'var(--panel-border-strong)';
              }}
            >
              <Settings size={14} />
              Manage
            </button>
          ) : (
            // Drafts or published books/comics: Show Edit button
            <button
              onClick={onEdit}
              style={{
                flex: 1,
                background: 'transparent',
                border: '1px solid var(--panel-border-strong)',
                color: 'var(--text-muted)',
                padding: '8px 16px',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--dropdown-hover)';
                e.currentTarget.style.borderColor = '#475569';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.borderColor = 'var(--panel-border-strong)';
              }}
            >
              Edit
            </button>
          )}
          {(isPublished || isUnpublished) && (
            <button
              onClick={onView}
              style={{
                flex: 1,
                background: isUnpublished
                  ? 'linear-gradient(135deg, #78716c 0%, #57534e 100%)'
                  : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
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
          )}
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
        color: 'var(--text)',
        marginBottom: 12,
      }}>
        {title}
      </div>
      <div style={{
        fontSize: 15,
        color: 'var(--text-muted)',
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
        background: 'var(--bg-card)',
        border: '1px solid var(--panel-border-strong)',
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
          color: 'var(--text)',
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
              color: 'var(--text-muted)',
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
              color: 'var(--text-muted)',
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
                background: 'var(--bg-card)',
                border: '1px solid var(--panel-border-strong)',
                borderRadius: 8,
                padding: '10px 14px',
                color: 'var(--text)',
                fontSize: 14,
              }}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{
              display: 'block',
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--text-muted)',
              marginBottom: 8,
            }}>
              Project Type
            </label>
            <select
              value={projectType}
              onChange={(e) => setProjectType(e.target.value)}
              style={{
                width: '100%',
                background: 'var(--bg-card)',
                border: '1px solid var(--panel-border-strong)',
                borderRadius: 8,
                padding: '10px 14px',
                color: 'var(--text)',
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
              color: 'var(--text-muted)',
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
                background: 'var(--bg-card)',
                border: '1px solid var(--panel-border-strong)',
                borderRadius: 8,
                padding: '10px 14px',
                color: 'var(--text)',
                fontSize: 14,
              }}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{
              display: 'block',
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--text-muted)',
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
                background: 'var(--bg-card)',
                border: '1px solid var(--panel-border-strong)',
                borderRadius: 8,
                padding: '10px 14px',
                color: 'var(--text)',
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
              color: 'var(--text-muted)',
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
                background: 'var(--bg-card)',
                border: '1px solid var(--panel-border-strong)',
                borderRadius: 8,
                padding: '10px 14px',
                color: 'var(--text)',
                fontSize: 14,
              }}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{
              display: 'block',
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--text-muted)',
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
                background: 'var(--bg-card)',
                border: '1px solid var(--panel-border-strong)',
                borderRadius: 8,
                padding: '10px 14px',
                color: 'var(--text)',
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
                border: '1px solid var(--panel-border-strong)',
                color: 'var(--text-muted)',
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
