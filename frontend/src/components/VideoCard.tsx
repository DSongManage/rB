import React from 'react';
import { Link } from 'react-router-dom';
import { OwnedBadge } from './OwnedBadge';

type Props = {
  id: number;
  title: string;
  author?: string;
  viewsText?: string;
  timeText?: string;
  thumbnailUrl: string;
  teaser_link?: string;
  price?: number;
  editions?: number;
  owned?: boolean;
  collaborators?: string[]; // Array of collaborator usernames
  isCollaborative?: boolean; // Flag for collaborative content
};

export function VideoCard({ id, title, author = 'Creator', viewsText = '1.2K views', timeText = '2 days ago', thumbnailUrl, teaser_link, price, editions, owned = false, collaborators, isCollaborative = false }: Props) {
  const priceNum = typeof price === 'string' ? parseFloat(price) : price;
  const editionsNum = typeof editions === 'string' ? parseInt(editions) : editions;
  const editionsText = editionsNum && editionsNum > 0 ? `${editionsNum} edition${editionsNum > 1 ? 's' : ''} available` : 'Sold out';
  const priceText = priceNum && priceNum > 0 ? `$${priceNum.toFixed(2)}` : 'Free';

  // Build author display text
  const authorDisplay = isCollaborative && collaborators && collaborators.length > 0
    ? collaborators.length === 1
      ? `By @${collaborators[0]}`
      : collaborators.length === 2
        ? `By @${collaborators[0]} & @${collaborators[1]}`
        : `By @${collaborators[0]} & ${collaborators.length - 1} others`
    : author;

  return (
    <div className="yt-card">
      <Link to={`/content/${id}`} className="yt-thumb" aria-label={title}>
        <img src={thumbnailUrl} alt={title} onError={(e: any) => {
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
        {/* Collaboration badge - bottom left */}
        {isCollaborative && (
          <div style={{
            position: 'absolute',
            bottom: 8,
            left: 8,
            background: 'rgba(245, 158, 11, 0.9)',
            backdropFilter: 'blur(4px)',
            padding: '4px 8px',
            borderRadius: 4,
            fontSize: 11,
            fontWeight: 700,
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}>
            <span>🤝</span>
            <span>Collab</span>
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
        <div className="yt-title" title={title}>{title}</div>
        <div className="yt-meta">{authorDisplay} • {viewsText} • {timeText}</div>
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
