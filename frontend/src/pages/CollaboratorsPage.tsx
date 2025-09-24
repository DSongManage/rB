import React, { useEffect, useMemo, useState } from 'react';

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

  useEffect(()=>{
    setLoading(true);
    fetch(`http://localhost:8000/api/users/search/?${queryString}`)
      .then(r=> r.ok ? r.json() : [])
      .then(setResults)
      .finally(()=> setLoading(false));
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
          <div key={p.id} style={{background:'#0f172a', border:'1px solid #1f2937', borderRadius:12, padding:12, display:'grid', gridTemplateColumns:'56px 1fr auto', gap:12, alignItems:'center'}}>
            <div style={{width:56, height:56, borderRadius:12, background:'#111827', display:'grid', placeItems:'center', color:'#f59e0b', fontWeight:700}}>{(p.username||'?').slice(0,1).toUpperCase()}</div>
            <div>
              <div style={{color:'#e5e7eb', fontWeight:600}}>@{p.username}</div>
              <div style={{fontSize:12, color:'#94a3b8'}}>{(p.display_name||'').trim()}</div>
              <div style={{fontSize:12, color:'#94a3b8'}}>{p.wallet_address ? `Wallet: ${p.wallet_address.slice(0,4)}...${p.wallet_address.slice(-4)}` : ''}</div>
            </div>
            <div>
              <button style={{background:'#f59e0b', color:'#111827', border:'none', padding:'8px 10px', borderRadius:8}}>Invite</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
