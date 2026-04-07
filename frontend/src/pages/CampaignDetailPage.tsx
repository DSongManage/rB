import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, Users, Shield, Send, AlertTriangle, PartyPopper, Rocket, ExternalLink, User, UserPlus } from 'lucide-react';
import campaignApi, { Campaign, CampaignUpdate as CampaignUpdateType, RoleInterest } from '../services/campaignApi';
import { CampaignProgressBar } from '../components/campaign/CampaignProgressBar';
import { CampaignContributionModal } from '../components/campaign/CampaignContributionModal';
import { CampaignStatusBadge } from '../components/campaign/CampaignStatusBadge';
import { CampaignProductionTracker } from '../components/campaign/CampaignProductionTracker';
import { BackerReclaimPanel } from '../components/campaign/BackerReclaimPanel';
import { useAuth } from '../hooks/useAuth';

function formatDeadline(deadline: string): string {
  const now = new Date();
  const target = new Date(deadline);
  const diff = target.getTime() - now.getTime();
  if (diff <= 0) return 'Campaign ended';
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days > 1) return `${days} days remaining`;
  const hours = Math.floor(diff / (1000 * 60 * 60));
  return `${hours} hours remaining`;
}

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [updates, setUpdates] = useState<CampaignUpdateType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showContribute, setShowContribute] = useState(false);
  const [updateTitle, setUpdateTitle] = useState('');
  const [updateBody, setUpdateBody] = useState('');
  const [postingUpdate, setPostingUpdate] = useState(false);
  const [showAuthGate, setShowAuthGate] = useState(false);
  const [roleInterests, setRoleInterests] = useState<RoleInterest[]>([]);

  const loadCampaign = async () => {
    if (!id) return;
    try {
      const campaignData = await campaignApi.getCampaign(parseInt(id));
      setCampaign(campaignData);
      // Updates + role interests may fail for non-authenticated users
      try {
        const updatesData = await campaignApi.getUpdates(parseInt(id));
        setUpdates(updatesData);
      } catch {
        setUpdates([]);
      }
      try {
        const interests = await campaignApi.getRoleInterests(parseInt(id));
        setRoleInterests(interests);
      } catch {
        setRoleInterests([]);
      }
    } catch (err) {
      console.error('Failed to load campaign:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadCampaign(); }, [id]);

  const handlePostUpdate = async () => {
    if (!campaign || !updateTitle || !updateBody) return;
    setPostingUpdate(true);
    try {
      await campaignApi.postUpdate(campaign.id, updateTitle, updateBody);
      setUpdateTitle('');
      setUpdateBody('');
      loadCampaign();
    } catch (err) {
      console.error('Failed to post update:', err);
    } finally {
      setPostingUpdate(false);
    }
  };

  const handleTransfer = async () => {
    if (!campaign) return;
    try {
      await campaignApi.transferToEscrow(campaign.id);
      loadCampaign();
    } catch (err) {
      console.error('Failed to transfer:', err);
    }
  };

  if (loading) {
    return (
      <div className="page" style={{ textAlign: 'center', padding: 64, color: 'var(--text-muted)' }}>
        Loading campaign...
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="page" style={{ textAlign: 'center', padding: 64, color: 'var(--text-muted)' }}>
        Campaign not found.
      </div>
    );
  }

  const currentAmount = parseFloat(campaign.current_amount) || 0;
  const fundingGoal = parseFloat(campaign.funding_goal) || 0;
  const isCreator = user?.username === campaign.creator_username;
  const isBacker = campaign.user_contribution && parseFloat(campaign.user_contribution) > 0;

  return (
    <div className="page" style={{ maxWidth: 800, margin: '0 auto', padding: '32px 24px' }}>
      <button
        onClick={() => navigate('/campaigns')}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'none', border: 'none', color: 'var(--text-muted)',
          fontSize: 13, cursor: 'pointer', marginBottom: 24,
        }}
      >
        <ArrowLeft size={16} /> Back to Campaigns
      </button>

      {/* Funded celebration banner */}
      {campaign.status === 'funded' && (
        <div style={{
          background: 'linear-gradient(135deg, #1e1b4b, #312e81)',
          borderRadius: 12, padding: 20, marginBottom: 24,
          textAlign: 'center', border: '1px solid #4f46e540',
        }}>
          <PartyPopper size={28} style={{ color: '#a78bfa', marginBottom: 8 }} />
          <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>Campaign Funded!</div>
          <div style={{ fontSize: 13, color: '#c4b5fd', marginTop: 4 }}>
            {isCreator
              ? 'Your campaign reached its goal. Transfer funds to escrow to begin production.'
              : 'This campaign reached its goal! The creator is preparing to begin production.'}
          </div>
        </div>
      )}

      {/* Completed banner */}
      {campaign.status === 'completed' && (
        <div style={{
          background: 'linear-gradient(135deg, #1a2e05, #365314)',
          borderRadius: 12, padding: 20, marginBottom: 24,
          textAlign: 'center', border: '1px solid #4ade8040',
        }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#4ade80' }}>Project Completed!</div>
          <div style={{ fontSize: 13, color: '#86efac', marginTop: 4 }}>
            All chapters have been delivered. Thank you to all {campaign.backer_count} backers!
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <CampaignStatusBadge status={campaign.status} size="md" />
          <span style={{
            fontSize: 11, padding: '4px 12px', borderRadius: 4,
            background: 'var(--chip-bg)', color: 'var(--text-dim)',
          }}>
            {campaign.campaign_type} / {campaign.content_type}
          </span>
        </div>

        <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>
          {campaign.title}
        </h1>
        <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>
          by {campaign.creator_display_name || campaign.creator_username}
        </div>
        {campaign.previous_campaign_info && (
          <div
            onClick={() => navigate(`/campaigns/${campaign.previous_campaign_info!.id}`)}
            style={{
              fontSize: 12, color: '#8b5cf6', marginTop: 6, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            Sequel to: {campaign.previous_campaign_info.title}
            <ExternalLink size={10} />
          </div>
        )}
      </div>

      {/* Progress section */}
      <div style={{
        background: 'var(--panel)', border: '1px solid var(--panel-border)',
        borderRadius: 12, padding: 24, marginBottom: 24,
      }}>
        <CampaignProgressBar
          currentAmount={currentAmount}
          fundingGoal={fundingGoal}
          backerCount={campaign.backer_count}
        />

        <div style={{
          display: 'flex', justifyContent: 'space-between',
          marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--panel-border)',
          fontSize: 13,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-dim)' }}>
            <Users size={14} />
            {campaign.backer_count} backer{campaign.backer_count !== 1 ? 's' : ''}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-dim)' }}>
            <Clock size={14} />
            {formatDeadline(campaign.deadline)}
          </div>
        </div>

        {/* Solo chapter tracker */}
        {campaign.campaign_type === 'solo' && campaign.chapter_count && (
          <div style={{
            marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--panel-border)',
            fontSize: 13, color: 'var(--text-dim)',
          }}>
            Chapters: {campaign.chapters_published || 0}/{campaign.chapter_count}
            {' '}({campaign.amount_per_chapter && `$${campaign.amount_per_chapter} per chapter`})
          </div>
        )}

        {/* Action buttons */}
        {campaign.status === 'active' && (
          <button
            onClick={() => {
              if (!user) {
                setShowAuthGate(true);
              } else {
                setShowContribute(true);
              }
            }}
            style={{
              width: '100%', padding: '14px 16px', borderRadius: 8,
              background: '#E8981F', border: 'none', color: '#fff',
              fontSize: 15, fontWeight: 700, cursor: 'pointer', marginTop: 16,
              boxShadow: '0 2px 8px rgba(232,152,31,0.25)',
            }}
          >
            Back this Project
          </button>
        )}

        {/* Creator: Transfer to Escrow (funded state) */}
        {campaign.status === 'funded' && isCreator && (
          <div style={{ marginTop: 16 }}>
            <button
              onClick={handleTransfer}
              style={{
                width: '100%', padding: '14px 16px', borderRadius: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                background: '#10b981', border: 'none', color: '#fff',
                fontSize: 15, fontWeight: 700, cursor: 'pointer',
              }}
            >
              <Rocket size={16} /> Begin Production — Transfer to Escrow
            </button>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', marginTop: 6 }}>
              {campaign.campaign_type === 'solo'
                ? 'Funds will auto-release as you publish chapters on renaissBlock.'
                : 'Set up collaborator contracts, then funds release per milestone.'}
            </div>
          </div>
        )}

        {/* Backer: Waiting for production (funded, not creator) */}
        {campaign.status === 'funded' && !isCreator && isBacker && (
          <div style={{
            marginTop: 16, padding: 12, borderRadius: 8,
            background: '#4f46e515', border: '1px solid #4f46e530', fontSize: 13, color: '#6d28d9', textAlign: 'center',
          }}>
            Awaiting creator to begin production. You'll be notified when work starts.
          </div>
        )}

        {/* Escrow PDA link (transferred/completed) */}
        {campaign.escrow_pda && (campaign.status === 'transferred' || campaign.status === 'completed') && (
          <div style={{
            marginTop: 12, fontSize: 11, color: 'var(--text-muted)', textAlign: 'center',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
          }}>
            Escrow: {campaign.escrow_pda.slice(0, 8)}...{campaign.escrow_pda.slice(-4)}
            <ExternalLink size={10} />
          </div>
        )}
      </div>

      {/* Production Tracker (transferred/completed solo campaigns) */}
      {(campaign.status === 'transferred' || campaign.status === 'completed') &&
        campaign.campaign_type === 'solo' && campaign.chapter_count && (
        <CampaignProductionTracker campaign={campaign} />
      )}

      {/* Backer Reclaim Panel (failed/reclaimable) */}
      {(campaign.status === 'failed' || campaign.status === 'reclaimable') && isBacker && (
        <BackerReclaimPanel
          campaign={campaign}
          userContribution={campaign.user_contribution || '0'}
          onReclaimed={loadCampaign}
        />
      )}

      {/* Description */}
      <div style={{
        background: 'var(--panel)', border: '1px solid var(--panel-border)',
        borderRadius: 12, padding: 24, marginBottom: 24,
      }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>
          About this Campaign
        </h2>
        <div style={{ fontSize: 14, color: 'var(--text-dim)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
          {campaign.description}
        </div>
      </div>

      {/* Rich pitch content */}
      {campaign.pitch_html && campaign.pitch_html !== '<p><br></p>' && (
        <div style={{
          background: 'var(--panel)', border: '1px solid var(--panel-border)',
          borderRadius: 12, padding: 24, marginBottom: 24,
        }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>
            The Pitch
          </h2>
          <div style={{ color: 'var(--text)', fontSize: 14, lineHeight: 1.7 }}
            dangerouslySetInnerHTML={{ __html: campaign.pitch_html }} />
        </div>
      )}

      {/* Team & Open Roles */}
      {((campaign.team_members && campaign.team_members.length > 0) || (campaign.open_roles && campaign.open_roles.length > 0)) && (
        <div style={{
          background: 'var(--panel)', border: '1px solid var(--panel-border)',
          borderRadius: 12, padding: 24, marginBottom: 24,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', margin: 0 }}>
              Team
            </h2>
            {campaign.team_completion_percentage != null && (
              <span style={{
                fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
                background: campaign.team_completion_percentage === 100 ? '#10b98115' : '#f59e0b15',
                color: campaign.team_completion_percentage === 100 ? '#10b981' : '#f59e0b',
              }}>
                {campaign.team_completion_percentage}% filled
              </span>
            )}
          </div>

          {/* Team members */}
          {campaign.team_members && campaign.team_members.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: campaign.open_roles?.length ? 16 : 0 }}>
              {campaign.team_members.map((member, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                  borderRadius: 10, border: '1px solid var(--panel-border)',
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%', background: '#8b5cf620',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    overflow: 'hidden', flexShrink: 0,
                  }}>
                    {member.avatar_url
                      ? <img src={member.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <User size={16} color="#8b5cf6" />
                    }
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
                      {member.display_name || member.username}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{member.role}</div>
                  </div>
                  <div style={{
                    fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 12,
                    background: '#10b98115', color: '#10b981', textTransform: 'uppercase',
                  }}>
                    Confirmed
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Open roles */}
          {campaign.open_roles && campaign.open_roles.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {campaign.open_roles.map((openRole, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                  borderRadius: 10, border: '1px dashed var(--panel-border)',
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%', background: '#f59e0b15',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <UserPlus size={16} color="#f59e0b" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
                      {openRole.role}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {openRole.milestone_count} milestone{openRole.milestone_count !== 1 ? 's' : ''} · ${openRole.budget}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{
                      fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 12,
                      background: '#f59e0b15', color: '#f59e0b', textTransform: 'uppercase',
                    }}>
                      Open
                    </div>
                    {openRole.interest_count > 0 && (
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                        {openRole.interest_count} interested
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Role Interest Management (creator only) */}
      {isCreator && roleInterests.filter(ri => ri.status === 'pending').length > 0 && (
        <div style={{
          background: 'var(--panel)', border: '1px solid var(--panel-border)',
          borderRadius: 12, padding: 24, marginBottom: 24,
        }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginBottom: 16 }}>
            Role Applications ({roleInterests.filter(ri => ri.status === 'pending').length} pending)
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {roleInterests.filter(ri => ri.status === 'pending').map(ri => (
              <div key={ri.id} style={{
                padding: 14, borderRadius: 10, border: '1px solid var(--panel-border)',
                display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%', background: '#8b5cf620',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <User size={16} color="#8b5cf6" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
                    {ri.display_name || ri.username}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    Applying for: {ri.role_name}
                  </div>
                  {ri.message && (
                    <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4, fontStyle: 'italic' }}>
                      "{ri.message}"
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button
                    onClick={async () => {
                      try {
                        await campaignApi.acceptRoleInterest(campaign!.id, ri.id);
                        loadCampaign();
                      } catch (err) { console.error(err); }
                    }}
                    style={{
                      padding: '6px 12px', borderRadius: 6, border: 'none',
                      background: '#10b981', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    Accept
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        await campaignApi.declineRoleInterest(campaign!.id, ri.id);
                        loadCampaign();
                      } catch (err) { console.error(err); }
                    }}
                    style={{
                      padding: '6px 12px', borderRadius: 6,
                      background: 'transparent', border: '1px solid var(--border)',
                      color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Production Progress */}
      {campaign.production_progress && (campaign.status === 'transferred' || campaign.status === 'completed') && (
        <div style={{
          background: 'var(--panel)', border: '1px solid var(--panel-border)',
          borderRadius: 12, padding: 24, marginBottom: 24,
        }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>
            Production Progress
          </h2>
          <div style={{
            height: 6, borderRadius: 3, background: 'var(--border)', marginBottom: 12, overflow: 'hidden',
          }}>
            <div style={{
              height: '100%', borderRadius: 3,
              background: 'linear-gradient(90deg, #10b981, #059669)',
              width: `${campaign.production_progress.percentage}%`,
              transition: 'width 0.5s ease',
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-muted)' }}>
            <span>{campaign.production_progress.completed} of {campaign.production_progress.total_milestones} milestones complete</span>
            <span style={{ fontWeight: 600, color: '#10b981' }}>{campaign.production_progress.percentage}%</span>
          </div>
        </div>
      )}

      {/* Reward Tiers */}
      {campaign.tiers && campaign.tiers.length > 0 && (
        <div style={{
          background: 'var(--panel)', border: '1px solid var(--panel-border)',
          borderRadius: 12, padding: 24, marginBottom: 24,
        }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginBottom: 16 }}>
            Reward Tiers
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {campaign.tiers.map((tier, i) => (
              <div key={tier.id || i} style={{
                padding: 16, borderRadius: 10,
                border: `1px solid ${tier.is_available ? 'var(--panel-border)' : '#ef444440'}`,
                background: tier.is_available ? 'transparent' : '#1c1917',
                opacity: tier.is_available ? 1 : 0.6,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{tier.title}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#10b981' }}>${tier.minimum_amount}+</span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.5 }}>{tier.description}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {tier.max_backers && (
                      <span>
                        {tier.current_backers || 0}/{tier.max_backers} claimed
                        {!tier.is_available && <span style={{ color: '#ef4444', marginLeft: 6 }}>Sold out</span>}
                      </span>
                    )}
                  </div>
                  {/* Fulfillment status */}
                  {tier.fulfillment_status && (campaign.status === 'transferred' || campaign.status === 'completed') && (
                    isCreator && tier.id ? (
                      <select
                        value={tier.fulfillment_status}
                        onChange={async (e) => {
                          try {
                            await campaignApi.updateTierFulfillment(campaign.id, tier.id!, e.target.value);
                            loadCampaign();
                          } catch (err) { console.error(err); }
                        }}
                        style={{
                          fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 8,
                          border: '1px solid var(--border)', background: 'var(--bg-secondary)',
                          color: tier.fulfillment_status === 'fulfilled' ? '#10b981' : tier.fulfillment_status === 'in_progress' ? '#f59e0b' : 'var(--text-muted)',
                          cursor: 'pointer',
                        }}
                      >
                        <option value="pending">Pending</option>
                        <option value="in_progress">In Progress</option>
                        <option value="fulfilled">Fulfilled</option>
                      </select>
                    ) : (
                      <span style={{
                        fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 8,
                        background: tier.fulfillment_status === 'fulfilled' ? '#10b98115' : tier.fulfillment_status === 'in_progress' ? '#f59e0b15' : '#6b728015',
                        color: tier.fulfillment_status === 'fulfilled' ? '#10b981' : tier.fulfillment_status === 'in_progress' ? '#f59e0b' : '#6b7280',
                        textTransform: 'uppercase',
                      }}>
                        {tier.fulfillment_status === 'in_progress' ? 'In Progress' : tier.fulfillment_status}
                      </span>
                    )
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Media Gallery */}
      {campaign.media && campaign.media.length > 0 && (
        <div style={{
          background: 'var(--panel)', border: '1px solid var(--panel-border)',
          borderRadius: 12, padding: 24, marginBottom: 24,
        }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginBottom: 16 }}>Gallery</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
            {campaign.media.map(m => (
              <div key={m.id} style={{ borderRadius: 8, overflow: 'hidden' }}>
                <img src={m.image} alt={m.caption} style={{ width: '100%', display: 'block' }} />
                {m.caption && <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '6px 0' }}>{m.caption}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Fee info */}
      <div style={{
        background: 'rgba(16,185,129,0.06)', borderRadius: 8, padding: 12, border: '1px solid rgba(16,185,129,0.15)',
        display: 'flex', gap: 10, fontSize: 12, color: '#4ade80',
        lineHeight: 1.5, marginBottom: 24,
      }}>
        <Shield size={16} style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          <strong>Backer protection.</strong> Funds are held in on-chain escrow (PDA).
          0% campaign fee. If the project fails, backers can reclaim their full contribution.
        </div>
      </div>

      {/* User's contribution */}
      {campaign.user_contribution && parseFloat(campaign.user_contribution) > 0 && (
        <div style={{
          background: 'rgba(59,130,246,0.06)', borderRadius: 8, padding: 12, border: '1px solid rgba(59,130,246,0.15)',
          fontSize: 13, color: '#93c5fd', marginBottom: 24,
        }}>
          You've contributed <strong>${campaign.user_contribution}</strong> to this campaign.
        </div>
      )}

      {/* Updates */}
      <div style={{
        background: 'var(--panel)', border: '1px solid var(--panel-border)',
        borderRadius: 12, padding: 24,
      }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginBottom: 16 }}>
          Updates ({updates.length})
        </h2>

        {/* Post update (creator only) */}
        {isCreator && campaign.status !== 'cancelled' && (
          <div style={{
            background: 'var(--chip-bg)', borderRadius: 8, padding: 12,
            marginBottom: 16, border: '1px dashed #4f46e540',
          }}>
            <div style={{ fontSize: 11, color: '#8b5cf6', marginBottom: 8, fontWeight: 600 }}>
              Creator Only — backers cannot see this form
            </div>
            <input
              value={updateTitle}
              onChange={(e) => setUpdateTitle(e.target.value)}
              placeholder="Update title"
              style={{
                width: '100%', padding: '8px 0', marginBottom: 8,
                background: 'transparent', border: 'none', borderBottom: '1px solid var(--panel-border)',
                color: 'var(--text)', fontSize: 14, outline: 'none',
              }}
            />
            <textarea
              value={updateBody}
              onChange={(e) => setUpdateBody(e.target.value)}
              placeholder="Share an update with your backers..."
              rows={3}
              style={{
                width: '100%', padding: '8px 0',
                background: 'transparent', border: 'none',
                color: 'var(--text)', fontSize: 13, outline: 'none', resize: 'none',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={handlePostUpdate}
                disabled={!updateTitle || !updateBody || postingUpdate}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '6px 14px', borderRadius: 6,
                  background: updateTitle && updateBody ? '#4f46e5' : 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                  color: updateTitle && updateBody ? '#fff' : 'var(--text-muted)',
                  fontSize: 12, cursor: updateTitle && updateBody ? 'pointer' : 'not-allowed',
                }}
              >
                <Send size={12} /> Post Update
              </button>
            </div>
          </div>
        )}

        {updates.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: 16 }}>
            No updates yet.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {updates.map(update => (
              <div key={update.id} style={{
                padding: 12, borderRadius: 8,
                border: '1px solid var(--panel-border)',
              }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
                  {update.title}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.5 }}>
                  {update.body}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
                  {new Date(update.created_at).toLocaleDateString()} by {update.author_username}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Contribution modal */}
      <CampaignContributionModal
        isOpen={showContribute}
        onClose={() => setShowContribute(false)}
        onContributed={loadCampaign}
        campaign={campaign}
      />

      {/* Auth gate for unauthenticated backers */}
      {showAuthGate && (
        <div
          onClick={() => setShowAuthGate(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#fff', borderRadius: 20, padding: '40px 36px',
              maxWidth: 420, width: '90%', textAlign: 'center',
              boxShadow: '0 16px 48px rgba(0,0,0,0.12)',
            }}
          >
            <div style={{
              width: 56, height: 56, borderRadius: '50%', background: 'rgba(232,152,31,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px', color: '#E8981F',
            }}>
              <Rocket size={28} />
            </div>
            <h3 style={{
              fontFamily: 'var(--font-heading)', fontSize: 24, fontWeight: 400,
              color: '#1a1816', margin: '0 0 8px', letterSpacing: '-0.02em',
            }}>
              Back this project
            </h3>
            <p style={{ fontSize: 15, color: '#6b6560', lineHeight: 1.6, margin: '0 0 28px' }}>
              Create a free account to back <strong>{campaign.title}</strong>. Your funds are protected by smart contract escrow.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                onClick={() => navigate('/auth', { state: { from: `/campaigns/${campaign.id}` } })}
                style={{
                  display: 'block', width: '100%', padding: '14px 24px', background: '#E8981F',
                  color: '#fff', borderRadius: 12, fontSize: 15, fontWeight: 700,
                  border: 'none', cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(232,152,31,0.25)',
                }}
              >
                Sign up to back — it's free
              </button>
              <button
                onClick={() => navigate('/auth', { state: { from: `/campaigns/${campaign.id}` } })}
                style={{
                  display: 'block', width: '100%', padding: '12px 24px', background: 'transparent',
                  color: '#6b6560', borderRadius: 12, fontSize: 14, fontWeight: 600,
                  border: '1px solid rgba(58,54,50,0.12)', cursor: 'pointer',
                }}
              >
                Already have an account? Sign in
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
