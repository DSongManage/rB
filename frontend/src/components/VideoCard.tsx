import React from 'react';
import { Link } from 'react-router-dom';

type Props = {
  id: number;
  title: string;
  author?: string;
  viewsText?: string;
  timeText?: string;
  thumbnailUrl: string;
  teaser_link?: string;
};

export function VideoCard({ id, title, author = 'Creator', viewsText = '1.2K views', timeText = '2 days ago', thumbnailUrl, teaser_link }: Props) {
  return (
    <div className="yt-card">
      <Link to={`/content/${id}`} className="yt-thumb" aria-label={title}>
        <img src={thumbnailUrl} alt={title} onError={(e: any) => {
          e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="960" height="540"%3E%3Crect fill="%23111827" width="960" height="540"/%3E%3Ctext fill="%2394a3b8" font-family="sans-serif" font-size="24" x="50%25" y="50%25" text-anchor="middle" dominant-baseline="middle"%3EPreview%3C/text%3E%3C/svg%3E';
        }} />
      </Link>
      <div className="yt-info">
        <div className="yt-title" title={title}>{title}</div>
        <div className="yt-meta">{author} • {viewsText} • {timeText}</div>
      </div>
    </div>
  );
}
