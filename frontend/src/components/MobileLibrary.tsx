import React, { useState, useEffect } from 'react';
import { libraryApi, type Library } from '../services/libraryApi';
import { MobileLibraryCard } from './MobileLibraryCard';
import { BookOpen, Image, Film, Music } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

const TAB_ICONS = {
  books: BookOpen,
  art: Image,
  film: Film,
  music: Music,
};

export function MobileLibrary() {
  const [library, setLibrary] = useState<Library | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState<keyof Library>('books');
  const { isAuthenticated } = useAuth();

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

  const currentItems = library?.[selectedTab] || [];

  // If library is empty, don't show the section
  if (!loading && !error && totalItems === 0) {
    return null;
  }

  return (
    <div
      style={{
        background: '#0a0f1a',
        padding: '20px 16px',
        marginBottom: 16,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <div>
          <h2
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: '#e5e7eb',
              margin: 0,
            }}
          >
            My Library
          </h2>
          <div
            style={{
              fontSize: 13,
              color: '#94a3b8',
              marginTop: 2,
            }}
          >
            {totalItems} {totalItems === 1 ? 'item' : 'items'}
          </div>
        </div>
      </div>

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
        {(['books', 'art', 'film', 'music'] as const).map((tab) => {
          const count = library?.[tab]?.length || 0;
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
          No {selectedTab} in your library yet.
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
    </div>
  );
}
