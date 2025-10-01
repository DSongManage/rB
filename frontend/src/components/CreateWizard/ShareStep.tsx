import React, { useEffect, useState } from 'react';
import PreviewModal from '../PreviewModal';

export default function ShareStep({ contentId, onPublish }:{ contentId?: number; onPublish?: ()=>void }){
  const url = contentId ? `https://renaissblock.local/content/${contentId}` : '';
  const [open, setOpen] = useState(false);
  const [teaser, setTeaser] = useState<string | undefined>();
  const [ctype, setCtype] = useState<'book'|'art'|'film'|'music' | undefined>();
  const [feePct, setFeePct] = useState<number>(10);
  useEffect(()=>{
    if (!contentId) return;
    fetch(`http://localhost:8000/api/content/${contentId}/preview/`)
      .then(r=> r.ok? r.json(): null)
      .then(d=> { setTeaser(d?.teaser_link); setCtype(d?.content_type); })
      .catch(()=>{});
    // Get current platform fee from dashboard (already returns fee percent)
    fetch('http://localhost:8000/api/dashboard/', { credentials:'include' })
      .then(r=> r.ok? r.json(): null)
      .then(d=> { if (d && typeof d.fee === 'number') setFeePct(d.fee); })
      .catch(()=>{});
  }, [contentId]);
  return (
    <div style={{display:'grid', gap:12}}>
      <div>Share your work</div>
      <div style={{display:'flex', gap:8}}>
        <input value={url} readOnly style={{flex:1}} />
        <button onClick={()=> url && navigator.clipboard.writeText(url)}>Copy link</button>
      </div>
      <div style={{fontSize:12, color:'#94a3b8'}}>Platform Fee: {feePct}% • Your Share: {Math.max(0, 100-feePct)}%</div>
      <div style={{display:'flex', gap:8}}>
        <button onClick={()=> setOpen(true)} style={{background:'transparent', border:'1px solid var(--panel-border)', color:'var(--text)'}}>Preview Teaser</button>
        <button onClick={onPublish} style={{background:'var(--accent)', color:'#111', border:'none', padding:'8px 12px', borderRadius:8}}>Approve & Mint</button>
      </div>
      <div style={{fontSize:12, color:'#94a3b8'}}>Invite collaborators directly from the Collaborators page.</div>
      <PreviewModal open={open} onClose={()=> setOpen(false)} teaserUrl={teaser} contentType={ctype as any} />
    </div>
  );
}


