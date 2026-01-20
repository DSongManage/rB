import React, { memo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, ChevronUp, ChevronDown, ThumbsUp, BookOpen } from 'lucide-react';
import { StarRatingDisplay } from './StarRatingDisplay';

type BookChapter = {
  id: number;
  title: string;
  order: number;
  content_id: number;
  price_usd: number;
  view_count: number;
  editions?: number;
};

type Props = {
  id: number;
  title: string;
  coverImageUrl: string;
  author: string;
  chapters: BookChapter[];
  publishedChapters: number;
  totalViews: number;
  totalLikes: number;
  totalPrice: number;
  averageRating: number | null;
  ratingCount: number;
  timeText: string;
};

// Format count (1.2K, 1.5M, etc.)
function formatCount(count: number): string {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`;
  } else if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return `${count}`;
}

function BookCardComponent({
  id,
  title,
  coverImageUrl,
  author,
  chapters,
  publishedChapters,
  totalViews,
  totalLikes,
  totalPrice,
  averageRating,
  ratingCount,
  timeText,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const navigate = useNavigate();

  const firstChapter = chapters.find(ch => ch.content_id);
  const hasMultipleChapters = publishedChapters > 1;

  // Popularity indicators
  const isPopular = totalViews >= 100;
  const isVeryPopular = totalViews >= 1000;

  // Format rating
  const ratingText = averageRating != null && ratingCount > 0
    ? `${Number(averageRating).toFixed(1)} (${formatCount(ratingCount)})`
    : '--';

  const handleViewChapter = (contentId: number) => {
    navigate(`/content/${contentId}`);
  };

  const handleCoverClick = () => {
    if (hasMultipleChapters) {
      // Toggle chapters dropdown for multi-chapter books
      setExpanded(!expanded);
    } else if (firstChapter) {
      // Navigate directly for single-chapter books
      navigate(`/content/${firstChapter.content_id}`);
    }
  };

  return (
    <div
      className="yt-card"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--panel-border-strong)',
        borderRadius: 16,
        overflow: 'hidden',
        transition: 'all 0.2s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-4px)';
        e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.25)';
        e.currentTarget.style.borderColor = 'var(--border)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'none';
        e.currentTarget.style.borderColor = 'var(--panel-border-strong)';
      }}
    >
      {/* Cover Image */}
      <div
        onClick={handleCoverClick}
        style={{
          width: '100%',
          paddingTop: '56.25%', // 16:9 ratio
          background: coverImageUrl
            ? `url(${coverImageUrl})`
            : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          position: 'relative',
          cursor: 'pointer',
        }}
      >
        {!coverImageUrl && (
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            color: 'rgba(255,255,255,0.3)',
          }}>
            <BookOpen size={48} />
          </div>
        )}

        {/* Chapter count badge - only show for multiple chapters */}
        {hasMultipleChapters && (
          <div style={{
            position: 'absolute',
            top: 8,
            right: 8,
            background: 'rgba(0,0,0,0.85)',
            backdropFilter: 'blur(4px)',
            padding: '4px 10px',
            borderRadius: 12,
            fontSize: 12,
            fontWeight: 600,
            color: '#f8fafc',
          }}>
            {publishedChapters} chapters
          </div>
        )}

        {/* Price badge */}
        {totalPrice > 0 && (
          <div style={{
            position: 'absolute',
            top: hasMultipleChapters ? 40 : 8,
            right: 8,
            background: 'rgba(0,0,0,0.8)',
            backdropFilter: 'blur(4px)',
            padding: '4px 8px',
            borderRadius: 4,
            fontSize: 12,
            fontWeight: 700,
            color: '#10b981',
          }}>
            ${totalPrice.toFixed(2)}
          </div>
        )}
      </div>

      {/* Card Content */}
      <div style={{ padding: 16 }}>
        {/* Title with views */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 8,
        }}>
          <div style={{
            fontSize: 15,
            fontWeight: 600,
            color: 'var(--text)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
          }}>
            {title}
          </div>
          {totalViews > 0 && (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
              fontSize: 11,
              fontWeight: isVeryPopular ? 700 : isPopular ? 600 : 500,
              color: isVeryPopular ? '#f59e0b' : isPopular ? '#10b981' : 'var(--text-muted)',
              background: isVeryPopular ? 'rgba(245, 158, 11, 0.15)' : isPopular ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
              padding: isPopular ? '2px 6px' : '0',
              borderRadius: 4,
              flexShrink: 0,
            }}>
              <Eye size={12} />
              {formatCount(totalViews)}
            </span>
          )}
        </div>

        {/* Author and meta */}
        <div style={{
          fontSize: 13,
          color: 'var(--text-muted)',
          marginBottom: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          flexWrap: 'wrap',
        }}>
          <Link
            to={`/profile/${author}`}
            style={{ color: '#60a5fa', textDecoration: 'none' }}
            onClick={(e) => e.stopPropagation()}
          >
            {author}
          </Link>
          <span>•</span>
          <StarRatingDisplay rating={averageRating} count={ratingCount} size={11} />
          <span>•</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
            <ThumbsUp size={12} /> {formatCount(totalLikes)}
          </span>
          <span>•</span>
          <span>{timeText}</span>
        </div>

        {/* Expandable chapter list - only for multi-chapter books */}
        {hasMultipleChapters && (
          <>
            <button
              onClick={() => setExpanded(!expanded)}
              style={{
                width: '100%',
                background: 'var(--dropdown-hover)',
                border: 'none',
                borderRadius: 8,
                padding: '8px 12px',
                color: 'var(--text-muted)',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span>Chapters</span>
              {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {expanded && (
              <div style={{
                background: 'var(--bg-input)',
                borderRadius: 8,
                padding: 8,
                marginTop: 8,
                maxHeight: 200,
                overflowY: 'auto',
              }}>
                {chapters.map((chapter, index) => (
                  <div
                    key={chapter.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 10px',
                      borderRadius: 6,
                      background: index % 2 === 0 ? 'transparent' : 'var(--nav-hover-bg)',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 13,
                        color: 'var(--text)',
                        fontWeight: 500,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}>
                        Ch {chapter.order + 1}: {chapter.title}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--subtle)' }}>
                        ${chapter.price_usd.toFixed(2)} • {chapter.view_count} views{chapter.editions !== undefined && chapter.editions !== null && (
                          <> • <span style={{ color: chapter.editions > 0 ? '#10b981' : '#ef4444' }}>
                            {chapter.editions > 0 ? `${chapter.editions} ed.` : 'Sold out'}
                          </span></>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleViewChapter(chapter.content_id);
                      }}
                      style={{
                    background: 'transparent',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    padding: '4px 10px',
                    color: 'var(--text-muted)',
                    fontSize: 11,
                    fontWeight: 500,
                    cursor: 'pointer',
                    marginLeft: 8,
                    flexShrink: 0,
                  }}
                >
                    View
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export const BookCard = memo(BookCardComponent);
