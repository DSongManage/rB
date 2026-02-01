import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../config';
import InviteModal from '../components/InviteModal';
import { MapPin, Briefcase, Award, Star, Eye, Users, BookOpen, ChevronLeft, ChevronRight, Zap, TrendingUp, Crown } from 'lucide-react';
import { useMobile } from '../hooks/useMobile';

// Tier display config
const TIER_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  founding: { label: 'Founding Creator', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.4)' },
  level_5: { label: 'Level 5', color: '#a855f7', bg: 'rgba(168,85,247,0.15)', border: 'rgba(168,85,247,0.4)' },
  level_4: { label: 'Level 4', color: '#6366f1', bg: 'rgba(99,102,241,0.15)', border: 'rgba(99,102,241,0.4)' },
  level_3: { label: 'Level 3', color: '#3b82f6', bg: 'rgba(59,130,246,0.15)', border: 'rgba(59,130,246,0.4)' },
  level_2: { label: 'Level 2', color: '#14b8a6', bg: 'rgba(20,184,166,0.15)', border: 'rgba(20,184,166,0.4)' },
  level_1: { label: 'Level 1', color: '#22c55e', bg: 'rgba(34,197,94,0.15)', border: 'rgba(34,197,94,0.4)' },
  standard: { label: 'Standard', color: '#94a3b8', bg: 'rgba(148,163,184,0.1)', border: 'rgba(148,163,184,0.3)' },
};

const TIER_OPTIONS = [
  { key: 'founding', label: 'Founding Creator', color: '#f59e0b' },
  { key: 'level_5', label: 'Level 5', color: '#a855f7' },
  { key: 'level_4', label: 'Level 4', color: '#6366f1' },
  { key: 'level_3', label: 'Level 3', color: '#3b82f6' },
  { key: 'level_2', label: 'Level 2', color: '#14b8a6' },
  { key: 'level_1', label: 'Level 1', color: '#22c55e' },
  { key: 'standard', label: 'Standard', color: '#94a3b8' },
];

interface FeaturedCreator {
  id: number;
  username: string;
  display_name: string;
  avatar_url: string;
  tier: string;
  fee_percent: string;
  roles: string[];
  lifetime_project_sales: number;
}

export default function CollaboratorsPage() {
  const navigate = useNavigate();
  const { isMobile, isPhone } = useMobile();
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [genre, setGenre] = useState('');
  const [location, setLocation] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [tierFilters, setTierFilters] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [featuredCreators, setFeaturedCreators] = useState<FeaturedCreator[]>([]);
  const [loading, setLoading] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [selectedRecipient, setSelectedRecipient] = useState<any>(null);

  // Pagination state
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrev, setHasPrev] = useState(false);

  const toggleTierFilter = (tier: string) => {
    setTierFilters(prev =>
      prev.includes(tier) ? prev.filter(t => t !== tier) : [...prev, tier]
    );
  };

  // Reset to page 1 when filters change
  const filterString = useMemo(()=>{
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (role) params.set('role', role);
    if (genre) params.set('genre', genre);
    if (location) params.set('location', location);
    if (statusFilter) params.set('status', statusFilter);
    if (tierFilters.length > 0) params.set('tier', tierFilters.join(','));
    if (sortBy) params.set('sort', sortBy);
    return params.toString();
  }, [q, role, genre, location, statusFilter, tierFilters, sortBy]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [filterString]);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(()=>{
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(()=>{
      setLoading(true);
      const params = new URLSearchParams(filterString);
      params.set('page', String(page));
      params.set('page_size', '24');
      const url = `${API_URL}/api/users/search/?${params.toString()}`;
      fetch(url, { credentials: 'include' })
        .then(r=> r.ok ? r.json() : { results: [] })
        .then((data)=> {
          setResults(Array.isArray(data.results) ? data.results : []);
          setTotalPages(data.total_pages || 1);
          setTotalCount(data.total_count || 0);
          setHasNext(data.has_next || false);
          setHasPrev(data.has_prev || false);
          setFeaturedCreators(data.featured_creators || []);
        })
        .finally(()=> setLoading(false));
    }, 300);
    return ()=> { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [filterString, page]);

  // Generate gradient background based on username
  const getGradient = (username: string) => {
    const gradients = [
      'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
      'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
      'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
      'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
      'linear-gradient(135deg, #30cfd0 0%, #330867 100%)',
      'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
      'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)',
    ];
    const index = username.charCodeAt(0) % gradients.length;
    return gradients[index];
  };

  const renderTierBadge = (tier: string, feePercent?: string) => {
    if (!tier || tier === 'standard') return null;
    const tc = TIER_CONFIG[tier] || TIER_CONFIG.standard;
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        fontSize: 12,
        color: tc.color,
        fontWeight: 600,
        padding: '6px 12px',
        background: tc.bg,
        borderRadius: 8,
        border: `1px solid ${tc.border}`,
        marginBottom: 16,
      }}>
        {tier === 'founding' ? <Star size={14} fill={tc.color} color={tc.color} /> : <Zap size={14} />}
        {tc.label}
        {feePercent && (
          <span style={{ marginLeft: 4, opacity: 0.8, fontWeight: 700 }}>
            ({feePercent} fee)
          </span>
        )}
      </div>
    );
  };

  return (
    <div style={{width: '100%', padding: isMobile ? '0 8px' : 0}}>
      {/* Search & Filters */}
      <div style={{background:'var(--bg-card)', border:'1px solid var(--panel-border-strong)', borderRadius: isMobile ? 8 : 12, padding: isMobile ? 12 : 20, marginBottom: isMobile ? 16 : 24, boxShadow: '0 4px 6px rgba(0,0,0,0.1)'}}>
        <h2 style={{margin:0, marginBottom: isMobile ? 12 : 16, color:'var(--text)', fontSize: isMobile ? 20 : 24, fontWeight:700}}>Find Collaborators</h2>
        <div style={{display:'grid', gridTemplateColumns: isPhone ? '1fr' : 'repeat(auto-fit, minmax(200px, 1fr))', gap:12, marginBottom: 16}}>
          <input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Search by name or @handle" style={{padding:'10px 14px'}} />
          <input value={role} onChange={(e)=>setRole(e.target.value)} placeholder="Role (e.g., author, artist)" style={{padding:'10px 14px'}} />
          <input value={genre} onChange={(e)=>setGenre(e.target.value)} placeholder="Genre (e.g., fantasy)" style={{padding:'10px 14px'}} />
          <input value={location} onChange={(e)=>setLocation(e.target.value)} placeholder="Location (city, state)" style={{padding:'10px 14px'}} />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{padding:'10px 14px', cursor: 'pointer'}}
          >
            <option value="">All Availability</option>
            <option value="green">Available - Open to collaborate</option>
            <option value="yellow">Selective - May consider offers</option>
            <option value="red">Unavailable - Not taking projects</option>
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            style={{padding:'10px 14px', cursor: 'pointer'}}
          >
            <option value="">Sort: Default</option>
            <option value="tier">Sort: Best Tier First</option>
          </select>
        </div>

        {/* Tier Filter Chips */}
        <div>
          <div style={{
            fontSize: 12,
            color: 'var(--text-muted)',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: 8,
          }}>
            Filter by Tier
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {TIER_OPTIONS.map(opt => {
              const isActive = tierFilters.includes(opt.key);
              return (
                <button
                  key={opt.key}
                  onClick={() => toggleTierFilter(opt.key)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '6px 14px',
                    borderRadius: 20,
                    border: `1.5px solid ${isActive ? opt.color : 'var(--panel-border-strong)'}`,
                    background: isActive ? (TIER_CONFIG[opt.key]?.bg || 'transparent') : 'transparent',
                    color: isActive ? opt.color : 'var(--text-muted)',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  {opt.key === 'founding' && <Star size={12} fill={isActive ? opt.color : 'none'} color={isActive ? opt.color : 'var(--text-muted)'} />}
                  {opt.label}
                </button>
              );
            })}
            {tierFilters.length > 0 && (
              <button
                onClick={() => setTierFilters([])}
                style={{
                  padding: '6px 14px',
                  borderRadius: 20,
                  border: '1.5px solid var(--panel-border-strong)',
                  background: 'transparent',
                  color: 'var(--text-muted)',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Featured Creators Section */}
      {featuredCreators.length > 0 && tierFilters.length === 0 && (
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--panel-border-strong)',
          borderRadius: isMobile ? 8 : 12,
          padding: isMobile ? 12 : 20,
          marginBottom: isMobile ? 16 : 24,
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 16,
          }}>
            <Crown size={20} style={{ color: '#f59e0b' }} />
            <h3 style={{ margin: 0, color: 'var(--text)', fontSize: 18, fontWeight: 700 }}>
              Top Tier Creators
            </h3>
            <span style={{
              fontSize: 11,
              color: 'var(--text-muted)',
              fontWeight: 500,
              marginLeft: 4,
            }}>
              Lower platform fees when they're on your project
            </span>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: isPhone ? 'repeat(2, 1fr)' : `repeat(auto-fill, minmax(180px, 1fr))`,
            gap: 12,
          }}>
            {featuredCreators.map(fc => {
              const tc = TIER_CONFIG[fc.tier] || TIER_CONFIG.standard;
              return (
                <div
                  key={fc.id}
                  onClick={() => navigate(`/profile/${fc.username}`)}
                  style={{
                    background: tc.bg,
                    border: `1px solid ${tc.border}`,
                    borderRadius: 12,
                    padding: 16,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    textAlign: 'center',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = `0 8px 16px ${tc.border}`;
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  {/* Avatar */}
                  <div style={{
                    width: 52,
                    height: 52,
                    borderRadius: '50%',
                    background: fc.avatar_url ? `url(${fc.avatar_url}) center/cover` : '#374151',
                    border: `2px solid ${tc.color}`,
                    margin: '0 auto 10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 20,
                    fontWeight: 700,
                    color: tc.color,
                  }}>
                    {!fc.avatar_url && (fc.username || '?').slice(0, 1).toUpperCase()}
                  </div>

                  {/* Name */}
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>
                    @{fc.username}
                  </div>
                  {fc.display_name && (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
                      {fc.display_name}
                    </div>
                  )}

                  {/* Tier + Fee */}
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '3px 10px',
                    borderRadius: 12,
                    background: 'rgba(0,0,0,0.15)',
                    fontSize: 11,
                    fontWeight: 700,
                    color: tc.color,
                    marginBottom: 6,
                  }}>
                    {fc.tier === 'founding' ? <Star size={10} fill={tc.color} color={tc.color} /> : <Zap size={10} />}
                    {tc.label} — {fc.fee_percent}
                  </div>

                  {/* Roles */}
                  {fc.roles.length > 0 && (
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
                      {fc.roles.slice(0, 2).join(' · ')}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Results Grid */}
      <div style={{
        display:'grid',
        gridTemplateColumns: isPhone ? '1fr' : 'repeat(auto-fill, minmax(320px, 1fr))',
        gap: isMobile ? 16 : 24,
        marginBottom: isMobile ? 20 : 32
      }}>
        {loading && <div style={{color:'var(--text-muted)', fontSize:14}}>Searching...</div>}
        {!loading && results.length === 0 && (
          <div style={{color:'var(--text-muted)', fontSize:14}}>No collaborators found. Try broadening your filters.</div>
        )}
        {!loading && results.map((p)=> {
          // Status badge color
          const statusColors = {
            green: { bg: '#10b981', text: '#fff' },
            yellow: { bg: '#f59e0b', text: '#000' },
            red: { bg: '#ef4444', text: '#fff' },
          };
          const statusColor = statusColors[p.status_category as 'green'|'yellow'|'red'] || statusColors.green;

          return (
            <div
              key={p.id}
              onClick={() => navigate(`/profile/${p.username}`)}
              style={{
                background:'var(--bg-card)',
                borderRadius:16,
                overflow:'hidden',
                boxShadow: '0 4px 6px rgba(0,0,0,0.1), 0 2px 4px rgba(0,0,0,0.06)',
                transition: 'all 0.3s ease',
                cursor: 'pointer',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column' as const
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = '0 12px 24px rgba(0,0,0,0.2), 0 8px 12px rgba(0,0,0,0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1), 0 2px 4px rgba(0,0,0,0.06)';
              }}
            >
              {/* Banner/Cover Image */}
              <div
                style={{
                  height: 140,
                  background: p.banner_url ? `url(${p.banner_url}) center/cover` : getGradient(p.username),
                  position: 'relative'
                }}
              >
                {/* Status Badge - Positioned in top right of banner */}
                {p.status && (
                  <div style={{
                    position: 'absolute',
                    top: 12,
                    right: 12,
                    background: statusColor.bg,
                    color: statusColor.text,
                    fontSize: 11,
                    fontWeight: 600,
                    padding: '5px 12px',
                    borderRadius: 12,
                    letterSpacing: 0.3,
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                  }}>
                    {p.status}
                  </div>
                )}

                {/* Tier badge on banner - top left */}
                {p.tier && p.tier !== 'standard' && (() => {
                  const tc = TIER_CONFIG[p.tier] || TIER_CONFIG.standard;
                  return (
                    <div style={{
                      position: 'absolute',
                      top: 12,
                      left: 12,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '4px 10px',
                      borderRadius: 12,
                      background: 'rgba(0,0,0,0.65)',
                      backdropFilter: 'blur(8px)',
                      fontSize: 11,
                      fontWeight: 700,
                      color: tc.color,
                      boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                    }}>
                      {p.tier === 'founding' ? <Star size={11} fill={tc.color} color={tc.color} /> : <Zap size={11} />}
                      {tc.label}
                      <span style={{ opacity: 0.7, marginLeft: 2 }}>
                        {p.fee_percent}
                      </span>
                    </div>
                  );
                })()}
              </div>

              {/* Card Content */}
              <div style={{padding: '0 20px 20px', position: 'relative', flex: 1, display: 'flex', flexDirection: 'column' as const}}>
                {/* Large Avatar - Overlapping Banner */}
                <div style={{
                  width: 96,
                  height: 96,
                  borderRadius: '50%',
                  background: p.avatar_url ? `url(${p.avatar_url}) center/cover` : '#374151',
                  border: '4px solid var(--bg-card)',
                  marginTop: -48,
                  marginBottom: 12,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 32,
                  fontWeight: 700,
                  color: '#f59e0b',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                }}>
                  {!p.avatar_url && (p.username||'?').slice(0,1).toUpperCase()}
                </div>

                {/* Username & Display Name */}
                <div style={{marginBottom: 12}}>
                  <div style={{color:'var(--text)', fontWeight:700, fontSize:18, marginBottom: 2}}>
                    @{p.username}
                  </div>
                  {p.display_name && (
                    <div style={{fontSize:14, color:'var(--text-muted)', fontWeight: 500}}>
                      {p.display_name}
                    </div>
                  )}
                </div>

                {/* Location */}
                {p.location && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 13,
                    color: 'var(--text-muted)',
                    marginBottom: 16
                  }}>
                    <MapPin size={14} />
                    <span>{p.location}</span>
                  </div>
                )}

                {/* Roles & Genres */}
                {(p.roles.length > 0 || p.genres.length > 0) && (
                  <div style={{display:'flex', flexWrap:'wrap', gap:6, marginBottom: 16}}>
                    {p.roles.slice(0, 3).map((r:string, i:number)=> (
                      <span key={`role-${i}`} style={{
                        background:'rgba(245,158,11,0.15)',
                        color:'#fbbf24',
                        fontSize:11,
                        fontWeight:600,
                        padding:'4px 10px',
                        borderRadius:6,
                        border:'1px solid rgba(245,158,11,0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4
                      }}>
                        <Briefcase size={10} />
                        {r}
                      </span>
                    ))}
                    {p.genres.slice(0, 2).map((g:string, i:number)=> (
                      <span key={`genre-${i}`} style={{
                        background:'rgba(59,130,246,0.15)',
                        color:'#60a5fa',
                        fontSize:11,
                        fontWeight:600,
                        padding:'4px 10px',
                        borderRadius:6,
                        border:'1px solid rgba(59,130,246,0.3)'
                      }}>
                        {g}
                      </span>
                    ))}
                  </div>
                )}

                {/* Bio Section with fade */}
                {p.bio && (
                  <div style={{
                    position: 'relative',
                    marginBottom: 16,
                    maxHeight: 60,
                    overflow: 'hidden'
                  }}>
                    <p style={{
                      fontSize: 13,
                      color: 'var(--text-muted)',
                      margin: 0,
                      lineHeight: 1.5
                    }}>
                      {p.bio}
                    </p>
                    {/* Fade out gradient overlay */}
                    <div style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      height: 30,
                      background: 'linear-gradient(transparent, var(--bg-card))',
                      pointerEvents: 'none'
                    }} />
                  </div>
                )}

                {/* Stats Row */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: 8,
                  padding: '16px 0',
                  borderTop: '1px solid var(--panel-border-strong)',
                  borderBottom: '1px solid var(--panel-border-strong)',
                  marginBottom: 16,
                  marginTop: 'auto'
                }}>
                  <div style={{textAlign: 'center'}}>
                    <div style={{fontSize:18, fontWeight:700, color:'var(--text)', marginBottom: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4}}>
                      <BookOpen size={14} style={{color: '#60a5fa'}} />
                      {p.content_count || 0}
                    </div>
                    <div style={{fontSize:9, color:'var(--subtle)', textTransform:'uppercase', letterSpacing:0.5, fontWeight: 600}}>
                      Works
                    </div>
                  </div>
                  <div style={{textAlign: 'center'}}>
                    <div style={{fontSize:18, fontWeight:700, color:'var(--text)', marginBottom: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4}}>
                      <Users size={14} style={{color: '#a78bfa'}} />
                      {p.follower_count || 0}
                    </div>
                    <div style={{fontSize:9, color:'var(--subtle)', textTransform:'uppercase', letterSpacing:0.5, fontWeight: 600}}>
                      Followers
                    </div>
                  </div>
                  <div style={{textAlign: 'center'}}>
                    <div style={{fontSize:18, fontWeight:700, color:'var(--text)', marginBottom: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4}}>
                      <Eye size={14} style={{color: '#34d399'}} />
                      {p.total_views || 0}
                    </div>
                    <div style={{fontSize:9, color:'var(--subtle)', textTransform:'uppercase', letterSpacing:0.5, fontWeight: 600}}>
                      Views
                    </div>
                  </div>
                  <div style={{textAlign: 'center'}}>
                    <div style={{fontSize:18, fontWeight:700, color:'var(--text)', marginBottom: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4}}>
                      <Star size={14} style={{color: '#fbbf24'}} />
                      {p.average_rating != null ? p.average_rating.toFixed(1) : '-'}
                    </div>
                    <div style={{fontSize:9, color:'var(--subtle)', textTransform:'uppercase', letterSpacing:0.5, fontWeight: 600}}>
                      Rating
                    </div>
                  </div>
                </div>

                {/* Tier + Fee Rate Badge */}
                {renderTierBadge(p.tier, p.fee_percent)}

                {/* Action Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedRecipient(p);
                    setInviteModalOpen(true);
                  }}
                  style={{
                    width: '100%',
                    background:'transparent',
                    color:'#f59e0b',
                    border:'2px solid #f59e0b',
                    padding:'10px 16px',
                    borderRadius:8,
                    fontWeight:600,
                    fontSize: 14,
                    cursor:'pointer',
                    transition:'all 0.2s ease'
                  }}
                  onMouseOver={(e)=> {
                    e.currentTarget.style.background='#f59e0b';
                    e.currentTarget.style.color='#111';
                  }}
                  onMouseOut={(e)=> {
                    e.currentTarget.style.background='transparent';
                    e.currentTarget.style.color='#f59e0b';
                  }}
                >
                  Invite to Collaborate
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 16,
          padding: '24px 0',
          marginBottom: 24
        }}>
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={!hasPrev}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: hasPrev ? 'var(--bg-card)' : 'var(--dropdown-hover)',
              color: hasPrev ? 'var(--text)' : 'var(--text-muted)',
              border: '1px solid var(--panel-border-strong)',
              padding: '10px 20px',
              borderRadius: 8,
              fontWeight: 600,
              fontSize: 14,
              cursor: hasPrev ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s ease'
            }}
          >
            <ChevronLeft size={18} />
            Previous
          </button>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            color: 'var(--text-muted)',
            fontSize: 14
          }}>
            <span>Page</span>
            <span style={{
              background: '#f59e0b',
              color: '#000',
              fontWeight: 700,
              padding: '4px 12px',
              borderRadius: 6,
              minWidth: 32,
              textAlign: 'center'
            }}>
              {page}
            </span>
            <span>of {totalPages}</span>
            <span style={{ marginLeft: 8, color: 'var(--subtle)' }}>
              ({totalCount} collaborators)
            </span>
          </div>

          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={!hasNext}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: hasNext ? 'var(--bg-card)' : 'var(--dropdown-hover)',
              color: hasNext ? 'var(--text)' : 'var(--text-muted)',
              border: '1px solid var(--panel-border-strong)',
              padding: '10px 20px',
              borderRadius: 8,
              fontWeight: 600,
              fontSize: 14,
              cursor: hasNext ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s ease'
            }}
          >
            Next
            <ChevronRight size={18} />
          </button>
        </div>
      )}

      {/* Invite Modal */}
      {selectedRecipient && (
        <InviteModal
          open={inviteModalOpen}
          onClose={() => {
            setInviteModalOpen(false);
            setSelectedRecipient(null);
          }}
          recipient={selectedRecipient}
        />
      )}
    </div>
  );
}
