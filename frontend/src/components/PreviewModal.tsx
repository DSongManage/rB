import React, { useEffect, useMemo, useState } from 'react';
// DOMPurify is used at runtime by consumers; keep optional import guard for tests
let DOMPurify: any = null;
try { DOMPurify = require('dompurify'); } catch {}

type Props = { open: boolean; onClose: ()=>void; teaserUrl?: string; contentType?: 'book'|'art'|'film'|'music' };

export default function PreviewModal({ open, onClose, teaserUrl, contentType }: Props){
  const type = contentType || 'book';
  const [html, setHtml] = useState<string>('');
  const [loading, setLoading] = useState(true);
  useEffect(()=>{
    let active = true;
    if (open && type==='book' && teaserUrl) {
      setLoading(true);
      // Fetch internal teaser endpoint and render inline
      fetch(teaserUrl, { credentials:'include' })
        .then(r=> r.ok ? r.text() : '')
        .then(t=> { 
          if (active) {
            setHtml(String(t||''));
            setLoading(false);
          }
        })
        .catch(()=> { 
          if (active) {
            setHtml('<p>Preview unavailable</p>');
            setLoading(false);
          }
        });
    } else {
      setLoading(false);
    }
    return ()=> { active = false; };
  }, [open, type, teaserUrl]);
  const safe = useMemo(()=>{
    if (!html) return '';
    if (!DOMPurify) return html;
    try { return DOMPurify.sanitize(html, { USE_PROFILES: { html: true } }); } catch { return html; }
  }, [html]);
  if (!open) return null;
  return (
    <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', display:'grid', placeItems:'center', zIndex:2000}}>
      <div style={{width:'80vw', maxWidth:900, maxHeight:'80vh', background:'#0f172a', border:'1px solid #1f2937', borderRadius:12, overflow:'hidden', display:'grid', gridTemplateRows:'40px 1fr'}}>
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 12px'}}>
          <div style={{fontWeight:600}}>Teaser Preview</div>
          <button onClick={onClose} style={{background:'transparent', color:'#cbd5e1', border:'none'}}>Close</button>
        </div>
        <div style={{padding:12, overflow:'auto'}}>
          {type==='book' && (
            <div style={{width:'100%', height:'65vh', overflow:'auto', padding:12, background:'#0b1220', borderRadius:8}}>
              {loading ? (
                <div style={{color:'#94a3b8', textAlign:'center', padding:20}}>Loading preview...</div>
              ) : safe ? (
                <div dangerouslySetInnerHTML={{ __html: safe }} />
              ) : (
                <div style={{color:'#94a3b8', textAlign:'center', padding:20}}>No preview available</div>
              )}
            </div>
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


