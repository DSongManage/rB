import React, { useEffect, useState } from 'react';
import { API_URL } from '../../config';
import { Copy, ExternalLink, Twitter, Check, Plus, Eye } from 'lucide-react';
import PreviewModal from '../PreviewModal';
import ConfettiEffect from './ConfettiEffect';

interface ShareStepProps {
  contentId?: number;
  minted: boolean;
  onPublish?: () => void;
}

export default function ShareStep({ contentId, minted, onPublish }: ShareStepProps) {
  const url = contentId ? `${window.location.origin}/content/${contentId}` : '';
  const [open, setOpen] = useState(false);
  const [teaser, setTeaser] = useState<string | undefined>();
  const [ctype, setCtype] = useState<'book' | 'art' | 'film' | 'music' | undefined>();
  const [feePct, setFeePct] = useState<number>(10);
  const [copied, setCopied] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [contentTitle, setContentTitle] = useState('');

  useEffect(() => {
    if (!contentId) return;
    fetch(`${API_URL}/api/content/${contentId}/preview/`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        const teaserUrl = d?.content_type === 'book'
          ? `${API_URL}/api/content/${contentId}/teaser/`
          : d?.teaser_link;
        setTeaser(teaserUrl);
        setCtype(d?.content_type);
        setContentTitle(d?.title || '');
      })
      .catch(() => { });

    fetch(`${API_URL}/api/dashboard/`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d && typeof d.fee === 'number') setFeePct(d.fee); })
      .catch(() => { });
  }, [contentId]);

  // Show confetti when minted changes to true
  useEffect(() => {
    if (minted) {
      setShowConfetti(true);
      const timer = setTimeout(() => setShowConfetti(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [minted]);

  const handleCopy = () => {
    if (url) {
      navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShareTwitter = () => {
    const text = contentTitle
      ? `Check out my new work "${contentTitle}" on renaissBlock!`
      : 'Check out my new work on renaissBlock!';
    const twitterUrl = `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
    window.open(twitterUrl, '_blank');
  };

  // Pre-mint state
  if (!minted) {
    return (
      <div className="share-step pre-mint">
        <h2>Ready to Publish?</h2>
        <p className="share-subtitle">Preview your work and share the link before minting</p>

        <div className="share-url-section">
          <label>Share URL</label>
          <div className="share-url-input">
            <input value={url} readOnly />
            <button onClick={handleCopy} className="copy-btn">
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>

        <div className="fee-info">
          Platform Fee: {feePct}% &bull; Your Share: {Math.max(0, 100 - feePct)}%
        </div>

        <div className="pre-mint-actions">
          <button onClick={() => setOpen(true)} className="preview-btn">
            <Eye size={18} />
            Preview Teaser
          </button>
          <button onClick={onPublish} className="mint-btn">
            Approve & Mint
          </button>
        </div>

        <p className="collaborators-hint">
          Invite collaborators directly from the Collaborators page.
        </p>

        <PreviewModal
          open={open}
          onClose={() => setOpen(false)}
          teaserUrl={teaser}
          contentType={ctype as any}
        />
      </div>
    );
  }

  // Post-mint success state
  return (
    <div className="share-step success">
      {showConfetti && <ConfettiEffect />}

      <div className="success-badge">
        <div className="checkmark-circle">
          <Check size={40} strokeWidth={3} />
        </div>
        <h1>Published!</h1>
        <p>Your work is now live on renaissBlock</p>
      </div>

      {contentTitle && (
        <div className="published-content-card">
          <h3>{contentTitle}</h3>
          <span className="content-type-badge">{ctype}</span>
        </div>
      )}

      <div className="share-section">
        <h3>Share Your Work</h3>
        <div className="share-buttons">
          <button onClick={handleShareTwitter} className="share-twitter-btn">
            <Twitter size={18} />
            Share on Twitter
          </button>
          <button onClick={handleCopy} className="share-copy-btn">
            {copied ? <Check size={18} /> : <Copy size={18} />}
            {copied ? 'Copied!' : 'Copy Link'}
          </button>
        </div>
      </div>

      <div className="next-actions">
        <a href={`/content/${contentId}`} className="view-work-btn">
          <ExternalLink size={18} />
          View Your Work
        </a>
        <a href="/studio?mode=solo" className="create-another-btn">
          <Plus size={18} />
          Create Another
        </a>
      </div>
    </div>
  );
}
