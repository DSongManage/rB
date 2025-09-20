import React from 'react';

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
      <a href={teaser_link || '#'} className="yt-thumb" aria-label={title}>
        <img src={thumbnailUrl} alt={title} />
      </a>
      <div className="yt-info">
        <div className="yt-title" title={title}>{title}</div>
        <div className="yt-meta">{author} • {viewsText} • {timeText}</div>
      </div>
    </div>
  );
}
