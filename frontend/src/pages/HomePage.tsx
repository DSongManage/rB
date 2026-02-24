import React, { useEffect, useMemo, useState } from 'react';
import { API_URL } from '../config';
import { VideoCard } from '../components/VideoCard';
import { BookCard } from '../components/BookCard';
import { ComicCard } from '../components/ComicCard';

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
  source_project_id?: number | null;
  collaborators?: Collaborator[];
  like_count?: number;
  view_count?: number;
  average_rating?: number | null;
  rating_count?: number;
};

// Book project from aggregated endpoint
type BookChapter = {
  id: number;
  title: string;
  order: number;
  content_id: number;
  price_usd: number;
  view_count: number;
  editions?: number;
};

type BookProject = {
  id: number;
  title: string;
  cover_image_url: string | null;
  creator_username: string;
  published_chapters: number;
  chapters: BookChapter[];
  total_views: number;
  total_price: number;
  total_likes: number;
  average_rating: number | null;
  rating_count: number;
  first_chapter_content_id: number | null;
  created_at: string;
  content_type: 'book';
};

// Comic project from aggregated endpoint
type ComicIssue = {
  id: number;
  title: string;
  issue_number: number;
  content_id: number;
  price_usd: number;
  view_count: number;
  editions?: number;
};

type ComicProject = {
  id: number;
  title: string;
  cover_image_url: string | null;
  creator_username: string;
  published_issues: number;
  issues: ComicIssue[];
  total_views: number;
  total_price: number;
  total_likes: number;
  average_rating: number | null;
  rating_count: number;
  first_issue_content_id: number | null;
  created_at: string;
  content_type: 'comic';
  is_collaborative?: boolean;
};

// Genre filter config - maps display name to content_type value
const GENRE_FILTERS = [
  { label: 'All', value: 'all' },
  { label: 'Comics', value: 'comic' },
  { label: 'Books', value: 'book' },
  { label: 'Art', value: 'art' },
  { label: 'Film', value: 'film', comingSoon: true },
  { label: 'Music', value: 'music', comingSoon: true },
];


export default function HomePage() {
  const [items, setItems] = useState<Item[]>([]);
  const [bookProjects, setBookProjects] = useState<BookProject[]>([]);
  const [comicProjects, setComicProjects] = useState<ComicProject[]>([]);
  const [selectedFilter, setSelectedFilter] = useState('comic');

  useEffect(()=>{
    const abortController = new AbortController();

    // Fetch regular content (art, film, music - excludes books which are shown aggregated)
    const contentPromise = fetch(`${API_URL}/api/content/`, {
      credentials: 'include',
      signal: abortController.signal,
    })
      .then(r=>r.json())
      .then(data => {
        // Handle paginated response from DRF
        if (data && Array.isArray(data.results)) {
          // Filter out BookEditor books/comics (shown as aggregated cards)
          // Keep Studio books/comics (collaborative OR solo) — they have source_project_id
          return data.results.filter((item: Item) => (item.content_type !== 'book' && item.content_type !== 'comic') || item.is_collaborative || item.source_project_id);
        } else if (Array.isArray(data)) {
          return data.filter((item: Item) => (item.content_type !== 'book' && item.content_type !== 'comic') || item.is_collaborative || item.source_project_id);
        }
        return [];
      });

    // Fetch aggregated book projects
    const booksPromise = fetch(`${API_URL}/api/book-projects/public/`, {
      credentials: 'include',
      signal: abortController.signal,
    })
      .then(r=>r.json())
      .then(data => Array.isArray(data) ? data : []);

    // Fetch aggregated comic projects
    const comicsPromise = fetch(`${API_URL}/api/comic-projects/public/`, {
      credentials: 'include',
      signal: abortController.signal,
    })
      .then(r=>r.json())
      .then(data => Array.isArray(data) ? data : []);

    // Wait for all requests
    Promise.all([contentPromise, booksPromise, comicsPromise])
      .then(([contentItems, books, comics]) => {
        setItems(contentItems);
        setBookProjects(books);
        setComicProjects(comics);
      })
      .catch((err)=>{
        if (err.name !== 'AbortError') {
          setItems([]);
          setBookProjects([]);
          setComicProjects([]);
        }
      });

    return () => abortController.abort();
  },[]);

  // Format time ago
  const getTimeAgo = (dateString?: string) => {
    if (!dateString) return 'Recently';
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'Just now';
    if (seconds < 3600) { const m = Math.floor(seconds / 60); return `${m} minute${m !== 1 ? 's' : ''} ago`; }
    if (seconds < 86400) { const h = Math.floor(seconds / 3600); return `${h} hour${h !== 1 ? 's' : ''} ago`; }
    if (seconds < 604800) { const d = Math.floor(seconds / 86400); return `${d} day${d !== 1 ? 's' : ''} ago`; }
    const w = Math.floor(seconds / 604800); return `${w} week${w !== 1 ? 's' : ''} ago`;
  };

  // Create unified list with sorting info
  type DisplayItem = {
    type: 'content' | 'book' | 'comic';
    sortKey: number;
    data: Item | BookProject | ComicProject;
  };

  const allItems: DisplayItem[] = useMemo(() => {
    const result: DisplayItem[] = [];

    items.forEach(it => {
      result.push({
        type: 'content',
        sortKey: it.created_at ? new Date(it.created_at).getTime() : 0,
        data: it,
      });
    });

    bookProjects.forEach(book => {
      result.push({
        type: 'book',
        sortKey: book.created_at ? new Date(book.created_at).getTime() : 0,
        data: book,
      });
    });

    comicProjects.forEach(comic => {
      result.push({
        type: 'comic',
        sortKey: comic.created_at ? new Date(comic.created_at).getTime() : 0,
        data: comic,
      });
    });

    result.sort((a, b) => b.sortKey - a.sortKey);

    return result;
  }, [items, bookProjects, comicProjects]);

  // Apply filter
  const filtered = useMemo(()=>{
    if (selectedFilter === 'all') return allItems;

    return allItems.filter(item => {
      if (item.type === 'book') return selectedFilter === 'book';
      if (item.type === 'comic') return selectedFilter === 'comic';
      return (item.data as Item).content_type === selectedFilter;
    });
  },[allItems, selectedFilter]);

  return (
    <div>
      <div className="chips" data-tour="genre-filters">
        {GENRE_FILTERS.map(f=> (
          <button
            key={f.value}
            className={`chip ${selectedFilter===f.value?'active':''} ${f.comingSoon ? 'disabled' : ''}`}
            onClick={()=> !f.comingSoon && setSelectedFilter(f.value)}
            disabled={f.comingSoon}
            style={{
              opacity: f.comingSoon ? 0.5 : 1,
              cursor: f.comingSoon ? 'not-allowed' : 'pointer',
            }}
          >
            {f.label}
            {f.comingSoon && (
              <span style={{
                fontSize: 9,
                background: '#f59e0b',
                color: '#000',
                padding: '1px 4px',
                borderRadius: 3,
                marginLeft: 4,
                fontWeight: 700,
              }}>
                SOON
              </span>
            )}
          </button>
        ))}
      </div>
      <div className="page" style={{padding:0, background:'transparent', border:'none', boxShadow:'none'}}>
        <div className="yt-grid" data-tour="content-grid">
          {filtered.map((item) => {
            if (item.type === 'book') {
              const book = item.data as BookProject;
              return (
                <BookCard
                  key={`book-${book.id}`}
                  id={book.id}
                  title={book.title}
                  coverImageUrl={book.cover_image_url || ''}
                  author={book.creator_username}
                  chapters={book.chapters}
                  publishedChapters={book.published_chapters}
                  totalViews={book.total_views}
                  totalLikes={book.total_likes}
                  totalPrice={book.total_price}
                  averageRating={book.average_rating}
                  ratingCount={book.rating_count}
                  timeText={getTimeAgo(book.created_at)}
                />
              );
            } else if (item.type === 'comic') {
              const comic = item.data as ComicProject;
              return (
                <ComicCard
                  key={`comic-${comic.id}`}
                  id={comic.id}
                  title={comic.title}
                  coverImageUrl={comic.cover_image_url || ''}
                  author={comic.creator_username}
                  issues={comic.issues}
                  publishedIssues={comic.published_issues}
                  totalViews={comic.total_views}
                  totalLikes={comic.total_likes}
                  totalPrice={comic.total_price}
                  averageRating={comic.average_rating}
                  ratingCount={comic.rating_count}
                  timeText={getTimeAgo(comic.created_at)}
                  isCollaborative={comic.is_collaborative}
                />
              );
            } else {
              const it = item.data as Item;
              return (
                <VideoCard
                  key={`content-${it.id}`}
                  id={it.id}
                  title={it.title}
                  author={it.creator_username || `Creator #${it.creator ?? 0}`}
                  likeCount={it.like_count}
                  viewCount={it.view_count}
                  averageRating={it.average_rating}
                  ratingCount={it.rating_count}
                  timeText={getTimeAgo(it.created_at)}
                  thumbnailUrl={it.teaser_link || ''}
                  price={it.price_usd}
                  editions={it.editions}
                  owned={it.owned}
                  isCollaborative={it.is_collaborative}
                  collaborators={it.collaborators?.map(c => c.username)}
                />
              );
            }
          })}
        </div>
      </div>
    </div>
  );
}
