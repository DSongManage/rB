import React, { useEffect, useMemo, useState } from 'react';
import { API_URL } from '../config';
import { VideoCard } from '../components/VideoCard';

type Collaborator = {
  username: string;
  role: string;
  revenue_percentage: number;
};

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
  is_collaborative?: boolean;
  collaborators?: Collaborator[];
  view_count?: number;
};

// Genre filter config - maps display name to content_type value
const GENRE_FILTERS = [
  { label: 'All', value: 'all' },
  { label: 'Books', value: 'book' },
  { label: 'Art', value: 'art' },
  { label: 'Film', value: 'film' },
  { label: 'Music', value: 'music' },
];

// Format view count like YouTube (1.2K, 1.5M, etc.)
function formatViewCount(count: number): string {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M views`;
  } else if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K views`;
  } else if (count === 1) {
    return '1 view';
  }
  return `${count} views`;
}

export default function HomePage() {
  const [items, setItems] = useState<Item[]>([]);
  const [selectedFilter, setSelectedFilter] = useState('all');

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
    if (selectedFilter === 'all') return items;
    // Filter by content_type using exact match
    return items.filter(it=> it.content_type === selectedFilter);
  },[items, selectedFilter]);

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
        {GENRE_FILTERS.map(f=> (
          <button
            key={f.value}
            className={`chip ${selectedFilter===f.value?'active':''}`}
            onClick={()=>setSelectedFilter(f.value)}
          >
            {f.label}
          </button>
        ))}
      </div>
      <div className="page" style={{padding:0, background:'transparent', border:'none', boxShadow:'none'}}>
        <div className="yt-grid">
          {filtered.map((it)=> (
            <VideoCard key={it.id}
              id={it.id}
              title={it.title}
              author={it.creator_username || `Creator #${it.creator ?? 0}`}
              viewsText={formatViewCount(it.view_count || 0)}
              timeText={getTimeAgo(it.created_at)}
              thumbnailUrl={it.teaser_link || ''}
              teaser_link={it.teaser_link}
              price={it.price_usd}
              editions={it.editions}
              owned={it.owned}
              isCollaborative={it.is_collaborative}
              collaborators={it.collaborators?.map(c => c.username)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
