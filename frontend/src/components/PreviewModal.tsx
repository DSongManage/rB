import React, { useEffect, useMemo, useState } from 'react';
// DOMPurify is used at runtime by consumers; keep optional import guard for tests
let DOMPurify: any = null;
try { DOMPurify = require('dompurify'); } catch {}

type Props = { 
  open: boolean; 
  onClose: ()=>void; 
  teaserUrl?: string; 
  contentType?: 'book'|'art'|'film'|'music';
  contentId?: number;
  price?: number;
  editions?: number;
};

export default function PreviewModal({ open, onClose, teaserUrl, contentType, contentId, price, editions }: Props){
  const type = contentType || 'book';
  const [html, setHtml] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  
  // Handle ESC key to close modal
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [open, onClose]);
  
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
  const handlePurchase = async () => {
    if (!contentId) return;
    setPurchasing(true);
    try {
      // TODO: Implement actual purchase flow
      alert(`Purchase flow for content ${contentId} - Price: $${price || 0}`);
      // This would integrate with the mint/purchase API
    } catch (err) {
      console.error('Purchase failed:', err);
    } finally {
      setPurchasing(false);
    }
  };

  const canPurchase = editions !== undefined && editions > 0;
  const priceText = price && price > 0 ? `$${price.toFixed(2)}` : 'Free';

  if (!open) return null;
  return (
    <div 
      style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', display:'grid', placeItems:'center', zIndex:2000}}
      onClick={(e) => {
        // Close when clicking the backdrop
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div style={{width:'80vw', maxWidth:900, maxHeight:'80vh', background:'#0f172a', border:'1px solid #1f2937', borderRadius:12, overflow:'hidden', display:'grid', gridTemplateRows:'50px 1fr'}}>
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 16px', borderBottom:'1px solid #1f2937'}}>
          <div style={{display:'flex', alignItems:'center', gap:16}}>
            <div style={{fontWeight:600, fontSize:16, color:'#e5e7eb'}}>Teaser Preview</div>
            {editions !== undefined && (
              <div style={{fontSize:12, color:'#94a3b8'}}>
                {editions > 0 ? `${editions} edition${editions > 1 ? 's' : ''} available` : 'Sold out'}
              </div>
            )}
          </div>
          <div style={{display:'flex', gap:12, alignItems:'center'}}>
            {contentId && canPurchase && (
              <button 
                onClick={handlePurchase}
                disabled={purchasing}
                style={{
                  background: purchasing ? '#6b7280' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color:'#fff',
                  border:'none',
                  borderRadius:6,
                  padding:'6px 16px',
                  cursor: purchasing ? 'not-allowed' : 'pointer',
                  fontSize:14,
                  fontWeight:700,
                  transition:'all 0.2s',
                }}
              >
                {purchasing ? 'Processing...' : `Buy Now ${priceText}`}
              </button>
            )}
            <button 
              onClick={onClose} 
              style={{
                background:'transparent', 
                color:'#cbd5e1', 
                border:'1px solid #475569',
                borderRadius:6,
                padding:'6px 16px',
                cursor:'pointer',
                fontSize:14,
                fontWeight:600,
                transition:'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#1e293b';
                e.currentTarget.style.borderColor = '#64748b';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.borderColor = '#475569';
              }}
            >
              Close
            </button>
          </div>
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


