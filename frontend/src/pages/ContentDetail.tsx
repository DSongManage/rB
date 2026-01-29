import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { ArrowLeft, Play, ChevronDown, ChevronUp, User, AlertCircle, ShoppingCart, Check } from 'lucide-react';
import PreviewModal from '../components/PreviewModal';
import AddToCartButton from '../components/AddToCartButton';
import CopyrightNotice from '../components/CopyrightNotice';
import { API_URL } from '../config';
import { RatingSection } from '../components/social/RatingSection';
import { useMobile } from '../hooks/useMobile';
import { useBalance } from '../contexts/BalanceContext';
import { useCart } from '../contexts/CartContext';

// Format genre for display
function formatGenre(genre: string): string {
  const genreMap: Record<string, string> = {
    'fantasy': 'Fantasy',
    'scifi': 'Sci-Fi',
    'nonfiction': 'Non-Fiction',
    'drama': 'Drama',
    'comedy': 'Comedy',
    'other': 'Other',
  };
  return genreMap[genre] || genre;
}

// Format date for display
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function ContentDetail(){
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { isMobile, isPhone } = useMobile();
  const { displayBalance, syncStatus, isBalanceSufficient } = useBalance();
  const [data, setData] = useState<any>(null);
  const [modalOpen, setModalOpen] = useState(false); // Start closed so user sees page first
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [collaboratorsExpanded, setCollaboratorsExpanded] = useState(false);
  const [comicIssues, setComicIssues] = useState<any[]>([]);
  const [ownedIssueIds, setOwnedIssueIds] = useState<Set<number>>(new Set());
  const ratingSectionRef = useRef<HTMLDivElement>(null);
  const { addToCart, isInCart } = useCart();

  // Check if user just completed reading this content
  const searchParams = new URLSearchParams(location.search);
  const justCompleted = searchParams.get('completed') === 'true';

  useEffect(()=>{
    if (!id) return;
    const abortController = new AbortController();

    // Fetch content and auth status in parallel
    Promise.all([
      fetch(`${API_URL}/api/content/${id}/preview/`, {
        credentials: 'include',
        signal: abortController.signal,
      }).then(r=> r.ok ? r.json() : null),
      fetch(`${API_URL}/api/auth/status/`, {
        credentials: 'include',
        signal: abortController.signal,
      }).then(r => r.ok ? r.json() : null)
    ])
      .then(([contentData, authData]) => {
        setData(contentData);
        setIsAuthenticated(!!authData?.username);
      })
      .catch(err => {
        if (err.name !== 'AbortError') {
          console.error('Failed to fetch content preview:', err);
        }
      });

    // Track content view (fire-and-forget, no need to abort)
    fetch(`${API_URL}/api/content/${id}/view/`, {
      method: 'POST',
      credentials: 'include',
    }).catch(() => {});

    return () => abortController.abort();
  }, [id]);

  // Auto-scroll to rating section when user just completed reading
  useEffect(() => {
    if (justCompleted && data) {
      // Small delay to let the page render
      setTimeout(() => {
        ratingSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 500);
    }
  }, [justCompleted, data]);

  // Fetch per-issue data for comics
  useEffect(() => {
    if (!data || data.content_type !== 'comic' || !data.source_project_id) return;
    fetch(`${API_URL}/api/comic-issues/?project=${data.source_project_id}`, {
      credentials: 'include',
    })
      .then(r => r.ok ? r.json() : [])
      .then((issues: any[]) => {
        const published = issues.filter((i: any) => i.is_published);
        setComicIssues(published);
      })
      .catch(() => {});

    // Check which issues user owns
    if (isAuthenticated) {
      fetch(`${API_URL}/api/purchases/owned-issues/?content_id=${id}`, {
        credentials: 'include',
      })
        .then(r => r.ok ? r.json() : { owned_issue_ids: [] })
        .then((resp: any) => setOwnedIssueIds(new Set(resp.owned_issue_ids || [])))
        .catch(() => {});
    }
  }, [data, isAuthenticated, id]);

  const handleCloseModal = () => {
    setModalOpen(false);
  };

  const handleOpenPreview = () => {
    setModalOpen(true);
  };

  if (!id) return null;
  if (!data) return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 400,
      color: '#94a3b8',
      fontSize: 16,
    }}>
      Loading...
    </div>
  );

  // For books, always use the teaser API endpoint (not the cover image)
  // For other types (art, film, music), use the teaser_link directly
  const teaserUrl = data?.content_type === 'book'
    ? `${API_URL}/api/content/${id}/teaser/`
    : data?.teaser_link;

  // Transform collaborators to match PreviewModal's expected format
  const collaborators = data?.collaborators?.map((c: any) => ({
    username: c.username,
    role: c.role,
    revenuePercentage: c.revenue_percentage,
  })) || [];

  const handleAuthRequired = () => {
    navigate('/auth');
  };

  const priceNum = typeof data?.price_usd === 'string' ? parseFloat(data.price_usd) : data?.price_usd;
  const priceText = priceNum && priceNum > 0 ? `$${priceNum.toFixed(2)}` : 'Free';
  const editionsNum = data?.editions;
  const editionsText = editionsNum && editionsNum > 0
    ? `${editionsNum} edition${editionsNum > 1 ? 's' : ''} available`
    : 'Sold out';

  return (
    <div style={{maxWidth:900, margin:'0 auto', padding: isMobile ? '16px 12px' : '24px 16px'}}>
      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: 'transparent',
          border: 'none',
          color: '#94a3b8',
          cursor: 'pointer',
          marginBottom: isMobile ? 16 : 20,
          padding: 0,
          fontSize: 14,
        }}
      >
        <ArrowLeft size={18} />
        Back
      </button>

      {/* Content Hero Section */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isPhone ? '1fr' : '300px 1fr',
        gap: isMobile ? 16 : 24,
        marginBottom: isMobile ? 24 : 32,
      }}>
        {/* Thumbnail with Preview Button */}
        <div style={{ position: 'relative' }}>
          <div
            style={{
              width: '100%',
              aspectRatio: '3/4',
              borderRadius: 12,
              overflow: 'hidden',
              background: '#1e293b',
              cursor: 'pointer',
              position: 'relative',
            }}
            onClick={handleOpenPreview}
          >
            {data?.teaser_link ? (
              <img
                src={data.teaser_link}
                alt={data.title}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
                onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            ) : (
              <div style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: '#fff',
                fontSize: 48,
                fontWeight: 700,
              }}>
                {data?.title?.charAt(0) || '?'}
              </div>
            )}
            {/* Play/Preview overlay */}
            <div style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0,0,0,0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: 0,
              transition: 'opacity 0.2s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '0'}
            >
              <div style={{
                background: 'rgba(255,255,255,0.9)',
                borderRadius: '50%',
                width: 64,
                height: 64,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Play size={32} fill="#1e293b" color="#1e293b" />
              </div>
            </div>
          </div>
          <button
            onClick={handleOpenPreview}
            style={{
              width: '100%',
              marginTop: 12,
              padding: '12px 20px',
              background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontWeight: 600,
              fontSize: 14,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <Play size={18} />
            View Preview
          </button>

          {/* Add to Cart Button - shows if available for purchase */}
          {isAuthenticated && editionsNum > 0 && priceNum > 0 && (
            <div style={{ marginTop: 12, width: '100%' }}>
              <AddToCartButton
                contentId={parseInt(id!)}
                price={priceNum.toFixed(2)}
                alreadyOwned={data?.preview?.owned}
              />
            </div>
          )}
        </div>

        {/* Content Info */}
        <div>
          {/* Title */}
          <h1 style={{ color: '#f1f5f9', fontSize: 28, fontWeight: 700, margin: 0, marginBottom: 16 }}>
            {data?.title}
          </h1>

          {/* Creator with Avatar */}
          {data?.creator_username && (
            <Link
              to={`/profile/${data.creator_username}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                marginBottom: 16,
                textDecoration: 'none',
              }}
            >
              {/* Avatar */}
              <div style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                overflow: 'hidden',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                {data.creator_avatar ? (
                  <img
                    src={data.creator_avatar}
                    alt={data.creator_username}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <User size={24} color="#fff" />
                )}
              </div>
              <div>
                <div style={{ color: '#60a5fa', fontSize: 15, fontWeight: 600 }}>
                  @{data.creator_username}
                </div>
                {data.created_at && (
                  <div style={{ color: '#64748b', fontSize: 12 }}>
                    Published {formatDate(data.created_at)}
                  </div>
                )}
              </div>
            </Link>
          )}

          {/* Collaborators - Expandable */}
          {data?.is_collaborative && collaborators.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <button
                onClick={() => setCollaboratorsExpanded(!collaboratorsExpanded)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  background: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: 8,
                  padding: '8px 12px',
                  color: '#94a3b8',
                  fontSize: 13,
                  cursor: 'pointer',
                  width: 'fit-content',
                }}
              >
                <span>
                  By{' '}
                  <span style={{ color: '#60a5fa' }}>@{collaborators[0]?.username}</span>
                  {collaborators.length > 1 && (
                    <span> & {collaborators.length - 1} other{collaborators.length > 2 ? 's' : ''}</span>
                  )}
                </span>
                {collaborators.length > 1 && (
                  collaboratorsExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />
                )}
              </button>
              {collaboratorsExpanded && (
                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 8,
                  marginTop: 8,
                  paddingLeft: 8,
                }}>
                  {collaborators.map((c: any) => (
                    <Link
                      key={c.username}
                      to={`/profile/${c.username}`}
                      style={{
                        background: '#0f172a',
                        border: '1px solid #334155',
                        borderRadius: 6,
                        padding: '6px 12px',
                        fontSize: 12,
                        color: '#60a5fa',
                        textDecoration: 'none',
                      }}
                    >
                      @{c.username}
                      <span style={{ color: '#64748b', marginLeft: 4 }}>({c.role})</span>
                      <span style={{ color: '#10b981', marginLeft: 4 }}>{c.revenuePercentage}%</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Price and Editions */}
          <div style={{
            display: 'flex',
            gap: 16,
            marginBottom: 20,
          }}>
            <div style={{
              background: priceNum > 0 ? 'rgba(16,185,129,0.15)' : 'rgba(148,163,184,0.15)',
              border: priceNum > 0 ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(148,163,184,0.3)',
              padding: '8px 16px',
              borderRadius: 8,
            }}>
              <div style={{ color: '#64748b', fontSize: 11, textTransform: 'uppercase', marginBottom: 2 }}>Price</div>
              <div style={{ color: priceNum > 0 ? '#10b981' : '#94a3b8', fontSize: 18, fontWeight: 700 }}>{priceText}</div>
            </div>
            <div style={{
              background: editionsNum > 0 ? 'rgba(59,130,246,0.15)' : 'rgba(239,68,68,0.15)',
              border: editionsNum > 0 ? '1px solid rgba(59,130,246,0.3)' : '1px solid rgba(239,68,68,0.3)',
              padding: '8px 16px',
              borderRadius: 8,
            }}>
              <div style={{ color: '#64748b', fontSize: 11, textTransform: 'uppercase', marginBottom: 2 }}>Availability</div>
              <div style={{ color: editionsNum > 0 ? '#60a5fa' : '#ef4444', fontSize: 14, fontWeight: 600 }}>{editionsText}</div>
            </div>
          </div>

          {/* Insufficient Balance Warning - Only show when needed */}
          {isAuthenticated && priceNum > 0 && syncStatus !== 'no_wallet' && !isBalanceSufficient(priceNum) && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 16,
              fontSize: 13,
              color: '#f87171',
            }}>
              <AlertCircle size={16} />
              <span>
                Your balance ({displayBalance || '$0.00'}) is insufficient.{' '}
                <Link to="/wallet" style={{ color: '#60a5fa', fontWeight: 500 }}>Add funds</Link>
              </span>
            </div>
          )}

          {/* Content Type & Genre Badges */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            <div style={{
              display: 'inline-block',
              background: 'rgba(139,92,246,0.15)',
              border: '1px solid rgba(139,92,246,0.3)',
              color: '#a78bfa',
              padding: '4px 12px',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
              textTransform: 'capitalize',
            }}>
              {data?.content_type}
            </div>
            {data?.genre && data.genre !== 'other' && (
              <div style={{
                display: 'inline-block',
                background: 'rgba(59,130,246,0.15)',
                border: '1px solid rgba(59,130,246,0.3)',
                color: '#60a5fa',
                padding: '4px 12px',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
              }}>
                {formatGenre(data.genre)}
              </div>
            )}
          </div>

          {/* Per-Issue Purchase List for Comics */}
          {data?.content_type === 'comic' && comicIssues.length > 0 && isAuthenticated && (
            <div style={{
              background: 'rgba(139, 92, 246, 0.06)',
              border: '1px solid rgba(139, 92, 246, 0.15)',
              borderRadius: 10,
              padding: 16,
              marginBottom: 16,
            }}>
              <div style={{
                fontSize: 12,
                fontWeight: 600,
                color: '#a78bfa',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: 12,
              }}>
                Issues
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {comicIssues.map((issue: any) => {
                  const owned = ownedIssueIds.has(issue.id);
                  const inCart = isInCart(issue.id, 'comic_issue');
                  return (
                    <div
                      key={issue.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        background: owned ? 'rgba(16, 185, 129, 0.08)' : '#0f172a',
                        border: owned ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid #1e293b',
                        borderRadius: 8,
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 500, color: '#e2e8f0' }}>
                          <span style={{ color: '#64748b', marginRight: 6 }}>#{issue.issue_number}</span>
                          {issue.title}
                        </div>
                        <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                          {issue.page_count} pages
                        </div>
                      </div>
                      <div>
                        {owned ? (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            background: 'rgba(16, 185, 129, 0.15)', color: '#10b981',
                            padding: '6px 12px', borderRadius: 6, fontSize: 13, fontWeight: 600,
                          }}>
                            <Check size={14} /> Owned
                          </span>
                        ) : (
                          <AddToCartButton
                            comicIssueId={issue.id}
                            price={parseFloat(issue.price).toFixed(2)}
                            compact
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              {comicIssues.length > 1 && !data?.preview?.owned && (
                <div style={{ marginTop: 12, textAlign: 'center' }}>
                  <AddToCartButton
                    contentId={parseInt(id!)}
                    price={priceNum.toFixed(2)}
                    alreadyOwned={data?.preview?.owned}
                  />
                </div>
              )}
            </div>
          )}

          {/* Synopsis/Description for Books */}
          {data?.content_type === 'book' && data?.description && (
            <div style={{
              background: 'rgba(59, 130, 246, 0.06)',
              border: '1px solid rgba(59, 130, 246, 0.15)',
              borderRadius: 10,
              padding: 16,
              marginBottom: 16,
            }}>
              <div style={{
                fontSize: 12,
                fontWeight: 600,
                color: '#60a5fa',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: 8,
              }}>
                Synopsis
              </div>
              <p style={{
                color: '#e2e8f0',
                fontSize: 14,
                lineHeight: 1.7,
                margin: 0,
              }}>
                {data.description}
              </p>
            </div>
          )}

          {/* Series Info */}
          {data?.series_info && (
            <div style={{
              background: 'rgba(139, 92, 246, 0.06)',
              border: '1px solid rgba(139, 92, 246, 0.15)',
              borderRadius: 10,
              padding: 16,
              marginBottom: 16,
            }}>
              <div style={{
                fontSize: 12,
                fontWeight: 600,
                color: '#a78bfa',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: 8,
              }}>
                Part of Series
              </div>
              <div style={{
                color: '#e2e8f0',
                fontSize: 15,
                fontWeight: 600,
              }}>
                {data.series_info.title}
              </div>
              {data.series_info.book_count > 1 && (
                <div style={{
                  color: '#94a3b8',
                  fontSize: 12,
                  marginTop: 4,
                }}>
                  {data.series_info.book_count} books in this series
                </div>
              )}
            </div>
          )}

          {/* Author's Note - Quote style with left border */}
          {data?.authors_note && (
            <div style={{
              paddingLeft: 16,
              marginBottom: 20,
              borderLeft: '3px solid #475569',
            }}>
              <div style={{
                fontSize: 11,
                fontWeight: 600,
                color: '#64748b',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: 6,
              }}>
                From the Author
              </div>
              <p style={{
                color: '#cbd5e1',
                fontSize: 14,
                lineHeight: 1.6,
                margin: 0,
                fontStyle: 'italic',
              }}>
                "{data.authors_note}"
              </p>
            </div>
          )}

          {/* Copyright Notice */}
          <CopyrightNotice
            authorName={data?.copyright_holder || data?.creator_username || 'Unknown'}
            year={data?.copyright_year || new Date().getFullYear()}
          />
        </div>
      </div>

      {/* Preview Modal */}
      <PreviewModal
        open={modalOpen}
        onClose={handleCloseModal}
        teaserUrl={teaserUrl}
        contentType={data?.content_type}
        contentId={parseInt(id)}
        price={data?.price_usd}
        editions={data?.editions}
        isCollaborative={data?.is_collaborative}
        collaborators={collaborators}
        creatorUsername={data?.creator_username}
        creatorAvatar={data?.creator_avatar}
        title={data?.title}
        likeCount={data?.like_count || 0}
        userHasLiked={data?.user_has_liked || false}
        commentCount={data?.comment_count || 0}
      />

      {/* Ratings Section */}
      <div ref={ratingSectionRef}>
        <RatingSection
          contentId={parseInt(id)}
          isAuthenticated={isAuthenticated}
          onAuthRequired={handleAuthRequired}
          autoOpen={justCompleted}
        />
      </div>
    </div>
  );
}


