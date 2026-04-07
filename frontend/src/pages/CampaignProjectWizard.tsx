/**
 * CampaignProjectWizard — Unified campaign + project creation wizard.
 *
 * Creates both a CollaborativeProject and Campaign atomically.
 * Steps: Basics → Team & Budget → Pitch → Tiers → Review & Launch
 *
 * Team members can be real users (invited) or TBD (open roles filled later).
 * Milestones use relative deadlines (days after funding).
 */

import React, { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import {
  ArrowLeft, ArrowRight, Rocket, Book, Layers, Image as ImageIcon,
  User, Upload, X, Plus, Trash2, DollarSign, Lock, Search, UserPlus,
} from 'lucide-react';
import campaignApi, { CampaignTier } from '../services/campaignApi';
import { collaborationApi } from '../services/collaborationApi';
import { API_URL as API_BASE } from '../config';

type Step = 'basics' | 'team' | 'pitch' | 'tiers' | 'review';

interface MilestoneInput {
  title: string;
  amount: string;
  days_after_funding: number;
  milestone_type: string;
}

interface TeamMember {
  id: string; // local key for React
  user_id: number | null;
  username: string; // empty for TBD
  avatar_url?: string;
  role: string;
  contract_type: string;
  total_amount: string;
  milestones: MilestoneInput[];
}

interface UserSearchResult {
  id: number;
  username: string;
  avatar?: string;
  display_name?: string;
}

const STEPS: { key: Step; label: string }[] = [
  { key: 'basics', label: 'Basics' },
  { key: 'team', label: 'Team & Budget' },
  { key: 'pitch', label: 'Pitch' },
  { key: 'tiers', label: 'Tiers' },
  { key: 'review', label: 'Review' },
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

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: 8,
  border: '1px solid var(--border)', background: 'var(--dropdown-bg)',
  color: 'var(--text)', fontSize: 14, outline: 'none',
};

const labelStyle: React.CSSProperties = {
  fontSize: 12, fontWeight: 600, color: '#8b5cf6',
  marginBottom: 6, display: 'block', textTransform: 'uppercase' as const,
  letterSpacing: '0.5px',
};

const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function CampaignProjectWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('basics');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Basics
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [contentType, setContentType] = useState<'book' | 'comic' | 'art'>('comic');
  const [deadline, setDeadline] = useState('');
  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState('');

  // Team
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [productionCosts, setProductionCosts] = useState('');
  const [showAddMember, setShowAddMember] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Pitch
  const [pitchHtml, setPitchHtml] = useState('');

  // Tiers
  const [tiers, setTiers] = useState<CampaignTier[]>([]);
  const [tierTitle, setTierTitle] = useState('');
  const [tierDescription, setTierDescription] = useState('');
  const [tierAmount, setTierAmount] = useState('');
  const [tierMaxBackers, setTierMaxBackers] = useState('');

  const defaultDeadline = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    .toISOString().split('T')[0];

  // Computed
  const totalMilestones = team.reduce((sum, m) => sum + parseFloat(m.total_amount || '0'), 0);
  const prodCosts = parseFloat(productionCosts) || 0;
  const fundingGoal = totalMilestones + prodCosts;

  const handleCoverSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCoverImage(file);
      setCoverPreview(URL.createObjectURL(file));
    }
  }, []);

  // User search with debounce
  const searchUsers = useCallback(async (q: string) => {
    if (q.length < 2) { setSearchResults([]); return; }
    setSearchLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/users/search/?q=${encodeURIComponent(q)}&page_size=6`, {
        credentials: 'include',
      });
      const data = await res.json();
      const results = data.results || data || [];
      // Filter out users already in team
      const teamUserIds = team.filter(m => m.user_id).map(m => m.user_id);
      setSearchResults(results.filter((u: UserSearchResult) => !teamUserIds.includes(u.id)));
    } catch { setSearchResults([]); }
    setSearchLoading(false);
  }, [team]);

  const addUserToTeam = (user: UserSearchResult) => {
    setTeam(prev => [...prev, {
      id: `user-${user.id}`,
      user_id: user.id,
      username: user.username,
      avatar_url: user.avatar,
      role: '',
      contract_type: 'work_for_hire',
      total_amount: '',
      milestones: [{ title: 'Milestone 1', amount: '', days_after_funding: 30, milestone_type: 'custom' }],
    }]);
    setShowAddMember(false);
    setSearchQuery('');
    setSearchResults([]);
  };

  const addTbdRole = () => {
    setTeam(prev => [...prev, {
      id: `tbd-${Date.now()}`,
      user_id: null,
      username: '',
      role: '',
      contract_type: 'work_for_hire',
      total_amount: '',
      milestones: [{ title: 'Milestone 1', amount: '', days_after_funding: 30, milestone_type: 'custom' }],
    }]);
    setShowAddMember(false);
  };

  const removeMember = (id: string) => setTeam(prev => prev.filter(m => m.id !== id));

  const updateMember = (id: string, updates: Partial<TeamMember>) => {
    setTeam(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m));
  };

  const updateMilestone = (memberId: string, milestoneIdx: number, updates: Partial<MilestoneInput>) => {
    setTeam(prev => prev.map(m => {
      if (m.id !== memberId) return m;
      const milestones = m.milestones.map((ms, i) => i === milestoneIdx ? { ...ms, ...updates } : ms);
      const total = milestones.reduce((s, ms) => s + (parseFloat(ms.amount) || 0), 0);
      return { ...m, milestones, total_amount: total > 0 ? String(total) : '' };
    }));
  };

  const addMilestone = (memberId: string) => {
    setTeam(prev => prev.map(m => {
      if (m.id !== memberId) return m;
      const maxDays = m.milestones.reduce((mx, ms) => Math.max(mx, ms.days_after_funding), 0);
      return { ...m, milestones: [...m.milestones, {
        title: `Milestone ${m.milestones.length + 1}`,
        amount: '',
        days_after_funding: maxDays + 14,
        milestone_type: 'custom',
      }] };
    }));
  };

  const removeMilestone = (memberId: string, idx: number) => {
    setTeam(prev => prev.map(m => {
      if (m.id !== memberId || m.milestones.length <= 1) return m;
      const milestones = m.milestones.filter((_, i) => i !== idx);
      const total = milestones.reduce((s, ms) => s + (parseFloat(ms.amount) || 0), 0);
      return { ...m, milestones, total_amount: total > 0 ? String(total) : '' };
    }));
  };

  const addTier = () => {
    if (!tierTitle || !tierAmount) return;
    setTiers(prev => [...prev, {
      title: tierTitle,
      description: tierDescription,
      minimum_amount: tierAmount,
      max_backers: tierMaxBackers ? parseInt(tierMaxBackers) : null,
    }]);
    setTierTitle(''); setTierDescription(''); setTierAmount(''); setTierMaxBackers('');
  };

  const handleLaunch = async () => {
    setSubmitting(true);
    setError('');
    try {
      const result = await campaignApi.createCampaignProject({
        title,
        description,
        content_type: contentType,
        pitch_html: pitchHtml,
        deadline: new Date(deadline || defaultDeadline).toISOString(),
        production_costs: productionCosts || '0',
        cover_image: coverImage || undefined,
        team: team.map(m => ({
          user_id: m.user_id,
          username: m.username || undefined,
          role: m.role,
          contract_type: m.contract_type,
          total_amount: m.total_amount,
          milestones: m.milestones.map(ms => ({
            title: ms.title,
            amount: ms.amount,
            days_after_funding: ms.days_after_funding,
            milestone_type: ms.milestone_type,
          })),
        })),
        tiers,
      });

      // Launch the campaign
      await campaignApi.launchCampaign(result.campaign_id);
      navigate(`/campaigns/${result.campaign_id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to create campaign');
      setSubmitting(false);
    }
  };

  const stepIdx = STEPS.findIndex(s => s.key === step);
  const canNext = useMemo(() => {
    switch (step) {
      case 'basics': return title.trim().length > 0;
      case 'team': return fundingGoal >= 10;
      case 'pitch': return true;
      case 'tiers': return true;
      default: return true;
    }
  }, [step, title, fundingGoal]);

  return (
    <div style={{
      maxWidth: 700, margin: '0 auto', padding: '20px 16px 80px',
      minHeight: '100vh',
    }}>
      {/* Header */}
      <button onClick={() => navigate(-1)} style={{
        background: 'none', border: 'none', color: '#8b5cf6',
        fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
        marginBottom: 16, padding: 0,
      }}>
        <ArrowLeft size={16} /> Back
      </button>

      <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)', margin: '0 0 4px' }}>
        Launch Campaign
      </h1>
      <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: '0 0 20px' }}>
        Create your project and campaign in one step. 0% platform fee on contributions.
      </p>

      {/* Progress bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 28 }}>
        {STEPS.map((s, i) => (
          <div key={s.key} style={{ flex: 1, textAlign: 'center' }}>
            <div style={{
              height: 3, borderRadius: 2, marginBottom: 6,
              background: i <= stepIdx ? '#8b5cf6' : 'var(--border)',
            }} />
            <span style={{
              fontSize: 11, color: i <= stepIdx ? '#8b5cf6' : 'var(--text-muted)',
              fontWeight: i === stepIdx ? 600 : 400,
            }}>{s.label}</span>
          </div>
        ))}
      </div>

      {error && (
        <div style={{
          padding: 12, borderRadius: 8, background: '#ef444420',
          color: '#ef4444', fontSize: 13, marginBottom: 16,
        }}>{error}</div>
      )}

      {/* ========== Step 1: Basics ========== */}
      {step === 'basics' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Cover Image */}
          <div>
            <label style={labelStyle}>Cover Image</label>
            <div
              onClick={() => document.getElementById('wiz-cover-upload')?.click()}
              style={{
                width: '100%', height: 200, borderRadius: 12, cursor: 'pointer',
                border: '2px dashed var(--border)', display: 'flex',
                flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                background: coverPreview ? `url(${coverPreview}) center/cover` : 'var(--bg-secondary)',
                color: 'var(--text-muted)', gap: 8,
              }}
            >
              {!coverPreview && <><Upload size={24} /><span style={{ fontSize: 13 }}>Click to upload</span></>}
            </div>
            <input id="wiz-cover-upload" type="file" accept="image/*" onChange={handleCoverSelect} style={{ display: 'none' }} />
          </div>

          {/* Content Type */}
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
                  background: contentType === type ? '#4f46e520' : 'var(--bg-secondary)',
                  border: `1px solid ${contentType === type ? '#4f46e5' : 'var(--border)'}`,
                  color: contentType === type ? '#4f46e5' : 'var(--text)',
                  fontSize: 12, cursor: 'pointer',
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
              placeholder="Your project title" style={inputStyle} />
          </div>

          {/* Description */}
          <div>
            <label style={labelStyle}>Short Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)}
              placeholder="One-liner for campaign cards..."
              style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} />
          </div>

          {/* Deadline */}
          <div>
            <label style={labelStyle}>Campaign Deadline</label>
            <input type="date" value={deadline || defaultDeadline}
              onChange={e => setDeadline(e.target.value)} style={inputStyle} />
          </div>
        </div>
      )}

      {/* ========== Step 2: Team & Budget ========== */}
      {step === 'team' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', margin: '0 0 4px' }}>Team & Budget</h2>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
              Add team members or open roles. Set milestones with deadlines relative to funding.
            </p>
          </div>

          {/* Team member cards */}
          {team.map((member) => (
            <div key={member.id} style={{
              borderRadius: 10, border: '1px solid var(--panel-border)',
              background: 'var(--panel)', overflow: 'hidden',
            }}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px' }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%', background: member.user_id ? '#3b82f6' : '#f59e0b',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  overflow: 'hidden',
                }}>
                  {member.avatar_url ? (
                    <img src={member.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>
                      {member.user_id ? member.username.charAt(0).toUpperCase() : '?'}
                    </span>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
                    {member.user_id ? `@${member.username}` : 'Open Role (TBD)'}
                  </div>
                  <input
                    value={member.role}
                    onChange={e => updateMember(member.id, { role: e.target.value })}
                    placeholder="Role (e.g., Illustrator, Colorist)"
                    style={{
                      width: '100%', padding: '2px 0', border: 'none', background: 'transparent',
                      color: 'var(--text-muted)', fontSize: 12, outline: 'none',
                    }}
                  />
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#10b981' }}>
                    ${fmt(parseFloat(member.total_amount) || 0)}
                  </div>
                </div>
                <button onClick={() => removeMember(member.id)} style={{
                  background: 'none', border: 'none', color: 'var(--text-muted)',
                  cursor: 'pointer', padding: 4, flexShrink: 0,
                }}>
                  <Trash2 size={14} />
                </button>
              </div>

              {/* Milestones */}
              <div style={{ padding: '0 14px 12px', borderTop: '1px solid var(--border)' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', padding: '8px 0 4px', textTransform: 'uppercase' }}>
                  Milestones
                </div>
                {member.milestones.map((ms, mi) => (
                  <div key={mi} style={{
                    display: 'flex', gap: 8, alignItems: 'center', padding: '6px 0',
                    borderBottom: mi < member.milestones.length - 1 ? '1px solid var(--border)' : 'none',
                  }}>
                    <input
                      value={ms.title}
                      onChange={e => updateMilestone(member.id, mi, { title: e.target.value })}
                      placeholder="Milestone title"
                      style={{
                        flex: 2, padding: '6px 8px', borderRadius: 6, fontSize: 12,
                        border: '1px solid var(--border)', background: 'var(--dropdown-bg)',
                        color: 'var(--text)', outline: 'none',
                      }}
                    />
                    <div style={{
                      display: 'flex', alignItems: 'center', flex: 1,
                      border: '1px solid var(--border)', borderRadius: 6,
                      background: 'var(--dropdown-bg)', overflow: 'hidden',
                    }}>
                      <span style={{ padding: '0 6px', color: 'var(--text-muted)', fontSize: 11 }}>$</span>
                      <input
                        type="number" min="0" value={ms.amount}
                        onChange={e => updateMilestone(member.id, mi, { amount: e.target.value })}
                        placeholder="0"
                        style={{
                          width: '100%', padding: '6px 6px 6px 0', border: 'none',
                          background: 'transparent', color: 'var(--text)', fontSize: 12, outline: 'none',
                        }}
                      />
                    </div>
                    <div style={{
                      display: 'flex', alignItems: 'center', flex: 1,
                      border: '1px solid var(--border)', borderRadius: 6,
                      background: 'var(--dropdown-bg)', overflow: 'hidden',
                    }}>
                      <input
                        type="number" min="1" value={ms.days_after_funding}
                        onChange={e => updateMilestone(member.id, mi, { days_after_funding: parseInt(e.target.value) || 1 })}
                        style={{
                          width: '100%', padding: '6px 4px 6px 8px', border: 'none',
                          background: 'transparent', color: 'var(--text)', fontSize: 12, outline: 'none',
                        }}
                      />
                      <span style={{ padding: '0 6px', color: 'var(--text-muted)', fontSize: 10, whiteSpace: 'nowrap' }}>days</span>
                    </div>
                    {member.milestones.length > 1 && (
                      <button onClick={() => removeMilestone(member.id, mi)} style={{
                        background: 'none', border: 'none', color: 'var(--text-muted)',
                        cursor: 'pointer', padding: 2, flexShrink: 0,
                      }}>
                        <X size={12} />
                      </button>
                    )}
                  </div>
                ))}
                <button onClick={() => addMilestone(member.id)} style={{
                  background: 'none', border: 'none', color: '#8b5cf6',
                  fontSize: 11, cursor: 'pointer', padding: '6px 0', display: 'flex', alignItems: 'center', gap: 4,
                }}>
                  <Plus size={12} /> Add milestone
                </button>
              </div>
            </div>
          ))}

          {/* Add member / TBD */}
          {showAddMember ? (
            <div style={{
              borderRadius: 10, border: '1px solid #8b5cf6',
              background: 'var(--panel)', padding: 14,
            }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <div style={{
                  flex: 1, display: 'flex', alignItems: 'center', gap: 8,
                  border: '1px solid var(--border)', borderRadius: 8,
                  background: 'var(--dropdown-bg)', padding: '0 10px',
                }}>
                  <Search size={14} style={{ color: 'var(--text-muted)' }} />
                  <input
                    value={searchQuery}
                    onChange={e => { setSearchQuery(e.target.value); searchUsers(e.target.value); }}
                    placeholder="Search users..."
                    autoFocus
                    style={{
                      width: '100%', padding: '8px 0', border: 'none',
                      background: 'transparent', color: 'var(--text)', fontSize: 13, outline: 'none',
                    }}
                  />
                </div>
                <button onClick={() => { setShowAddMember(false); setSearchQuery(''); setSearchResults([]); }} style={{
                  background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer',
                }}>
                  <X size={16} />
                </button>
              </div>

              {/* Search results */}
              {searchResults.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
                  {searchResults.map(u => (
                    <button key={u.id} onClick={() => addUserToTeam(u)} style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
                      borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)',
                      cursor: 'pointer', textAlign: 'left', width: '100%',
                    }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: '50%', background: '#3b82f6',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#fff', fontSize: 12, fontWeight: 700, overflow: 'hidden',
                      }}>
                        {u.avatar ? (
                          <img src={u.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : u.username.charAt(0).toUpperCase()}
                      </div>
                      <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>@{u.username}</span>
                    </button>
                  ))}
                </div>
              )}
              {searchQuery.length >= 2 && searchResults.length === 0 && !searchLoading && (
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 10px' }}>No users found</p>
              )}

              {/* Add TBD option */}
              <button onClick={addTbdRole} style={{
                width: '100%', padding: '10px 12px', borderRadius: 8,
                border: '1px dashed #f59e0b', background: '#f59e0b10',
                color: '#f59e0b', fontSize: 13, fontWeight: 500, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}>
                <UserPlus size={14} /> Add open role (TBD — fill later)
              </button>
            </div>
          ) : (
            <button onClick={() => setShowAddMember(true)} style={{
              width: '100%', padding: '12px 16px', borderRadius: 10,
              border: '1px dashed #8b5cf6', background: '#8b5cf610',
              color: '#8b5cf6', fontSize: 14, fontWeight: 500, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
              <Plus size={16} /> Add team member
            </button>
          )}

          {/* Production costs */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 14,
            padding: '14px 16px', borderRadius: 10,
            background: 'var(--dropdown-bg)', border: '1px dashed var(--border)',
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              background: 'var(--bg-secondary)', display: 'flex',
              alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <DollarSign size={16} style={{ color: '#f59e0b' }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Production costs</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Printing, shipping, tools — released to you</div>
            </div>
            <div style={{
              display: 'flex', alignItems: 'center',
              background: 'var(--dropdown-bg)', border: '1px solid var(--border)',
              borderRadius: 8, overflow: 'hidden', width: 120, flexShrink: 0,
            }}>
              <span style={{ padding: '0 8px', color: 'var(--text-muted)', fontSize: 13 }}>$</span>
              <input type="number" min="0" value={productionCosts}
                onChange={e => setProductionCosts(e.target.value)} placeholder="0"
                style={{
                  width: '100%', padding: '8px 8px 8px 0', border: 'none',
                  background: 'transparent', color: 'var(--text)', fontSize: 14, outline: 'none',
                }} />
            </div>
          </div>

          {/* Budget summary */}
          <div style={{
            padding: 16, borderRadius: 10,
            background: 'var(--panel)', border: '1px solid var(--panel-border)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Team milestones</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>${fmt(totalMilestones)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Production costs</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>${fmt(prodCosts)}</span>
            </div>
            <div style={{
              borderTop: '1px solid var(--border)', paddingTop: 8,
              display: 'flex', justifyContent: 'space-between',
            }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Funding Goal</span>
              <span style={{ fontSize: 16, fontWeight: 700, color: '#10b981' }}>${fmt(fundingGoal)}</span>
            </div>
          </div>

          {/* Info */}
          <div style={{
            background: '#1e3b2f', borderRadius: 8, padding: 12,
            fontSize: 12, color: '#4ade80', lineHeight: 1.5,
          }}>
            Deadlines are relative to funding — they start counting when your campaign is funded.
            Funds release as milestones are completed. <strong>3% escrow fee</strong> on releases.
          </div>
        </div>
      )}

      {/* ========== Step 3: Pitch ========== */}
      {step === 'pitch' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', margin: '0 0 4px' }}>Campaign Pitch</h2>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
              Tell backers about your project. Include sample pages, vision, and what makes it special.
            </p>
          </div>
          <ReactQuill
            value={pitchHtml}
            onChange={setPitchHtml}
            modules={quillModules}
            theme="snow"
            placeholder="Write your campaign pitch..."
            style={{ background: 'var(--dropdown-bg)', borderRadius: 8, minHeight: 300 }}
          />
        </div>
      )}

      {/* ========== Step 4: Tiers ========== */}
      {step === 'tiers' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', margin: '0 0 4px' }}>Reward Tiers</h2>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
              What do backers get at each contribution level?
            </p>
          </div>

          {tiers.map((tier, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
              borderRadius: 10, background: 'var(--panel)', border: '1px solid var(--panel-border)',
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{tier.title}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{tier.description}</div>
              </div>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#10b981' }}>${tier.minimum_amount}+</span>
              {tier.max_backers && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>max {tier.max_backers}</span>}
              <button onClick={() => setTiers(prev => prev.filter((_, j) => j !== i))} style={{
                background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer',
              }}>
                <Trash2 size={14} />
              </button>
            </div>
          ))}

          {/* Add tier form */}
          <div style={{
            padding: 14, borderRadius: 10, border: '1px dashed var(--border)',
            background: 'var(--bg-secondary)', display: 'flex', flexDirection: 'column', gap: 10,
          }}>
            <input value={tierTitle} onChange={e => setTierTitle(e.target.value)}
              placeholder="Tier name (e.g., Digital Copy)" style={inputStyle} />
            <textarea value={tierDescription} onChange={e => setTierDescription(e.target.value)}
              placeholder="What backers get at this level"
              style={{ ...inputStyle, minHeight: 50, resize: 'vertical' }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <input type="number" value={tierAmount} onChange={e => setTierAmount(e.target.value)}
                placeholder="Min amount ($)" style={{ ...inputStyle, flex: 1 }} />
              <input type="number" value={tierMaxBackers} onChange={e => setTierMaxBackers(e.target.value)}
                placeholder="Max backers (optional)" style={{ ...inputStyle, flex: 1 }} />
            </div>
            <button onClick={addTier} disabled={!tierTitle || !tierAmount} style={{
              padding: '8px 16px', borderRadius: 8, border: 'none',
              background: tierTitle && tierAmount ? '#8b5cf6' : 'var(--bg-secondary)',
              color: '#fff', fontWeight: 600, fontSize: 13, cursor: tierTitle && tierAmount ? 'pointer' : 'not-allowed',
            }}>
              <Plus size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /> Add Tier
            </button>
          </div>
        </div>
      )}

      {/* ========== Step 5: Review ========== */}
      {step === 'review' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', margin: 0 }}>Review & Launch</h2>

          <div style={{ padding: 16, borderRadius: 10, background: 'var(--panel)', border: '1px solid var(--panel-border)' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>{title || 'Untitled'}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>{description}</div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Funding Goal</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#10b981' }}>${fmt(fundingGoal)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Team Members</span>
              <span style={{ fontSize: 13, color: 'var(--text)' }}>
                {team.filter(m => m.user_id).length} assigned, {team.filter(m => !m.user_id).length} TBD
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Reward Tiers</span>
              <span style={{ fontSize: 13, color: 'var(--text)' }}>{tiers.length}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Deadline</span>
              <span style={{ fontSize: 13, color: 'var(--text)' }}>
                {new Date(deadline || defaultDeadline).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </span>
            </div>
          </div>

          {/* Team summary */}
          {team.length > 0 && (
            <div style={{ padding: 16, borderRadius: 10, background: 'var(--panel)', border: '1px solid var(--panel-border)' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 10 }}>Team Budget</div>
              {team.map(m => (
                <div key={m.id} style={{
                  display: 'flex', justifyContent: 'space-between', padding: '6px 0',
                  borderBottom: '1px solid var(--border)',
                }}>
                  <span style={{ fontSize: 13, color: 'var(--text)' }}>
                    {m.user_id ? `@${m.username}` : 'TBD'} — {m.role || 'Role TBD'}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>${fmt(parseFloat(m.total_amount) || 0)}</span>
                </div>
              ))}
              {prodCosts > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                  <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Production costs</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>${fmt(prodCosts)}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Navigation */}
      <div style={{
        display: 'flex', gap: 12, marginTop: 28,
      }}>
        {stepIdx > 0 && (
          <button onClick={() => setStep(STEPS[stepIdx - 1].key)} style={{
            flex: 1, padding: '14px 20px', borderRadius: 10,
            background: 'var(--bg-secondary)', border: '1px solid var(--border)',
            color: 'var(--text)', fontWeight: 600, fontSize: 14, cursor: 'pointer',
          }}>
            Back
          </button>
        )}
        {step !== 'review' ? (
          <button onClick={() => setStep(STEPS[stepIdx + 1].key)} disabled={!canNext} style={{
            flex: 2, padding: '14px 20px', borderRadius: 10, border: 'none',
            background: canNext ? 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)' : 'var(--bg-secondary)',
            color: '#fff', fontWeight: 600, fontSize: 14, cursor: canNext ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            Next: {STEPS[stepIdx + 1]?.label} <ArrowRight size={16} />
          </button>
        ) : (
          <button onClick={handleLaunch} disabled={submitting || fundingGoal < 10} style={{
            flex: 2, padding: '14px 20px', borderRadius: 10, border: 'none',
            background: submitting ? '#4b5563' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            color: '#fff', fontWeight: 600, fontSize: 14, cursor: submitting ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            opacity: submitting ? 0.7 : 1,
          }}>
            <Rocket size={16} /> {submitting ? 'Launching...' : 'Launch Campaign'}
          </button>
        )}
      </div>
    </div>
  );
}
