/**
 * ProductionWizard — Guided setup for comic production pipeline.
 *
 * Steps:
 * 1. Production Structure: total pages, stages, pages per batch
 * 2. Team Assignment: assign collaborators to stages, set pricing
 * 3. Review & Send: preview pipeline, send invitations
 */

import React, { useState, useCallback } from 'react';
import { CollaborativeProject, collaborationApi } from '../../services/collaborationApi';
import { API_URL } from '../../config';
import {
  Layers, PenTool, Paintbrush, Type, Plus, X, Search, ArrowRight,
  ArrowLeft, Rocket, Users, Check,
} from 'lucide-react';

interface ProductionWizardProps {
  project: CollaborativeProject;
  onComplete: () => void;
  onCancel: () => void;
}

interface StageInput {
  name: string;
  icon: string;
  collaborator_username: string;
  collaborator_display_name: string;
  is_tbd: boolean;
  price_per_page: string;
  same_as_stage: number | null;
}

interface SearchResult {
  id: number;
  username: string;
  display_name?: string;
  avatar_url?: string;
}

const DEFAULT_STAGES = [
  { name: 'Pencils', icon: 'pen', enabled: true },
  { name: 'Inks', icon: 'pen-tool', enabled: true },
  { name: 'Colors', icon: 'paintbrush', enabled: true },
  { name: 'Letters', icon: 'type', enabled: false },
];

const ICON_MAP: Record<string, React.ReactNode> = {
  'pen': <PenTool size={18} />,
  'pen-tool': <Layers size={18} />,
  'paintbrush': <Paintbrush size={18} />,
  'type': <Type size={18} />,
  'custom': <Plus size={18} />,
};

type WizardStep = 'structure' | 'team' | 'review';

export default function ProductionWizard({ project, onComplete, onCancel }: ProductionWizardProps) {
  const [step, setStep] = useState<WizardStep>('structure');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Structure
  const [totalPages, setTotalPages] = useState(24);
  const [pagesPerBatch, setPagesPerBatch] = useState(5);
  const [enabledStages, setEnabledStages] = useState(
    DEFAULT_STAGES.map(s => ({ ...s }))
  );
  const [customStageName, setCustomStageName] = useState('');

  // Team
  const [stages, setStages] = useState<StageInput[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchingFor, setSearchingFor] = useState<number | null>(null);

  const activeStages = enabledStages.filter(s => s.enabled);
  const batchCount = Math.ceil(totalPages / pagesPerBatch);
  const totalMilestones = activeStages.length * batchCount;

  // Initialize team stage inputs when moving to team step
  const goToTeam = () => {
    setStages(activeStages.map(s => ({
      name: s.name,
      icon: s.icon,
      collaborator_username: '',
      collaborator_display_name: '',
      is_tbd: false,
      price_per_page: '',
      same_as_stage: null,
    })));
    setStep('team');
  };

  // Search users
  const handleSearch = async (query: string, stageIdx: number) => {
    setSearchQuery(query);
    setSearchingFor(stageIdx);
    if (query.length < 2) { setSearchResults([]); return; }
    try {
      const res = await fetch(`${API_URL}/api/users/search/?q=${encodeURIComponent(query)}`, {
        credentials: 'include',
      });
      if (res.ok) setSearchResults(await res.json());
    } catch { /* ignore */ }
  };

  const [exactLookupLoading, setExactLookupLoading] = useState(false);
  const [exactLookupError, setExactLookupError] = useState('');

  const selectUser = (stageIdx: number, username: string, displayName?: string) => {
    setStages(prev => prev.map((s, i) =>
      i === stageIdx ? { ...s, collaborator_username: username, collaborator_display_name: displayName || username, is_tbd: false, same_as_stage: null } : s
    ));
    setSearchResults([]);
    setSearchingFor(null);
    setSearchQuery('');
    setExactLookupError('');
  };

  const setTbd = (stageIdx: number) => {
    setStages(prev => prev.map((s, i) =>
      i === stageIdx ? { ...s, collaborator_username: '', collaborator_display_name: '', is_tbd: true, same_as_stage: null } : s
    ));
    setSearchResults([]);
    setSearchingFor(null);
    setSearchQuery('');
  };

  const clearAssignment = (stageIdx: number) => {
    setStages(prev => prev.map((s, i) =>
      i === stageIdx ? { ...s, collaborator_username: '', collaborator_display_name: '', is_tbd: false, same_as_stage: null } : s
    ));
  };

  const handleExactLookup = async (stageIdx: number) => {
    if (!searchQuery.trim()) return;
    setExactLookupLoading(true);
    setExactLookupError('');
    try {
      const res = await fetch(`${API_URL}/api/users/lookup/?username=${encodeURIComponent(searchQuery.trim())}`, {
        credentials: 'include',
      });
      if (res.ok) {
        const user = await res.json();
        selectUser(stageIdx, user.username, user.display_name || user.username);
      } else {
        setExactLookupError(`No user found with username "${searchQuery.trim()}"`);
      }
    } catch {
      setExactLookupError('Failed to look up user');
    } finally {
      setExactLookupLoading(false);
    }
  };

  const setSameAs = (stageIdx: number, sourceIdx: number) => {
    setStages(prev => prev.map((s, i) =>
      i === stageIdx ? { ...s, same_as_stage: sourceIdx, collaborator_username: '', is_tbd: false } : s
    ));
  };

  // Calculate totals
  const getStageCost = (s: StageInput) => {
    const ppp = parseFloat(s.price_per_page) || 0;
    return ppp * totalPages;
  };
  const totalCost = stages.reduce((sum, s) => sum + getStageCost(s), 0);

  // Build batch breakdown for review
  const batches: { start: number; end: number }[] = [];
  let ps = 1;
  while (ps <= totalPages) {
    const pe = Math.min(ps + pagesPerBatch - 1, totalPages);
    batches.push({ start: ps, end: pe });
    ps = pe + 1;
  }

  // Submit
  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      const csrfMatch = document.cookie.match(/csrftoken=([^;]+)/);
      const res = await fetch(`${API_URL}/api/collaborative-projects/${project.id}/production-wizard/`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfMatch?.[1] || '' },
        body: JSON.stringify({
          total_pages: totalPages,
          pages_per_batch: pagesPerBatch,
          stages: stages.map(s => ({
            name: s.name,
            collaborator_username: s.is_tbd ? null : (s.same_as_stage != null ? null : s.collaborator_username || null),
            is_tbd: s.is_tbd,
            price_per_page: s.price_per_page || '0',
            same_as_stage: s.same_as_stage,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create pipeline');
      onComplete();
    } catch (err: any) {
      setError(err.message || 'Failed');
    } finally {
      setSubmitting(false);
    }
  };

  const canProceedToTeam = activeStages.length > 0 && totalPages > 0 && pagesPerBatch > 0;
  const canProceedToReview = stages.every(s => s.same_as_stage != null || s.collaborator_username || s.is_tbd);

  return (
    <div style={{
      background: 'var(--panel)', border: '1px solid var(--panel-border)',
      borderRadius: 16, padding: 28, maxWidth: 640, margin: '0 auto',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#E8981F', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
            Production Pipeline
          </div>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 400, color: 'var(--text)', margin: 0 }}>
            {step === 'structure' ? 'How is your comic produced?' :
             step === 'team' ? 'Who handles each stage?' :
             'Review your pipeline'}
          </h2>
        </div>
        <button onClick={onCancel} style={{
          background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer',
        }}><X size={20} /></button>
      </div>

      {/* Progress */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24 }}>
        {(['structure', 'team', 'review'] as WizardStep[]).map((s, i) => (
          <div key={s} style={{
            flex: 1, height: 3, borderRadius: 2,
            background: (['structure', 'team', 'review'].indexOf(step) >= i) ? '#E8981F' : 'var(--border)',
          }} />
        ))}
      </div>

      {error && (
        <div style={{ padding: 12, background: '#ef444415', border: '1px solid #ef4444', borderRadius: 8, color: '#ef4444', fontSize: 13, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* Step 1: Structure */}
      {step === 'structure' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 6, display: 'block' }}>
              Total pages in your comic
            </label>
            <input type="number" min={1} max={200} value={totalPages}
              onChange={e => setTotalPages(parseInt(e.target.value) || 1)}
              style={{ width: 120, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 16, fontWeight: 600 }}
            />
          </div>

          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 8, display: 'block' }}>
              What stages does your comic go through?
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {enabledStages.map((s, i) => (
                <label key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                  borderRadius: 10, border: `1.5px solid ${s.enabled ? '#E8981F' : 'var(--border)'}`,
                  background: s.enabled ? '#E8981F08' : 'transparent', cursor: 'pointer',
                }}>
                  <input type="checkbox" checked={s.enabled}
                    onChange={() => setEnabledStages(prev => prev.map((st, j) => j === i ? { ...st, enabled: !st.enabled } : st))}
                    style={{ accentColor: '#E8981F' }}
                  />
                  <span style={{ color: s.enabled ? 'var(--text)' : 'var(--text-muted)', fontSize: 14, fontWeight: 500 }}>
                    {ICON_MAP[s.icon] || null} {s.name}
                  </span>
                </label>
              ))}
              {/* Add custom stage */}
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={customStageName} onChange={e => setCustomStageName(e.target.value)}
                  placeholder="Custom stage name..."
                  style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }}
                />
                <button onClick={() => {
                  if (customStageName.trim()) {
                    setEnabledStages(prev => [...prev, { name: customStageName.trim(), icon: 'custom', enabled: true }]);
                    setCustomStageName('');
                  }
                }} style={{
                  padding: '8px 14px', borderRadius: 8, border: 'none',
                  background: customStageName.trim() ? '#E8981F' : 'var(--bg-secondary)',
                  color: customStageName.trim() ? '#fff' : 'var(--text-muted)',
                  fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}>
                  <Plus size={14} /> Add
                </button>
              </div>
            </div>
          </div>

          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 6, display: 'block' }}>
              Pages per milestone batch
            </label>
            <input type="number" min={1} max={totalPages} value={pagesPerBatch}
              onChange={e => setPagesPerBatch(parseInt(e.target.value) || 1)}
              style={{ width: 120, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 16, fontWeight: 600 }}
            />
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
              Creates {batchCount} batch{batchCount !== 1 ? 'es' : ''} × {activeStages.length} stage{activeStages.length !== 1 ? 's' : ''} = {totalMilestones} milestones total
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Team */}
      {step === 'team' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {stages.map((s, i) => (
            <div key={i} style={{
              padding: 16, borderRadius: 12,
              border: '1px solid var(--panel-border)', background: 'var(--bg)',
            }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                {ICON_MAP[s.icon]} {s.name}
              </div>

              {/* Collaborator assignment */}
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>
                  Assigned to
                </label>

                {/* Confirmed state: show chip */}
                {(s.same_as_stage != null || s.collaborator_username || s.is_tbd) ? (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
                    borderRadius: 8, border: '1px solid #8b5cf640', background: '#8b5cf608',
                  }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: '50%',
                      background: s.is_tbd ? '#f59e0b20' : '#8b5cf620',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, color: s.is_tbd ? '#f59e0b' : '#8b5cf6', fontWeight: 700,
                    }}>
                      {s.is_tbd ? '?' : (s.same_as_stage != null ? stages[s.same_as_stage]?.collaborator_username?.[0]?.toUpperCase() : s.collaborator_username[0]?.toUpperCase())}
                    </div>
                    <span style={{ flex: 1, fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>
                      {s.is_tbd ? 'TBD — Open Role' :
                       s.same_as_stage != null ? `Same as ${stages[s.same_as_stage]?.name} (@${stages[s.same_as_stage]?.collaborator_username})` :
                       `@${s.collaborator_username}`}
                      {s.collaborator_display_name && s.collaborator_display_name !== s.collaborator_username && (
                        <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> ({s.collaborator_display_name})</span>
                      )}
                    </span>
                    <button onClick={() => clearAssignment(i)} style={{
                      background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer',
                    }}><X size={16} /></button>
                  </div>
                ) : (
                  /* Search state */
                  <div>
                    <div style={{ position: 'relative' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)' }}>
                        <Search size={14} style={{ color: 'var(--text-muted)' }} />
                        <input
                          value={searchingFor === i ? searchQuery : ''}
                          onChange={e => handleSearch(e.target.value, i)}
                          onFocus={() => { setSearchingFor(i); setExactLookupError(''); }}
                          placeholder="Search @username..."
                          style={{ flex: 1, border: 'none', background: 'transparent', color: 'var(--text)', fontSize: 13, outline: 'none' }}
                        />
                      </div>

                      {/* Search results dropdown */}
                      {searchingFor === i && searchQuery.length >= 2 && (
                        <div style={{
                          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
                          background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 8,
                          marginTop: 4, maxHeight: 160, overflow: 'auto',
                          boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                        }}>
                          {searchResults.length > 0 ? searchResults.map(u => (
                            <button key={u.id} onClick={() => selectUser(i, u.username, u.display_name)} style={{
                              display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 12px',
                              border: 'none', background: 'transparent', color: 'var(--text)', fontSize: 13,
                              cursor: 'pointer', textAlign: 'left',
                            }}
                              onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-secondary)'; }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                            >
                              <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#8b5cf620', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#8b5cf6', fontWeight: 700 }}>
                                {u.username[0]?.toUpperCase()}
                              </div>
                              @{u.username} {u.display_name ? <span style={{ color: 'var(--text-muted)' }}>({u.display_name})</span> : ''}
                            </button>
                          )) : (
                            <div style={{ padding: '12px 16px', textAlign: 'center' }}>
                              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
                                No collaborators found for "{searchQuery}"
                              </div>
                              <button onClick={() => handleExactLookup(i)} disabled={exactLookupLoading} style={{
                                width: '100%', padding: '8px 12px', borderRadius: 6, border: 'none',
                                background: '#8b5cf6', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                              }}>
                                {exactLookupLoading ? 'Looking up...' : `Invite @${searchQuery} by exact username`}
                              </button>
                              {exactLookupError && (
                                <div style={{ fontSize: 11, color: '#ef4444', marginTop: 6, padding: '4px 8px', background: '#ef444415', borderRadius: 4 }}>
                                  {exactLookupError}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Quick options: TBD + Same-as */}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                      <button onClick={() => setTbd(i)} style={{
                        padding: '4px 12px', borderRadius: 6, border: '1px dashed #f59e0b',
                        background: '#f59e0b08', color: '#f59e0b', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                      }}>
                        TBD — fill later
                      </button>
                      {i > 0 && stages.slice(0, i).map((prev, j) => (
                        (prev.collaborator_username || prev.is_tbd) ? (
                          <button key={j} onClick={() => prev.is_tbd ? setTbd(i) : setSameAs(i, j)} style={{
                            padding: '4px 12px', borderRadius: 6, border: '1px solid var(--border)',
                            background: 'var(--bg)', color: 'var(--text-muted)', fontSize: 11, cursor: 'pointer',
                          }}>
                            Same as {prev.name}
                          </button>
                        ) : null
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Price per page */}
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>
                  Price per page (USD)
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: 'var(--text-muted)' }}>$</span>
                  <input type="number" min={0} step={0.01} value={s.price_per_page}
                    onChange={e => setStages(prev => prev.map((st, j) => j === i ? { ...st, price_per_page: e.target.value } : st))}
                    placeholder="0.00"
                    style={{ width: 100, padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 14 }}
                  />
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    = ${getStageCost(s).toFixed(2)} total ({totalPages} pages)
                  </span>
                </div>
              </div>
            </div>
          ))}

          {/* Total */}
          <div style={{
            padding: 14, borderRadius: 10, background: '#10b98110', border: '1px solid #10b98130',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Total project cost</span>
            <span style={{ fontSize: 20, fontWeight: 700, color: '#10b981' }}>${totalCost.toFixed(2)}</span>
          </div>
        </div>
      )}

      {/* Step 3: Review */}
      {step === 'review' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Pipeline visualization */}
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>
            {totalPages} pages · {activeStages.length} stages · {batchCount} batches · {totalMilestones} milestones
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontWeight: 600 }}>Batch</th>
                  {stages.map((s, i) => (
                    <th key={i} style={{ textAlign: 'center', padding: '8px 12px', borderBottom: '1px solid var(--border)', color: 'var(--text)', fontWeight: 600 }}>
                      {s.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {batches.map((b, bi) => (
                  <tr key={bi}>
                    <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', color: 'var(--text)', fontWeight: 500 }}>
                      Pages {b.start}-{b.end}
                    </td>
                    {stages.map((s, si) => (
                      <td key={si} style={{ textAlign: 'center', padding: '8px 12px', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                        <div style={{ fontSize: 11 }}>
                          ${((parseFloat(s.price_per_page) || 0) * (b.end - b.start + 1)).toFixed(2)}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                          {si > 0 ? '→' : '●'} {s.same_as_stage != null ? stages[s.same_as_stage]?.collaborator_username : s.collaborator_username}
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Per-collaborator summary */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>Per collaborator</div>
            {(() => {
              const collabMap: Record<string, { stages: string[]; total: number }> = {};
              stages.forEach(s => {
                const username = s.is_tbd ? 'TBD' : (s.same_as_stage != null ? stages[s.same_as_stage]?.collaborator_username : s.collaborator_username);
                if (!username) return;
                if (!collabMap[username]) collabMap[username] = { stages: [], total: 0 };
                collabMap[username].stages.push(s.name);
                collabMap[username].total += getStageCost(s);
              });
              return Object.entries(collabMap).map(([username, info]) => (
                <div key={username} style={{
                  display: 'flex', justifyContent: 'space-between', padding: '8px 12px',
                  borderRadius: 8, background: 'var(--bg)', marginBottom: 4,
                }}>
                  <div>
                    <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>@{username}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>{info.stages.join(', ')}</span>
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#10b981' }}>${info.total.toFixed(2)}</span>
                </div>
              ));
            })()}
          </div>
        </div>
      )}

      {/* Navigation */}
      <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
        {step !== 'structure' && (
          <button onClick={() => setStep(step === 'review' ? 'team' : 'structure')} style={{
            flex: 1, padding: '12px 16px', borderRadius: 10,
            background: 'var(--bg-secondary)', border: '1px solid var(--border)',
            color: 'var(--text)', fontSize: 14, fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
            <ArrowLeft size={16} /> Back
          </button>
        )}
        {step === 'structure' && (
          <button onClick={goToTeam} disabled={!canProceedToTeam} style={{
            flex: 2, padding: '12px 16px', borderRadius: 10, border: 'none',
            background: canProceedToTeam ? '#E8981F' : 'var(--bg-secondary)',
            color: canProceedToTeam ? '#fff' : 'var(--text-muted)',
            fontSize: 14, fontWeight: 600, cursor: canProceedToTeam ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
            Next: Assign Team <ArrowRight size={16} />
          </button>
        )}
        {step === 'team' && (
          <button onClick={() => setStep('review')} disabled={!canProceedToReview} style={{
            flex: 2, padding: '12px 16px', borderRadius: 10, border: 'none',
            background: canProceedToReview ? '#E8981F' : 'var(--bg-secondary)',
            color: canProceedToReview ? '#fff' : 'var(--text-muted)',
            fontSize: 14, fontWeight: 600, cursor: canProceedToReview ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
            Next: Review <ArrowRight size={16} />
          </button>
        )}
        {step === 'review' && (
          <button onClick={handleSubmit} disabled={submitting} style={{
            flex: 2, padding: '12px 16px', borderRadius: 10, border: 'none',
            background: submitting ? '#4b5563' : 'linear-gradient(135deg, #10b981, #059669)',
            color: '#fff', fontSize: 14, fontWeight: 600,
            cursor: submitting ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
            <Rocket size={16} /> {submitting ? 'Setting up...' : 'Create Pipeline & Send Invites'}
          </button>
        )}
      </div>
    </div>
  );
}
