import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import {
  MapPin, Briefcase, Award, ExternalLink, Star, Users, DollarSign,
  Book, Music, Film, Palette, Globe, Linkedin, Twitter, Instagram,
  ChevronDown, ChevronUp, Eye, BookOpen
} from 'lucide-react';
import InviteModal from '../components/InviteModal';
import { CreatorReviewsSection } from '../components/social/CreatorReviewsSection';
import { FollowButton } from '../components/social/FollowButton';
import { API_URL } from '../config';
import { useMobile } from '../hooks/useMobile';

// Book chapter interface for grouped display
interface BookChapter {
  id: number;
  title: string;
  order: number;
  content_id: number;
  price_usd: number;
  view_count: number;
}

// Book project interface for grouped display
interface BookProject {
  id: number;
  title: string;
  cover_image_url: string | null;
  published_chapters: number;
  chapters: BookChapter[];
  total_views: number;
  total_price: number;
}

interface PublicProfile {
  profile: {
    id: number;
    username: string;
    display_name: string;
    bio: string;
    avatar: string;
    banner: string;
    location: string;
    status: string;
    status_category: 'green' | 'yellow' | 'red';
    tier: string;
    roles: string[];
    genres: string[];
    skills: string[];
    social_links: Record<string, string>;
  };
  platform_works: Array<{
    id: number;
    title: string;
    content_type: string;
    genre: string;
    price_usd: string;
    cover_image: string | null;
    teaser_link: string;
    nft_contract: string;
    created_at: string;
  }>;
  book_projects: BookProject[];
  external_portfolio: Array<{
    id: number;
    title: string;
    description: string;
    image_url: string | null;
    external_url: string;
    project_type: string;
    role: string;
    created_date: string | null;
  }>;
  collaborations: Array<{
    id: number;
    title: string;
    content_type: string;
    status: string;
    user_role: string;
    collaborator_count: number;
    cover_image: string | null;
    created_at: string;
  }>;
  testimonials: Array<{
    id: number;
    rater_username: string;
    rater_avatar: string;
    project_title: string;
    quality_score: number;
    deadline_score: number;
    communication_score: number;
    would_collab_again: number;
    average_score: number;
    public_feedback: string;
    created_at: string;
  }>;
  stats: {
    works_count: number;
    total_views: number;
    follower_count: number;
    successful_collabs: number;
    average_rating: number | null;
  };
}

// Social platform icons and colors
const socialPlatforms: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  behance: { icon: <Globe size={18} />, color: '#1769ff', label: 'Behance' },
  dribbble: { icon: <Globe size={18} />, color: '#ea4c89', label: 'Dribbble' },
  artstation: { icon: <Palette size={18} />, color: '#13aff0', label: 'ArtStation' },
  soundcloud: { icon: <Music size={18} />, color: '#ff5500', label: 'SoundCloud' },
  spotify: { icon: <Music size={18} />, color: '#1db954', label: 'Spotify' },
  youtube: { icon: <Film size={18} />, color: '#ff0000', label: 'YouTube' },
  deviantart: { icon: <Palette size={18} />, color: '#00e59b', label: 'DeviantArt' },
  linkedin: { icon: <Linkedin size={18} />, color: '#0077b5', label: 'LinkedIn' },
  website: { icon: <Globe size={18} />, color: '#64748b', label: 'Website' },
  twitter: { icon: <Twitter size={18} />, color: '#1da1f2', label: 'Twitter' },
  instagram: { icon: <Instagram size={18} />, color: '#e4405f', label: 'Instagram' },
};

// Content type icons
const contentTypeIcons: Record<string, React.ReactNode> = {
  book: <Book size={16} />,
  music: <Music size={16} />,
  film: <Film size={16} />,
  art: <Palette size={16} />,
  video: <Film size={16} />,
  other: <Globe size={16} />,
};

export default function PublicProfilePage() {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'works' | 'portfolio' | 'collabs' | 'reviews'>('works');
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ username: string } | null>(null);
  const [expandedBooks, setExpandedBooks] = useState<Set<number>>(new Set());
  // Track follower count separately so it updates when follow/unfollow happens
  const [followerCount, setFollowerCount] = useState<number>(0);
  const { isMobile, isPhone } = useMobile();

  useEffect(() => {
    if (!username) return;

    setLoading(true);
    setError(null);

    // Fetch both the public profile and current user info
    Promise.all([
      fetch(`${API_URL}/api/users/${username}/public/`, { credentials: 'include' })
        .then(r => {
          if (!r.ok) throw new Error('User not found');
          return r.json();
        }),
      fetch(`${API_URL}/api/auth/status/`, { credentials: 'include' })
        .then(r => r.ok ? r.json() : null)
    ])
      .then(([profileData, userData]) => {
        setProfile(profileData);
        setCurrentUser(userData);
        // Initialize follower count from profile stats
        if (profileData?.stats?.follower_count !== undefined) {
          setFollowerCount(profileData.stats.follower_count);
        }
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [username]);

  // Generate gradient background based on username
  const getGradient = (name: string) => {
    const gradients = [
      'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
      'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
      'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
      'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
      'linear-gradient(135deg, #30cfd0 0%, #330867 100%)',
    ];
    const index = name.charCodeAt(0) % gradients.length;
    return gradients[index];
  };

  if (loading) {
    return (
      <div className="page" style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 20px', textAlign: 'center' }}>
        <div style={{ color: '#94a3b8', fontSize: 16 }}>Loading profile...</div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="page" style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 20px', textAlign: 'center' }}>
        <div style={{ color: '#ef4444', fontSize: 18, marginBottom: 16 }}>
          {error || 'Profile not found'}
        </div>
        <button
          onClick={() => navigate('/collaborators')}
          style={{
            background: '#f59e0b',
            color: '#111',
            border: 'none',
            padding: '10px 20px',
            borderRadius: 8,
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          Back to Collaborators
        </button>
      </div>
    );
  }

  const { profile: p, platform_works, book_projects, external_portfolio, collaborations, testimonials, stats } = profile;
  const statusColors = {
    green: { bg: '#10b981', text: '#fff' },
    yellow: { bg: '#f59e0b', text: '#000' },
    red: { bg: '#ef4444', text: '#fff' },
  };
  const statusColor = statusColors[p.status_category] || statusColors.green;

  const seoTitle = `${p.display_name || p.username} (@${p.username}) | renaissBlock`;
  const seoDesc = p.bio
    ? p.bio.slice(0, 155) + (p.bio.length > 155 ? '...' : '')
    : `${p.display_name || p.username} is a creator on renaissBlock.${p.roles?.length ? ' ' + p.roles.join(', ') + '.' : ''}`;
  const seoImage = p.avatar || 'https://renaissblock.com/logo512.png';
  const seoUrl = `https://renaissblock.com/profile/${p.username}`;

  return (
    <div className="page" style={{ maxWidth: 1200, margin: '0 auto', padding: '0 20px 40px' }}>
      <Helmet>
        <title>{seoTitle}</title>
        <meta name="description" content={seoDesc} />
        <link rel="canonical" href={seoUrl} />
        <meta property="og:title" content={seoTitle} />
        <meta property="og:description" content={seoDesc} />
        <meta property="og:type" content="profile" />
        <meta property="og:url" content={seoUrl} />
        <meta property="og:image" content={seoImage} />
        <meta property="og:site_name" content="renaissBlock" />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content={seoTitle} />
        <meta name="twitter:description" content={seoDesc} />
        <meta name="twitter:image" content={seoImage} />
      </Helmet>
      {/* Hero Section */}
      <div style={{
        background: '#1e293b',
        borderRadius: 16,
        overflow: 'hidden',
        marginBottom: 24,
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
      }}>
        {/* Banner */}
        <div style={{
          height: 200,
          background: p.banner ? `url(${p.banner}) center/cover` : getGradient(p.username),
          position: 'relative'
        }}>
          {/* Status Badge */}
          <div style={{
            position: 'absolute',
            top: 16,
            right: 16,
            background: statusColor.bg,
            color: statusColor.text,
            fontSize: 11,
            fontWeight: 700,
            padding: '6px 14px',
            borderRadius: 16,
            textTransform: 'uppercase',
            letterSpacing: 0.8
          }}>
            {p.status_category} - {p.status}
          </div>
        </div>

        {/* Profile Info */}
        <div style={{ padding: isPhone ? '0 16px 24px' : '0 32px 32px', position: 'relative' }}>
          {/* Avatar */}
          <div style={{
            width: isPhone ? 100 : 140,
            height: isPhone ? 100 : 140,
            borderRadius: '50%',
            background: p.avatar ? `url(${p.avatar}) center/cover` : '#374151',
            border: isPhone ? '4px solid var(--bg-card)' : '6px solid var(--bg-card)',
            marginTop: isPhone ? -50 : -70,
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: isPhone ? 36 : 48,
            fontWeight: 700,
            color: '#f59e0b',
            boxShadow: '0 4px 6px rgba(0,0,0,0.2)'
          }}>
            {!p.avatar && (p.username || '?').slice(0, 1).toUpperCase()}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: isPhone ? 16 : 24 }}>
            <div style={{ flex: 1, minWidth: isPhone ? 0 : 300 }}>
              {/* Name & Username */}
              <h1 style={{ color: 'var(--text)', fontWeight: 700, fontSize: isPhone ? 22 : 28, margin: '0 0 4px' }}>
                {p.display_name || `@${p.username}`}
              </h1>
              <div style={{ color: 'var(--text-muted)', fontSize: 16, marginBottom: 12 }}>
                @{p.username}
              </div>

              {/* Location */}
              {p.location && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', marginBottom: 16 }}>
                  <MapPin size={16} />
                  <span>{p.location}</span>
                </div>
              )}

              {/* Bio */}
              {p.bio && (
                <p style={{ color: 'var(--text-muted)', fontSize: 15, lineHeight: 1.6, margin: '0 0 16px', maxWidth: 600 }}>
                  {p.bio}
                </p>
              )}

              {/* Roles, Genres, Skills */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                {p.roles.map((r, i) => (
                  <span key={`role-${i}`} style={{
                    background: 'rgba(245,158,11,0.15)',
                    color: '#fbbf24',
                    fontSize: 12,
                    fontWeight: 600,
                    padding: '6px 12px',
                    borderRadius: 8,
                    border: '1px solid rgba(245,158,11,0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4
                  }}>
                    <Briefcase size={12} />
                    {r}
                  </span>
                ))}
                {p.genres.map((g, i) => (
                  <span key={`genre-${i}`} style={{
                    background: 'rgba(59,130,246,0.15)',
                    color: '#60a5fa',
                    fontSize: 12,
                    fontWeight: 600,
                    padding: '6px 12px',
                    borderRadius: 8,
                    border: '1px solid rgba(59,130,246,0.3)'
                  }}>
                    {g}
                  </span>
                ))}
                {p.skills.map((s, i) => (
                  <span key={`skill-${i}`} style={{
                    background: 'rgba(16,185,129,0.15)',
                    color: '#34d399',
                    fontSize: 12,
                    fontWeight: 600,
                    padding: '6px 12px',
                    borderRadius: 8,
                    border: '1px solid rgba(16,185,129,0.3)'
                  }}>
                    {s}
                  </span>
                ))}
              </div>

              {/* Social Links */}
              {Object.keys(p.social_links).length > 0 && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {Object.entries(p.social_links).map(([platform, url]) => {
                    const platformInfo = socialPlatforms[platform];
                    if (!platformInfo || !url) return null;
                    return (
                      <a
                        key={platform}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={platformInfo.label}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 40,
                          height: 40,
                          borderRadius: 8,
                          background: 'rgba(255,255,255,0.05)',
                          color: platformInfo.color,
                          transition: 'all 0.2s ease'
                        }}
                        onMouseOver={e => {
                          e.currentTarget.style.background = platformInfo.color;
                          e.currentTarget.style.color = '#fff';
                        }}
                        onMouseOut={e => {
                          e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                          e.currentTarget.style.color = platformInfo.color;
                        }}
                      >
                        {platformInfo.icon}
                      </a>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Stats & CTA */}
            <div style={{ minWidth: 280 }}>
              {/* Tier Badge */}
              {p.tier && p.tier !== 'standard' && (
                <div style={{
                  fontSize: 14,
                  color: p.tier === 'founding' ? '#f59e0b' : '#c084fc',
                  fontWeight: 600,
                  textAlign: 'center',
                  padding: '10px 16px',
                  background: p.tier === 'founding' ? 'rgba(245,158,11,0.1)' : 'rgba(168,85,247,0.1)',
                  borderRadius: 12,
                  border: `1px solid ${p.tier === 'founding' ? 'rgba(245,158,11,0.3)' : 'rgba(168,85,247,0.3)'}`,
                  marginBottom: 16,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8
                }}>
                  <Award size={18} />
                  {p.tier === 'founding' ? 'Founding Creator' : `${p.tier.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())} Creator`}
                </div>
              )}

              {/* Stats Grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: 12,
                marginBottom: 16
              }}>
                <div style={{
                  background: 'rgba(255,255,255,0.03)',
                  borderRadius: 12,
                  padding: 16,
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: '#f1f5f9' }}>
                    {stats.works_count}
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase' }}>Works</div>
                </div>
                <div style={{
                  background: 'rgba(255,255,255,0.03)',
                  borderRadius: 12,
                  padding: 16,
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: '#f59e0b' }}>
                    {followerCount.toLocaleString()}
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase' }}>Followers</div>
                </div>
                <div style={{
                  background: 'rgba(255,255,255,0.03)',
                  borderRadius: 12,
                  padding: 16,
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: '#10b981' }}>
                    {stats.total_views.toLocaleString()}
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase' }}>Views</div>
                </div>
                <div style={{
                  background: 'rgba(255,255,255,0.03)',
                  borderRadius: 12,
                  padding: 16,
                  textAlign: 'center'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                    <Star size={18} fill="#fbbf24" color="#fbbf24" />
                    <span style={{ fontSize: 24, fontWeight: 700, color: '#fbbf24' }}>
                      {stats.average_rating ? stats.average_rating.toFixed(1) : '-'}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase' }}>Rating</div>
                </div>
              </div>

              {/* Action Buttons - Only show if not viewing own profile */}
              {currentUser?.username !== p.username && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <FollowButton
                    username={p.username}
                    initialFollowerCount={followerCount}
                    size="lg"
                    onFollowChange={(following, count) => {
                      // Update the stats display when follow status changes
                      setFollowerCount(count);
                    }}
                  />
                  <button
                    onClick={() => setInviteModalOpen(true)}
                    style={{
                      width: '100%',
                      background: 'transparent',
                      color: '#f59e0b',
                      border: '1px solid #f59e0b',
                      padding: '14px 20px',
                      borderRadius: 12,
                      fontWeight: 700,
                      fontSize: 15,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      transition: 'all 0.2s ease'
                    }}
                    onMouseOver={e => {
                      e.currentTarget.style.background = 'rgba(245, 158, 11, 0.1)';
                    }}
                    onMouseOut={e => {
                      e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <Users size={18} />
                    Invite to Collaborate
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content Tabs */}
      <div style={{
        display: 'flex',
        gap: 8,
        marginBottom: 24,
        borderBottom: '1px solid #334155',
        paddingBottom: 16
      }}>
        {[
          { key: 'works', label: 'Platform Works', count: platform_works.length + book_projects.length },
          { key: 'portfolio', label: 'External Portfolio', count: external_portfolio.length },
          { key: 'collabs', label: 'Collaborations', count: collaborations.length },
          { key: 'reviews', label: 'Reviews', count: null },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as typeof activeTab)}
            style={{
              background: activeTab === tab.key ? 'rgba(245,158,11,0.15)' : 'transparent',
              color: activeTab === tab.key ? '#f59e0b' : '#94a3b8',
              border: activeTab === tab.key ? '1px solid rgba(245,158,11,0.3)' : '1px solid transparent',
              padding: '10px 20px',
              borderRadius: 8,
              fontWeight: 600,
              fontSize: 14,
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            {tab.label}{tab.count !== null && ` (${tab.count})`}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20, marginBottom: 40 }}>
        {/* Book Projects - grouped with expandable chapters */}
        {activeTab === 'works' && book_projects.map(book => {
          const isExpanded = expandedBooks.has(book.id);
          const toggleExpand = () => {
            setExpandedBooks(prev => {
              const newSet = new Set(prev);
              if (newSet.has(book.id)) {
                newSet.delete(book.id);
              } else {
                newSet.add(book.id);
              }
              return newSet;
            });
          };

          return (
            <div
              key={`book-${book.id}`}
              style={{
                background: '#1e293b',
                borderRadius: 12,
                overflow: 'hidden',
                transition: 'all 0.2s ease',
              }}
              onMouseOver={e => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.25)';
              }}
              onMouseOut={e => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              {/* Cover Image */}
              <div
                onClick={toggleExpand}
                style={{
                  height: 160,
                  background: book.cover_image_url ? `url(${book.cover_image_url}) center/cover` : getGradient(book.title),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  cursor: 'pointer',
                }}
              >
                {!book.cover_image_url && <BookOpen size={48} color="rgba(255,255,255,0.3)" />}
                {/* Chapter count badge */}
                <div style={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  background: 'rgba(0,0,0,0.8)',
                  backdropFilter: 'blur(4px)',
                  padding: '4px 10px',
                  borderRadius: 12,
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#f8fafc',
                }}>
                  {book.published_chapters} chapter{book.published_chapters !== 1 ? 's' : ''}
                </div>
              </div>

              {/* Card Content */}
              <div style={{ padding: 16 }}>
                <h3 style={{ color: '#f1f5f9', fontSize: 16, fontWeight: 600, margin: '0 0 8px' }}>
                  {book.title}
                </h3>
                <div style={{
                  fontSize: 13,
                  color: '#94a3b8',
                  marginBottom: 12,
                }}>
                  book • {book.published_chapters} chapter{book.published_chapters !== 1 ? 's' : ''}
                </div>

                {/* Stats */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  fontSize: 13,
                  color: '#cbd5e1',
                  marginBottom: 12,
                }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Eye size={14} /> {book.total_views}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <DollarSign size={14} /> ${book.total_price.toFixed(2)}
                  </span>
                </div>

                {/* Expandable chapter list */}
                {book.chapters.length > 0 && (
                  <>
                    <button
                      onClick={toggleExpand}
                      style={{
                        width: '100%',
                        background: '#0f172a',
                        border: 'none',
                        borderRadius: 8,
                        padding: '8px 12px',
                        color: '#94a3b8',
                        fontSize: 13,
                        fontWeight: 500,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: isExpanded ? 8 : 0,
                      }}
                    >
                      <span>Chapters</span>
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>

                    {isExpanded && (
                      <div style={{
                        background: '#0f172a',
                        borderRadius: 8,
                        padding: 8,
                        maxHeight: 200,
                        overflowY: 'auto',
                      }}>
                        {book.chapters.map((chapter, index) => (
                          <Link
                            key={chapter.id}
                            to={`/content/${chapter.content_id}`}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '8px 10px',
                              borderRadius: 6,
                              background: index % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)',
                              textDecoration: 'none',
                              transition: 'background 0.15s ease',
                            }}
                            onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                            onMouseOut={e => e.currentTarget.style.background = index % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)'}
                          >
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{
                                fontSize: 13,
                                color: '#e2e8f0',
                                fontWeight: 500,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}>
                                Ch {chapter.order + 1}: {chapter.title}
                              </div>
                              <div style={{ fontSize: 11, color: '#64748b' }}>
                                ${chapter.price_usd.toFixed(2)}
                              </div>
                            </div>
                            <span style={{
                              background: 'transparent',
                              border: '1px solid #334155',
                              borderRadius: 6,
                              padding: '4px 10px',
                              color: '#94a3b8',
                              fontSize: 11,
                              fontWeight: 500,
                              marginLeft: 8,
                              flexShrink: 0,
                            }}>
                              View
                            </span>
                          </Link>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}

        {/* Other platform works (non-book content like art, music, videos) */}
        {activeTab === 'works' && platform_works.map(work => (
          <Link
            key={work.id}
            to={`/content/${work.id}`}
            style={{
              background: '#1e293b',
              borderRadius: 12,
              overflow: 'hidden',
              transition: 'all 0.2s ease',
              textDecoration: 'none',
              cursor: 'pointer'
            }}
            onMouseOver={e => e.currentTarget.style.transform = 'translateY(-4px)'}
            onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <div style={{
              height: 160,
              background: work.cover_image ? `url(${work.cover_image}) center/cover` : getGradient(work.title),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative'
            }}>
              {!work.cover_image && contentTypeIcons[work.content_type]}
              {/* Price badge */}
              <div style={{
                position: 'absolute',
                top: 8,
                right: 8,
                background: 'rgba(0,0,0,0.8)',
                backdropFilter: 'blur(4px)',
                padding: '4px 8px',
                borderRadius: 4,
                fontSize: 12,
                fontWeight: 700,
                color: parseFloat(work.price_usd) > 0 ? '#10b981' : '#94a3b8',
              }}>
                ${parseFloat(work.price_usd).toFixed(2)}
              </div>
            </div>
            <div style={{ padding: 16 }}>
              <h3 style={{ color: '#f1f5f9', fontSize: 16, fontWeight: 600, margin: '0 0 8px' }}>
                {work.title}
              </h3>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <span style={{
                  background: 'rgba(59,130,246,0.15)',
                  color: '#60a5fa',
                  fontSize: 11,
                  padding: '4px 8px',
                  borderRadius: 4
                }}>
                  {work.content_type}
                </span>
                <span style={{
                  background: 'rgba(16,185,129,0.15)',
                  color: '#34d399',
                  fontSize: 11,
                  padding: '4px 8px',
                  borderRadius: 4
                }}>
                  {work.genre}
                </span>
              </div>
              <div style={{
                color: '#94a3b8',
                fontSize: 13,
                display: 'flex',
                alignItems: 'center',
                gap: 4
              }}>
                Click to view & purchase
              </div>
            </div>
          </Link>
        ))}

        {activeTab === 'portfolio' && external_portfolio.map(item => (
          <div key={item.id} style={{
            background: '#1e293b',
            borderRadius: 12,
            overflow: 'hidden'
          }}>
            <div style={{
              height: 160,
              background: item.image_url ? `url(${item.image_url}) center/cover` : getGradient(item.title),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {!item.image_url && contentTypeIcons[item.project_type] || <Globe size={32} color="#94a3b8" />}
            </div>
            <div style={{ padding: 16 }}>
              <h3 style={{ color: '#f1f5f9', fontSize: 16, fontWeight: 600, margin: '0 0 8px' }}>
                {item.title}
              </h3>
              {item.role && (
                <div style={{ color: '#f59e0b', fontSize: 13, marginBottom: 8 }}>{item.role}</div>
              )}
              {item.description && (
                <p style={{ color: '#94a3b8', fontSize: 13, lineHeight: 1.5, margin: '0 0 12px' }}>
                  {item.description.slice(0, 100)}{item.description.length > 100 ? '...' : ''}
                </p>
              )}
              {item.external_url && (
                <a
                  href={item.external_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: '#60a5fa',
                    fontSize: 13,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    textDecoration: 'none'
                  }}
                >
                  View Project <ExternalLink size={14} />
                </a>
              )}
            </div>
          </div>
        ))}

        {activeTab === 'collabs' && collaborations.map(collab => (
          <div key={collab.id} style={{
            background: '#1e293b',
            borderRadius: 12,
            overflow: 'hidden'
          }}>
            <div style={{
              height: 160,
              background: collab.cover_image ? `url(${collab.cover_image}) center/cover` : getGradient(collab.title),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {!collab.cover_image && contentTypeIcons[collab.content_type]}
            </div>
            <div style={{ padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{
                  background: 'rgba(16,185,129,0.15)',
                  color: '#34d399',
                  fontSize: 11,
                  padding: '4px 8px',
                  borderRadius: 4,
                  textTransform: 'uppercase'
                }}>
                  {collab.content_type}
                </span>
              </div>
              <h3 style={{ color: '#f1f5f9', fontSize: 16, fontWeight: 600, margin: '0 0 8px' }}>
                {collab.title}
              </h3>
              <div style={{ color: '#f59e0b', fontSize: 14, marginBottom: 8 }}>
                {collab.user_role}
              </div>
              <div style={{ color: '#64748b', fontSize: 13 }}>
                <Users size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
                {collab.collaborator_count} collaborators
              </div>
            </div>
          </div>
        ))}

        {activeTab === 'works' && platform_works.length === 0 && book_projects.length === 0 && (
          <div style={{ color: '#94a3b8', gridColumn: '1/-1', textAlign: 'center', padding: 40 }}>
            No platform works yet
          </div>
        )}
        {activeTab === 'portfolio' && external_portfolio.length === 0 && (
          <div style={{ color: '#94a3b8', gridColumn: '1/-1', textAlign: 'center', padding: 40 }}>
            No external portfolio items yet
          </div>
        )}
        {activeTab === 'collabs' && collaborations.length === 0 && (
          <div style={{ color: '#94a3b8', gridColumn: '1/-1', textAlign: 'center', padding: 40 }}>
            No collaborations yet
          </div>
        )}
      </div>

      {/* Reviews Tab Content */}
      {activeTab === 'reviews' && (
        <div style={{ marginBottom: 40 }}>
          <CreatorReviewsSection
            creatorUsername={p.username}
            creatorUserId={p.id}
            averageRating={stats.average_rating}
            isOwnProfile={currentUser?.username === p.username}
            isAuthenticated={!!currentUser}
            onAuthRequired={() => navigate('/auth')}
          />
        </div>
      )}

      {/* Testimonials */}
      {testimonials.length > 0 && (
        <div style={{ marginBottom: 40 }}>
          <h2 style={{ color: '#f1f5f9', fontSize: 20, fontWeight: 700, marginBottom: 20 }}>
            Testimonials
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 20 }}>
            {testimonials.map(t => (
              <div key={t.id} style={{
                background: '#1e293b',
                borderRadius: 12,
                padding: 20
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                  <div style={{
                    width: 48,
                    height: 48,
                    borderRadius: '50%',
                    background: t.rater_avatar ? `url(${t.rater_avatar}) center/cover` : '#374151',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#f59e0b',
                    fontWeight: 700
                  }}>
                    {!t.rater_avatar && t.rater_username.slice(0, 1).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ color: '#f1f5f9', fontWeight: 600 }}>@{t.rater_username}</div>
                    <div style={{ color: '#64748b', fontSize: 13 }}>{t.project_title}</div>
                  </div>
                  <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Star size={16} fill="#fbbf24" color="#fbbf24" />
                    <span style={{ color: '#fbbf24', fontWeight: 700 }}>{t.average_score.toFixed(1)}</span>
                  </div>
                </div>
                <p style={{ color: '#cbd5e1', fontSize: 14, lineHeight: 1.6, margin: 0, fontStyle: 'italic' }}>
                  "{t.public_feedback}"
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Invite Modal */}
      <InviteModal
        open={inviteModalOpen}
        onClose={() => setInviteModalOpen(false)}
        recipient={{
          id: p.id,
          username: p.username,
          display_name: p.display_name,
          avatar_url: p.avatar,
          status: p.status,
          status_category: p.status_category,
          roles: p.roles,
          genres: p.genres
        }}
      />
    </div>
  );
}
