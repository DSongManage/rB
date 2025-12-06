import React, { useEffect, useMemo, useState } from 'react';
import { API_URL } from '../config';
// DOMPurify is used at runtime by consumers; keep optional import guard for tests
let DOMPurify: any = null;
try { DOMPurify = require('dompurify'); } catch {}

type Collaborator = {
  username: string;
  role: string;
  revenuePercentage: number;
};

type Props = {
  open: boolean;
  onClose: ()=>void;
  teaserUrl?: string;
  contentType?: 'book'|'art'|'film'|'music';
  contentId?: number;
  price?: number;
  editions?: number;
  isCollaborative?: boolean;
  collaborators?: Collaborator[];
};

export default function PreviewModal({ open, onClose, teaserUrl, contentType, contentId, price, editions, isCollaborative = false, collaborators = [] }: Props){
  const type = contentType || 'book';
  const [html, setHtml] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  
  // Handle ESC key to close modal and prevent body scroll
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        onClose();
      }
    };

    if (open) {
      window.addEventListener('keydown', handleEsc);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      window.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = 'unset';
    };
  }, [open, onClose]);
  
  useEffect(()=>{
    let active = true;
    if (open && type==='book' && teaserUrl) {
      setLoading(true);
      console.log('Fetching teaser from:', teaserUrl);
      // Fetch internal teaser endpoint and render inline
      fetch(teaserUrl, { credentials:'include' })
        .then(r=> {
          console.log('Teaser response:', r.status, r.statusText);
          return r.ok ? r.text() : '';
        })
        .then(t=> {
          console.log('Teaser content length:', t?.length || 0);
          if (active) {
            setHtml(String(t||''));
            setLoading(false);
          }
        })
        .catch((err)=> {
          console.error('Teaser fetch error:', err);
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
      // Get CSRF token
      const csrfToken = await fetch(`${API_URL}/api/auth/csrf/`, { credentials: 'include' })
        .then(r => r.json())
        .then(j => j?.csrfToken || '');

      // Call backend to create Stripe checkout session
      const res = await fetch(`${API_URL}/api/checkout/session/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrfToken,
        },
        credentials: 'include',
        body: JSON.stringify({
          content_id: contentId
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        // Handle specific error codes from backend
        if (data?.code === 'NOT_MINTED') {
          alert('Content not available for purchase');
        } else if (data?.code === 'SOLD_OUT') {
          alert('This content is sold out');
        } else if (data?.code === 'ALREADY_OWNED') {
          alert('You already own this content');
        } else if (data?.code === 'NO_BUYER_WALLET') {
          alert('Please set up your wallet in your profile before purchasing');
        } else if (data?.code === 'NO_CREATOR_WALLET') {
          alert('Creator wallet not configured. Please contact support.');
        } else if (data?.code === 'STRIPE_ERROR') {
          alert('Payment system error. Please try again.');
        } else {
          alert(data?.error || 'Checkout failed');
        }
        return;
      }

      // Redirect to Stripe Checkout
      if (data?.checkout_url) {
        window.location.href = data.checkout_url;
      } else {
        alert('No checkout URL received');
      }
    } catch (err) {
      console.error('Purchase failed:', err);
      alert('Failed to initiate checkout. Please try again.');
    } finally {
      setPurchasing(false);
    }
  };

  const canPurchase = editions !== undefined && editions > 0;
  const priceText = price && price > 0 ? `$${price.toFixed(2)}` : 'Free';

  if (!open) return null;
  return (
    <div
      style={{
        position:'fixed',
        inset:0,
        background:'rgba(0,0,0,0.75)',
        backdropFilter:'blur(4px)',
        display:'grid',
        placeItems:'center',
        zIndex:2000,
        cursor:'pointer'
      }}
      onClick={(e) => {
        // Close when clicking the backdrop
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div style={{width:'80vw', maxWidth:900, maxHeight:'80vh', background:'#0f172a', border:'1px solid #1f2937', borderRadius:12, overflow:'hidden', display:'grid', gridTemplateRows:'50px 1fr', cursor:'default'}}>
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 16px', borderBottom:'1px solid #1f2937'}}>
          <div style={{display:'flex', alignItems:'center', gap:16}}>
            <div style={{fontWeight:600, fontSize:16, color:'#e5e7eb'}}>Teaser Preview</div>
            {isCollaborative && (
              <div style={{
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                color: '#fff',
                padding: '4px 10px',
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}>
                <span>🤝</span>
                <span>Collaborative Work</span>
              </div>
            )}
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
        {/* Collaborators Section */}
        {isCollaborative && collaborators.length > 0 && (
          <div style={{
            padding: '12px 16px',
            borderBottom: '1px solid #1f2937',
            background: '#0b1220',
          }}>
            <div style={{
              fontSize: 12,
              fontWeight: 600,
              color: '#94a3b8',
              marginBottom: 8,
            }}>
              Collaborators & Revenue Split:
            </div>
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 12,
            }}>
              {collaborators.map((collab, idx) => (
                <div
                  key={idx}
                  style={{
                    background: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: 6,
                    padding: '6px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: 12,
                  }}
                >
                  <span style={{ color: '#e5e7eb', fontWeight: 600 }}>@{collab.username}</span>
                  <span style={{ color: '#64748b' }}>•</span>
                  <span style={{ color: '#94a3b8' }}>{collab.role}</span>
                  <span style={{ color: '#64748b' }}>•</span>
                  <span style={{ color: '#f59e0b', fontWeight: 700 }}>{collab.revenuePercentage}%</span>
                </div>
              ))}
            </div>
          </div>
        )}
        <div style={{padding:12, overflow:'auto'}}>
          {type==='book' && (
            <div style={{width:'100%', height:'65vh', overflow:'auto', padding:12, background:'#0b1220', borderRadius:8}}>
              {loading ? (
                <div style={{color:'#94a3b8', textAlign:'center', padding:20}}>Loading preview...</div>
              ) : safe ? (
                <div className="content-display" dangerouslySetInnerHTML={{ __html: safe }} />
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


