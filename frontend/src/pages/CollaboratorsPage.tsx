import React, { useEffect, useMemo, useRef, useState } from 'react';
import StatusEditForm from '../components/StatusEditForm';
import InviteModal from '../components/InviteModal';

export default function CollaboratorsPage() {
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [genre, setGenre] = useState('');
  const [location, setLocation] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [selectedRecipient, setSelectedRecipient] = useState<any>(null);

  const queryString = useMemo(()=>{
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (role) params.set('role', role);
    if (genre) params.set('genre', genre);
    if (location) params.set('location', location);
    return params.toString();
  }, [q, role, genre, location]);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(()=>{
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(()=>{
      setLoading(true);
      const url = `/api/users/search/?${queryString}`;
      fetch(url, { credentials: 'include' })
        .then(r=> r.ok ? r.json() : [])
        .then((data)=> setResults(Array.isArray(data) ? data : []))
        .finally(()=> setLoading(false));
    }, 300);
    return ()=> { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [queryString]);

  return (
    <div className="page" style={{maxWidth:1100, margin:'0 auto'}}>
      <div style={{background:'#0f172a', border:'1px solid #1f2937', borderRadius:12, padding:16, marginBottom:16}}>
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr auto', gap:8}}>
          <input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Search by name or @handle" />
          <input value={role} onChange={(e)=>setRole(e.target.value)} placeholder="Role (e.g., author, artist)" />
          <input value={genre} onChange={(e)=>setGenre(e.target.value)} placeholder="Genre (e.g., fantasy)" />
          <input value={location} onChange={(e)=>setLocation(e.target.value)} placeholder="Location (city, state)" />
          <button onClick={()=>{ /* results update via state */ }}>Search</button>
        </div>
      </div>

      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
        {loading && <div style={{color:'#94a3b8'}}>Searching…</div>}
        {!loading && results.length === 0 && (
          <div style={{color:'#94a3b8'}}>No collaborators found. Try broadening your filters.</div>
        )}
        {!loading && results.map((p)=> {
          // Status badge color (LinkedIn-like availability)
          const statusColors = {
            green: { bg: '#10b981', text: '#fff' },
            yellow: { bg: '#f59e0b', text: '#000' },
            red: { bg: '#ef4444', text: '#fff' },
          };
          const statusColor = statusColors[p.status_category as 'green'|'yellow'|'red'] || statusColors.green;
          
          return (
            <div key={p.id} style={{background:'var(--panel)', border:'1px solid var(--panel-border)', borderRadius:12, padding:16, display:'grid', gap:12}}>
              {/* Header: Avatar + Name + Status Badge */}
              <div style={{display:'grid', gridTemplateColumns:'56px 1fr auto', gap:12, alignItems:'start'}}>
                <div style={{width:56, height:56, borderRadius:12, background: p.avatar_url ? `url(${p.avatar_url})` : '#111', backgroundSize:'cover', display:'grid', placeItems:'center', color:'var(--accent)', fontWeight:700}}>
                  {!p.avatar_url && (p.username||'?').slice(0,1).toUpperCase()}
                </div>
                <div>
                  <div style={{color:'var(--text)', fontWeight:600, fontSize:16}}>@{p.username}</div>
                  {p.display_name && <div style={{fontSize:13, color:'#cbd5e1', marginTop:2}}>{p.display_name}</div>}
                  {p.location && <div style={{fontSize:12, color:'#94a3b8', marginTop:2}}>📍 {p.location}</div>}
                </div>
                {p.status && (
                  <div style={{background:statusColor.bg, color:statusColor.text, fontSize:10, fontWeight:600, padding:'4px 8px', borderRadius:6, textTransform:'uppercase', letterSpacing:0.5}}>
                    {p.status_category}
                  </div>
                )}
              </div>

              {/* Capabilities: Roles & Genres */}
              {(p.roles.length > 0 || p.genres.length > 0) && (
                <div style={{display:'flex', flexWrap:'wrap', gap:6}}>
                  {p.roles.map((r:string, i:number)=> (
                    <span key={`role-${i}`} style={{background:'rgba(245,158,11,0.1)', color:'#f59e0b', fontSize:11, fontWeight:600, padding:'3px 8px', borderRadius:4, border:'1px solid rgba(245,158,11,0.3)'}}>
                      {r}
                    </span>
                  ))}
                  {p.genres.map((g:string, i:number)=> (
                    <span key={`genre-${i}`} style={{background:'rgba(59,130,246,0.1)', color:'#3b82f6', fontSize:11, fontWeight:600, padding:'3px 8px', borderRadius:4, border:'1px solid rgba(59,130,246,0.3)'}}>
                      {g}
                    </span>
                  ))}
                </div>
              )}

              {/* Accomplishments & Stats */}
              <div style={{display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:12, borderTop:'1px solid var(--panel-border)', paddingTop:12}}>
                <div>
                  <div style={{fontSize:20, fontWeight:700, color:'var(--text)'}}>{p.content_count || 0}</div>
                  <div style={{fontSize:11, color:'#94a3b8', textTransform:'uppercase', letterSpacing:0.5}}>NFTs Minted</div>
                </div>
                <div>
                  <div style={{fontSize:20, fontWeight:700, color:'var(--accent)'}}>{p.successful_collabs || 0}</div>
                  <div style={{fontSize:11, color:'#94a3b8', textTransform:'uppercase', letterSpacing:0.5}}>Collaborations</div>
                </div>
                <div>
                  <div style={{fontSize:20, fontWeight:700, color:'#10b981'}}>${(p.total_sales_usd || 0).toLocaleString()}</div>
                  <div style={{fontSize:11, color:'#94a3b8', textTransform:'uppercase', letterSpacing:0.5}}>Total Sales</div>
                </div>
              </div>

              {/* Tier Badge */}
              {p.tier && p.tier !== 'Basic' && (
                <div style={{fontSize:12, color:'#a855f7', fontWeight:600, textAlign:'center', padding:'4px', background:'rgba(168,85,247,0.1)', borderRadius:6, border:'1px solid rgba(168,85,247,0.3)'}}>
                  {p.tier} Tier
                </div>
              )}

              {/* Action Button */}
              <button 
                onClick={() => {
                  setSelectedRecipient(p);
                  setInviteModalOpen(true);
                }}
                style={{background:'var(--accent)', color:'#111', border:'none', padding:'10px 14px', borderRadius:8, fontWeight:600, cursor:'pointer', transition:'opacity 0.2s'}} 
                onMouseOver={(e)=> e.currentTarget.style.opacity='0.9'} 
                onMouseOut={(e)=> e.currentTarget.style.opacity='1'}
              >
                Invite to Collaborate
              </button>
            </div>
          );
        })}
      </div>

      <div style={{marginTop:24, background:'var(--panel)', border:'1px solid var(--panel-border)', borderRadius:12, padding:16}}>
        <div style={{fontWeight:600, marginBottom:8}}>My availability status</div>
        <StatusEditForm onSaved={()=>{ /* No-op here; used on Profile page primarily */ }} />
      </div>

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
