import React, { memo } from 'react';
import { Link } from 'react-router-dom';
import type { LibraryItem } from '../services/libraryApi';

interface LibraryItemCardProps {
  item: LibraryItem;
  onClick?: () => void;
}

function LibraryItemCardComponent({ item, onClick }: LibraryItemCardProps) {
  const progressPercentage = Math.round(item.progress);

  return (
    <Link
      to={`/reader/${item.id}`}
      className="library-item-card"
      onClick={onClick}
      style={{
        display: 'flex',
        gap: 12,
        padding: 12,
        background: '#0b1220',
        border: '1px solid #2a3444',
        borderRadius: 8,
        textDecoration: 'none',
        color: 'inherit',
        transition: 'all 0.2s ease',
        cursor: 'pointer',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = '#111827';
        e.currentTarget.style.borderColor = '#374151';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = '#0b1220';
        e.currentTarget.style.borderColor = '#2a3444';
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
          background: '#0e1320',
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
        {/* Progress overlay */}
        {item.progress > 0 && (
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
                background: '#f59e0b',
                transition: 'width 0.3s ease',
              }}
            />
          </div>
        )}
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
              color: '#e5e7eb',
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
              color: '#94a3b8',
            }}
          >
            {item.creator}
          </div>
        </div>
        <div
          style={{
            fontSize: 11,
            color: '#10b981',
            fontWeight: 600,
          }}
        >
          {progressPercentage > 0 ? `${progressPercentage}% complete` : 'Not started'}
        </div>
      </div>
    </Link>
  );
}

export const LibraryItemCard = memo(LibraryItemCardComponent);
