import React, { memo } from 'react';
import { Link } from 'react-router-dom';
import type { LibraryItem } from '../services/libraryApi';

interface MobileLibraryCardProps {
  item: LibraryItem;
}

function MobileLibraryCardComponent({ item }: MobileLibraryCardProps) {
  const progressPercentage = Math.round(item.progress);
  const placeholderSvg = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%23111827" width="200" height="200"/%3E%3Ctext fill="%2394a3b8" font-family="sans-serif" font-size="48" x="50%25" y="50%25" text-anchor="middle" dominant-baseline="middle"%3E%F0%9F%93%96%3C/text%3E%3C/svg%3E';

  return (
    <Link
      to={`/reader/${item.id}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        background: '#0b1220',
        border: '1px solid #2a3444',
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
          background: '#0e1320',
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
        {/* Progress bar at bottom of thumbnail */}
        {item.progress > 0 && (
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
                background: '#f59e0b',
                transition: 'width 0.3s ease',
              }}
            />
          </div>
        )}
      </div>

      {/* Title and progress info */}
      <div style={{ padding: 10 }}>
        <div
          style={{
            fontWeight: 600,
            fontSize: 13,
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
            fontSize: 11,
            color: '#94a3b8',
            marginBottom: 4,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {item.creator}
        </div>
        <div
          style={{
            fontSize: 11,
            color: progressPercentage > 0 ? '#10b981' : '#64748b',
            fontWeight: 500,
          }}
        >
          {progressPercentage > 0 ? `${progressPercentage}%` : 'New'}
        </div>
      </div>
    </Link>
  );
}

export const MobileLibraryCard = memo(MobileLibraryCardComponent);
