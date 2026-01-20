import React, { memo } from 'react';
import { Link } from 'react-router-dom';
import type { LibraryItem } from '../services/libraryApi';

interface MobileLibraryCardProps {
  item: LibraryItem;
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

function MobileLibraryCardComponent({ item }: MobileLibraryCardProps) {
  const progressPercentage = Math.round(item.progress);
  const relativeTime = getRelativeTime(item.last_read_at);
  const placeholderSvg = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%23111827" width="200" height="200"/%3E%3Ctext fill="%2394a3b8" font-family="sans-serif" font-size="48" x="50%25" y="50%25" text-anchor="middle" dominant-baseline="middle"%3E%F0%9F%93%96%3C/text%3E%3C/svg%3E';

  return (
    <Link
      to={`/reader/${item.id}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-card)',
        border: '1px solid var(--panel-border-strong)',
        borderRadius: 12,
        overflow: 'hidden',
        textDecoration: 'none',
        color: 'inherit',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
      }}
    >
      {/* Square thumbnail with progress overlay */}
      <div
        style={{
          position: 'relative',
          aspectRatio: '1',
          background: 'var(--bg-input)',
        }}
      >
        <img
          src={item.thumbnail || placeholderSvg}
          alt={item.title}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
          onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
            e.currentTarget.src = placeholderSvg;
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
            background: 'rgba(0,0,0,0.6)',
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

      {/* Title and progress info */}
      <div style={{ padding: 10 }}>
        <div
          style={{
            fontWeight: 600,
            fontSize: 13,
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
            fontSize: 11,
            color: 'var(--text-muted)',
            marginBottom: 4,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {item.creator}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              fontSize: 11,
              color: progressPercentage === 100 ? '#10b981' : progressPercentage > 0 ? '#f59e0b' : 'var(--subtle)',
              fontWeight: 500,
            }}
          >
            {progressPercentage === 100 ? 'Finished' : progressPercentage > 0 ? `${progressPercentage}%` : 'Not started'}
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

export const MobileLibraryCard = memo(MobileLibraryCardComponent);
