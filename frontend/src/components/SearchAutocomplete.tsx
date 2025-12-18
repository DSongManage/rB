import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Clock, TrendingUp, X } from 'lucide-react';
import { API_URL } from '../config';

type Suggestion = {
  id: number;
  title: string;
  creator_username?: string;
  content_type?: string;
};

type Props = {
  onSearch?: (query: string) => void;
};

const RECENT_SEARCHES_KEY = 'rb_recent_searches';
const MAX_RECENT_SEARCHES = 5;

export function SearchAutocomplete({ onSearch }: Props) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Load recent searches from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
      if (stored) {
        setRecentSearches(JSON.parse(stored));
      }
    } catch {}
  }, []);

  // Save recent search
  const saveRecentSearch = (search: string) => {
    if (!search.trim()) return;
    const updated = [search, ...recentSearches.filter(s => s !== search)].slice(0, MAX_RECENT_SEARCHES);
    setRecentSearches(updated);
    try {
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
    } catch {}
  };

  // Remove recent search
  const removeRecentSearch = (search: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = recentSearches.filter(s => s !== search);
    setRecentSearches(updated);
    try {
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
    } catch {}
  };

  // Fetch suggestions (debounced)
  useEffect(() => {
    if (query.length < 2) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(() => {
      setLoading(true);
      fetch(`${API_URL}/api/search/?q=${encodeURIComponent(query)}`, { credentials: 'include' })
        .then(r => r.json())
        .then(data => {
          if (Array.isArray(data)) {
            setSuggestions(data.slice(0, 6));
          }
        })
        .catch(() => setSuggestions([]))
        .finally(() => setLoading(false));
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle search submission
  const handleSearch = (searchQuery: string) => {
    if (!searchQuery.trim()) return;
    saveRecentSearch(searchQuery.trim());
    setIsOpen(false);
    setQuery(searchQuery);
    if (onSearch) {
      onSearch(searchQuery);
    } else {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    const items = query.length >= 2 ? suggestions : recentSearches;
    const totalItems = items.length;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => (prev < totalItems - 1 ? prev + 1 : prev));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < totalItems) {
          const selected = query.length >= 2
            ? suggestions[selectedIndex]?.title
            : recentSearches[selectedIndex];
          if (selected) handleSearch(selected);
        } else {
          handleSearch(query);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        inputRef.current?.blur();
        break;
    }
  };

  // Reset selection when suggestions change
  useEffect(() => {
    setSelectedIndex(-1);
  }, [suggestions, recentSearches]);

  const showDropdown = isOpen && (query.length >= 2 ? suggestions.length > 0 : recentSearches.length > 0);

  return (
    <div ref={containerRef} className="search-autocomplete" style={{ position: 'relative', width: '100%' }}>
      <form
        onSubmit={(e) => { e.preventDefault(); handleSearch(query); }}
        className="rb-search"
      >
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search"
          autoComplete="off"
        />
        <button type="submit">
          <Search size={18} />
        </button>
      </form>

      {/* Dropdown */}
      {showDropdown && (
        <div className="search-dropdown" style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          marginTop: 4,
          background: '#1e293b',
          borderRadius: 8,
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
          zIndex: 1000,
          overflow: 'hidden',
          border: '1px solid #334155',
        }}>
          {query.length >= 2 ? (
            // Show search suggestions
            <>
              {suggestions.map((item, index) => (
                <div
                  key={item.id}
                  onClick={() => handleSearch(item.title)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '10px 16px',
                    cursor: 'pointer',
                    background: selectedIndex === index ? '#334155' : 'transparent',
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <Search size={16} style={{ color: '#64748b', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      color: '#f1f5f9',
                      fontSize: 14,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}>
                      {item.title}
                    </div>
                    {item.creator_username && (
                      <div style={{ color: '#64748b', fontSize: 12 }}>
                        by {item.creator_username}
                      </div>
                    )}
                  </div>
                  {item.content_type && (
                    <span style={{
                      fontSize: 10,
                      padding: '2px 6px',
                      background: '#334155',
                      borderRadius: 4,
                      color: '#94a3b8',
                      textTransform: 'capitalize',
                    }}>
                      {item.content_type}
                    </span>
                  )}
                </div>
              ))}
            </>
          ) : (
            // Show recent searches
            <>
              <div style={{
                padding: '8px 16px',
                fontSize: 12,
                color: '#64748b',
                borderBottom: '1px solid #334155',
              }}>
                Recent searches
              </div>
              {recentSearches.map((search, index) => (
                <div
                  key={search}
                  onClick={() => handleSearch(search)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '10px 16px',
                    cursor: 'pointer',
                    background: selectedIndex === index ? '#334155' : 'transparent',
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <Clock size={16} style={{ color: '#64748b', flexShrink: 0 }} />
                  <span style={{ flex: 1, color: '#f1f5f9', fontSize: 14 }}>
                    {search}
                  </span>
                  <button
                    onClick={(e) => removeRecentSearch(search, e)}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 4,
                      cursor: 'pointer',
                      color: '#64748b',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
