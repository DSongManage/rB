import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import {
  ArrowLeft, ArrowRight, Rocket, Book, Layers, Image as ImageIcon,
  Users, User, Upload, X, Plus, Trash2, DollarSign, Gift,
} from 'lucide-react';
import campaignApi, { CampaignTier } from '../services/campaignApi';

type Step = 'type' | 'basics' | 'pitch' | 'tiers' | 'review';

const STEPS: { key: Step; label: string }[] = [
  { key: 'type', label: 'Type' },
  { key: 'basics', label: 'Basics' },
  { key: 'pitch', label: 'Pitch' },
  { key: 'tiers', label: 'Tiers' },
  { key: 'review', label: 'Launch' },
];

const quillModules = {
  toolbar: [
    [{ header: [2, 3, false] }],
    ['bold', 'italic', 'underline'],
    [{ list: 'ordered' }, { list: 'bullet' }],
    ['link', 'image'],
    ['clean'],
  ],
};

export default function CampaignCreatePage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('type');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [campaignType, setCampaignType] = useState<'collaborative' | 'solo'>('collaborative');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [contentType, setContentType] = useState<'book' | 'comic' | 'art'>('book');
  const [fundingGoal, setFundingGoal] = useState('');
  const [deadline, setDeadline] = useState('');
  const [chapterCount, setChapterCount] = useState('');
  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string>('');
  const [pitchHtml, setPitchHtml] = useState('');
  const [tiers, setTiers] = useState<CampaignTier[]>([]);

  // Tier editing
  const [tierTitle, setTierTitle] = useState('');
  const [tierDescription, setTierDescription] = useState('');
  const [tierAmount, setTierAmount] = useState('');
  const [tierMaxBackers, setTierMaxBackers] = useState('');

  const defaultDeadline = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    .toISOString().split('T')[0];

  const handleCoverSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCoverImage(file);
      setCoverPreview(URL.createObjectURL(file));
    }
  }, []);

  const addTier = () => {
    if (!tierTitle || !tierAmount) return;
    setTiers([...tiers, {
      title: tierTitle,
      description: tierDescription,
      minimum_amount: tierAmount,
      max_backers: tierMaxBackers ? parseInt(tierMaxBackers) : null,
    }]);
    setTierTitle('');
    setTierDescription('');
    setTierAmount('');
    setTierMaxBackers('');
  };

  const removeTier = (index: number) => {
    setTiers(tiers.filter((_, i) => i !== index));
  };

  const handleCreate = async () => {
    setSubmitting(true);
    setError('');
    try {
      const campaign = await campaignApi.createCampaign({
        title,
        description,
        pitch_html: pitchHtml,
        content_type: contentType,
        campaign_type: campaignType,
        funding_goal: fundingGoal,
        deadline: new Date(deadline || defaultDeadline).toISOString(),
        chapter_count: campaignType === 'solo' ? parseInt(chapterCount) || undefined : undefined,
        cover_image: coverImage || undefined,
        tiers: tiers.length > 0 ? tiers : undefined,
      });
      await campaignApi.launchCampaign(campaign.id);
      navigate(`/campaigns/${campaign.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to create campaign');
      setSubmitting(false);
    }
  };

  const stepIndex = STEPS.findIndex(s => s.key === step);
  const canProceed = () => {
    if (step === 'basics') return title && description && fundingGoal;
    if (step === 'pitch') return true; // pitch is optional
    if (step === 'tiers') return true; // tiers are optional
    return true;
  };

  const goNext = () => {
    const nextStep = STEPS[stepIndex + 1];
    if (nextStep) setStep(nextStep.key);
  };

  const goBack = () => {
    if (stepIndex > 0) setStep(STEPS[stepIndex - 1].key);
    else navigate('/studio');
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: 8,
    background: '#1e293b', border: '1px solid #334155',
    color: '#e2e8f0', fontSize: 14, outline: 'none',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 12, color: '#94a3b8', marginBottom: 6, display: 'block', fontWeight: 500,
  };

  return (
    <div className="page" style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px' }}>
      {/* Back button */}
      <button onClick={goBack} style={{
        display: 'flex', alignItems: 'center', gap: 6,
        background: 'none', border: 'none', color: '#64748b',
        fontSize: 13, cursor: 'pointer', marginBottom: 24,
      }}>
        <ArrowLeft size={16} /> Back
      </button>

      {/* Header */}
      <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>
        Create Campaign
      </h1>
      <p style={{ fontSize: 14, color: '#94a3b8', marginBottom: 24 }}>
        Raise funds for your creative project. 0% platform fee on contributions.
      </p>

      {/* Step indicator */}
      {step !== 'type' && (
        <div style={{ display: 'flex', gap: 4, marginBottom: 32 }}>
          {STEPS.filter(s => s.key !== 'type').map((s, i) => (
            <div key={s.key} style={{ flex: 1 }}>
              <div style={{
                height: 3, borderRadius: 2,
                background: STEPS.findIndex(x => x.key === s.key) <= stepIndex ? '#8b5cf6' : '#334155',
                transition: 'background 0.3s',
              }} />
              <div style={{
                fontSize: 10, color: STEPS.findIndex(x => x.key === s.key) <= stepIndex ? '#a78bfa' : '#475569',
                marginTop: 4, textAlign: 'center',
              }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ========== Step 1: Type ========== */}
      {step === 'type' && (
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: '#e2e8f0', marginBottom: 16 }}>
            What kind of campaign?
          </h2>
          {[
            { type: 'solo' as const, icon: User, title: 'Solo Project', color: '#8b5cf6',
              desc: 'Fund your own project. Backers get refunds if you don\'t deliver. Funds release per chapter published.' },
            { type: 'collaborative' as const, icon: Users, title: 'Collaborative Project', color: '#10b981',
              desc: 'Fund a team project. After goal is met, funds transfer to milestone-based escrow for collaborators.' },
          ].map(({ type, icon: Icon, title: t, desc, color }) => (
            <div key={type} onClick={() => { setCampaignType(type); setStep('basics'); }}
              style={{
                padding: 20, borderRadius: 12, cursor: 'pointer', marginBottom: 12,
                background: 'var(--panel)', border: '2px solid var(--panel-border)', transition: 'all 0.2s',
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = color}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--panel-border)'}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <Icon size={20} style={{ color }} />
                <span style={{ fontSize: 15, fontWeight: 600, color: '#e2e8f0' }}>{t}</span>
              </div>
              <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.5 }}>{desc}</div>
            </div>
          ))}
        </div>
      )}

      {/* ========== Step 2: Basics ========== */}
      {step === 'basics' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: '#e2e8f0', margin: 0 }}>Campaign Basics</h2>

          {/* Cover Image Upload */}
          <div>
            <label style={labelStyle}>Cover Image</label>
            <div
              onClick={() => document.getElementById('cover-upload')?.click()}
              style={{
                width: '100%', height: 200, borderRadius: 12, cursor: 'pointer',
                border: '2px dashed #334155', display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 8,
                background: coverPreview ? `url(${coverPreview}) center/cover` : '#0f172a',
                position: 'relative', overflow: 'hidden',
              }}
            >
              {!coverPreview && (
                <>
                  <Upload size={24} style={{ color: '#64748b' }} />
                  <span style={{ fontSize: 13, color: '#64748b' }}>Click to upload cover image</span>
                  <span style={{ fontSize: 11, color: '#475569' }}>Recommended: 1200x630px</span>
                </>
              )}
              {coverPreview && (
                <button onClick={(e) => { e.stopPropagation(); setCoverImage(null); setCoverPreview(''); }}
                  style={{
                    position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.7)',
                    border: 'none', borderRadius: 6, padding: 4, cursor: 'pointer', color: '#fff',
                  }}>
                  <X size={16} />
                </button>
              )}
            </div>
            <input id="cover-upload" type="file" accept="image/*" onChange={handleCoverSelect}
              style={{ display: 'none' }} />
          </div>

          {/* Content type */}
          <div>
            <label style={labelStyle}>Content Type</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {[
                { type: 'book' as const, icon: Book, label: 'Book' },
                { type: 'comic' as const, icon: Layers, label: 'Comic' },
                { type: 'art' as const, icon: ImageIcon, label: 'Art' },
              ].map(({ type, icon: Icon, label }) => (
                <button key={type} onClick={() => setContentType(type)} style={{
                  flex: 1, padding: '10px 8px', borderRadius: 8,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  background: contentType === type ? '#4f46e520' : '#1e293b',
                  border: `1px solid ${contentType === type ? '#4f46e5' : '#334155'}`,
                  color: '#e2e8f0', fontSize: 12, cursor: 'pointer',
                }}>
                  <Icon size={16} /> {label}
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label style={labelStyle}>Title</label>
            <input value={title} onChange={e => setTitle(e.target.value)}
              placeholder="Your campaign title" style={inputStyle} />
          </div>

          {/* Short description */}
          <div>
            <label style={labelStyle}>Short Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)}
              placeholder="One-liner that appears on campaign cards..."
              rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
            <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>{description.length}/200 characters</div>
          </div>

          {/* Funding goal + deadline row */}
          <div style={{ display: 'flex', gap: 16 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Funding Goal (USDC)</label>
              <div style={{ display: 'flex', alignItems: 'center', ...inputStyle, padding: 0, overflow: 'hidden' }}>
                <span style={{ padding: '0 10px', color: '#64748b' }}>$</span>
                <input type="number" min="10" value={fundingGoal} onChange={e => setFundingGoal(e.target.value)}
                  placeholder="1000" style={{ ...inputStyle, border: 'none', borderRadius: 0 }} />
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Deadline</label>
              <input type="date" value={deadline || defaultDeadline} onChange={e => setDeadline(e.target.value)}
                style={inputStyle} />
            </div>
          </div>

          {/* Chapter count (solo only) */}
          {campaignType === 'solo' && (
            <div>
              <label style={labelStyle}>Number of Chapters (serialized release)</label>
              <input type="number" min="1" value={chapterCount} onChange={e => setChapterCount(e.target.value)}
                placeholder="6" style={inputStyle} />
              {chapterCount && fundingGoal && (
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                  ${(parseFloat(fundingGoal) / parseInt(chapterCount)).toFixed(2)} released per chapter
                </div>
              )}
            </div>
          )}

          <button onClick={goNext} disabled={!canProceed()} style={{
            width: '100%', padding: '12px 16px', borderRadius: 8, marginTop: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            background: canProceed() ? '#4f46e5' : '#334155',
            border: 'none', color: '#fff', fontSize: 14, fontWeight: 600,
            cursor: canProceed() ? 'pointer' : 'not-allowed',
          }}>
            Next: Write Your Pitch <ArrowRight size={16} />
          </button>
        </div>
      )}

      {/* ========== Step 3: Pitch ========== */}
      {step === 'pitch' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: '#e2e8f0', margin: 0 }}>Your Pitch</h2>
          <p style={{ fontSize: 13, color: '#94a3b8', margin: 0 }}>
            Tell backers why they should support your project. What are you creating? What makes it special?
            This is displayed on your campaign page.
          </p>

          <div style={{ background: '#0f172a', borderRadius: 8, border: '1px solid #334155' }}>
            <ReactQuill
              theme="snow"
              value={pitchHtml}
              onChange={setPitchHtml}
              modules={quillModules}
              placeholder="Write your campaign pitch here... Tell your story, share your vision, explain what backers will get."
              style={{ minHeight: 300 }}
            />
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={goBack} style={{
              flex: 1, padding: '12px 16px', borderRadius: 8,
              background: '#334155', border: 'none', color: '#e2e8f0', fontSize: 14, cursor: 'pointer',
            }}>Back</button>
            <button onClick={goNext} style={{
              flex: 2, padding: '12px 16px', borderRadius: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              background: '#4f46e5', border: 'none', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}>
              Next: Reward Tiers <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ========== Step 4: Tiers ========== */}
      {step === 'tiers' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: '#e2e8f0', margin: 0 }}>Reward Tiers</h2>
          <p style={{ fontSize: 13, color: '#94a3b8', margin: 0 }}>
            Define what backers get at different contribution levels. Tiers are optional but help motivate larger contributions.
          </p>

          {/* Existing tiers */}
          {tiers.map((tier, i) => (
            <div key={i} style={{
              padding: 16, borderRadius: 10,
              background: 'var(--panel)', border: '1px solid var(--panel-border)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <Gift size={14} style={{ color: '#8b5cf6' }} />
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0' }}>{tier.title}</span>
                  <span style={{ fontSize: 12, color: '#10b981', fontWeight: 600 }}>${tier.minimum_amount}+</span>
                </div>
                <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.5 }}>{tier.description}</div>
                {tier.max_backers && (
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>Limited to {tier.max_backers} backers</div>
                )}
              </div>
              <button onClick={() => removeTier(i)} style={{
                background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 4,
              }}>
                <Trash2 size={14} />
              </button>
            </div>
          ))}

          {/* Add tier form */}
          <div style={{
            padding: 16, borderRadius: 10,
            background: '#0f172a', border: '1px dashed #334155',
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8', marginBottom: 12 }}>
              <Plus size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
              Add a Reward Tier
            </div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
              <div style={{ flex: 2 }}>
                <input value={tierTitle} onChange={e => setTierTitle(e.target.value)}
                  placeholder="Tier name (e.g. Early Bird)" style={inputStyle} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', ...inputStyle, padding: 0, overflow: 'hidden' }}>
                  <span style={{ padding: '0 8px', color: '#64748b', fontSize: 13 }}>$</span>
                  <input type="number" min="1" value={tierAmount} onChange={e => setTierAmount(e.target.value)}
                    placeholder="10" style={{ ...inputStyle, border: 'none', borderRadius: 0 }} />
                </div>
              </div>
            </div>
            <textarea value={tierDescription} onChange={e => setTierDescription(e.target.value)}
              placeholder="What backers get at this level..." rows={2}
              style={{ ...inputStyle, resize: 'none', marginBottom: 10 }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: '#64748b' }}>Max backers (optional):</span>
                <input type="number" min="1" value={tierMaxBackers} onChange={e => setTierMaxBackers(e.target.value)}
                  placeholder="Unlimited" style={{ ...inputStyle, width: 100, padding: '6px 8px', fontSize: 12 }} />
              </div>
              <button onClick={addTier} disabled={!tierTitle || !tierAmount} style={{
                padding: '8px 16px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 6,
                background: tierTitle && tierAmount ? '#4f46e5' : '#334155',
                border: 'none', color: '#fff', fontSize: 12, fontWeight: 600,
                cursor: tierTitle && tierAmount ? 'pointer' : 'not-allowed',
              }}>
                <Plus size={12} /> Add Tier
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={goBack} style={{
              flex: 1, padding: '12px 16px', borderRadius: 8,
              background: '#334155', border: 'none', color: '#e2e8f0', fontSize: 14, cursor: 'pointer',
            }}>Back</button>
            <button onClick={goNext} style={{
              flex: 2, padding: '12px 16px', borderRadius: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              background: '#4f46e5', border: 'none', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}>
              Review & Launch <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ========== Step 5: Review ========== */}
      {step === 'review' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: '#e2e8f0', margin: 0 }}>Review & Launch</h2>

          {/* Preview card */}
          <div style={{
            background: 'var(--panel)', border: '1px solid var(--panel-border)',
            borderRadius: 12, overflow: 'hidden',
          }}>
            {/* Cover */}
            {coverPreview ? (
              <div style={{ height: 180, background: `url(${coverPreview}) center/cover` }} />
            ) : (
              <div style={{ height: 100, background: 'linear-gradient(135deg, #1e1b4b, #312e81)' }} />
            )}
            <div style={{ padding: 20 }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#e2e8f0', marginBottom: 4 }}>{title}</div>
              <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 12 }}>{description}</div>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 13 }}>
                <div><span style={{ color: '#64748b' }}>Goal: </span><strong style={{ color: '#10b981' }}>${fundingGoal}</strong></div>
                <div><span style={{ color: '#64748b' }}>Type: </span><span style={{ color: '#e2e8f0' }}>{campaignType}</span></div>
                <div><span style={{ color: '#64748b' }}>Content: </span><span style={{ color: '#e2e8f0' }}>{contentType}</span></div>
                {campaignType === 'solo' && chapterCount && (
                  <div><span style={{ color: '#64748b' }}>Chapters: </span><span style={{ color: '#e2e8f0' }}>{chapterCount}</span></div>
                )}
                {tiers.length > 0 && (
                  <div><span style={{ color: '#64748b' }}>Tiers: </span><span style={{ color: '#e2e8f0' }}>{tiers.length}</span></div>
                )}
              </div>
            </div>
          </div>

          {/* Pitch preview */}
          {pitchHtml && pitchHtml !== '<p><br></p>' && (
            <div style={{
              background: 'var(--panel)', border: '1px solid var(--panel-border)',
              borderRadius: 12, padding: 20,
            }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#94a3b8', marginBottom: 8 }}>Pitch Preview</div>
              <div className="ql-editor" style={{ color: '#cbd5e1', fontSize: 14, lineHeight: 1.7 }}
                dangerouslySetInnerHTML={{ __html: pitchHtml }} />
            </div>
          )}

          {/* Tiers preview */}
          {tiers.length > 0 && (
            <div style={{
              background: 'var(--panel)', border: '1px solid var(--panel-border)',
              borderRadius: 12, padding: 20,
            }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#94a3b8', marginBottom: 12 }}>
                Reward Tiers ({tiers.length})
              </div>
              {tiers.map((tier, i) => (
                <div key={i} style={{
                  padding: 10, borderRadius: 8, border: '1px solid #334155', marginBottom: 8,
                  display: 'flex', justifyContent: 'space-between',
                }}>
                  <div>
                    <span style={{ fontWeight: 600, color: '#e2e8f0', fontSize: 13 }}>{tier.title}</span>
                    <span style={{ color: '#64748b', fontSize: 12, marginLeft: 8 }}>{tier.description}</span>
                  </div>
                  <span style={{ color: '#10b981', fontWeight: 600, fontSize: 13 }}>${tier.minimum_amount}+</span>
                </div>
              ))}
            </div>
          )}

          {/* Fee info */}
          <div style={{
            background: '#1e3b2f', borderRadius: 8, padding: 12,
            fontSize: 12, color: '#4ade80', lineHeight: 1.5,
          }}>
            <strong>0% campaign fee.</strong> Your backers' funds are protected by smart contract escrow at every stage.
          </div>

          {error && (
            <div style={{ color: '#ef4444', fontSize: 13, textAlign: 'center' }}>{error}</div>
          )}

          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={goBack} style={{
              flex: 1, padding: '12px 16px', borderRadius: 8,
              background: '#334155', border: 'none', color: '#e2e8f0', fontSize: 14, cursor: 'pointer',
            }}>Edit</button>
            <button onClick={handleCreate} disabled={submitting} style={{
              flex: 2, padding: '12px 16px', borderRadius: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              background: submitting ? '#334155' : '#10b981',
              border: 'none', color: '#fff', fontSize: 14, fontWeight: 600,
              cursor: submitting ? 'wait' : 'pointer',
            }}>
              <Rocket size={16} />
              {submitting ? 'Launching...' : 'Launch Campaign'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
