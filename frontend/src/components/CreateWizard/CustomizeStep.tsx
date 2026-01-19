import React, { useEffect, useRef, useState } from 'react';

type Props = {
  onNext?: (c: {
    teaserPercent: number;
    watermark: boolean;
    price: number;
    editions: number;
    authorsNote: string;
    tagIds: number[];
    splits: Array<{ address: string; percent: number }>;
  }) => void;
  registerSubmit?: (fn: () => {
    teaserPercent: number;
    watermark: boolean;
    price: number;
    editions: number;
    authorsNote: string;
    tagIds: number[];
    splits: Array<{ address: string; percent: number }>;
  }) => void;
};

// Helper to count words
function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(w => w.length > 0).length;
}

export default function CustomizeStep({ onNext, registerSubmit }: Props) {
  const [teaser, setTeaser] = useState(10);
  const [watermark, setWatermark] = useState(false);
  const [price, setPrice] = useState(1);
  const [editions, setEditions] = useState(10);
  const [authorsNote, setAuthorsNote] = useState('');
  const [splits] = useState<Array<{ address: string; percent: number }>>([]);
  const latest = useRef({ teaserPercent: teaser, watermark, price, editions, authorsNote, tagIds: [] as number[], splits });

  const wordCount = countWords(authorsNote);
  const maxWords = 100;
  const isOverLimit = wordCount > maxWords;

  // Keep a ref of latest values without triggering parent state updates
  useEffect(() => {
    latest.current = { teaserPercent: teaser, watermark, price, editions, authorsNote, tagIds: [], splits };
  }, [teaser, watermark, price, editions, authorsNote, splits]);

  // Register once (or when registerSubmit identity changes)
  useEffect(() => {
    if (registerSubmit) {
      registerSubmit(() => latest.current);
    }
  }, [registerSubmit]);

  return (
    <div style={{ display: 'grid', gap: 16 }} data-tour="customize-panel">
      <label>Teaser shown to public: {teaser}% <input type="range" min={0} max={100} value={teaser} onChange={(e) => setTeaser(parseInt(e.target.value))} /></label>
      <label title="Show a watermark overlay on the teaser only (original remains clean)"><input type="checkbox" checked={watermark} onChange={(e) => setWatermark(e.target.checked)} /> Show watermark on teaser</label>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div style={{ display: 'grid', gap: 6 }}>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>Price per edition (USD)</div>
          <input type="number" min={0} step={0.01} value={price} onChange={(e) => setPrice(parseFloat(e.target.value || '0'))} />
        </div>
        <div style={{ display: 'grid', gap: 6 }}>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>Number of editions</div>
          <input type="number" min={1} value={editions} onChange={(e) => setEditions(parseInt(e.target.value || '1'))} />
        </div>
      </div>

      {/* Author's Note */}
      <div style={{ display: 'grid', gap: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>Author's Note (optional)</div>
          <div style={{ fontSize: 11, color: isOverLimit ? '#ef4444' : '#64748b' }}>
            {wordCount}/{maxWords} words
          </div>
        </div>
        <textarea
          value={authorsNote}
          onChange={(e) => setAuthorsNote(e.target.value)}
          placeholder="Share a brief note about this work with your audience..."
          style={{
            width: '100%',
            minHeight: 80,
            padding: '10px 12px',
            background: 'var(--bg)',
            border: `1px solid ${isOverLimit ? '#ef4444' : 'var(--panel-border)'}`,
            borderRadius: 8,
            color: 'var(--text)',
            fontSize: 14,
            resize: 'vertical',
            fontFamily: 'inherit',
          }}
        />
        {isOverLimit && (
          <div style={{ fontSize: 11, color: '#ef4444' }}>
            Please keep your note under {maxWords} words.
          </div>
        )}
      </div>

      <div style={{ fontSize: 12, color: '#94a3b8' }}>Platform fee applies per terms</div>
    </div>
  );
}
