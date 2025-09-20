import React from 'react';

type Item = { id: number; title: string; teaser_link?: string };

export function TeaserGrid({ items }: { items: Item[] }) {
  return (
    <div className="grid">
      {items.map((it) => (
        <div key={it.id} className="card">
          <div className="card-title">{it.title}</div>
          {it.teaser_link && (
            <a className="card-link" href={it.teaser_link}>View teaser</a>
          )}
        </div>
      ))}
    </div>
  );
}
