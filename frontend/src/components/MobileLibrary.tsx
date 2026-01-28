import React, { useState, useEffect } from 'react';
import { libraryApi, type Library } from '../services/libraryApi';
import { MobileLibraryCard } from './MobileLibraryCard';
import { BookOpen, Image, BookMarked, Film, Music, ArrowUpDown, Search, X, ChevronDown, ChevronUp, Library as LibraryIcon } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

type SortOption = 'recent' | 'progress' | 'az';

const TAB_ICONS = {
  books: BookOpen,
  art: Image,
  comics: BookMarked,
  film: Film,
  music: Music,
};

export function MobileLibrary() {
  const [library, setLibrary] = useState<Library | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState<'books' | 'art' | 'comics'>('books');
  const [sortBy, setSortBy] = useState<SortOption>(() => {
    const saved = localStorage.getItem('library-sort');
    return (saved as SortOption) || 'recent';
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    const saved = localStorage.getItem('mobile-library-collapsed');
    return saved === 'true';
  });
  const { isAuthenticated } = useAuth();

  // Save collapsed preference
  const toggleCollapsed = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem('mobile-library-collapsed', String(newState));
  };

  // Save sort preference to localStorage
  const handleSortChange = (newSort: SortOption) => {
    setSortBy(newSort);
    localStorage.setItem('library-sort', newSort);
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadLibrary();
    } else {
      setLibrary(null);
      setLoading(false);
      setError(null);
    }
  }, [isAuthenticated]);

  const loadLibrary = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await libraryApi.getLibrary();
      setLibrary(data);
      // Auto-select first tab with content
      const tabs: ('books' | 'art' | 'comics')[] = ['books', 'art', 'comics'];
      const firstTabWithContent = tabs.find(tab => data[tab]?.length > 0);
      if (firstTabWithContent) {
        setSelectedTab(firstTabWithContent);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load library');
      console.error('Library load error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated) {
    return null;
  }

  const totalItems = library
    ? Object.values(library).reduce((sum, items) => sum + items.length, 0)
    : 0;

  // Apply sorting to current items
  const sortItems = (items: Library['books']) => {
    return [...items].sort((a, b) => {
      switch (sortBy) {
        case 'progress':
          return b.progress - a.progress;
        case 'az':
          return a.title.localeCompare(b.title);
        case 'recent':
        default:
          // Sort by last_read_at first, then purchased_at
          if (a.last_read_at && b.last_read_at) {
            return new Date(b.last_read_at).getTime() - new Date(a.last_read_at).getTime();
          }
          if (a.last_read_at) return -1;
          if (b.last_read_at) return 1;
          return new Date(b.purchased_at).getTime() - new Date(a.purchased_at).getTime();
      }
    });
  };

  const currentItems = library?.[selectedTab]
    ? sortItems(library[selectedTab]).filter(item =>
        searchQuery === '' || item.title.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  // Get in-progress items (1-99% progress) for Continue Reading section
  const continueReadingItems = library
    ? Object.values(library)
        .flat()
        .filter(item => item.progress > 0 && item.progress < 100)
        .sort((a, b) => {
          // Sort by last_read_at (most recent first)
          if (a.last_read_at && b.last_read_at) {
            return new Date(b.last_read_at).getTime() - new Date(a.last_read_at).getTime();
          }
          if (a.last_read_at) return -1;
          if (b.last_read_at) return 1;
          return b.progress - a.progress; // Fallback: higher progress first
        })
        .slice(0, 3)
    : [];

  // If library is empty, don't show the section
  if (!loading && !error && totalItems === 0) {
    return null;
  }

  return (
    <div
      style={{
        background: '#0a0f1a',
        padding: isCollapsed ? '12px 16px' : '20px 16px',
        marginBottom: 16,
        transition: 'padding 0.2s ease',
      }}
    >
      {/* Collapsible Header */}
      <button
        onClick={toggleCollapsed}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          width: '100%',
          background: 'transparent',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          marginBottom: isCollapsed ? 0 : 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <LibraryIcon size={20} style={{ color: '#f59e0b' }} />
          <div style={{ textAlign: 'left' }}>
            <h2
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: '#e5e7eb',
                margin: 0,
              }}
            >
              My Library
            </h2>
            {isCollapsed && (
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                {totalItems} {totalItems === 1 ? 'item' : 'items'} • Tap to expand
              </div>
            )}
          </div>
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          color: '#94a3b8',
        }}>
          {!isCollapsed && (
            <span style={{ fontSize: 12 }}>
              {totalItems} {totalItems === 1 ? 'item' : 'items'}
            </span>
          )}
          {isCollapsed ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
        </div>
      </button>

      {/* Collapsible Content */}
      {!isCollapsed && (
        <>

      {/* Search */}
      <div style={{ marginBottom: 16 }}>
        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <Search size={16} style={{ position: 'absolute', left: 12, color: '#64748b' }} />
          <input
            type="text"
            placeholder="Search library..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              background: '#111827',
              border: '1px solid #2a3444',
              borderRadius: 10,
              padding: '10px 36px 10px 40px',
              fontSize: 14,
              color: '#e5e7eb',
              outline: 'none',
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{
                position: 'absolute',
                right: 10,
                background: 'transparent',
                border: 'none',
                color: '#64748b',
                cursor: 'pointer',
                padding: 4,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Continue Reading Section */}
      {continueReadingItems.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: '#f59e0b',
              marginBottom: 10,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <BookOpen size={16} />
            Continue Reading
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 12,
            }}
          >
            {continueReadingItems.map((item) => (
              <MobileLibraryCard key={`continue-${item.id}`} item={item} />
            ))}
          </div>
        </div>
      )}

      {/* Horizontal scrollable tabs */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
          paddingBottom: 8,
          marginBottom: 16,
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        {/* Only show tabs that have content */}
        {(['books', 'art', 'comics'] as const).map((tab) => {
          const count = library?.[tab]?.length || 0;
          // Only show tabs that have content
          if (count === 0) return null;
          const isActive = selectedTab === tab;
          const Icon = TAB_ICONS[tab];

          return (
            <button
              key={tab}
              onClick={() => setSelectedTab(tab)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: isActive ? '#f59e0b' : '#111827',
                border: '1px solid',
                borderColor: isActive ? '#f59e0b' : '#2a3444',
                color: isActive ? '#111827' : '#cbd5e1',
                padding: '10px 16px',
                borderRadius: 20,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                transition: 'all 0.2s ease',
              }}
            >
              <Icon size={16} />
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              <span
                style={{
                  background: isActive ? 'rgba(0,0,0,0.2)' : '#2a3444',
                  padding: '2px 8px',
                  borderRadius: 10,
                  fontSize: 11,
                }}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Sort dropdown */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 16,
        }}
      >
        <ArrowUpDown size={14} style={{ color: '#64748b' }} />
        <select
          value={sortBy}
          onChange={(e) => handleSortChange(e.target.value as SortOption)}
          style={{
            background: '#111827',
            border: '1px solid #2a3444',
            borderRadius: 8,
            padding: '6px 10px',
            fontSize: 13,
            color: '#cbd5e1',
            cursor: 'pointer',
          }}
        >
          <option value="recent">Recent</option>
          <option value="progress">Progress</option>
          <option value="az">A-Z</option>
        </select>
      </div>

      {/* Content */}
      {loading && (
        <div
          style={{
            textAlign: 'center',
            padding: 32,
            color: '#94a3b8',
            fontSize: 14,
          }}
        >
          Loading library...
        </div>
      )}

      {error && (
        <div
          style={{
            background: '#ef444420',
            border: '1px solid #ef4444',
            borderRadius: 12,
            padding: 16,
            color: '#fca5a5',
            fontSize: 14,
          }}
        >
          {error}
          <button
            onClick={loadLibrary}
            style={{
              marginTop: 8,
              display: 'block',
              background: '#ef4444',
              color: '#fff',
              border: 'none',
              padding: '8px 16px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !error && currentItems.length === 0 && (
        <div
          style={{
            textAlign: 'center',
            padding: 32,
            color: '#94a3b8',
            fontSize: 14,
          }}
        >
          {searchQuery
              ? `No results for "${searchQuery}"`
              : `No ${selectedTab} in your library yet.`}
        </div>
      )}

      {!loading && !error && currentItems.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 12,
          }}
        >
          {currentItems.map((item) => (
            <MobileLibraryCard key={item.id} item={item} />
          ))}
        </div>
      )}
        </>
      )}
    </div>
  );
}
