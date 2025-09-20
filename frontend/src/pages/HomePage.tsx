import React, { useEffect, useMemo, useState } from 'react';
import { VideoCard } from '../components/VideoCard';

type Item = { id:number; title:string; teaser_link?:string; creator?: number };

const GENRES = ['All','Books','Art','Film','Music','Tech','Photography'];

export default function HomePage() {
  const [items, setItems] = useState<Item[]>([]);
  const [genre, setGenre] = useState('All');

  useEffect(()=>{
    fetch('http://127.0.0.1:8000/api/content/')
      .then(r=>r.json()).then(setItems).catch(()=>setItems([]));
  },[]);

  const filtered = useMemo(()=>{
    if (genre==='All') return items;
    // demo filter: use title keywords to simulate genre
    return items.filter(it=> it.title.toLowerCase().includes(genre.toLowerCase()));
  },[items, genre]);

  const thumb = (i:number)=> `https://picsum.photos/seed/rb${i}/960/540`;

  return (
    <div>
      <div className="chips">
        {GENRES.map(g=> (
          <button key={g} className={`chip ${genre===g?'active':''}`} onClick={()=>setGenre(g)}>{g}</button>
        ))}
      </div>
      <div className="page" style={{padding:0, background:'transparent', border:'none', boxShadow:'none'}}>
        <div className="yt-grid">
          {filtered.map((it, idx)=> (
            <VideoCard key={it.id}
              id={it.id}
              title={it.title}
              author={`Creator #${it.creator ?? 0}`}
              viewsText={`${(idx+1)*3}K views`}
              timeText={`${(idx%7)+1} days ago`}
              thumbnailUrl={thumb(idx)}
              teaser_link={it.teaser_link}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
