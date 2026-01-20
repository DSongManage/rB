import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../config';
import InviteModal from '../components/InviteModal';
import { MapPin, Briefcase, Award, Star, Eye, Users, BookOpen, ChevronLeft, ChevronRight } from 'lucide-react';
import { useMobile } from '../hooks/useMobile';

export default function CollaboratorsPage() {
  const navigate = useNavigate();
  const { isMobile, isPhone } = useMobile();
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [genre, setGenre] = useState('');
  const [location, setLocation] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [selectedRecipient, setSelectedRecipient] = useState<any>(null);

  // Pagination state
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrev, setHasPrev] = useState(false);

  // Reset to page 1 when filters change
  const filterString = useMemo(()=>{
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (role) params.set('role', role);
    if (genre) params.set('genre', genre);
    if (location) params.set('location', location);
    if (statusFilter) params.set('status', statusFilter);
    return params.toString();
  }, [q, role, genre, location, statusFilter]);

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

  return (
    <div style={{width: '100%', padding: isMobile ? '0 8px' : 0}}>
      <div style={{background:'var(--bg-card)', border:'1px solid var(--panel-border-strong)', borderRadius: isMobile ? 8 : 12, padding: isMobile ? 12 : 20, marginBottom: isMobile ? 16 : 24, boxShadow: '0 4px 6px rgba(0,0,0,0.1)'}}>
        <h2 style={{margin:0, marginBottom: isMobile ? 12 : 16, color:'var(--text)', fontSize: isMobile ? 20 : 24, fontWeight:700}}>Find Collaborators</h2>
        <div style={{display:'grid', gridTemplateColumns: isPhone ? '1fr' : 'repeat(auto-fit, minmax(200px, 1fr))', gap:12}}>
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
        </div>
      </div>

      <div style={{
        display:'grid',
        gridTemplateColumns: isPhone ? '1fr' : 'repeat(auto-fill, minmax(320px, 1fr))',
        gap: isMobile ? 16 : 24,
        marginBottom: isMobile ? 20 : 32
      }}>
        {loading && <div style={{color:'var(--text-muted)', fontSize:14}}>Searching…</div>}
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
                position: 'relative'
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
              </div>

              {/* Card Content */}
              <div style={{padding: '0 20px 20px', position: 'relative'}}>
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
                  marginBottom: 16
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

                {/* Tier Badge */}
                {p.tier && p.tier !== 'Basic' && (
                  <div style={{
                    fontSize:12,
                    color:'#c084fc',
                    fontWeight:600,
                    textAlign:'center',
                    padding:'6px 12px',
                    background:'rgba(168,85,247,0.1)',
                    borderRadius:8,
                    border:'1px solid rgba(168,85,247,0.3)',
                    marginBottom: 16,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6
                  }}>
                    <Award size={14} />
                    {p.tier} Tier
                  </div>
                )}

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
