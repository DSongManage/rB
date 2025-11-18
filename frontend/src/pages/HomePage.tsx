import React, { useEffect, useMemo, useState } from 'react';
import { API_URL } from '../config';
import { VideoCard } from '../components/VideoCard';

type Item = {
  id: number;
  title: string;
  teaser_link?: string;
  creator?: number;
  creator_username?: string;
  created_at?: string;
  content_type?: string;
  price_usd?: number;
  editions?: number;
  owned?: boolean;
};

const GENRES = ['All','Books','Art','Film','Music','Tech','Photography'];

export default function HomePage() {
  const [items, setItems] = useState<Item[]>([]);
  const [genre, setGenre] = useState('All');

  useEffect(()=>{
    fetch(`${API_URL}/api/content/`, { credentials: 'include' })
      .then(r=>r.json())
      .then(data => {
        // Handle paginated response from DRF
        if (data && Array.isArray(data.results)) {
          setItems(data.results);
        } else if (Array.isArray(data)) {
          setItems(data);
        } else {
          setItems([]);
        }
      })
      .catch(()=>setItems([]));
  },[]);

  const filtered = useMemo(()=>{
    if (genre==='All') return items;
    // Filter by content_type or genre
    return items.filter(it=> {
      const contentType = it.content_type || '';
      return contentType.toLowerCase().includes(genre.toLowerCase()) || 
             it.title.toLowerCase().includes(genre.toLowerCase());
    });
  },[items, genre]);

  // Format time ago
  const getTimeAgo = (dateString?: string) => {
    if (!dateString) return 'Recently';
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;
    return `${Math.floor(seconds / 604800)} weeks ago`;
  };

  return (
    <div>
      <div className="chips">
        {GENRES.map(g=> (
          <button key={g} className={`chip ${genre===g?'active':''}`} onClick={()=>setGenre(g)}>{g}</button>
        ))}
      </div>
      <div className="page" style={{padding:0, background:'transparent', border:'none', boxShadow:'none'}}>
        <div className="yt-grid">
          {filtered.map((it)=> (
            <VideoCard key={it.id}
              id={it.id}
              title={it.title}
              author={it.creator_username || `Creator #${it.creator ?? 0}`}
              viewsText="0 views"
              timeText={getTimeAgo(it.created_at)}
              thumbnailUrl={it.teaser_link || ''}
              teaser_link={it.teaser_link}
              price={it.price_usd}
              editions={it.editions}
              owned={it.owned}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
