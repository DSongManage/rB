import React, { memo } from 'react';
import { Link } from 'react-router-dom';
import type { LibraryItem } from '../services/libraryApi';

interface LibraryItemCardProps {
  item: LibraryItem;
  onClick?: () => void;
}

// Helper to format relative time
function getRelativeTime(dateString: string | null): string | null {
  if (!dateString) return null;

  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return `${Math.floor(diffDays / 30)}mo ago`;
}

function LibraryItemCardComponent({ item, onClick }: LibraryItemCardProps) {
  const progressPercentage = Math.round(item.progress);
  const relativeTime = getRelativeTime(item.last_read_at);

  return (
    <Link
      to={`/reader/${item.id}`}
      className="library-item-card"
      onClick={onClick}
      style={{
        display: 'flex',
        gap: 12,
        padding: 12,
        background: 'var(--bg-card)',
        border: '1px solid var(--panel-border-strong)',
        borderRadius: 8,
        textDecoration: 'none',
        color: 'inherit',
        transition: 'all 0.2s ease',
        cursor: 'pointer',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--dropdown-hover)';
        e.currentTarget.style.borderColor = 'var(--border)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'var(--bg-card)';
        e.currentTarget.style.borderColor = 'var(--panel-border-strong)';
      }}
    >
      {/* Thumbnail */}
      <div
        style={{
          position: 'relative',
          width: 80,
          height: 80,
          flexShrink: 0,
          borderRadius: 6,
          overflow: 'hidden',
          background: 'var(--bg-input)',
        }}
      >
        <img
          src={item.thumbnail || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="80" height="80"%3E%3Crect fill="%23111827" width="80" height="80"/%3E%3Ctext fill="%2394a3b8" font-family="sans-serif" font-size="12" x="50%25" y="50%25" text-anchor="middle" dominant-baseline="middle"%3E%F0%9F%93%96%3C/text%3E%3C/svg%3E'}
          alt={item.title}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
          onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
            e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="80" height="80"%3E%3Crect fill="%23111827" width="80" height="80"/%3E%3Ctext fill="%2394a3b8" font-family="sans-serif" font-size="12" x="50%25" y="50%25" text-anchor="middle" dominant-baseline="middle"%3E%F0%9F%93%96%3C/text%3E%3C/svg%3E';
          }}
        />
        {/* Progress bar - always show */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 4,
            background: 'rgba(0,0,0,0.5)',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${item.progress}%`,
              background: progressPercentage === 100 ? '#10b981' : '#f59e0b',
              transition: 'width 0.3s ease',
            }}
          />
        </div>
      </div>

      {/* Content info */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          minWidth: 0,
        }}
      >
        <div>
          <div
            style={{
              fontWeight: 600,
              fontSize: 14,
              color: 'var(--text)',
              marginBottom: 4,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {item.title}
          </div>
          <div
            style={{
              fontSize: 12,
              color: 'var(--text-muted)',
            }}
          >
            {item.creator}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              fontSize: 11,
              color: progressPercentage === 100 ? '#10b981' : progressPercentage > 0 ? '#f59e0b' : 'var(--subtle)',
              fontWeight: 600,
            }}
          >
            {progressPercentage === 100 ? 'Finished' : progressPercentage > 0 ? `${progressPercentage}% complete` : 'Not started'}
          </span>
          {relativeTime && progressPercentage > 0 && (
            <span style={{ fontSize: 10, color: 'var(--subtle)' }}>
              · {relativeTime}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

export const LibraryItemCard = memo(LibraryItemCardComponent);
