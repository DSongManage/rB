import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, Users, Shield, Send, AlertTriangle, PartyPopper, Rocket, ExternalLink } from 'lucide-react';
import campaignApi, { Campaign, CampaignUpdate as CampaignUpdateType } from '../services/campaignApi';
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

  const loadCampaign = async () => {
    if (!id) return;
    try {
      const campaignData = await campaignApi.getCampaign(parseInt(id));
      setCampaign(campaignData);
      // Updates may fail for non-authenticated users — don't break the page
      try {
        const updatesData = await campaignApi.getUpdates(parseInt(id));
        setUpdates(updatesData);
      } catch {
        setUpdates([]);
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
      <div className="page" style={{ textAlign: 'center', padding: 64, color: '#64748b' }}>
        Loading campaign...
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="page" style={{ textAlign: 'center', padding: 64, color: '#64748b' }}>
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
          background: 'none', border: 'none', color: '#64748b',
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
          <PartyPopper size={28} style={{ color: '#8b5cf6', marginBottom: 8 }} />
          <div style={{ fontSize: 18, fontWeight: 700, color: '#e2e8f0' }}>Campaign Funded!</div>
          <div style={{ fontSize: 13, color: '#a78bfa', marginTop: 4 }}>
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
            background: '#1e293b', color: '#94a3b8',
          }}>
            {campaign.campaign_type} / {campaign.content_type}
          </span>
        </div>

        <h1 style={{ fontSize: 28, fontWeight: 800, color: '#e2e8f0', marginBottom: 8 }}>
          {campaign.title}
        </h1>
        <div style={{ fontSize: 14, color: '#64748b' }}>
          by {campaign.creator_display_name || campaign.creator_username}
        </div>
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
          marginTop: 16, paddingTop: 16, borderTop: '1px solid #334155',
          fontSize: 13,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#94a3b8' }}>
            <Users size={14} />
            {campaign.backer_count} backer{campaign.backer_count !== 1 ? 's' : ''}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#94a3b8' }}>
            <Clock size={14} />
            {formatDeadline(campaign.deadline)}
          </div>
        </div>

        {/* Solo chapter tracker */}
        {campaign.campaign_type === 'solo' && campaign.chapter_count && (
          <div style={{
            marginTop: 16, paddingTop: 16, borderTop: '1px solid #334155',
            fontSize: 13, color: '#94a3b8',
          }}>
            Chapters: {campaign.chapters_published || 0}/{campaign.chapter_count}
            {' '}({campaign.amount_per_chapter && `$${campaign.amount_per_chapter} per chapter`})
          </div>
        )}

        {/* Action buttons */}
        {campaign.status === 'active' && (
          <button
            onClick={() => setShowContribute(true)}
            style={{
              width: '100%', padding: '14px 16px', borderRadius: 8,
              background: '#4f46e5', border: 'none', color: '#fff',
              fontSize: 15, fontWeight: 700, cursor: 'pointer', marginTop: 16,
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
            <div style={{ fontSize: 11, color: '#64748b', textAlign: 'center', marginTop: 6 }}>
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
            background: '#1e1b4b', fontSize: 13, color: '#a78bfa', textAlign: 'center',
          }}>
            Awaiting creator to begin production. You'll be notified when work starts.
          </div>
        )}

        {/* Escrow PDA link (transferred/completed) */}
        {campaign.escrow_pda && (campaign.status === 'transferred' || campaign.status === 'completed') && (
          <div style={{
            marginTop: 12, fontSize: 11, color: '#64748b', textAlign: 'center',
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
        <h2 style={{ fontSize: 16, fontWeight: 600, color: '#e2e8f0', marginBottom: 12 }}>
          About this Campaign
        </h2>
        <div style={{ fontSize: 14, color: '#94a3b8', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
          {campaign.description}
        </div>
      </div>

      {/* Rich pitch content */}
      {campaign.pitch_html && campaign.pitch_html !== '<p><br></p>' && (
        <div style={{
          background: 'var(--panel)', border: '1px solid var(--panel-border)',
          borderRadius: 12, padding: 24, marginBottom: 24,
        }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: '#e2e8f0', marginBottom: 12 }}>
            The Pitch
          </h2>
          <div className="ql-editor" style={{ color: '#cbd5e1', fontSize: 14, lineHeight: 1.7, padding: 0 }}
            dangerouslySetInnerHTML={{ __html: campaign.pitch_html }} />
        </div>
      )}

      {/* Reward Tiers */}
      {campaign.tiers && campaign.tiers.length > 0 && (
        <div style={{
          background: 'var(--panel)', border: '1px solid var(--panel-border)',
          borderRadius: 12, padding: 24, marginBottom: 24,
        }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: '#e2e8f0', marginBottom: 16 }}>
            Reward Tiers
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {campaign.tiers.map((tier, i) => (
              <div key={tier.id || i} style={{
                padding: 16, borderRadius: 10,
                border: `1px solid ${tier.is_available ? '#334155' : '#ef444440'}`,
                background: tier.is_available ? 'transparent' : '#1c1917',
                opacity: tier.is_available ? 1 : 0.6,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 15, fontWeight: 600, color: '#e2e8f0' }}>{tier.title}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#10b981' }}>${tier.minimum_amount}+</span>
                </div>
                <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.5 }}>{tier.description}</div>
                {tier.max_backers && (
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 6 }}>
                    {tier.current_backers || 0}/{tier.max_backers} claimed
                    {!tier.is_available && <span style={{ color: '#ef4444', marginLeft: 6 }}>Sold out</span>}
                  </div>
                )}
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
          <h2 style={{ fontSize: 16, fontWeight: 600, color: '#e2e8f0', marginBottom: 16 }}>Gallery</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
            {campaign.media.map(m => (
              <div key={m.id} style={{ borderRadius: 8, overflow: 'hidden' }}>
                <img src={m.image} alt={m.caption} style={{ width: '100%', display: 'block' }} />
                {m.caption && <div style={{ fontSize: 12, color: '#64748b', padding: '6px 0' }}>{m.caption}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Fee info */}
      <div style={{
        background: '#1e3b2f', borderRadius: 8, padding: 12,
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
          background: '#1e3a5f', borderRadius: 8, padding: 12,
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
        <h2 style={{ fontSize: 16, fontWeight: 600, color: '#e2e8f0', marginBottom: 16 }}>
          Updates ({updates.length})
        </h2>

        {/* Post update (creator only) */}
        {isCreator && campaign.status !== 'cancelled' && (
          <div style={{
            background: '#1e293b', borderRadius: 8, padding: 12,
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
                background: 'transparent', border: 'none', borderBottom: '1px solid #334155',
                color: '#e2e8f0', fontSize: 14, outline: 'none',
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
                color: '#e2e8f0', fontSize: 13, outline: 'none', resize: 'none',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={handlePostUpdate}
                disabled={!updateTitle || !updateBody || postingUpdate}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '6px 14px', borderRadius: 6,
                  background: updateTitle && updateBody ? '#4f46e5' : '#334155',
                  border: 'none', color: '#fff', fontSize: 12, cursor: 'pointer',
                }}
              >
                <Send size={12} /> Post Update
              </button>
            </div>
          </div>
        )}

        {updates.length === 0 ? (
          <div style={{ fontSize: 13, color: '#64748b', textAlign: 'center', padding: 16 }}>
            No updates yet.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {updates.map(update => (
              <div key={update.id} style={{
                padding: 12, borderRadius: 8,
                border: '1px solid #334155',
              }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0', marginBottom: 4 }}>
                  {update.title}
                </div>
                <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.5 }}>
                  {update.body}
                </div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 8 }}>
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
    </div>
  );
}
