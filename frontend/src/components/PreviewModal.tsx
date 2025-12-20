import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle, Share2, X } from 'lucide-react';
import { sanitizeHtml } from '../utils/sanitize';
import { API_URL } from '../config';
import { LikeButton } from './social/LikeButton';
import { ContentCommentsSection } from './social/ContentCommentsSection';

// Get CSRF token from cookie (avoids rate limiting)
function getCsrfToken(): string {
  const match = document.cookie.match(/csrftoken=([^;]+)/);
  return match ? match[1] : '';
}

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
  creatorUsername?: string;
  creatorAvatar?: string;
  title?: string;
  likeCount?: number;
  userHasLiked?: boolean;
  commentCount?: number;
};

export default function PreviewModal({
  open,
  onClose,
  teaserUrl,
  contentType,
  contentId,
  price,
  editions,
  isCollaborative = false,
  collaborators = [],
  creatorUsername,
  creatorAvatar,
  title,
  likeCount = 0,
  userHasLiked = false,
  commentCount = 0,
}: Props){
  const type = contentType || 'book';
  const [html, setHtml] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUsername, setCurrentUsername] = useState<string | undefined>();

  // Check auth status
  useEffect(() => {
    if (open) {
      fetch(`${API_URL}/api/auth/status/`, { credentials: 'include' })
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          setIsAuthenticated(!!data?.username);
          setCurrentUsername(data?.username);
        })
        .catch(() => {});
    }
  }, [open]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        onClose();
      }
    };

    if (open) {
      window.addEventListener('keydown', handleEsc);
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

  const safe = useMemo(()=> sanitizeHtml(html), [html]);

  const handlePurchase = async () => {
    if (!contentId) return;
    setPurchasing(true);
    try {
      const csrfToken = getCsrfToken();

      const res = await fetch(`${API_URL}/api/checkout/session/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrfToken,
        },
        credentials: 'include',
        body: JSON.stringify({ content_id: contentId }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data?.code === 'NOT_MINTED') alert('Content not available for purchase');
        else if (data?.code === 'SOLD_OUT') alert('This content is sold out');
        else if (data?.code === 'ALREADY_OWNED') alert('You already own this content');
        else if (data?.code === 'NO_BUYER_WALLET') alert('Please set up your wallet in your profile before purchasing');
        else if (data?.code === 'NO_CREATOR_WALLET') alert('Creator wallet not configured. Please contact support.');
        else if (data?.code === 'STRIPE_ERROR') alert('Payment system error. Please try again.');
        else alert(data?.error || 'Checkout failed');
        return;
      }

      if (data?.checkout_url) {
        window.location.href = data.checkout_url;
      } else {
        alert('No checkout URL received');
      }
    } catch {
      alert('Failed to initiate checkout. Please try again.');
    } finally {
      setPurchasing(false);
    }
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/content/${contentId}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: title || 'Check this out', url });
      } catch {}
    } else {
      await navigator.clipboard.writeText(url);
      alert('Link copied to clipboard!');
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
        background:'rgba(0,0,0,0.9)',
        backdropFilter:'blur(8px)',
        display:'flex',
        alignItems:'center',
        justifyContent:'center',
        zIndex:2000,
        padding: 20,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Main Content Area */}
      <div style={{
        display: 'flex',
        gap: 0,
        maxWidth: 1200,
        width: '100%',
        height: '90vh',
        maxHeight: 800,
      }}>
        {/* Preview Content */}
        <div style={{
          flex: 1,
          background: '#0f172a',
          borderRadius: '16px 0 0 16px',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
        }}>
          {/* Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid #1e293b',
            background: '#0b1220',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ color: '#f1f5f9', fontWeight: 600, fontSize: 16 }}>
                {title || 'Preview'}
              </span>
              {editions !== undefined && (
                <span style={{
                  background: editions > 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                  color: editions > 0 ? '#10b981' : '#ef4444',
                  padding: '4px 10px',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 600,
                }}>
                  {editions > 0 ? `${editions} available` : 'Sold out'}
                </span>
              )}
            </div>
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                padding: 8,
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={24} />
            </button>
          </div>

          {/* Content */}
          <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
            {type === 'book' && (
              <div style={{
                width: '100%',
                height: '100%',
                overflow: 'auto',
                padding: 16,
                background: '#0b1220',
                borderRadius: 8,
                position: 'relative',
              }}>
                {loading ? (
                  <div style={{ color: '#94a3b8', textAlign: 'center', padding: 40 }}>
                    Loading preview...
                  </div>
                ) : safe ? (
                  <>
                    <div className="content-display" dangerouslySetInnerHTML={{ __html: safe }} />
                    <div style={{
                      position: 'absolute',
                      inset: 0,
                      pointerEvents: 'none',
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignContent: 'flex-start',
                      justifyContent: 'center',
                      gap: '60px 80px',
                      padding: 40,
                      overflow: 'hidden',
                    }}>
                      {Array.from({ length: 30 }).map((_, i) => (
                        <div
                          key={i}
                          style={{
                            color: 'rgba(148, 163, 184, 0.08)',
                            fontSize: 16,
                            fontWeight: 600,
                            transform: 'rotate(-25deg)',
                            whiteSpace: 'nowrap',
                            userSelect: 'none',
                            letterSpacing: 2,
                          }}
                        >
                          renaissBlock
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div style={{ color: '#94a3b8', textAlign: 'center', padding: 40 }}>
                    No preview available
                  </div>
                )}
              </div>
            )}
            {type === 'art' && (
              <div style={{ display: 'grid', placeItems: 'center', height: '100%', position: 'relative' }}>
                <img src={teaserUrl} alt="preview" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 8 }} />
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  pointerEvents: 'none',
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignContent: 'center',
                  justifyContent: 'center',
                  gap: '40px 60px',
                  overflow: 'hidden',
                }}>
                  {Array.from({ length: 40 }).map((_, i) => (
                    <div
                      key={i}
                      style={{
                        color: 'rgba(255, 255, 255, 0.2)',
                        fontSize: 14,
                        fontWeight: 700,
                        transform: 'rotate(-30deg)',
                        whiteSpace: 'nowrap',
                        userSelect: 'none',
                        letterSpacing: 3,
                        textShadow: '0 1px 2px rgba(0,0,0,0.5)',
                      }}
                    >
                      renaissBlock
                    </div>
                  ))}
                </div>
              </div>
            )}
            {type === 'film' && (
              <video src={teaserUrl} controls style={{ width: '100%', height: '100%', borderRadius: 8 }} />
            )}
            {type === 'music' && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <audio src={teaserUrl} controls style={{ width: '100%', maxWidth: 500 }} />
              </div>
            )}
          </div>

          {/* Purchase Bar */}
          {contentId && canPurchase && (
            <div style={{
              padding: '16px 20px',
              borderTop: '1px solid #1e293b',
              background: '#0b1220',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <button
                onClick={handlePurchase}
                disabled={purchasing}
                style={{
                  background: purchasing ? '#475569' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 10,
                  padding: '14px 40px',
                  cursor: purchasing ? 'not-allowed' : 'pointer',
                  fontSize: 16,
                  fontWeight: 700,
                  transition: 'all 0.2s',
                }}
              >
                {purchasing ? 'Processing...' : `Buy Now ${priceText}`}
              </button>
            </div>
          )}
        </div>

        {/* Right Sidebar - YouTube Style */}
        <div style={{
          width: showComments ? 380 : 72,
          background: '#0b1220',
          borderRadius: '0 16px 16px 0',
          borderLeft: '1px solid #1e293b',
          display: 'flex',
          flexDirection: 'column',
          transition: 'width 0.3s ease',
          overflow: 'hidden',
        }}>
          {/* Action Buttons */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '20px 0',
            gap: 8,
            borderBottom: showComments ? '1px solid #1e293b' : 'none',
          }}>
            {/* Like Button */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              {contentId && (
                <LikeButton
                  contentId={contentId}
                  initialCount={likeCount}
                  initialLiked={userHasLiked}
                  isAuthenticated={isAuthenticated}
                  onAuthRequired={() => window.location.href = '/auth'}
                  size="lg"
                  showCount={false}
                />
              )}
              <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 500 }}>
                {likeCount > 0 ? likeCount.toLocaleString() : 'Like'}
              </span>
            </div>

            {/* Comment Button */}
            <button
              onClick={() => setShowComments(!showComments)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
                background: showComments ? 'rgba(139, 92, 246, 0.15)' : 'transparent',
                border: 'none',
                padding: '12px 16px',
                borderRadius: 12,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              <MessageCircle
                size={28}
                color={showComments ? '#a78bfa' : '#94a3b8'}
                fill={showComments ? '#a78bfa' : 'transparent'}
              />
              <span style={{ fontSize: 12, color: showComments ? '#a78bfa' : '#94a3b8', fontWeight: 500 }}>
                {commentCount > 0 ? commentCount.toLocaleString() : 'Comments'}
              </span>
            </button>

            {/* Share Button */}
            <button
              onClick={handleShare}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
                background: 'transparent',
                border: 'none',
                padding: '12px 16px',
                borderRadius: 12,
                cursor: 'pointer',
              }}
            >
              <Share2 size={28} color="#94a3b8" />
              <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 500 }}>Share</span>
            </button>
          </div>

          {/* Creator Info */}
          {(creatorUsername || (isCollaborative && collaborators.length > 0)) && (
            <div style={{
              padding: '16px 12px',
              borderBottom: showComments ? '1px solid #1e293b' : 'none',
            }}>
              {creatorUsername && (
                <Link
                  to={`/profile/${creatorUsername}`}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 8,
                    textDecoration: 'none',
                    marginBottom: isCollaborative ? 12 : 0,
                  }}
                >
                  <div style={{
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    background: creatorAvatar ? `url(${creatorAvatar}) center/cover` : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontSize: 18,
                    fontWeight: 600,
                  }}>
                    {!creatorAvatar && creatorUsername.charAt(0).toUpperCase()}
                  </div>
                  <span style={{
                    fontSize: 12,
                    color: '#60a5fa',
                    fontWeight: 600,
                    textAlign: 'center',
                    wordBreak: 'break-word',
                  }}>
                    @{creatorUsername}
                  </span>
                </Link>
              )}

              {/* Collaborators */}
              {isCollaborative && collaborators.length > 0 && (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 8,
                }}>
                  <span style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>
                    Collaborators
                  </span>
                  {collaborators.slice(0, 3).map((c) => (
                    <Link
                      key={c.username}
                      to={`/profile/${c.username}`}
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        fontSize: 11,
                        color: '#60a5fa',
                        textDecoration: 'none',
                      }}
                    >
                      @{c.username}
                    </Link>
                  ))}
                  {collaborators.length > 3 && (
                    <span style={{ fontSize: 11, color: '#64748b' }}>
                      +{collaborators.length - 3} more
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Comments Section (expanded) */}
          {showComments && contentId && (
            <div style={{
              flex: 1,
              overflow: 'auto',
              padding: 16,
            }}>
              <ContentCommentsSection
                contentId={contentId}
                isAuthenticated={isAuthenticated}
                currentUsername={currentUsername}
                onAuthRequired={() => window.location.href = '/auth'}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
