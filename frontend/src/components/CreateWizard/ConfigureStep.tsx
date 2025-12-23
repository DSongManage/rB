import React, { useEffect, useRef, useState } from 'react';
import TagSelector from './TagSelector';
import CopyrightPreview from '../BookEditor/CopyrightPreview';

interface ConfigureStepProps {
  contentId?: number;
  authorName?: string;
  registerSubmit?: (fn: () => {
    teaserPercent: number;
    watermark: boolean;
    price: number;
    editions: number;
    authorsNote: string;
    tagIds: number[];
    splits: Array<{ address: string; percent: number }>;
  }) => void;
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(w => w.length > 0).length;
}

export default function ConfigureStep({ contentId, authorName, registerSubmit }: ConfigureStepProps) {
  const [teaser, setTeaser] = useState(10);
  const [watermark, setWatermark] = useState(false);
  const [price, setPrice] = useState(1);
  const [editions, setEditions] = useState(10);
  const [authorsNote, setAuthorsNote] = useState('');
  const [selectedTags, setSelectedTags] = useState<number[]>([]);
  const [splits] = useState<Array<{ address: string; percent: number }>>([]);

  const wordCount = countWords(authorsNote);
  const maxWords = 100;
  const isOverLimit = wordCount > maxWords;

  const latest = useRef({
    teaserPercent: teaser,
    watermark,
    price,
    editions,
    authorsNote,
    tagIds: selectedTags,
    splits,
  });

  // Keep ref updated with latest values
  useEffect(() => {
    latest.current = {
      teaserPercent: teaser,
      watermark,
      price,
      editions,
      authorsNote,
      tagIds: selectedTags,
      splits,
    };
  }, [teaser, watermark, price, editions, authorsNote, selectedTags, splits]);

  // Register callback once
  useEffect(() => {
    if (registerSubmit) {
      registerSubmit(() => latest.current);
    }
  }, [registerSubmit]);

  // Calculate potential earnings
  const potentialGross = price * editions;
  const platformFee = potentialGross * 0.1; // 10% platform fee
  const potentialEarnings = potentialGross - platformFee;

  return (
    <div className="configure-step">
      {/* Section 1: Tags & Discovery */}
      <section className="config-section">
        <h3>Tags & Discovery</h3>
        <p className="section-hint">Add tags to help readers find your work</p>
        <TagSelector
          selectedIds={selectedTags}
          onChange={setSelectedTags}
          maxTags={10}
        />
      </section>

      {/* Section 2: Author's Note */}
      <section className="config-section">
        <div className="section-header">
          <h3>Author's Note</h3>
          <span className={`word-count ${isOverLimit ? 'over-limit' : ''}`}>
            {wordCount}/{maxWords} words
          </span>
        </div>
        <p className="section-hint">Share a brief note about this work with your audience</p>
        <textarea
          value={authorsNote}
          onChange={(e) => setAuthorsNote(e.target.value)}
          placeholder="What inspired this work? Any thoughts you'd like to share with readers..."
          className={`authors-note-input ${isOverLimit ? 'error' : ''}`}
        />
        {isOverLimit && (
          <div className="error-text">
            Please keep your note under {maxWords} words.
          </div>
        )}
      </section>

      {/* Section 3: Preview Settings */}
      <section className="config-section">
        <h3>Preview Settings</h3>
        <p className="section-hint">Control what readers see before purchase</p>

        <div className="teaser-slider">
          <label>
            Teaser shown to public: <strong>{teaser}%</strong>
          </label>
          <input
            type="range"
            min={0}
            max={100}
            value={teaser}
            onChange={(e) => setTeaser(parseInt(e.target.value))}
          />
          <div className="slider-labels">
            <span>0%</span>
            <span>50%</span>
            <span>100%</span>
          </div>
        </div>

        <label className="watermark-toggle">
          <input
            type="checkbox"
            checked={watermark}
            onChange={(e) => setWatermark(e.target.checked)}
          />
          <span>Show watermark on teaser</span>
          <span className="toggle-hint">(Original remains clean)</span>
        </label>
      </section>

      {/* Section 4: Pricing */}
      <section className="config-section">
        <h3>Pricing</h3>
        <p className="section-hint">Set your price and edition limits</p>

        <div className="pricing-grid">
          <div className="price-input">
            <label>Price per edition (USD)</label>
            <div className="input-with-prefix">
              <span className="prefix">$</span>
              <input
                type="number"
                min={0}
                step={0.01}
                value={price}
                onChange={(e) => setPrice(parseFloat(e.target.value || '0'))}
              />
            </div>
          </div>
          <div className="editions-input">
            <label>Number of editions</label>
            <input
              type="number"
              min={1}
              value={editions}
              onChange={(e) => setEditions(parseInt(e.target.value || '1'))}
            />
          </div>
        </div>

        <div className="earnings-preview">
          <div className="earnings-row">
            <span>Potential gross (if sold out)</span>
            <span>${potentialGross.toFixed(2)}</span>
          </div>
          <div className="earnings-row fee">
            <span>Platform fee (10%)</span>
            <span>-${platformFee.toFixed(2)}</span>
          </div>
          <div className="earnings-row highlight">
            <span>Your potential earnings</span>
            <span className="earnings-amount">${potentialEarnings.toFixed(2)}</span>
          </div>
        </div>
      </section>

      {/* Section 5: Copyright Notice */}
      <section className="config-section">
        <h3>Copyright Notice</h3>
        <p className="section-hint">This notice will be associated with your published work</p>
        <CopyrightPreview authorName={authorName || 'Author'} />
      </section>
    </div>
  );
}
