import React, { useEffect, useMemo, useState } from 'react';
import { API_URL } from '../config';
import { VideoCard } from '../components/VideoCard';
import { BookCard } from '../components/BookCard';
import { FilterDropdown } from '../components/FilterDropdown';

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

// Content type filter config
const TYPE_FILTERS = [
  { label: 'All', value: 'all' },
  { label: 'Books', value: 'book' },
  { label: 'Comics', value: 'comic' },
  { label: 'Art', value: 'art' },
  { label: 'Film', value: 'film', comingSoon: true },
  { label: 'Music', value: 'music', comingSoon: true },
];

// Genre filter config - for content genre (fantasy, scifi, etc.)
const GENRE_FILTERS = [
  { label: 'All Genres', value: 'all' },
  { label: 'Fantasy', value: 'fantasy' },
  { label: 'Sci-Fi', value: 'scifi' },
  { label: 'Drama', value: 'drama' },
  { label: 'Comedy', value: 'comedy' },
  { label: 'Nonfiction', value: 'nonfiction' },
];

// Sort options for content ordering
const SORT_OPTIONS = [
  { label: 'Newest', value: 'newest' },
  { label: 'Most Popular', value: 'popular' },
  { label: 'Highest Rated', value: 'rated' },
  { label: 'Best Sellers', value: 'bestsellers' },
];


export default function HomePage() {
  const [items, setItems] = useState<Item[]>([]);
  const [bookProjects, setBookProjects] = useState<BookProject[]>([]);
  const [selectedType, setSelectedType] = useState('all');
  const [selectedGenre, setSelectedGenre] = useState('all');
  const [selectedSort, setSelectedSort] = useState('newest');

  useEffect(()=>{
    const abortController = new AbortController();

    // Build query params
    const genreParam = selectedGenre !== 'all' ? `&genre=${selectedGenre}` : '';

    // Fetch regular content (art, film, music - excludes books which are shown aggregated)
    const contentPromise = fetch(`${API_URL}/api/content/?sort=${selectedSort}${genreParam}`, {
      credentials: 'include',
      signal: abortController.signal,
    })
      .then(r=>r.json())
      .then(data => {
        // Handle paginated response from DRF
        if (data && Array.isArray(data.results)) {
          // Filter out book content - we'll show aggregated books instead
          return data.results.filter((item: Item) => item.content_type !== 'book');
        } else if (Array.isArray(data)) {
          return data.filter((item: Item) => item.content_type !== 'book');
        }
        return [];
      });

    // Fetch aggregated book projects
    const booksPromise = fetch(`${API_URL}/api/book-projects/public/?sort=${selectedSort}${genreParam}`, {
      credentials: 'include',
      signal: abortController.signal,
    })
      .then(r=>r.json())
      .then(data => Array.isArray(data) ? data : []);

    // Wait for both requests
    Promise.all([contentPromise, booksPromise])
      .then(([contentItems, books]) => {
        setItems(contentItems);
        setBookProjects(books);
      })
      .catch((err)=>{
        if (err.name !== 'AbortError') {
          setItems([]);
          setBookProjects([]);
        }
      });

    return () => abortController.abort();
  },[selectedSort, selectedGenre]);

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

  // Create unified list with sorting info
  type DisplayItem = {
    type: 'content' | 'book';
    data: Item | BookProject;
  };

  const allItems: DisplayItem[] = useMemo(() => {
    // Get sort value based on selected sort option
    const getSortValue = (item: DisplayItem): number => {
      if (item.type === 'book') {
        const book = item.data as BookProject;
        switch (selectedSort) {
          case 'popular':
            return book.total_views || 0;
          case 'rated':
            // Sort by rating first, then by count for tiebreaker
            return (book.average_rating || 0) * 10000 + (book.rating_count || 0);
          case 'bestsellers':
            // Books don't have purchase_count on frontend, use views as proxy
            return book.total_views || 0;
          case 'newest':
          default:
            return book.created_at ? new Date(book.created_at).getTime() : 0;
        }
      } else {
        const content = item.data as Item;
        switch (selectedSort) {
          case 'popular':
            return content.view_count || 0;
          case 'rated':
            // Sort by rating first, then by count for tiebreaker
            return (content.average_rating || 0) * 10000 + (content.rating_count || 0);
          case 'bestsellers':
            // Content doesn't have purchase_count on frontend, use views as proxy
            return content.view_count || 0;
          case 'newest':
          default:
            return content.created_at ? new Date(content.created_at).getTime() : 0;
        }
      }
    };

    const result: DisplayItem[] = [];

    // Add regular content items
    items.forEach(it => {
      result.push({
        type: 'content',
        data: it,
      });
    });

    // Add book projects
    bookProjects.forEach(book => {
      result.push({
        type: 'book',
        data: book,
      });
    });

    // Sort based on selected sort option (descending)
    result.sort((a, b) => getSortValue(b) - getSortValue(a));

    return result;
  }, [items, bookProjects, selectedSort]);

  // Apply filter
  const filtered = useMemo(()=>{
    if (selectedType === 'all') return allItems;

    return allItems.filter(item => {
      if (item.type === 'book') {
        return selectedType === 'book';
      } else {
        return (item.data as Item).content_type === selectedType;
      }
    });
  },[allItems, selectedType]);

  return (
    <div>
      {/* Filter Bar - single row with tabs + dropdowns */}
      <div className="filter-bar">
        {/* Primary content type tabs */}
        <div className="filter-tabs">
          {TYPE_FILTERS.map(f => (
            <button
              key={f.value}
              className={`filter-tab ${selectedType === f.value ? 'active' : ''}`}
              onClick={() => !f.comingSoon && setSelectedType(f.value)}
              disabled={f.comingSoon}
            >
              {f.label}
              {f.comingSoon && (
                <span className="coming-soon-badge">Soon</span>
              )}
            </button>
          ))}
        </div>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Dropdown filters */}
        <FilterDropdown
          label="Genre"
          value={selectedGenre}
          options={GENRE_FILTERS}
          onChange={setSelectedGenre}
        />
        <FilterDropdown
          label="Sort"
          value={selectedSort}
          options={SORT_OPTIONS}
          onChange={setSelectedSort}
        />
      </div>

      <div className="page" style={{padding:0, background:'transparent', border:'none', boxShadow:'none'}}>
        <div className="yt-grid">
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
