import React, { memo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, ChevronUp, ChevronDown, ThumbsUp, BookOpen, Users } from 'lucide-react';
import { StarRatingDisplay } from './StarRatingDisplay';

type ComicIssue = {
  id: number;
  title: string;
  issue_number: number;
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
  issues: ComicIssue[];
  publishedIssues: number;
  totalViews: number;
  totalLikes: number;
  totalPrice: number;
  averageRating: number | null;
  ratingCount: number;
  timeText: string;
  isCollaborative?: boolean;
};

function formatCount(count: number): string {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`;
  } else if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return `${count}`;
}

function ComicCardComponent({
  id,
  title,
  coverImageUrl,
  author,
  issues,
  publishedIssues,
  totalViews,
  totalLikes,
  totalPrice,
  averageRating,
  ratingCount,
  timeText,
  isCollaborative = false,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const navigate = useNavigate();

  const firstIssue = issues.find(i => i.content_id);
  const hasMultipleIssues = publishedIssues > 1;

  const isPopular = totalViews >= 100;
  const isVeryPopular = totalViews >= 1000;

  const ratingText = averageRating != null && ratingCount > 0
    ? `${Number(averageRating).toFixed(1)} (${formatCount(ratingCount)})`
    : '--';

  const handleViewIssue = (contentId: number) => {
    navigate(`/content/${contentId}`);
  };

  const handleCoverClick = () => {
    if (hasMultipleIssues) {
      setExpanded(!expanded);
    } else if (firstIssue) {
      navigate(`/content/${firstIssue.content_id}`);
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
          paddingTop: '56.25%',
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

        {/* Issue count badge */}
        {hasMultipleIssues && (
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
            {publishedIssues} issues
          </div>
        )}

        {/* Price badge */}
        {totalPrice > 0 && (
          <div style={{
            position: 'absolute',
            top: hasMultipleIssues ? 40 : 8,
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
          {isCollaborative && (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
              background: 'rgba(245, 158, 11, 0.15)',
              color: '#f59e0b',
              padding: '1px 6px',
              borderRadius: 4,
              fontSize: 10,
              fontWeight: 700,
              lineHeight: 1,
            }}>
              <Users size={10} />
              COLLAB
            </span>
          )}
          <span>•</span>
          <StarRatingDisplay rating={averageRating} count={ratingCount} size={11} />
          <span>•</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
            <ThumbsUp size={12} /> {formatCount(totalLikes)}
          </span>
          <span>•</span>
          <span>{timeText}</span>
        </div>

        {/* Expandable issue list */}
        {hasMultipleIssues && (
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
              <span>Issues</span>
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
                {issues.map((issue, index) => (
                  <div
                    key={issue.id}
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
                        Issue #{issue.issue_number}: {issue.title}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--subtle)' }}>
                        ${issue.price_usd.toFixed(2)} • {issue.view_count} views{issue.editions !== undefined && issue.editions !== null && (
                          <> • <span style={{ color: issue.editions > 0 ? '#10b981' : '#ef4444' }}>
                            {issue.editions > 0 ? `${issue.editions} ed.` : 'Sold out'}
                          </span></>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleViewIssue(issue.content_id);
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

export const ComicCard = memo(ComicCardComponent);
