import React from 'react';
import { BookOpen, Layers, Image, Video } from 'lucide-react';

export default function TypeSelect({ onSelect }:{ onSelect:(t:'text'|'image'|'video'|'comic')=>void }){
  const card = (
    t:'text'|'image'|'video'|'comic',
    icon: React.ReactNode,
    title:string,
    desc:string,
    disabled?: boolean,
    comingSoon?: boolean
  ) => (
    <button
      className="type-select-card"
      onClick={()=> !disabled && onSelect(t)}
      disabled={disabled}
    >
      {comingSoon && (
        <span className="coming-soon-badge">Coming Soon</span>
      )}
      <div className="type-select-icon" style={{ color: disabled ? '#64748b' : undefined }}>
        {icon}
      </div>
      <h4 style={{ color: disabled ? '#64748b' : undefined }}>{title}</h4>
      <p>{desc}</p>
    </button>
  );
  return (
    <div className="type-select-grid" data-tour="content-type-selector">
      {card('text', <BookOpen size={28} />, 'Write a Book', 'Create a book with chapters, organize, and publish as a series or complete work')}
      {card('comic', <Layers size={28} />, 'Create a Comic Book', 'Design pages with panels, artwork, and speech bubbles')}
      {card('image', <Image size={28} />, 'Upload Image / Art', 'PNG/JPG/WebP up to 50MB; watermark optional')}
      {card('video', <Video size={28} />, 'Upload Video / Song', 'MP4/MOV/MP3 up to 50MB; auto-compress', true, true)}
    </div>
  );
}
