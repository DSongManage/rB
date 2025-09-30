import React, { useEffect, useMemo, useRef, useState } from 'react';
import StatusEditForm from '../components/StatusEditForm';
import { ProfileStatus } from '../components/ProfileStatus';

export default function CollaboratorsPage() {
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [genre, setGenre] = useState('');
  const [location, setLocation] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

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
      const url = `http://localhost:8000/api/users/search/?${queryString}`;
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
        {!loading && results.map((p)=> (
          <div key={p.id} style={{background:'var(--panel)', border:'1px solid var(--panel-border)', borderRadius:12, padding:12, display:'grid', gridTemplateColumns:'56px 1fr auto', gap:12, alignItems:'center'}}>
            <div style={{width:56, height:56, borderRadius:12, background:'#111', display:'grid', placeItems:'center', color:'var(--accent)', fontWeight:700}}>{(p.username||'?').slice(0,1).toUpperCase()}</div>
            <div>
              <div style={{color:'var(--text)', fontWeight:600}}>@{p.username}</div>
              <div style={{fontSize:12, color:'#94a3b8'}}>{(p.display_name||'').trim()}</div>
              <div style={{fontSize:12, color:'#94a3b8'}}>{p.wallet_address ? `Wallet: ${p.wallet_address.slice(0,4)}...${p.wallet_address.slice(-4)}` : ''}</div>
              {/* Placeholder space for status badge if API returns status later in results */}
            </div>
            <div>
              <button style={{background:'var(--accent)', color:'#111', border:'none', padding:'8px 10px', borderRadius:8}}>Invite</button>
            </div>
          </div>
        ))}
      </div>

      <div style={{marginTop:24, background:'var(--panel)', border:'1px solid var(--panel-border)', borderRadius:12, padding:16}}>
        <div style={{fontWeight:600, marginBottom:8}}>My availability status</div>
        <StatusEditForm onSaved={()=>{ /* No-op here; used on Profile page primarily */ }} />
      </div>
    </div>
  );
}
