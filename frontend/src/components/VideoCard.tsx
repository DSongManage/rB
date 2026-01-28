import React, { memo } from 'react';
import { Link } from 'react-router-dom';
import { ThumbsUp, Eye, Users } from 'lucide-react';
import { OwnedBadge } from './OwnedBadge';
import { StarRatingDisplay } from './StarRatingDisplay';

type Props = {
  id: number;
  title: string;
  author?: string;
  likeCount?: number;
  viewCount?: number;
  averageRating?: number | null;
  ratingCount?: number;
  timeText?: string;
  thumbnailUrl: string;
  teaser_link?: string;
  price?: number;
  editions?: number;
  owned?: boolean;
  collaborators?: string[]; // Array of collaborator usernames
  isCollaborative?: boolean; // Flag for collaborative content
  chapterCount?: number; // For aggregated books
  linkTo?: string; // Custom link path (for book projects linking to first chapter)
};

// Format like count (1.2K, 1.5M, etc.)
function formatCount(count: number): string {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`;
  } else if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return `${count}`;
}

function VideoCardComponent({ id, title, author = 'Creator', likeCount = 0, viewCount = 0, averageRating, ratingCount = 0, timeText = '2 days ago', thumbnailUrl, teaser_link, price, editions, owned = false, collaborators, isCollaborative = false, chapterCount, linkTo }: Props) {
  const priceNum = typeof price === 'string' ? parseFloat(price) : price;
  const editionsNum = typeof editions === 'string' ? parseInt(editions) : editions;
  const editionsText = editionsNum && editionsNum > 0 ? `${editionsNum} edition${editionsNum > 1 ? 's' : ''} available` : 'Sold out';
  const priceText = priceNum && priceNum > 0 ? `$${priceNum.toFixed(2)}` : 'Free';

  // Format view count with popularity indicator
  const viewsText = formatCount(viewCount);
  const isPopular = viewCount >= 100; // Threshold for "popular" styling
  const isVeryPopular = viewCount >= 1000; // Threshold for "very popular" styling

  // Content link - use custom linkTo if provided (for book projects)
  const contentLink = linkTo || `/content/${id}`;

  // Format rating text
  const ratingText = averageRating != null && ratingCount > 0
    ? `${Number(averageRating).toFixed(1)} (${formatCount(ratingCount)})`
    : '--';

  // Format likes text
  const likesText = formatCount(likeCount);

  // Extract username from author display (remove "Creator #X" format if present, or extract username)
  const authorUsername = author?.startsWith('Creator #') ? null : author;

  // Build clickable author component
  const renderAuthorDisplay = () => {
    if (isCollaborative && collaborators && collaborators.length > 0) {
      if (collaborators.length === 1) {
        return (
          <Link
            to={`/profile/${collaborators[0]}`}
            style={{ color: '#60a5fa', textDecoration: 'none' }}
            onClick={(e) => e.stopPropagation()}
          >
            {collaborators[0]}
          </Link>
        );
      } else if (collaborators.length === 2) {
        return (
          <>
            <Link
              to={`/profile/${collaborators[0]}`}
              style={{ color: '#60a5fa', textDecoration: 'none' }}
              onClick={(e) => e.stopPropagation()}
            >
              {collaborators[0]}
            </Link>
            {' & '}
            <Link
              to={`/profile/${collaborators[1]}`}
              style={{ color: '#60a5fa', textDecoration: 'none' }}
              onClick={(e) => e.stopPropagation()}
            >
              {collaborators[1]}
            </Link>
          </>
        );
      } else {
        return (
          <>
            <Link
              to={`/profile/${collaborators[0]}`}
              style={{ color: '#60a5fa', textDecoration: 'none' }}
              onClick={(e) => e.stopPropagation()}
            >
              {collaborators[0]}
            </Link>
            {` & ${collaborators.length - 1} others`}
          </>
        );
      }
    }

    // Non-collaborative content - single author
    if (authorUsername) {
      return (
        <Link
          to={`/profile/${authorUsername}`}
          style={{ color: '#60a5fa', textDecoration: 'none' }}
          onClick={(e) => e.stopPropagation()}
        >
          {author}
        </Link>
      );
    }

    return author;
  };

  return (
    <div className="yt-card">
      <Link to={contentLink} className="yt-thumb" aria-label={title}>
        <img src={thumbnailUrl} alt={title} onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
          e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="960" height="540"%3E%3Crect fill="%23111827" width="960" height="540"/%3E%3Ctext fill="%2394a3b8" font-family="sans-serif" font-size="24" x="50%25" y="50%25" text-anchor="middle" dominant-baseline="middle"%3EPreview%3C/text%3E%3C/svg%3E';
        }} />
        {/* Owned badge - top left */}
        {owned && (
          <div style={{
            position: 'absolute',
            top: 8,
            left: 8,
          }}>
            <OwnedBadge owned={owned} />
          </div>
        )}
        {/* COLLAB badge - show when collaborative AND not owned (owned takes priority for top-left) */}
        {isCollaborative && !owned && (
          <div style={{
            position: 'absolute',
            top: 8,
            left: 8,
            background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
            color: '#000',
            padding: '4px 8px',
            borderRadius: 6,
            fontSize: 10,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            zIndex: 2,
          }}>
            <Users size={12} />
            COLLAB
          </div>
        )}
        {/* Chapter count badge for aggregated books - bottom left */}
        {chapterCount && chapterCount > 1 && (
          <div style={{
            position: 'absolute',
            bottom: 8,
            left: 8,
            background: 'rgba(0,0,0,0.85)',
            backdropFilter: 'blur(4px)',
            padding: '3px 8px',
            borderRadius: 4,
            fontSize: 11,
            fontWeight: 600,
            color: '#60a5fa',
          }}>
            {chapterCount} chapters
          </div>
        )}
        {/* Price badge - top right */}
        {priceNum !== undefined && !isNaN(priceNum) && (
          <div style={{
            position: 'absolute',
            top: 8,
            right: 8,
            background: 'rgba(0,0,0,0.8)',
            backdropFilter: 'blur(4px)',
            padding: '4px 8px',
            borderRadius: 4,
            fontSize: 12,
            fontWeight: 700,
            color: priceNum > 0 ? '#10b981' : '#94a3b8',
          }}>
            {priceText}
          </div>
        )}
      </Link>
      <div className="yt-info">
        <div className="yt-title" title={title} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{title}</span>
          {viewCount > 0 && (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
              fontSize: 11,
              fontWeight: isVeryPopular ? 700 : isPopular ? 600 : 500,
              color: isVeryPopular ? '#f59e0b' : isPopular ? '#10b981' : '#94a3b8',
              background: isVeryPopular ? 'rgba(245, 158, 11, 0.15)' : isPopular ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
              padding: isPopular ? '2px 6px' : '0',
              borderRadius: 4,
              flexShrink: 0,
            }}>
              <Eye size={12} />
              {viewsText}
            </span>
          )}
        </div>
        <div className="yt-meta">
          {renderAuthorDisplay()} • <StarRatingDisplay rating={averageRating} count={ratingCount} size={11} /> • <ThumbsUp size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 2 }} />{likesText} • {timeText}
        </div>
        {editionsNum !== undefined && !isNaN(editionsNum) && (
          <div style={{
            fontSize: 11,
            color: editionsNum > 0 ? '#10b981' : '#ef4444',
            fontWeight: 600,
            marginTop: 4,
          }}>
            {editionsText}
          </div>
        )}
      </div>
    </div>
  );
}

export const VideoCard = memo(VideoCardComponent);
