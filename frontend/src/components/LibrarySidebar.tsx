import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { libraryApi, type Library } from '../services/libraryApi';
import { LibraryItemCard } from './LibraryItemCard';
import { ChevronRight, ChevronLeft, BookOpen, Image, BookMarked, Film, Music, ArrowUpDown, Search, X } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

interface LibrarySidebarProps {
  isExpanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
}

type SortOption = 'recent' | 'progress' | 'az';

export function LibrarySidebar({ isExpanded, onExpandedChange }: LibrarySidebarProps) {
  const [library, setLibrary] = useState<Library | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState<keyof Library>('books');
  const [sortBy, setSortBy] = useState<SortOption>(() => {
    const saved = localStorage.getItem('library-sort');
    return (saved as SortOption) || 'recent';
  });
  const [searchQuery, setSearchQuery] = useState('');
  const { isAuthenticated } = useAuth();

  // Save sort preference to localStorage
  const handleSortChange = (newSort: SortOption) => {
    setSortBy(newSort);
    localStorage.setItem('library-sort', newSort);
  };

  useEffect(() => {
    // Only load library if user is authenticated
    if (isAuthenticated) {
      loadLibrary();
    } else {
      // Reset state if user is not authenticated
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load library');
      console.error('Library load error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Don't render anything if not authenticated
  if (!isAuthenticated) {
    return null;
  }

  if (!isExpanded) {
    return (
      <div
        style={{
          position: 'fixed',
          left: 0,
          top: 72,
          bottom: 0,
          width: 48,
          background: '#0b1220',
          borderRight: '1px solid #2a3444',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '12px 0',
          zIndex: 40,
        }}
      >
        <button
          onClick={() => onExpandedChange(true)}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#94a3b8',
            cursor: 'pointer',
            padding: 8,
            borderRadius: 8,
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#111827';
            e.currentTarget.style.color = '#e5e7eb';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = '#94a3b8';
          }}
          aria-label="Expand library"
        >
          <ChevronRight size={20} />
        </button>
        <div
          style={{
            writingMode: 'vertical-rl',
            fontSize: 12,
            fontWeight: 600,
            color: '#94a3b8',
            marginTop: 16,
          }}
        >
          LIBRARY
        </div>
      </div>
    );
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

  return (
    <div
      style={{
        position: 'fixed',
        left: 0,
        top: 72,
        bottom: 0,
        width: 320,
        background: '#0b1220',
        borderRight: '1px solid #2a3444',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 40,
        transition: 'width 0.3s ease',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: 16,
          borderBottom: '1px solid #2a3444',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div>
          <div
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: '#e5e7eb',
            }}
          >
            My Library
          </div>
          <div
            style={{
              fontSize: 12,
              color: '#94a3b8',
              marginTop: 2,
            }}
          >
            {totalItems} {totalItems === 1 ? 'item' : 'items'}
          </div>
        </div>
        <button
          onClick={() => onExpandedChange(false)}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#94a3b8',
            cursor: 'pointer',
            padding: 8,
            borderRadius: 8,
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#111827';
            e.currentTarget.style.color = '#e5e7eb';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = '#94a3b8';
          }}
          aria-label="Collapse library"
        >
          <ChevronLeft size={20} />
        </button>
      </div>

      {/* Search */}
      <div
        style={{
          padding: '8px 16px',
          borderBottom: '1px solid #2a3444',
        }}
      >
        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <Search size={14} style={{ position: 'absolute', left: 10, color: '#64748b' }} />
          <input
            type="text"
            placeholder="Search library..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              background: '#111827',
              border: '1px solid #2a3444',
              borderRadius: 8,
              padding: '8px 32px 8px 32px',
              fontSize: 13,
              color: '#e5e7eb',
              outline: 'none',
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{
                position: 'absolute',
                right: 8,
                background: 'transparent',
                border: 'none',
                color: '#64748b',
                cursor: 'pointer',
                padding: 2,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Continue Reading Section */}
      {continueReadingItems.length > 0 && (
        <div
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid #2a3444',
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: '#f59e0b',
              marginBottom: 10,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <BookOpen size={14} />
            Continue Reading
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {continueReadingItems.map((item) => (
              <LibraryItemCard key={`continue-${item.id}`} item={item} />
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div
        className="library-tabs-scroll"
        style={{
          display: 'flex',
          gap: 4,
          padding: '12px 16px',
          borderBottom: '1px solid #2a3444',
          overflowX: 'auto',
        }}
      >
        {(['books', 'art', 'comics'] as const).map((tab) => {
          const count = library?.[tab]?.length || 0;
          const isActive = selectedTab === tab;
          const Icon = tab === 'books' ? BookOpen : tab === 'art' ? Image : BookMarked;
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
                padding: '6px 12px',
                borderRadius: 18,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = '#1f2937';
                  e.currentTarget.style.borderColor = '#374151';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = '#111827';
                  e.currentTarget.style.borderColor = '#2a3444';
                }
              }}
            >
              <Icon size={14} />
              {tab.charAt(0).toUpperCase() + tab.slice(1)} ({count})
            </button>
          );
        })}
        {/* Coming Soon tabs */}
        {(['film', 'music'] as const).map((tab) => (
          <button
            key={tab}
            disabled
            style={{
              background: '#111827',
              border: '1px solid #2a3444',
              color: '#64748b',
              padding: '6px 12px',
              borderRadius: 18,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'not-allowed',
              whiteSpace: 'nowrap',
              opacity: 0.5,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
            <span style={{
              fontSize: 8,
              background: '#f59e0b',
              color: '#000',
              padding: '1px 3px',
              borderRadius: 2,
              fontWeight: 700,
            }}>
              SOON
            </span>
          </button>
        ))}
      </div>

      {/* Sort dropdown */}
      <div
        style={{
          padding: '8px 16px',
          borderBottom: '1px solid #2a3444',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <ArrowUpDown size={14} style={{ color: '#64748b' }} />
        <select
          value={sortBy}
          onChange={(e) => handleSortChange(e.target.value as SortOption)}
          style={{
            background: '#111827',
            border: '1px solid #2a3444',
            borderRadius: 6,
            padding: '4px 8px',
            fontSize: 12,
            color: '#cbd5e1',
            cursor: 'pointer',
            flex: 1,
          }}
        >
          <option value="recent">Recent</option>
          <option value="progress">Progress</option>
          <option value="az">A-Z</option>
        </select>
      </div>

      {/* Content */}
      <div
        className="library-sidebar-content"
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 16,
        }}
      >
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
              borderRadius: 8,
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
                background: '#ef4444',
                color: '#fff',
                padding: '6px 12px',
                fontSize: 12,
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {currentItems.map((item) => (
              <LibraryItemCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>

      {/* Footer Links - YouTube style */}
      <div
        style={{
          padding: '12px 16px',
          borderTop: '1px solid #2a3444',
          flexShrink: 0,
        }}
      >
        {/* Legal Links Row */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '6px 12px',
            marginBottom: 8,
          }}
        >
          <Link to="/legal/terms" style={footerLinkStyle}>Terms</Link>
          <Link to="/legal/privacy" style={footerLinkStyle}>Privacy</Link>
          <Link to="/legal/content-policy" style={footerLinkStyle}>Content Policy</Link>
          <Link to="/legal/dmca" style={footerLinkStyle}>DMCA</Link>
        </div>
        {/* Support Links Row */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '6px 12px',
            marginBottom: 10,
          }}
        >
          <a href="mailto:support@renaissblock.com" style={footerLinkStyle}>Contact</a>
          <a href="mailto:dmca@renaissblock.com" style={footerLinkStyle}>Report Copyright</a>
        </div>
        {/* Copyright */}
        <div
          style={{
            fontSize: 11,
            color: '#64748b',
          }}
        >
          © {new Date().getFullYear()} renaissBlock
        </div>
      </div>
    </div>
  );
}

const footerLinkStyle: React.CSSProperties = {
  fontSize: 11,
  color: '#64748b',
  textDecoration: 'none',
  transition: 'color 0.2s',
};
// Add hover effect via onMouseEnter/Leave in the JSX or use CSS classes
