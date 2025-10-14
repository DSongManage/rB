import React, { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { VideoCard } from '../components/VideoCard';

const TYPES = ['all','book','art','film','music'];
const GENRES = ['all','fantasy','scifi','nonfiction','drama','comedy','other'];

export default function SearchPage() {
  const location = useLocation();
  const urlQ = new URLSearchParams(location.search).get('q') || '';
  const [q, setQ] = useState(urlQ);
  const [type, setType] = useState('all');
  const [genre, setGenre] = useState('all');
  const [results, setResults] = useState<any[]>([]);

  const run = useCallback(() => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (type !== 'all') params.set('type', type);
    if (genre !== 'all') params.set('genre', genre);
    fetch(`http://127.0.0.1:8000/api/search/?${params.toString()}`)
      .then(r=>r.json()).then(setResults).catch(()=>setResults([]));
  }, [q, type, genre]);
  
  useEffect(()=>{ run(); }, [run]);

  return (
    <div className="page" style={{background:'transparent', border:'none', boxShadow:'none'}}>
      <div style={{display:'flex', gap:10, marginBottom:16}}>
        <input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Search" />
        <select value={type} onChange={(e)=>setType(e.target.value)}>
          {TYPES.map(t=> <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={genre} onChange={(e)=>setGenre(e.target.value)}>
          {GENRES.map(g=> <option key={g} value={g}>{g}</option>)}
        </select>
        <button onClick={run}>Search</button>
      </div>
      <div className="yt-grid">
        {results.map((it, idx)=> (
          <VideoCard key={it.id}
            id={it.id}
            title={it.title}
            author={`Creator #${it.creator ?? 0}`}
            thumbnailUrl={`https://picsum.photos/seed/s${idx}/960/540`}
            teaser_link={it.teaser_link}
          />
        ))}
      </div>
    </div>
  );
}
