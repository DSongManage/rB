import React, { useState } from 'react';

export default function TypeSelect({ onSelect }:{ onSelect:(t:'text'|'image'|'video')=>void }){
  const [hovered, setHovered] = useState<'text'|'image'|'video'|'none'>('none');
  const card = (t:'text'|'image'|'video', title:string, desc:string) => (
    <button
      onMouseEnter={()=> setHovered(t)}
      onMouseLeave={()=> setHovered('none')}
      onClick={()=> onSelect(t)}
      style={{
        background:'var(--panel)',
        border:'1px solid var(--panel-border)',
        borderRadius:12,
        padding:16,
        textAlign:'left',
        cursor:'pointer',
        boxShadow: hovered===t? '0 0 12px rgba(245,158,11,0.5)':'none',
        outline: hovered===t? '2px solid rgba(245,158,11,0.6)':'none'
      }}
    >
      <div style={{fontWeight:700, color:'var(--text)'}}>{title}</div>
      <div style={{fontSize:12, color:'#94a3b8'}}>{desc}</div>
    </button>
  );
  return (
    <div style={{display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:12}}>
      {card('text', 'Write Text / Chapter', 'Compose a chapter or article with a rich editor')}
      {card('image', 'Upload Image / Art', 'PNG/JPG/WebP up to 50MB; watermark optional')}
      {card('video', 'Upload Video / Song', 'MP4/MOV/MP3 up to 50MB; auto-compress')}
    </div>
  );
}


