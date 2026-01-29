import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { libraryApi, type Library } from '../services/libraryApi';
import { LibraryItemCard } from './LibraryItemCard';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

export function LibrarySidebar() {
  const [library, setLibrary] = useState<Library | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);
  const [selectedTab, setSelectedTab] = useState<keyof Library>('books');
  const { isAuthenticated } = useAuth();

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
      // Auto-select first tab with content
      const tabs: (keyof Library)[] = ['books', 'art', 'comics'];
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
          background: 'var(--bg-card)',
          borderRight: '1px solid var(--panel-border-strong)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '12px 0',
          zIndex: 40,
        }}
      >
        <button
          onClick={() => setIsExpanded(true)}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: 8,
            borderRadius: 8,
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--chip-bg)';
            e.currentTarget.style.color = 'var(--text)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = 'var(--text-muted)';
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
            color: 'var(--text-muted)',
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

  const currentItems = library?.[selectedTab] || [];

  return (
    <div
      data-tour="library-sidebar"
      style={{
        position: 'fixed',
        left: 0,
        top: 72,
        bottom: 0,
        width: 320,
        background: 'var(--bg-card)',
        borderRight: '1px solid var(--panel-border-strong)',
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
          borderBottom: '1px solid var(--panel-border-strong)',
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
              color: 'var(--text)',
            }}
          >
            My Library
          </div>
          <div
            style={{
              fontSize: 12,
              color: 'var(--text-muted)',
              marginTop: 2,
            }}
          >
            {totalItems} {totalItems === 1 ? 'item' : 'items'}
          </div>
        </div>
        <button
          onClick={() => setIsExpanded(false)}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: 8,
            borderRadius: 8,
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--chip-bg)';
            e.currentTarget.style.color = 'var(--text)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = 'var(--text-muted)';
          }}
          aria-label="Collapse library"
        >
          <ChevronLeft size={20} />
        </button>
      </div>

      {/* Tabs */}
      <div
        data-tour="library-tabs"
        style={{
          display: 'flex',
          gap: 4,
          padding: '12px 16px',
          borderBottom: '1px solid var(--panel-border-strong)',
          overflowX: 'auto',
        }}
      >
        {(['books', 'art', 'comics'] as const).map((tab) => {
          const count = library?.[tab]?.length || 0;
          // Only show tabs that have content
          if (count === 0) return null;
          const isActive = selectedTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setSelectedTab(tab)}
              style={{
                background: isActive ? 'var(--accent)' : 'var(--chip-bg)',
                border: '1px solid',
                borderColor: isActive ? 'var(--accent)' : 'var(--panel-border-strong)',
                color: isActive ? '#111827' : 'var(--text-dim)',
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
                  e.currentTarget.style.background = 'var(--header-bg)';
                  e.currentTarget.style.borderColor = 'var(--subtle)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'var(--chip-bg)';
                  e.currentTarget.style.borderColor = 'var(--panel-border-strong)';
                }
              }}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)} ({count})
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div
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
              color: 'var(--text-muted)',
              fontSize: 14,
            }}
          >
            Loading library...
          </div>
        )}

        {error && (
          <div
            style={{
              background: 'var(--error-bg)',
              border: '1px solid var(--error-text)',
              borderRadius: 8,
              padding: 16,
              color: 'var(--error-text)',
              fontSize: 14,
            }}
          >
            {error}
            <button
              onClick={loadLibrary}
              style={{
                marginTop: 8,
                background: 'var(--accent)',
                color: 'var(--button-text)',
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
              color: 'var(--text-muted)',
              fontSize: 14,
            }}
          >
            No {selectedTab} in your library yet.
          </div>
        )}

        {!loading && !error && currentItems.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {currentItems.map((item, index) => (
              <div key={item.id} data-tour={index === 0 ? 'library-item' : undefined}>
                <LibraryItemCard item={item} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer Links - YouTube style */}
      <div
        style={{
          padding: '12px 16px',
          borderTop: '1px solid var(--panel-border-strong)',
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
            color: 'var(--subtle)',
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
  color: 'var(--subtle)',
  textDecoration: 'none',
  transition: 'color 0.2s',
};
