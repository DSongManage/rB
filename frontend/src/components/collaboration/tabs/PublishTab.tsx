import React, { useState, useEffect } from 'react';
import { CollaborativeProject, collaborationApi } from '../../../services/collaborationApi';
import CopyrightPreview from '../../BookEditor/CopyrightPreview';

interface User {
  id: number;
  username: string;
  display_name?: string;
}

interface PublishTabProps {
  project: CollaborativeProject;
  currentUser: User;
  onProjectUpdate?: (project: CollaborativeProject) => void;
}

type PublishStep = 'customize' | 'approve' | 'mint' | 'share';

export default function PublishTab({
  project,
  currentUser,
  onProjectUpdate,
}: PublishTabProps) {
  const [step, setStep] = useState<PublishStep>('customize');
  const [minting, setMinting] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Customization state
  const [teaserPercent, setTeaserPercent] = useState(project.teaser_percent || 10);
  const [watermark, setWatermark] = useState(project.watermark_preview || false);
  const [price, setPrice] = useState(parseFloat(String(project.price_usd)) || 1);
  const [editions, setEditions] = useState(project.editions || 1);
  const [authorsNote, setAuthorsNote] = useState(project.authors_note || '');

  const collaborators = project.collaborators || [];
  const acceptedCollaborators = collaborators.filter(c => c.status === 'accepted');
  const sections = project.sections || [];

  const currentUserRole = collaborators.find(c => c.user === currentUser.id);
  const isProjectLead = project.created_by === currentUser.id;

  // Helper function to strip HTML tags and check content length
  const getTextContentLength = (html: string): number => {
    const stripped = (html || '')
      .replace(/<[^>]*>/g, '')  // Remove HTML tags
      .replace(/&nbsp;/g, ' ')  // Replace &nbsp;
      .trim();
    return stripped.length;
  };

  // Validation checks for minimum publishing criteria
  const titleValid = Boolean(
    project.title &&
    project.title.trim().length >= 3 &&
    !project.title.startsWith('Collaboration Invite')
  );

  const hasContentSections = sections.length > 0;

  // For books: check text content has at least 50 characters
  const textSections = sections.filter(s => s.section_type === 'text');
  const hasValidTextContent = project.content_type === 'book'
    ? textSections.some(s => getTextContentLength(s.content_html || '') >= 50)
    : true;

  // For art/music/video: check media files exist
  const mediaSections = sections.filter(s => s.section_type !== 'text');
  const hasValidMediaContent = ['art', 'music', 'video'].includes(project.content_type)
    ? mediaSections.some(s => s.media_file)
    : true;

  const priceValid = price > 0;
  const editionsValid = editions >= 1;

  // Check if all contract tasks are signed off
  const collaboratorsWithTasks = acceptedCollaborators.filter(c => (c.tasks_total || 0) > 0);
  const allTasksSignedOff = collaboratorsWithTasks.length === 0 ||
    collaboratorsWithTasks.every(c => c.all_tasks_complete);
  const incompleteTaskCount = collaboratorsWithTasks.reduce(
    (sum, c) => sum + ((c.tasks_total || 0) - (c.tasks_signed_off || 0)),
    0
  );

  // Check if all requirements are met
  const checklistItems = [
    {
      id: 'title',
      label: 'Valid project title',
      checked: titleValid,
      hint: !titleValid ? 'Set a title (min 3 characters, not a placeholder)' : undefined,
    },
    {
      id: 'content',
      label: project.content_type === 'book'
        ? 'Book has text content (min 50 characters)'
        : `${project.content_type.charAt(0).toUpperCase() + project.content_type.slice(1)} has media files`,
      checked: hasContentSections && (project.content_type === 'book' ? hasValidTextContent : hasValidMediaContent),
      hint: !hasContentSections
        ? 'Add at least one section'
        : (project.content_type === 'book' && !hasValidTextContent)
          ? 'Add at least 50 characters of text'
          : undefined,
    },
    {
      id: 'price',
      label: 'Price set (greater than $0)',
      checked: priceValid,
      hint: !priceValid ? 'Set a price for your NFT' : undefined,
    },
    {
      id: 'editions',
      label: 'Edition count set',
      checked: editionsValid,
      hint: !editionsValid ? 'Set at least 1 edition' : undefined,
    },
    {
      id: 'splits',
      label: 'Revenue splits total 100%',
      checked: Math.abs(collaborators.reduce((sum, c) => sum + parseFloat(String(c.revenue_percentage)), 0) - 100) < 0.01,
    },
    {
      id: 'tasks',
      label: 'All contract tasks signed off',
      checked: allTasksSignedOff,
      hint: !allTasksSignedOff
        ? `${incompleteTaskCount} task${incompleteTaskCount === 1 ? '' : 's'} still need sign-off`
        : undefined,
    },
    {
      id: 'invited',
      label: 'All collaborators responded',
      checked: collaborators.every(c => c.status === 'accepted' || c.status === 'declined'),
    },
    {
      id: 'approved',
      label: 'All collaborators approved',
      checked: project.is_fully_approved,
    },
  ];

  const allChecked = checklistItems.every(item => item.checked);

  // Determine current step based on project state
  useEffect(() => {
    if (project.status === 'minted') {
      setStep('share');
    } else if (project.is_fully_approved) {
      setStep('mint');
    }
  }, [project.status, project.is_fully_approved]);

  const handleSaveCustomization = async () => {
    if (!isProjectLead) return;

    setSaving(true);
    setError('');

    try {
      const updatedProject = await collaborationApi.updateCustomization(project.id, {
        price_usd: price,
        editions: editions,
        teaser_percent: teaserPercent,
        watermark_preview: watermark,
        authors_note: authorsNote,
      });
      onProjectUpdate?.(updatedProject);
      setStep('approve');
    } catch (err: any) {
      setError(err.message || 'Failed to save customization');
    } finally {
      setSaving(false);
    }
  };

  const handleApproveVersion = async () => {
    try {
      const updatedProject = await collaborationApi.approveCurrentVersion(project.id);
      onProjectUpdate?.(updatedProject);
    } catch (err: any) {
      setError(err.message || 'Failed to approve');
    }
  };

  const handleApproveRevenue = async () => {
    try {
      const updatedProject = await collaborationApi.approveProject(project.id, {
        approve_content: currentUserRole?.approved_current_version || false,
        approve_revenue: true,
      });
      onProjectUpdate?.(updatedProject);
    } catch (err: any) {
      setError(err.message || 'Failed to approve revenue split');
    }
  };

  const handleMint = async () => {
    if (!allChecked || !isProjectLead) return;

    setMinting(true);
    setError('');

    try {
      const result = await collaborationApi.mintProject(project.id);
      const updatedProject = await collaborationApi.getCollaborativeProject(project.id);
      onProjectUpdate?.(updatedProject);
      setStep('share');
    } catch (err: any) {
      setError(err.message || 'Failed to mint project');
    } finally {
      setMinting(false);
    }
  };

  const steps: { id: PublishStep; label: string }[] = [
    { id: 'customize', label: 'Customize' },
    { id: 'approve', label: 'Approve' },
    { id: 'mint', label: 'Mint' },
    { id: 'share', label: 'Share' },
  ];

  const stepIndex = steps.findIndex(s => s.id === step);

  // Calculate user's estimated earnings
  const creatorPool = price * 0.9 * editions;
  const userEstimatedEarnings = creatorPool * (currentUserRole?.revenue_percentage || 0) / 100;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Step Progress Bar */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${steps.length}, 1fr)`,
        gap: 8,
        alignItems: 'end',
      }}>
        {steps.map((s, i) => {
          const isCurrent = s.id === step;
          const isCompleted = i < stepIndex || project.status === 'minted';
          const canClick = i <= stepIndex || project.status === 'minted';

          return (
            <div
              key={s.id}
              onClick={() => canClick && setStep(s.id)}
              style={{ cursor: canClick ? 'pointer' : 'default' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 24,
                  height: 24,
                  borderRadius: 999,
                  border: '1px solid var(--panel-border)',
                  background: isCurrent ? 'var(--accent)' : isCompleted ? '#10b981' : 'var(--panel)',
                  color: isCurrent || isCompleted ? '#111' : 'var(--text-dim)',
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: 12,
                  fontWeight: 700,
                }}>
                  {isCompleted ? '✓' : i + 1}
                </div>
                <div style={{
                  fontSize: 13,
                  color: isCurrent ? 'var(--text)' : 'var(--text-dim)',
                  fontWeight: isCurrent ? 700 : 600,
                }}>
                  {s.label}
                </div>
              </div>
              <div style={{
                height: 3,
                marginTop: 6,
                borderRadius: 999,
                background: isCurrent
                  ? 'radial-gradient(60% 100% at 50% 100%, rgba(245,158,11,0.9), rgba(245,158,11,0.2))'
                  : isCompleted ? '#10b981' : 'transparent',
                boxShadow: isCurrent ? '0 0 8px rgba(245,158,11,0.7)' : 'none',
              }} />
            </div>
          );
        })}
      </div>

      {/* Back button */}
      {stepIndex > 0 && step !== 'share' && (
        <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
          <button
            onClick={() => setStep(steps[stepIndex - 1].id)}
            style={{
              background: 'transparent',
              border: '1px solid var(--panel-border)',
              color: 'var(--text-dim)',
              borderRadius: 8,
              padding: '6px 12px',
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            Back
          </button>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div style={{
          padding: 12,
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid #ef4444',
          borderRadius: 8,
          color: '#ef4444',
          fontSize: 13,
        }}>
          {error}
        </div>
      )}

      {/* Step Content */}
      {step === 'customize' && (
        <CustomizeStep
          isProjectLead={isProjectLead}
          teaserPercent={teaserPercent}
          setTeaserPercent={setTeaserPercent}
          watermark={watermark}
          setWatermark={setWatermark}
          price={price}
          setPrice={setPrice}
          editions={editions}
          setEditions={setEditions}
          authorsNote={authorsNote}
          setAuthorsNote={setAuthorsNote}
          onNext={isProjectLead ? handleSaveCustomization : () => setStep('approve')}
          saving={saving}
          authorName={project.creator_display_name || project.creator_username || 'Creator'}
        />
      )}

      {step === 'approve' && (
        <ApproveStep
          project={project}
          currentUser={currentUser}
          currentUserRole={currentUserRole}
          acceptedCollaborators={acceptedCollaborators}
          checklistItems={checklistItems}
          price={price}
          editions={editions}
          userEstimatedEarnings={userEstimatedEarnings}
          onApproveVersion={handleApproveVersion}
          onApproveRevenue={handleApproveRevenue}
          onNext={() => setStep('mint')}
        />
      )}

      {step === 'mint' && (
        <MintStep
          project={project}
          isProjectLead={isProjectLead}
          allChecked={allChecked}
          checklistItems={checklistItems}
          price={price}
          editions={editions}
          minting={minting}
          onMint={handleMint}
        />
      )}

      {step === 'share' && (
        <ShareStep project={project} />
      )}
    </div>
  );
}

// ===== Step Components =====

interface CustomizeStepProps {
  isProjectLead: boolean;
  teaserPercent: number;
  setTeaserPercent: (v: number) => void;
  watermark: boolean;
  setWatermark: (v: boolean) => void;
  price: number;
  setPrice: (v: number) => void;
  editions: number;
  setEditions: (v: number) => void;
  authorsNote: string;
  setAuthorsNote: (v: string) => void;
  onNext: () => void;
  saving: boolean;
  authorName: string;
}

// Helper to count words
function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(w => w.length > 0).length;
}

function CustomizeStep({
  isProjectLead,
  teaserPercent,
  setTeaserPercent,
  watermark,
  setWatermark,
  price,
  setPrice,
  editions,
  setEditions,
  authorsNote,
  setAuthorsNote,
  onNext,
  saving,
  authorName,
}: CustomizeStepProps) {
  const wordCount = countWords(authorsNote);
  const maxWords = 100;
  const isOverLimit = wordCount > maxWords;

  return (
    <div style={{
      background: 'var(--panel)',
      border: '1px solid var(--panel-border)',
      borderRadius: 12,
      padding: 24,
    }}>
      <h3 style={{ margin: '0 0 20px', color: 'var(--text)', fontSize: 18 }}>
        Customize Your NFT
      </h3>

      {!isProjectLead && (
        <div style={{
          padding: 16,
          background: 'rgba(245, 158, 11, 0.1)',
          borderRadius: 8,
          marginBottom: 20,
          color: '#f59e0b',
          fontSize: 13,
        }}>
          Only the project owner can modify these settings.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Teaser Slider */}
        <div>
          <label style={{ fontSize: 13, color: '#94a3b8', display: 'block', marginBottom: 8 }}>
            Teaser shown to public: {teaserPercent}%
          </label>
          <input
            type="range"
            min={0}
            max={100}
            value={teaserPercent}
            onChange={(e) => setTeaserPercent(parseInt(e.target.value))}
            disabled={!isProjectLead}
            style={{ width: '100%' }}
          />
        </div>

        {/* Watermark Checkbox */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: isProjectLead ? 'pointer' : 'not-allowed' }}>
          <input
            type="checkbox"
            checked={watermark}
            onChange={(e) => setWatermark(e.target.checked)}
            disabled={!isProjectLead}
          />
          <span style={{ fontSize: 13, color: 'var(--text)' }}>Show watermark on teaser</span>
        </label>

        {/* Price and Editions */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 8 }}>
              Price per edition (USD)
            </label>
            <input
              type="number"
              min={0.01}
              step={0.01}
              value={price}
              onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
              disabled={!isProjectLead}
              style={{
                width: '100%',
                padding: '10px 14px',
                background: 'var(--bg)',
                border: '1px solid var(--panel-border)',
                borderRadius: 8,
                color: 'var(--text)',
                fontSize: 16,
              }}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 8 }}>
              Number of editions
            </label>
            <input
              type="number"
              min={1}
              value={editions}
              onChange={(e) => setEditions(parseInt(e.target.value) || 1)}
              disabled={!isProjectLead}
              style={{
                width: '100%',
                padding: '10px 14px',
                background: 'var(--bg)',
                border: '1px solid var(--panel-border)',
                borderRadius: 8,
                color: 'var(--text)',
                fontSize: 16,
              }}
            />
          </div>
        </div>

        {/* Author's Note */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <label style={{ fontSize: 13, color: '#94a3b8' }}>
              Author's Note (optional)
            </label>
            <span style={{ fontSize: 11, color: isOverLimit ? '#ef4444' : '#64748b' }}>
              {wordCount}/{maxWords} words
            </span>
          </div>
          <textarea
            value={authorsNote}
            onChange={(e) => setAuthorsNote(e.target.value)}
            placeholder="Share a brief note about this work with your audience..."
            disabled={!isProjectLead}
            style={{
              width: '100%',
              minHeight: 80,
              padding: '10px 14px',
              background: 'var(--bg)',
              border: `1px solid ${isOverLimit ? '#ef4444' : 'var(--panel-border)'}`,
              borderRadius: 8,
              color: 'var(--text)',
              fontSize: 14,
              resize: 'vertical',
              fontFamily: 'inherit',
              cursor: isProjectLead ? 'text' : 'not-allowed',
              opacity: isProjectLead ? 1 : 0.6,
            }}
          />
          {isOverLimit && (
            <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>
              Please keep your note under {maxWords} words.
            </div>
          )}
        </div>

        <div style={{ fontSize: 12, color: '#64748b' }}>
          Platform fee applies per terms. Changing price or editions will reset all revenue split approvals.
        </div>

        {/* Copyright Preview */}
        <CopyrightPreview authorName={authorName} />
      </div>

      {/* Next Button */}
      <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={onNext}
          disabled={isProjectLead && saving}
          style={{
            padding: '12px 32px',
            background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
            border: 'none',
            borderRadius: 8,
            color: '#111',
            fontWeight: 700,
            fontSize: 14,
            cursor: (isProjectLead && saving) ? 'not-allowed' : 'pointer',
            opacity: (isProjectLead && saving) ? 0.7 : 1,
          }}
        >
          {isProjectLead ? (saving ? 'Saving...' : 'Save & Continue') : 'Continue to Approve'}
        </button>
      </div>
    </div>
  );
}

interface ApproveStepProps {
  project: CollaborativeProject;
  currentUser: User;
  currentUserRole: any;
  acceptedCollaborators: any[];
  checklistItems: { id: string; label: string; checked: boolean; hint?: string }[];
  price: number;
  editions: number;
  userEstimatedEarnings: number;
  onApproveVersion: () => void;
  onApproveRevenue: () => void;
  onNext: () => void;
}

function ApproveStep({
  project,
  currentUser,
  currentUserRole,
  acceptedCollaborators,
  checklistItems,
  price,
  editions,
  userEstimatedEarnings,
  onApproveVersion,
  onApproveRevenue,
  onNext,
}: ApproveStepProps) {
  const userHasApproved = currentUserRole?.approved_current_version && currentUserRole?.approved_revenue_split;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Status Banner */}
      <div style={{
        background: project.is_fully_approved
          ? 'rgba(16, 185, 129, 0.1)'
          : 'rgba(245, 158, 11, 0.1)',
        border: `1px solid ${project.is_fully_approved ? '#10b981' : '#f59e0b'}`,
        borderRadius: 12,
        padding: 20,
        display: 'flex',
        alignItems: 'center',
        gap: 16,
      }}>
        <div style={{
          width: 48,
          height: 48,
          borderRadius: '50%',
          background: project.is_fully_approved
            ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
            : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 24,
        }}>
          {project.is_fully_approved ? '✓' : '...'}
        </div>
        <div>
          <div style={{
            fontSize: 18,
            fontWeight: 700,
            color: project.is_fully_approved ? '#10b981' : '#f59e0b',
          }}>
            {project.is_fully_approved ? 'All Approved!' : 'Awaiting Approvals'}
          </div>
          <div style={{ fontSize: 14, color: '#94a3b8', marginTop: 4 }}>
            {project.is_fully_approved
              ? 'All collaborators have approved. Proceed to mint.'
              : 'Waiting for all collaborators to approve content and revenue split.'}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Your Approval Actions */}
        <div style={{
          background: 'var(--panel)',
          border: '1px solid var(--panel-border)',
          borderRadius: 12,
          padding: 24,
        }}>
          <h3 style={{ margin: '0 0 16px', color: 'var(--text)', fontSize: 16 }}>
            Your Approval
          </h3>

          {userHasApproved ? (
            <div style={{
              textAlign: 'center',
              padding: 24,
              background: 'rgba(16, 185, 129, 0.1)',
              borderRadius: 8,
            }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>✓</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#10b981' }}>
                You've approved this project
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ padding: 16, background: 'var(--bg)', borderRadius: 8 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>
                  Content Approval
                </div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 12 }}>
                  Confirm you're happy with all content in this project.
                </div>
                <button
                  onClick={onApproveVersion}
                  disabled={currentUserRole?.approved_current_version}
                  style={{
                    width: '100%',
                    padding: '10px 16px',
                    background: currentUserRole?.approved_current_version
                      ? '#374151'
                      : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                    border: 'none',
                    borderRadius: 8,
                    color: '#fff',
                    fontWeight: 600,
                    cursor: currentUserRole?.approved_current_version ? 'not-allowed' : 'pointer',
                    fontSize: 13,
                  }}
                >
                  {currentUserRole?.approved_current_version ? '✓ Content Approved' : 'Approve Content'}
                </button>
              </div>

              <div style={{ padding: 16, background: 'var(--bg)', borderRadius: 8 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>
                  Revenue Split Approval
                </div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 12 }}>
                  ${price.toFixed(2)} x {editions} editions = ${(price * editions).toFixed(2)} gross.
                  Your share: {currentUserRole?.revenue_percentage || 0}% = ${userEstimatedEarnings.toFixed(2)} (after 10% platform fee)
                </div>
                <button
                  onClick={onApproveRevenue}
                  disabled={currentUserRole?.approved_revenue_split}
                  style={{
                    width: '100%',
                    padding: '10px 16px',
                    background: currentUserRole?.approved_revenue_split
                      ? '#374151'
                      : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                    border: 'none',
                    borderRadius: 8,
                    color: '#fff',
                    fontWeight: 600,
                    cursor: currentUserRole?.approved_revenue_split ? 'not-allowed' : 'pointer',
                    fontSize: 13,
                  }}
                >
                  {currentUserRole?.approved_revenue_split ? '✓ Revenue Approved' : 'Approve Revenue Split'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Approval Progress */}
        <div style={{
          background: 'var(--panel)',
          border: '1px solid var(--panel-border)',
          borderRadius: 12,
          padding: 24,
        }}>
          <h3 style={{ margin: '0 0 16px', color: 'var(--text)', fontSize: 16 }}>
            Team Approval Status
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {acceptedCollaborators.map((collab) => {
              const hasApproved = collab.approved_current_version && collab.approved_revenue_split;
              return (
                <div
                  key={collab.id}
                  style={{
                    padding: 12,
                    background: hasApproved ? 'rgba(16, 185, 129, 0.1)' : 'var(--bg)',
                    border: `1px solid ${hasApproved ? '#10b981' : 'var(--panel-border)'}`,
                    borderRadius: 8,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      background: hasApproved
                        ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                        : 'linear-gradient(135deg, #64748b 0%, #475569 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontSize: 12,
                      fontWeight: 600,
                    }}>
                      {hasApproved ? '✓' : collab.username.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                        @{collab.username}
                      </div>
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>
                        {collab.role} - {collab.revenue_percentage}%
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <span style={{
                      fontSize: 10,
                      padding: '3px 6px',
                      borderRadius: 4,
                      background: collab.approved_current_version ? 'rgba(16, 185, 129, 0.1)' : 'rgba(100, 116, 139, 0.1)',
                      color: collab.approved_current_version ? '#10b981' : '#64748b',
                    }}>
                      {collab.approved_current_version ? '✓' : '○'} Content
                    </span>
                    <span style={{
                      fontSize: 10,
                      padding: '3px 6px',
                      borderRadius: 4,
                      background: collab.approved_revenue_split ? 'rgba(16, 185, 129, 0.1)' : 'rgba(100, 116, 139, 0.1)',
                      color: collab.approved_revenue_split ? '#10b981' : '#64748b',
                    }}>
                      {collab.approved_revenue_split ? '✓' : '○'} Revenue
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Next Button */}
      {project.is_fully_approved && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={onNext}
            style={{
              padding: '12px 32px',
              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              border: 'none',
              borderRadius: 8,
              color: '#111',
              fontWeight: 700,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

interface MintStepProps {
  project: CollaborativeProject;
  isProjectLead: boolean;
  allChecked: boolean;
  checklistItems: { id: string; label: string; checked: boolean; hint?: string }[];
  price: number;
  editions: number;
  minting: boolean;
  onMint: () => void;
}

function MintStep({
  project,
  isProjectLead,
  allChecked,
  checklistItems,
  price,
  editions,
  minting,
  onMint,
}: MintStepProps) {
  const [agree, setAgree] = useState(false);

  const gross = price * editions;
  const platformFee = gross * 0.1;
  const net = gross - platformFee;

  return (
    <div style={{
      background: 'var(--panel)',
      border: '1px solid var(--panel-border)',
      borderRadius: 12,
      padding: 24,
    }}>
      <h3 style={{ margin: '0 0 20px', color: 'var(--text)', fontSize: 18 }}>
        Review & Mint
      </h3>

      {/* Checklist */}
      <div style={{ marginBottom: 24 }}>
        <h4 style={{ margin: '0 0 12px', color: 'var(--text)', fontSize: 14 }}>Pre-mint Checklist</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {checklistItems.map((item) => (
            <div
              key={item.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                padding: 10,
                background: item.checked ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.05)',
                borderRadius: 6,
                border: item.checked ? 'none' : '1px solid rgba(239, 68, 68, 0.2)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  background: item.checked ? '#10b981' : '#ef4444',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontSize: 10,
                }}>
                  {item.checked ? '✓' : '!'}
                </div>
                <span style={{ fontSize: 13, color: item.checked ? '#10b981' : 'var(--text)' }}>
                  {item.label}
                </span>
              </div>
              {!item.checked && item.hint && (
                <span style={{ fontSize: 11, color: '#ef4444', marginLeft: 30 }}>
                  {item.hint}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Financial Summary */}
      <div style={{
        padding: 16,
        background: 'var(--bg)',
        borderRadius: 8,
        marginBottom: 24,
      }}>
        <h4 style={{ margin: '0 0 12px', color: 'var(--text)', fontSize: 14 }}>Financial Summary</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13, color: '#94a3b8' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Price per edition:</span>
            <span style={{ color: 'var(--text)' }}>${price.toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Editions:</span>
            <span style={{ color: 'var(--text)' }}>{editions}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Gross Revenue (if all sold):</span>
            <span style={{ color: 'var(--text)' }}>${gross.toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Platform Fee (10%):</span>
            <span style={{ color: '#ef4444' }}>-${platformFee.toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--panel-border)', paddingTop: 8 }}>
            <span style={{ fontWeight: 600 }}>Creator Pool:</span>
            <span style={{ color: '#10b981', fontWeight: 600 }}>${net.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Terms Agreement */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
          <a href="/legal/terms" target="_blank" rel="noreferrer" style={{ fontSize: 12, color: 'var(--accent)' }}>
            Terms of Service
          </a>
          <a href="/legal/creator-agreement" target="_blank" rel="noreferrer" style={{ fontSize: 12, color: 'var(--accent)' }}>
            Creator Agreement
          </a>
          <a href="/legal/content-policy" target="_blank" rel="noreferrer" style={{ fontSize: 12, color: 'var(--accent)' }}>
            Content Policy
          </a>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={agree}
            onChange={(e) => setAgree(e.target.checked)}
          />
          <span style={{ fontSize: 13, color: 'var(--text)' }}>
            I agree to the Terms and understand fees
          </span>
        </label>
      </div>

      {/* Mint Button */}
      {isProjectLead ? (
        <button
          onClick={onMint}
          disabled={!allChecked || !agree || minting}
          style={{
            width: '100%',
            padding: '14px 24px',
            background: allChecked && agree
              ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
              : '#374151',
            border: 'none',
            borderRadius: 8,
            color: '#fff',
            fontWeight: 700,
            fontSize: 16,
            cursor: allChecked && agree && !minting ? 'pointer' : 'not-allowed',
            opacity: allChecked && agree ? 1 : 0.5,
          }}
        >
          {minting ? 'Minting...' : 'Mint & Publish NFT'}
        </button>
      ) : (
        <div style={{
          textAlign: 'center',
          padding: 16,
          background: 'rgba(245, 158, 11, 0.1)',
          borderRadius: 8,
          color: '#f59e0b',
          fontSize: 14,
        }}>
          Waiting for project owner to mint the NFT.
        </div>
      )}

      <div style={{ fontSize: 11, color: '#64748b', marginTop: 12, textAlign: 'center' }}>
        Once minted, content cannot be changed.
      </div>
    </div>
  );
}

function ShareStep({ project }: { project: CollaborativeProject }) {
  // Use /collaborations/ route since collaborative projects don't have a Content entry yet
  // TODO: Once backend creates Content on mint, switch to /content/${content_id}
  const projectUrl = `${window.location.origin}/collaborations/${project.id}`;
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(projectUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{
      background: 'var(--panel)',
      border: '1px solid var(--panel-border)',
      borderRadius: 12,
      padding: 24,
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 64, marginBottom: 16 }}>🎉</div>
      <h3 style={{ margin: '0 0 8px', color: 'var(--text)', fontSize: 24 }}>
        Successfully Minted!
      </h3>
      <p style={{ fontSize: 14, color: '#94a3b8', marginBottom: 24 }}>
        Your collaborative NFT is now live. Share it with the world!
      </p>

      <div style={{
        display: 'flex',
        gap: 8,
        maxWidth: 500,
        margin: '0 auto 24px',
      }}>
        <input
          value={projectUrl}
          readOnly
          style={{
            flex: 1,
            padding: '10px 14px',
            background: 'var(--bg)',
            border: '1px solid var(--panel-border)',
            borderRadius: 8,
            color: 'var(--text)',
            fontSize: 13,
          }}
        />
        <button
          onClick={handleCopy}
          style={{
            padding: '10px 20px',
            background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
            border: 'none',
            borderRadius: 8,
            color: '#fff',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: 13,
          }}
        >
          {copied ? 'Copied!' : 'Copy Link'}
        </button>
      </div>

      <div style={{
        display: 'flex',
        justifyContent: 'center',
        gap: 16,
      }}>
        <a
          href={`https://twitter.com/intent/tweet?text=Check out our collaborative NFT!&url=${encodeURIComponent(projectUrl)}`}
          target="_blank"
          rel="noreferrer"
          style={{
            padding: '10px 20px',
            background: '#1DA1F2',
            borderRadius: 8,
            color: '#fff',
            fontWeight: 600,
            textDecoration: 'none',
            fontSize: 13,
          }}
        >
          Share on X
        </a>
      </div>
    </div>
  );
}
