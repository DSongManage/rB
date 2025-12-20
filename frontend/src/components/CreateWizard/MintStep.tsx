import React, { useEffect, useState } from 'react';
import { API_URL } from '../../config';
import { FileText, Tag, DollarSign, Rocket } from 'lucide-react';

interface ContentPreview {
  id: number;
  title: string;
  teaser_link: string;
  content_type: string;
  tags?: Array<{ id: number; name: string }>;
}

interface MintStepProps {
  contentId?: number;
  price?: number;
  editions?: number;
  onMint: () => void;
}

export default function MintStep({ contentId, price, editions, onMint }: MintStepProps) {
  const [agree, setAgree] = useState(false);
  const [feePct, setFeePct] = useState<number>(10);
  const [contentDetails, setContentDetails] = useState<ContentPreview | null>(null);
  const [loading, setLoading] = useState(false);

  // Fetch platform fee
  useEffect(() => {
    fetch(`${API_URL}/api/dashboard/`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d && typeof d.fee === 'number') setFeePct(d.fee); })
      .catch(() => { });
  }, []);

  // Fetch content preview
  useEffect(() => {
    if (!contentId) return;
    fetch(`${API_URL}/api/content/${contentId}/preview/`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d) {
          setContentDetails({
            id: d.id,
            title: d.title,
            teaser_link: d.teaser_link,
            content_type: d.content_type,
            tags: d.tags || [],
          });
        }
      })
      .catch(() => { });
  }, [contentId]);

  const gross = (Number(price || 0) * Number(editions || 1));
  const platformFee = gross * (feePct / 100);
  const netEarnings = gross - platformFee;

  const handleMint = () => {
    if (!agree || loading) return;
    setLoading(true);
    onMint();
  };

  return (
    <div className="mint-step">
      <div className="mint-header">
        <h2>Review & Publish</h2>
        <p className="mint-subtitle">Double-check your settings before publishing</p>
      </div>

      {/* Content Preview Card */}
      <div className="review-card content-preview-card">
        <div className="card-header">
          <FileText size={20} />
          <h3>Your Work</h3>
        </div>
        {contentDetails ? (
          <div className="content-preview">
            {contentDetails.teaser_link && (
              <img
                src={contentDetails.teaser_link}
                alt=""
                className="content-thumbnail"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            )}
            <div className="content-info">
              <h4>{contentDetails.title}</h4>
              <span className="content-type">{contentDetails.content_type}</span>
            </div>
          </div>
        ) : (
          <div className="content-preview-placeholder">Loading content preview...</div>
        )}
      </div>

      {/* Tags Card */}
      {contentDetails?.tags && contentDetails.tags.length > 0 && (
        <div className="review-card tags-card">
          <div className="card-header">
            <Tag size={20} />
            <h3>Tags</h3>
          </div>
          <div className="tag-chips-preview">
            {contentDetails.tags.map(tag => (
              <span key={tag.id} className="tag-chip-preview">{tag.name}</span>
            ))}
          </div>
        </div>
      )}

      {/* Pricing & Earnings Card */}
      <div className="review-card earnings-card">
        <div className="card-header">
          <DollarSign size={20} />
          <h3>Pricing & Earnings</h3>
        </div>
        <div className="earnings-breakdown">
          <div className="breakdown-row">
            <span>Price per edition</span>
            <span>${(price || 0).toFixed(2)}</span>
          </div>
          <div className="breakdown-row">
            <span>Number of editions</span>
            <span>{editions || 1}</span>
          </div>
          <div className="breakdown-divider" />
          <div className="breakdown-row">
            <span>Gross revenue (if sold out)</span>
            <span>${gross.toFixed(2)}</span>
          </div>
          <div className="breakdown-row fee">
            <span>Platform fee ({feePct}%)</span>
            <span>-${platformFee.toFixed(2)}</span>
          </div>
          <div className="breakdown-row highlight">
            <span>Your earnings</span>
            <span className="earnings-amount">${netEarnings.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Terms Agreement */}
      <div className="terms-section">
        <label className="terms-checkbox">
          <input
            type="checkbox"
            checked={agree}
            onChange={(e) => setAgree(e.target.checked)}
          />
          <span>
            I agree to the{' '}
            <a href="/terms" target="_blank" rel="noreferrer">Terms and Conditions</a>
            {' '}and understand the platform fee structure
          </span>
        </label>
      </div>

      {/* Mint Button */}
      <button
        className="mint-button"
        disabled={!agree || loading}
        onClick={handleMint}
      >
        <Rocket size={18} />
        {loading ? 'Publishing...' : 'Mint & Publish'}
      </button>
    </div>
  );
}
