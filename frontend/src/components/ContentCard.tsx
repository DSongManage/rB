import React from 'react';

type Props = { id: number; title: string; teaser_link?: string; onUnlock?: (id:number)=>void };

export function ContentCard({ id, title, teaser_link, onUnlock }: Props) {
  return (
    <div className="card">
      <div className="card-title">{title}</div>
      {teaser_link && <a className="card-link" href={teaser_link}>Preview</a>}
      {onUnlock && <button onClick={()=>onUnlock(id)}>Unlock</button>}
    </div>
  );
}
