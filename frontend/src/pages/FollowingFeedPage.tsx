/**
 * Following Feed Page
 *
 * Shows latest content from creators the user follows.
 */

import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, Heart, Clock, Book, Music, Film, Palette, Users } from 'lucide-react';
import { getFollowingFeed, FeedItem, PaginatedResponse } from '../services/socialApi';

const contentTypeIcons: Record<string, React.ReactNode> = {
  book: <Book size={32} color="#94a3b8" />,
  music: <Music size={32} color="#94a3b8" />,
  video: <Film size={32} color="#94a3b8" />,
  art: <Palette size={32} color="#94a3b8" />,
};

function getGradient(title: string): string {
  const gradients = [
    'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
  ];
  const index = title.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % gradients.length;
  return gradients[index];
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
}

export default function FollowingFeedPage() {
  const navigate = useNavigate();
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    const fetchFeed = async () => {
      try {
        setLoading(true);
        const response = await getFollowingFeed(1);
        setFeed(response.results);
        setHasMore(response.next !== null);
        setPage(1);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load feed');
      } finally {
        setLoading(false);
      }
    };

    fetchFeed();
  }, []);

  const loadMore = async () => {
    if (loadingMore || !hasMore) return;

    try {
      setLoadingMore(true);
      const nextPage = page + 1;
      const response = await getFollowingFeed(nextPage);
      setFeed(prev => [...prev, ...response.results]);
      setHasMore(response.next !== null);
      setPage(nextPage);
    } catch (err) {
      console.error('Failed to load more:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#0f172a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#94a3b8',
      }}>
        Loading feed...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#0f172a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#ef4444',
      }}>
        {error}
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0f172a',
      padding: '24px 16px',
    }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{
            color: '#f8fafc',
            fontSize: 28,
            fontWeight: 700,
            marginBottom: 8,
          }}>
            Following Feed
          </h1>
          <p style={{ color: '#94a3b8', fontSize: 15 }}>
            Latest drops from creators you follow
          </p>
        </div>

        {/* Empty State */}
        {feed.length === 0 && (
          <div style={{
            textAlign: 'center',
            padding: '60px 20px',
            background: '#1e293b',
            borderRadius: 16,
          }}>
            <Users size={48} color="#64748b" style={{ marginBottom: 16 }} />
            <h2 style={{ color: '#f8fafc', fontSize: 20, fontWeight: 600, marginBottom: 8 }}>
              No content yet
            </h2>
            <p style={{ color: '#94a3b8', marginBottom: 24 }}>
              Follow some creators to see their latest drops here
            </p>
            <button
              onClick={() => navigate('/search')}
              style={{
                background: '#f59e0b',
                color: '#111',
                border: 'none',
                padding: '12px 24px',
                borderRadius: 8,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Discover Creators
            </button>
          </div>
        )}

        {/* Feed Items */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {feed.map(item => (
            <Link
              key={item.id}
              to={`/content/${item.id}`}
              style={{
                display: 'flex',
                background: '#1e293b',
                borderRadius: 12,
                overflow: 'hidden',
                textDecoration: 'none',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.2)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              {/* Cover Image */}
              <div style={{
                width: 160,
                minHeight: 120,
                background: item.cover_image
                  ? `url(${item.cover_image}) center/cover`
                  : getGradient(item.title),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                {!item.cover_image && contentTypeIcons[item.content_type]}
              </div>

              {/* Content */}
              <div style={{ flex: 1, padding: 16, minWidth: 0 }}>
                {/* Creator */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 8,
                }}>
                  {item.creator.avatar ? (
                    <img
                      src={item.creator.avatar}
                      alt={item.creator.display_name}
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: '50%',
                        objectFit: 'cover',
                      }}
                    />
                  ) : (
                    <div style={{
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      background: '#334155',
                    }} />
                  )}
                  <span style={{ color: '#94a3b8', fontSize: 13 }}>
                    {item.creator.display_name}
                  </span>
                  <span style={{ color: '#64748b', fontSize: 12 }}>
                    @{item.creator.username}
                  </span>
                </div>

                {/* Title */}
                <h3 style={{
                  color: '#f8fafc',
                  fontSize: 16,
                  fontWeight: 600,
                  marginBottom: 8,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {item.title}
                </h3>

                {/* Meta */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  fontSize: 13,
                  color: '#64748b',
                }}>
                  <span style={{
                    background: 'rgba(59,130,246,0.15)',
                    color: '#60a5fa',
                    padding: '2px 8px',
                    borderRadius: 4,
                    fontSize: 11,
                  }}>
                    {item.content_type}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Eye size={14} /> {item.view_count}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Heart size={14} /> {item.like_count}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Clock size={14} /> {formatTimeAgo(item.created_at)}
                  </span>
                </div>

                {/* Price */}
                <div style={{
                  marginTop: 12,
                  color: '#10b981',
                  fontSize: 15,
                  fontWeight: 600,
                }}>
                  ${parseFloat(item.price_usd).toFixed(2)}
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Load More */}
        {hasMore && (
          <div style={{ textAlign: 'center', marginTop: 32 }}>
            <button
              onClick={loadMore}
              disabled={loadingMore}
              style={{
                background: '#334155',
                color: '#f8fafc',
                border: 'none',
                padding: '12px 32px',
                borderRadius: 8,
                fontWeight: 600,
                cursor: loadingMore ? 'not-allowed' : 'pointer',
                opacity: loadingMore ? 0.7 : 1,
              }}
            >
              {loadingMore ? 'Loading...' : 'Load More'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
