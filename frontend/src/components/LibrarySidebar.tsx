import React, { useState, useEffect } from 'react';
import { libraryApi, type Library } from '../services/libraryApi';
import { LibraryItemCard } from './LibraryItemCard';

export function LibrarySidebar() {
  const [library, setLibrary] = useState<Library | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);
  const [selectedTab, setSelectedTab] = useState<keyof Library>('books');

  useEffect(() => {
    loadLibrary();
  }, []);

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
          onClick={() => setIsExpanded(true)}
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
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M7 4l6 6-6 6" />
          </svg>
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

  const currentItems = library?.[selectedTab] || [];

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
          onClick={() => setIsExpanded(false)}
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
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M13 4l-6 6 6 6" />
          </svg>
        </button>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          gap: 4,
          padding: '12px 16px',
          borderBottom: '1px solid #2a3444',
          overflowX: 'auto',
        }}
      >
        {(['books', 'art', 'film', 'music'] as const).map((tab) => {
          const count = library?.[tab]?.length || 0;
          const isActive = selectedTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setSelectedTab(tab)}
              style={{
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
            No {selectedTab} in your library yet.
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
    </div>
  );
}
