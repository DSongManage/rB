import React, { useCallback, useEffect, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { VideoCard } from '../components/VideoCard';
import { API_URL } from '../config';

// Filter options
const TYPE_FILTERS = [
  { label: 'All', value: 'all' },
  { label: 'Books', value: 'book' },
  { label: 'Art', value: 'art' },
  { label: 'Film', value: 'film' },
  { label: 'Music', value: 'music' },
];

const GENRE_FILTERS = [
  { label: 'All Genres', value: 'all' },
  { label: 'Fantasy', value: 'fantasy' },
  { label: 'Sci-Fi', value: 'scifi' },
  { label: 'Non-Fiction', value: 'nonfiction' },
  { label: 'Drama', value: 'drama' },
  { label: 'Comedy', value: 'comedy' },
  { label: 'Other', value: 'other' },
];

type SearchResult = {
  id: number;
  title: string;
  teaser_link?: string;
  creator?: number;
  creator_username?: string;
  created_at?: string;
  content_type?: string;
  like_count?: number;
  average_rating?: number | null;
  rating_count?: number;
  price_usd?: number;
  editions?: number;
  owned?: boolean;
};


export default function SearchPage() {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  // Get values from URL params
  const query = searchParams.get('q') || '';
  const [type, setType] = useState(searchParams.get('type') || 'all');
  const [genre, setGenre] = useState(searchParams.get('genre') || 'all');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  // Update URL when filters change
  const updateFilters = (newType: string, newGenre: string) => {
    const params = new URLSearchParams(searchParams);
    if (newType !== 'all') {
      params.set('type', newType);
    } else {
      params.delete('type');
    }
    if (newGenre !== 'all') {
      params.set('genre', newGenre);
    } else {
      params.delete('genre');
    }
    setSearchParams(params);
  };

  const handleTypeChange = (newType: string) => {
    setType(newType);
    updateFilters(newType, genre);
  };

  const handleGenreChange = (newGenre: string) => {
    setGenre(newGenre);
    updateFilters(type, newGenre);
  };

  const fetchResults = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (type !== 'all') params.set('type', type);
    if (genre !== 'all') params.set('genre', genre);

    fetch(`${API_URL}/api/search/?${params.toString()}`, { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setResults(data);
        } else {
          setResults([]);
        }
      })
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
  }, [query, type, genre]);

  // Fetch results when query or filters change
  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  // Sync local state with URL params when they change
  useEffect(() => {
    setType(searchParams.get('type') || 'all');
    setGenre(searchParams.get('genre') || 'all');
  }, [searchParams]);

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
    <div className="page" style={{ background: 'transparent', border: 'none', boxShadow: 'none' }}>
      {/* Search query display */}
      {query && (
        <div style={{ marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 20, color: '#f1f5f9' }}>
            Results for "{query}"
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: '#94a3b8' }}>
            {results.length} result{results.length !== 1 ? 's' : ''} found
          </p>
        </div>
      )}

      {/* Filter chips */}
      <div style={{ marginBottom: 16 }}>
        <div className="chips" style={{ marginBottom: 8 }}>
          {TYPE_FILTERS.map(f => (
            <button
              key={f.value}
              className={`chip ${type === f.value ? 'active' : ''}`}
              onClick={() => handleTypeChange(f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="chips">
          {GENRE_FILTERS.map(f => (
            <button
              key={f.value}
              className={`chip ${genre === f.value ? 'active' : ''}`}
              onClick={() => handleGenreChange(f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Results grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
          Searching...
        </div>
      ) : results.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
          {query ? `No results found for "${query}"` : 'Browse content using the filters above'}
        </div>
      ) : (
        <div className="yt-grid">
          {results.map((it) => (
            <VideoCard
              key={it.id}
              id={it.id}
              title={it.title}
              author={it.creator_username || `Creator #${it.creator ?? 0}`}
              likeCount={it.like_count}
              averageRating={it.average_rating}
              ratingCount={it.rating_count}
              timeText={getTimeAgo(it.created_at)}
              thumbnailUrl={it.teaser_link || ''}
              teaser_link={it.teaser_link}
              price={it.price_usd}
              editions={it.editions}
              owned={it.owned}
            />
          ))}
        </div>
      )}
    </div>
  );
}
