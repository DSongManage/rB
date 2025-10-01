import React from 'react';

type Props = { open: boolean; onClose: ()=>void; teaserUrl?: string; contentType?: 'book'|'art'|'film'|'music' };

export default function PreviewModal({ open, onClose, teaserUrl, contentType }: Props){
  if (!open) return null;
  const type = contentType || 'book';
  return (
    <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', display:'grid', placeItems:'center', zIndex:2000}}>
      <div style={{width:'80vw', maxWidth:900, maxHeight:'80vh', background:'#0f172a', border:'1px solid #1f2937', borderRadius:12, overflow:'hidden', display:'grid', gridTemplateRows:'40px 1fr'}}>
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 12px'}}>
          <div style={{fontWeight:600}}>Teaser Preview</div>
          <button onClick={onClose} style={{background:'transparent', color:'#cbd5e1', border:'none'}}>Close</button>
        </div>
        <div style={{padding:12, overflow:'auto'}}>
          {type==='book' && (
            <iframe title="text-preview" src={teaserUrl} style={{width:'100%', height:'65vh', border:'none'}} />
          )}
          {(type==='art') && (
            <div style={{display:'grid', placeItems:'center'}}>
              <img src={teaserUrl} alt="preview" style={{maxWidth:'100%', maxHeight:'65vh', objectFit:'contain'}} />
            </div>
          )}
          {type==='film' && (
            <video src={teaserUrl} controls style={{width:'100%', maxHeight:'60vh'}} />
          )}
          {type==='music' && (
            <audio src={teaserUrl} controls style={{width:'100%'}} />
          )}
        </div>
      </div>
    </div>
  );
}


