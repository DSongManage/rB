import React, { useState } from 'react';

export default function TypeSelect({ onSelect }:{ onSelect:(t:'text'|'image'|'video')=>void }){
  const [hovered, setHovered] = useState<'text'|'image'|'video'|'none'>('none');
  const card = (t:'text'|'image'|'video', title:string, desc:string, disabled?: boolean, comingSoon?: boolean) => (
    <button
      onMouseEnter={()=> !disabled && setHovered(t)}
      onMouseLeave={()=> setHovered('none')}
      onClick={()=> !disabled && onSelect(t)}
      disabled={disabled}
      style={{
        background: disabled ? 'var(--panel)' : 'var(--panel)',
        border:'1px solid var(--panel-border)',
        borderRadius:12,
        padding:16,
        textAlign:'left',
        cursor: disabled ? 'not-allowed' : 'pointer',
        boxShadow: !disabled && hovered===t? '0 0 12px rgba(245,158,11,0.5)':'none',
        outline: !disabled && hovered===t? '2px solid rgba(245,158,11,0.6)':'none',
        opacity: disabled ? 0.5 : 1,
        position: 'relative' as const,
      }}
    >
      {comingSoon && (
        <span style={{
          position: 'absolute',
          top: 8,
          right: 8,
          background: '#f59e0b',
          color: '#000',
          fontSize: 10,
          fontWeight: 700,
          padding: '2px 6px',
          borderRadius: 4,
          textTransform: 'uppercase',
        }}>
          Coming Soon
        </span>
      )}
      <div style={{fontWeight:700, color: disabled ? '#64748b' : 'var(--text)'}}>{title}</div>
      <div style={{fontSize:12, color:'#94a3b8'}}>{desc}</div>
    </button>
  );
  return (
    <div style={{display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:12}}>
      {card('text', 'Write a Book', 'Create a book with chapters, organize, and publish as a series or complete work')}
      {card('image', 'Upload Image / Art', 'PNG/JPG/WebP up to 50MB; watermark optional')}
      {card('video', 'Upload Video / Song', 'MP4/MOV/MP3 up to 50MB; auto-compress', true, true)}
    </div>
  );
}


