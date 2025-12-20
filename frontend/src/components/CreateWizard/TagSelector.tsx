import React, { useState, useEffect, useMemo } from 'react';
import { API_URL } from '../../config';
import { X, Plus, Search, ChevronDown, ChevronUp } from 'lucide-react';

interface Tag {
  id: number;
  name: string;
  slug: string;
  category: 'genre' | 'theme' | 'mood' | 'custom';
  is_predefined: boolean;
  usage_count: number;
}

interface TagSelectorProps {
  selectedIds: number[];
  onChange: (ids: number[]) => void;
  maxTags?: number;
}

async function fetchCsrf(): Promise<string> {
  try {
    const res = await fetch(`${API_URL}/api/auth/csrf/`, { credentials: 'include' });
    const data = await res.json();
    return data?.csrfToken || '';
  } catch {
    return '';
  }
}

export default function TagSelector({ selectedIds, onChange, maxTags = 10 }: TagSelectorProps) {
  const [tags, setTags] = useState<Tag[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showAllTags, setShowAllTags] = useState(false);

  // Fetch predefined tags on mount
  useEffect(() => {
    fetch(`${API_URL}/api/tags/?predefined=true`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        const tagsArray = Array.isArray(data) ? data : (data?.results || []);
        setTags(tagsArray);
      })
      .catch(() => setTags([]))
      .finally(() => setLoading(false));
  }, []);

  // Suggested tags - top 2 from each category (6 total)
  const suggestedTags = useMemo(() => {
    const genres = tags.filter(t => t.category === 'genre').slice(0, 2);
    const themes = tags.filter(t => t.category === 'theme').slice(0, 2);
    const moods = tags.filter(t => t.category === 'mood').slice(0, 2);
    return [...genres, ...themes, ...moods];
  }, [tags]);

  // Filtered tags based on search
  const filteredTags = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    return tags.filter(t =>
      t.name.toLowerCase().includes(query) &&
      !selectedIds.includes(t.id)
    ).slice(0, 8);
  }, [tags, searchQuery, selectedIds]);

  // Group tags by category for browse all view
  const groupedTags = useMemo(() => ({
    genre: tags.filter(t => t.category === 'genre'),
    theme: tags.filter(t => t.category === 'theme'),
    mood: tags.filter(t => t.category === 'mood'),
  }), [tags]);

  const toggleTag = (id: number) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter(i => i !== id));
    } else if (selectedIds.length < maxTags) {
      onChange([...selectedIds, id]);
      setSearchQuery('');
    }
  };

  const addCustomTag = async () => {
    const name = searchQuery.trim();
    if (!name || creating || selectedIds.length >= maxTags) return;

    // Check if tag already exists
    const existing = tags.find(t => t.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      if (!selectedIds.includes(existing.id)) {
        onChange([...selectedIds, existing.id]);
      }
      setSearchQuery('');
      return;
    }

    setCreating(true);
    try {
      const csrf = await fetchCsrf();
      const res = await fetch(`${API_URL}/api/tags/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrf,
        },
        body: JSON.stringify({ name }),
        credentials: 'include',
      });

      if (res.ok) {
        const newTag = await res.json();
        if (!tags.find(t => t.id === newTag.id)) {
          setTags([...tags, newTag]);
        }
        if (!selectedIds.includes(newTag.id)) {
          onChange([...selectedIds, newTag.id]);
        }
        setSearchQuery('');
      }
    } catch (err) {
      console.error('Failed to create tag:', err);
    } finally {
      setCreating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredTags.length > 0) {
        toggleTag(filteredTags[0].id);
      } else if (searchQuery.trim()) {
        addCustomTag();
      }
    }
  };

  const selectedTags = tags.filter(t => selectedIds.includes(t.id));
  const isAtLimit = selectedIds.length >= maxTags;

  if (loading) {
    return (
      <div className="tag-selector">
        <div className="tag-loading">Loading tags...</div>
      </div>
    );
  }

  return (
    <div className="tag-selector">
      {/* Selected tags */}
      {selectedTags.length > 0 && (
        <div className="selected-tags">
          {selectedTags.map(tag => (
            <span key={tag.id} className="tag-chip selected">
              {tag.name}
              <button type="button" onClick={() => toggleTag(tag.id)} aria-label={`Remove ${tag.name}`}>
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Search input */}
      <div className="tag-search">
        <Search size={16} className="search-icon" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isAtLimit ? 'Max tags reached' : 'Search or add tags...'}
          disabled={isAtLimit}
        />
        {searchQuery.trim() && !isAtLimit && (
          <button
            type="button"
            className="add-custom-btn"
            onClick={addCustomTag}
            disabled={creating}
          >
            <Plus size={14} />
            Add
          </button>
        )}
      </div>

      {/* Search results */}
      {searchQuery.trim() && filteredTags.length > 0 && (
        <div className="tag-search-results">
          {filteredTags.map(tag => (
            <button
              key={tag.id}
              type="button"
              className="tag-chip"
              onClick={() => toggleTag(tag.id)}
            >
              {tag.name}
              <span className="tag-category-hint">{tag.category}</span>
            </button>
          ))}
        </div>
      )}

      {/* Suggested tags (when not searching) */}
      {!searchQuery.trim() && !showAllTags && (
        <div className="suggested-tags">
          <div className="suggested-header">
            <span>Suggested</span>
            <button
              type="button"
              className="browse-all-btn"
              onClick={() => setShowAllTags(true)}
            >
              Browse all <ChevronDown size={14} />
            </button>
          </div>
          <div className="tag-chips">
            {suggestedTags.map(tag => (
              <button
                key={tag.id}
                type="button"
                className={`tag-chip ${selectedIds.includes(tag.id) ? 'active' : ''}`}
                onClick={() => toggleTag(tag.id)}
                disabled={!selectedIds.includes(tag.id) && isAtLimit}
              >
                {tag.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Browse all tags */}
      {!searchQuery.trim() && showAllTags && (
        <div className="all-tags">
          <button
            type="button"
            className="collapse-btn"
            onClick={() => setShowAllTags(false)}
          >
            <ChevronUp size={14} /> Hide categories
          </button>
          {Object.entries(groupedTags).map(([category, categoryTags]) => (
            categoryTags.length > 0 && (
              <div key={category} className="tag-category">
                <h4>{category.charAt(0).toUpperCase() + category.slice(1)}</h4>
                <div className="tag-chips">
                  {categoryTags.map(tag => (
                    <button
                      key={tag.id}
                      type="button"
                      className={`tag-chip ${selectedIds.includes(tag.id) ? 'active' : ''}`}
                      onClick={() => toggleTag(tag.id)}
                      disabled={!selectedIds.includes(tag.id) && isAtLimit}
                    >
                      {tag.name}
                    </button>
                  ))}
                </div>
              </div>
            )
          ))}
        </div>
      )}

      {/* Tag count */}
      <p className="tag-limit-hint">
        {selectedIds.length}/{maxTags} tags
      </p>
    </div>
  );
}
