import React, { useState, useEffect } from 'react';
import { CollaborativeProject, ComicPage, ComicIssueListItem, collaborationApi } from '../../../services/collaborationApi';
import CopyrightPreview from '../../BookEditor/CopyrightPreview';
import { Check, Clock, PartyPopper, AlertCircle, Eye, DollarSign, PenLine, Lock, Unlock, BookOpen } from 'lucide-react';
import { CollaborationPreviewReader } from '../CollaborationPreviewReader';

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

  // Comic preview state
  const [showPreview, setShowPreview] = useState(false);
  const [comicPages, setComicPages] = useState<ComicPage[]>([]);
  const [loadingPages, setLoadingPages] = useState(false);

  // Per-issue mint state (comics only)
  const [comicIssues, setComicIssues] = useState<ComicIssueListItem[]>([]);
  const [mintMode, setMintMode] = useState<'issue' | 'series'>('issue');
  const [selectedIssueId, setSelectedIssueId] = useState<number | null>(null);
  const [issuePrices, setIssuePrices] = useState<Record<number, number>>({});

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

  // For comics: check comicPages instead of sections
  // When minting single issue, validate that the selected issue has pages
  const hasContentSections = project.content_type === 'comic'
    ? (mintMode === 'issue' && selectedIssueId
        ? (comicIssues.find(i => i.id === selectedIssueId)?.page_count ?? 0) > 0
        : comicPages.length > 0)
    : sections.length > 0;

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

  // Check for active breaches (any collaborator with uncured breach)
  const hasUncuredBreach = project.has_active_breach ||
    acceptedCollaborators.some(c => c.has_active_breach);

  // Check warranty of originality acknowledgments
  const allWarrantiesAcknowledged = acceptedCollaborators.every(
    c => c.warranty_of_originality_acknowledged !== false
  );

  // Check if all requirements are met
  // Items marked soloRelevant: true are shown for solo projects
  // Items marked soloRelevant: false are hidden for solo projects (collaboration-specific)
  const allChecklistItems = [
    {
      id: 'title',
      label: 'Valid project title',
      checked: titleValid,
      hint: !titleValid ? 'Set a title (min 3 characters, not a placeholder)' : undefined,
      soloRelevant: true,
    },
    {
      id: 'content',
      label: project.content_type === 'book'
        ? 'Book has text content (min 50 characters)'
        : project.content_type === 'comic'
          ? 'Comic has pages with artwork'
          : `${project.content_type.charAt(0).toUpperCase() + project.content_type.slice(1)} has media files`,
      checked: project.content_type === 'comic'
        ? hasContentSections  // For comics: just check that pages exist
        : hasContentSections && (project.content_type === 'book' ? hasValidTextContent : hasValidMediaContent),
      hint: !hasContentSections
        ? (project.content_type === 'comic' ? 'Add at least one page to your comic' : 'Add at least one section')
        : (project.content_type === 'book' && !hasValidTextContent)
          ? 'Add at least 50 characters of text'
          : undefined,
      soloRelevant: true,
    },
    {
      id: 'price',
      label: 'Price set (greater than $0)',
      checked: priceValid,
      hint: !priceValid ? 'Set a price for your NFT' : undefined,
      soloRelevant: true,
    },
    {
      id: 'editions',
      label: 'Edition count set',
      checked: editionsValid,
      hint: !editionsValid ? 'Set at least 1 edition' : undefined,
      soloRelevant: true,
    },
    {
      id: 'splits',
      label: 'Revenue splits total 100%',
      checked: Math.abs(collaborators.reduce((sum, c) => sum + parseFloat(String(c.revenue_percentage)), 0) - 100) < 0.01,
      soloRelevant: false, // Solo projects always have 100% to the creator
    },
    {
      id: 'tasks',
      label: 'All contract tasks signed off',
      checked: allTasksSignedOff,
      hint: !allTasksSignedOff
        ? `${incompleteTaskCount} task${incompleteTaskCount === 1 ? '' : 's'} still need sign-off`
        : undefined,
      soloRelevant: false, // Solo projects don't have contract tasks
    },
    {
      id: 'invited',
      label: 'All collaborators responded',
      checked: collaborators.every(c => c.status === 'accepted' || c.status === 'declined'),
      soloRelevant: false, // Solo projects don't have collaborator invitations
    },
    {
      id: 'approved',
      label: 'All collaborators approved',
      checked: project.is_fully_approved,
      soloRelevant: false, // Solo projects don't need team approval
    },
    {
      id: 'no_disputes',
      label: 'No active disputes',
      checked: !project.has_active_dispute,
      hint: project.has_active_dispute ? 'Resolve all disputes before minting' : undefined,
      soloRelevant: false, // Solo projects don't have disputes
    },
    {
      id: 'no_breaches',
      label: 'No uncured breaches',
      checked: !hasUncuredBreach,
      hint: hasUncuredBreach ? 'All breaches must be cured or resolved' : undefined,
      soloRelevant: false, // Solo projects don't have breach tracking
    },
    {
      id: 'warranty',
      label: 'All collaborators acknowledged warranty of originality',
      checked: allWarrantiesAcknowledged,
      hint: !allWarrantiesAcknowledged ? 'All collaborators must acknowledge their work is original' : undefined,
      soloRelevant: false, // Solo projects don't need team warranty acknowledgment
    },
  ];

  // Filter checklist based on whether this is a solo project
  const checklistItems = allChecklistItems.filter(item =>
    project.is_solo ? item.soloRelevant : true
  );

  const allChecked = checklistItems.every(item => item.checked);

  // Determine current step based on project state
  // Only auto-navigate to 'share' step when already minted/unpublished
  // Don't auto-jump to 'mint' - let users navigate through steps manually
  useEffect(() => {
    if (project.status === 'minted' || project.status === 'unpublished') {
      setStep('share');
    }
    // Removed: auto-jump to 'mint' when is_fully_approved
    // Users should go through customize -> approve -> mint flow
  }, [project.status]);

  // Fetch comic issues for per-issue minting
  useEffect(() => {
    if (project.content_type === 'comic') {
      collaborationApi.getComicIssues({ project: project.id })
        .then((issues) => {
          setComicIssues(issues);
          // Initialize prices from issue data
          const prices: Record<number, number> = {};
          issues.forEach(issue => {
            prices[issue.id] = issue.price || 1;
          });
          setIssuePrices(prices);
          // Auto-select first unminted issue
          const firstUnminted = issues.find(i => !i.is_published);
          if (firstUnminted) setSelectedIssueId(firstUnminted.id);
        })
        .catch(err => console.error('Failed to load comic issues:', err));
    }
  }, [project.id, project.content_type]);

  // Fetch comic pages for preview (if this is a comic project)
  // Pages are associated with issues, not directly with projects,
  // so we need to first get issues, then get pages for each issue
  useEffect(() => {
    if (project.content_type === 'comic') {
      setLoadingPages(true);

      // First get all issues for this project
      collaborationApi.getComicIssues({ project: project.id })
        .then(async (issues) => {
          if (issues.length === 0) {
            setComicPages([]);
            return;
          }

          // Get pages for each issue and combine them
          const allPagesPromises = issues.map(issue =>
            collaborationApi.getComicIssuePages(issue.id)
          );
          const pagesArrays = await Promise.all(allPagesPromises);
          const allPages = pagesArrays.flat();

          // Sort by issue number then page number for consistent ordering
          allPages.sort((a, b) => {
            if (a.issue !== b.issue) return (a.issue || 0) - (b.issue || 0);
            return a.page_number - b.page_number;
          });

          setComicPages(allPages);
        })
        .catch(err => console.error('Failed to load comic pages for preview:', err))
        .finally(() => setLoadingPages(false));
    }
  }, [project.id, project.content_type]);

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
      if (project.content_type === 'comic') {
        if (mintMode === 'issue' && selectedIssueId) {
          // Mint single issue
          await collaborationApi.prepareComicIssue(selectedIssueId);
          await collaborationApi.publishComicIssue(selectedIssueId);
          // Refresh issues list
          const updatedIssues = await collaborationApi.getComicIssues({ project: project.id });
          setComicIssues(updatedIssues);
          // Select next unminted issue
          const nextUnminted = updatedIssues.find(i => !i.is_published);
          setSelectedIssueId(nextUnminted?.id ?? null);
        } else if (mintMode === 'series') {
          // Mint entire series
          await collaborationApi.prepareAllComicIssues(project.id);
          await collaborationApi.publishAllComicIssues(project.id);
          const updatedIssues = await collaborationApi.getComicIssues({ project: project.id });
          setComicIssues(updatedIssues);
          setSelectedIssueId(null);
        }
        // Also mint the project-level NFT
        await collaborationApi.mintProject(project.id);
      } else {
        await collaborationApi.mintProject(project.id);
      }
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
        <>
          {/* Preview as Reader button for comics */}
          {project.content_type === 'comic' && (
            <div style={{
              background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(245, 158, 11, 0.05) 100%)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              borderRadius: 12,
              padding: 20,
              marginBottom: 20,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <h3 style={{ margin: 0, color: 'var(--text)', fontSize: 16, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <BookOpen size={20} style={{ color: '#f59e0b' }} />
                    Preview Your Comic
                  </h3>
                  <p style={{ margin: '6px 0 0', color: '#94a3b8', fontSize: 13 }}>
                    See exactly how readers will experience your comic before publishing.
                  </p>
                </div>
                <button
                  onClick={() => setShowPreview(true)}
                  disabled={loadingPages || comicPages.length === 0}
                  style={{
                    background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                    color: '#000',
                    border: 'none',
                    borderRadius: 8,
                    padding: '10px 20px',
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: loadingPages || comicPages.length === 0 ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    opacity: loadingPages || comicPages.length === 0 ? 0.6 : 1,
                  }}
                >
                  <Eye size={16} />
                  {loadingPages ? 'Loading...' : 'Preview as Reader'}
                </button>
              </div>
              {comicPages.length === 0 && !loadingPages && (
                <p style={{ margin: '12px 0 0', color: '#94a3b8', fontSize: 12, fontStyle: 'italic' }}>
                  Add pages to your comic in the Comic tab to enable preview.
                </p>
              )}
            </div>
          )}
          {/* Comic Per-Issue Mint Selector */}
          {project.content_type === 'comic' && comicIssues.length > 0 && (
            <div style={{
              background: 'var(--panel)',
              border: '1px solid var(--panel-border)',
              borderRadius: 16,
              overflow: 'hidden',
              marginBottom: 20,
            }}>
              <div style={{
                padding: '20px 24px',
                borderBottom: '1px solid var(--panel-border)',
                background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.05) 0%, transparent 100%)',
              }}>
                <h3 style={{ margin: 0, color: 'var(--text)', fontSize: 16, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <BookOpen size={20} style={{ color: '#8b5cf6' }} />
                  Mint Mode
                </h3>
                <p style={{ margin: '6px 0 0', color: '#94a3b8', fontSize: 13 }}>
                  Choose to mint individual issues or the entire series
                </p>
              </div>

              <div style={{ padding: 24 }}>
                {/* Mint mode radio */}
                <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
                  {[
                    { value: 'issue' as const, label: 'Mint Single Issue', desc: 'Mint one issue at a time' },
                    { value: 'series' as const, label: 'Mint Entire Series', desc: 'Mint all unpublished issues' },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => isProjectLead && setMintMode(opt.value)}
                      disabled={!isProjectLead}
                      style={{
                        flex: 1,
                        padding: '14px 16px',
                        background: mintMode === opt.value
                          ? 'linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(139, 92, 246, 0.05) 100%)'
                          : 'var(--bg)',
                        border: mintMode === opt.value
                          ? '2px solid #8b5cf6'
                          : '1px solid var(--panel-border)',
                        borderRadius: 12,
                        cursor: isProjectLead ? 'pointer' : 'not-allowed',
                        textAlign: 'left',
                      }}
                    >
                      <div style={{ fontSize: 14, fontWeight: 600, color: mintMode === opt.value ? '#8b5cf6' : 'var(--text)' }}>
                        {opt.label}
                      </div>
                      <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{opt.desc}</div>
                    </button>
                  ))}
                </div>

                {/* Issue list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {comicIssues.map(issue => {
                    const isMinted = issue.is_published;
                    const isSelected = mintMode === 'issue' && selectedIssueId === issue.id;
                    return (
                      <div
                        key={issue.id}
                        onClick={() => {
                          if (!isMinted && mintMode === 'issue' && isProjectLead) {
                            setSelectedIssueId(issue.id);
                          }
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '12px 16px',
                          background: isSelected
                            ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(245, 158, 11, 0.05) 100%)'
                            : isMinted ? 'rgba(100, 116, 139, 0.05)' : 'var(--bg)',
                          border: isSelected
                            ? '2px solid #f59e0b'
                            : '1px solid var(--panel-border)',
                          borderRadius: 10,
                          cursor: isMinted || mintMode !== 'issue' || !isProjectLead ? 'default' : 'pointer',
                          opacity: isMinted ? 0.6 : 1,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          {mintMode === 'issue' && (
                            <div style={{
                              width: 18, height: 18, borderRadius: 9,
                              border: isSelected ? '2px solid #f59e0b' : '2px solid var(--panel-border)',
                              background: isSelected ? '#f59e0b' : 'transparent',
                              display: 'grid', placeItems: 'center',
                            }}>
                              {isSelected && <div style={{ width: 8, height: 8, borderRadius: 4, background: '#fff' }} />}
                            </div>
                          )}
                          <div>
                            <div style={{
                              fontSize: 14, fontWeight: 500,
                              color: isMinted ? '#64748b' : 'var(--text)',
                            }}>
                              <span style={{ color: '#64748b', marginRight: 6 }}>#{issue.issue_number}</span>
                              {issue.title}
                            </div>
                            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                              {issue.page_count} pages
                            </div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          {isMinted ? (
                            <span style={{
                              background: 'rgba(16, 185, 129, 0.15)',
                              color: '#10b981',
                              fontSize: 11,
                              fontWeight: 700,
                              padding: '3px 8px',
                              borderRadius: 6,
                            }}>
                              Minted
                            </span>
                          ) : (
                            <span style={{ fontSize: 14, fontWeight: 600, color: '#10b981' }}>
                              ${(issuePrices[issue.id] || issue.price || 1).toFixed(2)}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Summary */}
                {mintMode === 'series' && (
                  <div style={{
                    marginTop: 16, padding: 12, background: 'rgba(139, 92, 246, 0.08)',
                    borderRadius: 8, fontSize: 13, color: '#94a3b8',
                  }}>
                    {comicIssues.filter(i => !i.is_published).length} issue(s) will be minted.
                    {comicIssues.filter(i => i.is_published).length > 0 && (
                      <span> ({comicIssues.filter(i => i.is_published).length} already minted)</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

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
          authorName={project.created_by_username || 'Creator'}
        />
        </>
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
          isSolo={project.is_solo}
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
          mintMode={project.content_type === 'comic' ? mintMode : undefined}
          selectedIssue={project.content_type === 'comic' && mintMode === 'issue'
            ? comicIssues.find(i => i.id === selectedIssueId) : undefined}
          unmintedCount={project.content_type === 'comic'
            ? comicIssues.filter(i => !i.is_published).length : undefined}
        />
      )}

      {step === 'share' && (
        <ShareStep
          project={project}
          isProjectLead={isProjectLead}
          onProjectUpdate={onProjectUpdate}
        />
      )}

      {/* Comic Preview Modal */}
      {showPreview && project.content_type === 'comic' && (
        <CollaborationPreviewReader
          pages={comicPages}
          project={project}
          onClose={() => setShowPreview(false)}
        />
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

  // Price input handling - use string for better UX
  const [priceInput, setPriceInput] = React.useState(price > 0 ? price.toString() : '');

  const handlePriceChange = (value: string) => {
    setPriceInput(value);
    const parsed = parseFloat(value);
    if (!isNaN(parsed) && parsed >= 0) {
      setPrice(parsed);
    } else if (value === '' || value === '.') {
      setPrice(0);
    }
  };

  const handlePriceBlur = () => {
    const parsed = parseFloat(priceInput);
    if (!isNaN(parsed) && parsed > 0) {
      setPriceInput(parsed.toFixed(2));
      setPrice(parsed);
    } else {
      setPriceInput('');
      setPrice(0);
    }
  };

  // Editions input handling - format with commas for display
  const [editionsInput, setEditionsInput] = React.useState(editions.toLocaleString('en-US'));

  const handleEditionsChange = (value: string) => {
    // Strip commas for processing, keep only digits
    const cleanValue = value.replace(/,/g, '');
    setEditionsInput(cleanValue);
    const parsed = parseInt(cleanValue);
    if (!isNaN(parsed) && parsed >= 1) {
      setEditions(parsed);
    }
  };

  const handleEditionsBlur = () => {
    const cleanValue = editionsInput.replace(/,/g, '');
    const parsed = parseInt(cleanValue);
    if (!isNaN(parsed) && parsed >= 1) {
      setEditionsInput(parsed.toLocaleString('en-US'));
      setEditions(parsed);
    } else {
      setEditionsInput('1');
      setEditions(1);
    }
  };

  // Teaser presets
  const teaserPresets = [
    { label: 'Sample', value: 10, description: 'Just a taste' },
    { label: 'Preview', value: 25, description: 'First quarter' },
    { label: 'Generous', value: 50, description: 'Half the content' },
    { label: 'Most', value: 75, description: 'Almost all' },
  ];

  // Calculate estimated revenue
  const grossRevenue = price * editions;
  const platformFee = grossRevenue * 0.10;
  const netRevenue = grossRevenue - platformFee;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {!isProjectLead && (
        <div style={{
          padding: 16,
          background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(245, 158, 11, 0.05) 100%)',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          borderRadius: 12,
          color: '#f59e0b',
          fontSize: 14,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}>
          <Lock size={20} />
          <span>Only the project owner can modify these settings.</span>
        </div>
      )}

      {/* Section 1: Free Preview Settings */}
      <div style={{
        background: 'var(--panel)',
        border: '1px solid var(--panel-border)',
        borderRadius: 16,
        overflow: 'hidden',
      }}>
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--panel-border)',
          background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.05) 0%, transparent 100%)',
        }}>
          <h3 style={{ margin: 0, color: 'var(--text)', fontSize: 16, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Eye size={20} style={{ color: '#3b82f6' }} />
            Free Preview
          </h3>
          <p style={{ margin: '6px 0 0', color: '#94a3b8', fontSize: 13 }}>
            How much of your content can non-buyers see?
          </p>
        </div>

        <div style={{ padding: 24 }}>
          {/* Visual Preview Bar */}
          <div style={{ marginBottom: 24 }}>
            <div style={{
              display: 'flex',
              height: 48,
              borderRadius: 12,
              overflow: 'hidden',
              border: '1px solid var(--panel-border)',
              background: 'var(--bg)',
            }}>
              <div style={{
                width: `${teaserPercent}%`,
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'width 0.3s ease',
                minWidth: teaserPercent > 0 ? 60 : 0,
              }}>
                {teaserPercent > 0 && (
                  <span style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>
                    Free {teaserPercent}%
                  </span>
                )}
              </div>
              <div style={{
                flex: 1,
                background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.2) 0%, rgba(245, 158, 11, 0.1) 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderLeft: teaserPercent > 0 && teaserPercent < 100 ? '2px dashed var(--panel-border)' : 'none',
              }}>
                {teaserPercent < 100 && (
                  <span style={{ color: '#f59e0b', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Lock size={14} /> Paid {100 - teaserPercent}%
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Preset Buttons */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 12,
            marginBottom: 20,
          }}>
            {teaserPresets.map((preset) => (
              <button
                key={preset.value}
                onClick={() => isProjectLead && setTeaserPercent(preset.value)}
                disabled={!isProjectLead}
                style={{
                  padding: '12px 8px',
                  background: teaserPercent === preset.value
                    ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
                    : 'var(--bg)',
                  border: teaserPercent === preset.value
                    ? 'none'
                    : '1px solid var(--panel-border)',
                  borderRadius: 10,
                  cursor: isProjectLead ? 'pointer' : 'not-allowed',
                  opacity: isProjectLead ? 1 : 0.6,
                  transition: 'all 0.2s ease',
                }}
              >
                <div style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: teaserPercent === preset.value ? '#111' : 'var(--text)',
                }}>
                  {preset.label}
                </div>
                <div style={{
                  fontSize: 11,
                  color: teaserPercent === preset.value ? '#333' : '#64748b',
                  marginTop: 2,
                }}>
                  {preset.value}%
                </div>
              </button>
            ))}
          </div>

          {/* Custom Slider */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: '#64748b' }}>Custom amount</span>
              <span style={{ fontSize: 12, color: 'var(--text)', fontWeight: 500 }}>{teaserPercent}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={teaserPercent}
              onChange={(e) => setTeaserPercent(parseInt(e.target.value))}
              disabled={!isProjectLead}
              style={{
                width: '100%',
                height: 6,
                borderRadius: 3,
                appearance: 'none',
                background: `linear-gradient(to right, #10b981 0%, #10b981 ${teaserPercent}%, var(--panel-border) ${teaserPercent}%, var(--panel-border) 100%)`,
                cursor: isProjectLead ? 'pointer' : 'not-allowed',
                opacity: isProjectLead ? 1 : 0.6,
              }}
            />
          </div>

          {/* Watermark Toggle */}
          <label style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 16px',
            background: 'var(--bg)',
            borderRadius: 10,
            cursor: isProjectLead ? 'pointer' : 'not-allowed',
            opacity: isProjectLead ? 1 : 0.6,
          }}>
            <div>
              <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 500 }}>
                Watermark preview
              </div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                Add subtle branding to free preview content
              </div>
            </div>
            <div style={{
              width: 44,
              height: 24,
              borderRadius: 12,
              background: watermark ? '#10b981' : 'var(--panel-border)',
              position: 'relative',
              transition: 'background 0.2s ease',
            }}>
              <div style={{
                width: 20,
                height: 20,
                borderRadius: 10,
                background: '#fff',
                position: 'absolute',
                top: 2,
                left: watermark ? 22 : 2,
                transition: 'left 0.2s ease',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              }} />
              <input
                type="checkbox"
                checked={watermark}
                onChange={(e) => setWatermark(e.target.checked)}
                disabled={!isProjectLead}
                style={{ opacity: 0, position: 'absolute', width: '100%', height: '100%', cursor: 'inherit' }}
              />
            </div>
          </label>
        </div>
      </div>

      {/* Section 2: Pricing */}
      <div style={{
        background: 'var(--panel)',
        border: '1px solid var(--panel-border)',
        borderRadius: 16,
        overflow: 'hidden',
      }}>
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--panel-border)',
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.05) 0%, transparent 100%)',
        }}>
          <h3 style={{ margin: 0, color: 'var(--text)', fontSize: 16, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 10 }}>
            <DollarSign size={20} style={{ color: '#10b981' }} />
            Pricing
          </h3>
          <p style={{ margin: '6px 0 0', color: '#94a3b8', fontSize: 13 }}>
            Set your price and edition count
          </p>
        </div>

        <div style={{ padding: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {/* Price Input */}
            <div>
              <label style={{ fontSize: 13, color: '#94a3b8', display: 'block', marginBottom: 10 }}>
                Price per edition
              </label>
              <div style={{ position: 'relative' }}>
                <span style={{
                  position: 'absolute',
                  left: 16,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#64748b',
                  fontSize: 18,
                  fontWeight: 500,
                }}>$</span>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={priceInput}
                  onChange={(e) => handlePriceChange(e.target.value.replace(/[^0-9.]/g, ''))}
                  onBlur={handlePriceBlur}
                  disabled={!isProjectLead}
                  style={{
                    width: '100%',
                    padding: '14px 16px 14px 36px',
                    background: 'var(--bg)',
                    border: '1px solid var(--panel-border)',
                    borderRadius: 10,
                    color: 'var(--text)',
                    fontSize: 18,
                    fontWeight: 500,
                    outline: 'none',
                    transition: 'border-color 0.2s ease',
                    cursor: isProjectLead ? 'text' : 'not-allowed',
                    opacity: isProjectLead ? 1 : 0.6,
                  }}
                />
                <span style={{
                  position: 'absolute',
                  right: 16,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#64748b',
                  fontSize: 12,
                }}>USD</span>
              </div>
            </div>

            {/* Editions Input */}
            <div>
              <label style={{ fontSize: 13, color: '#94a3b8', display: 'block', marginBottom: 10 }}>
                Number of editions
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="1"
                  value={editionsInput}
                  onChange={(e) => handleEditionsChange(e.target.value.replace(/[^0-9]/g, ''))}
                  onBlur={handleEditionsBlur}
                  disabled={!isProjectLead}
                  style={{
                    width: '100%',
                    padding: '14px 50px 14px 16px',
                    background: 'var(--bg)',
                    border: '1px solid var(--panel-border)',
                    borderRadius: 10,
                    color: 'var(--text)',
                    fontSize: 18,
                    fontWeight: 500,
                    outline: 'none',
                    transition: 'border-color 0.2s ease',
                    cursor: isProjectLead ? 'text' : 'not-allowed',
                    opacity: isProjectLead ? 1 : 0.6,
                  }}
                />
                <span style={{
                  position: 'absolute',
                  right: 16,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#64748b',
                  fontSize: 12,
                }}>copies</span>
              </div>
            </div>
          </div>

          {/* Revenue Preview */}
          {price > 0 && (
            <div style={{
              marginTop: 20,
              padding: 16,
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(16, 185, 129, 0.05) 100%)',
              borderRadius: 12,
              border: '1px solid rgba(16, 185, 129, 0.2)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>Potential earnings (if all sell)</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: '#10b981', marginTop: 4 }}>
                    ${netRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
                <div style={{ textAlign: 'right', fontSize: 12, color: '#64748b' }}>
                  <div>Gross: ${grossRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                  <div>Platform fee (10%): -${platformFee.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                </div>
              </div>
            </div>
          )}

          <p style={{ margin: '16px 0 0', fontSize: 12, color: '#64748b' }}>
            Changing price or editions will reset all revenue split approvals.
          </p>
        </div>
      </div>

      {/* Section 3: Author's Note */}
      <div style={{
        background: 'var(--panel)',
        border: '1px solid var(--panel-border)',
        borderRadius: 16,
        overflow: 'hidden',
      }}>
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--panel-border)',
          background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.05) 0%, transparent 100%)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: 0, color: 'var(--text)', fontSize: 16, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 10 }}>
                <PenLine size={20} style={{ color: '#8b5cf6' }} />
                Author's Note
                <span style={{ fontSize: 12, fontWeight: 400, color: '#64748b' }}>(optional)</span>
              </h3>
              <p style={{ margin: '6px 0 0', color: '#94a3b8', fontSize: 13 }}>
                Share a personal message with your audience
              </p>
            </div>
            <span style={{
              fontSize: 12,
              color: isOverLimit ? '#ef4444' : '#64748b',
              background: isOverLimit ? 'rgba(239, 68, 68, 0.1)' : 'var(--bg)',
              padding: '4px 10px',
              borderRadius: 20,
            }}>
              {wordCount}/{maxWords}
            </span>
          </div>
        </div>

        <div style={{ padding: 24 }}>
          <textarea
            value={authorsNote}
            onChange={(e) => setAuthorsNote(e.target.value)}
            placeholder="Share the story behind this work, thank your collaborators, or leave a message for your readers..."
            disabled={!isProjectLead}
            style={{
              width: '100%',
              minHeight: 120,
              padding: 16,
              background: 'var(--bg)',
              border: `1px solid ${isOverLimit ? '#ef4444' : 'var(--panel-border)'}`,
              borderRadius: 12,
              color: 'var(--text)',
              fontSize: 14,
              lineHeight: 1.6,
              resize: 'vertical',
              fontFamily: 'inherit',
              cursor: isProjectLead ? 'text' : 'not-allowed',
              opacity: isProjectLead ? 1 : 0.6,
              outline: 'none',
              transition: 'border-color 0.2s ease',
            }}
          />
          {isOverLimit && (
            <div style={{
              fontSize: 12,
              color: '#ef4444',
              marginTop: 8,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}>
              <AlertCircle size={14} />
              Please keep your note under {maxWords} words.
            </div>
          )}
        </div>
      </div>

      {/* Section 4: Copyright */}
      <CopyrightPreview authorName={authorName} />

      {/* Action Button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={onNext}
          disabled={(isProjectLead && saving) || isOverLimit}
          style={{
            padding: '14px 40px',
            background: (saving || isOverLimit)
              ? '#374151'
              : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
            border: 'none',
            borderRadius: 12,
            color: (saving || isOverLimit) ? '#9ca3af' : '#111',
            fontWeight: 700,
            fontSize: 15,
            cursor: (saving || isOverLimit) ? 'not-allowed' : 'pointer',
            boxShadow: (saving || isOverLimit)
              ? 'none'
              : '0 4px 14px rgba(245, 158, 11, 0.4)',
            transition: 'all 0.2s ease',
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
  isSolo: boolean;
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
  isSolo,
}: ApproveStepProps) {
  const userHasApproved = currentUserRole?.approved_current_version && currentUserRole?.approved_revenue_split;

  // For solo projects, we consider it "approved" when the user has confirmed their settings
  const isReadyToMint = isSolo ? true : project.is_fully_approved;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Status Banner */}
      <div style={{
        background: isReadyToMint
          ? 'rgba(16, 185, 129, 0.1)'
          : 'rgba(245, 158, 11, 0.1)',
        border: `1px solid ${isReadyToMint ? '#10b981' : '#f59e0b'}`,
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
          background: isReadyToMint
            ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
            : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 24,
        }}>
          {isReadyToMint ? <Check size={24} /> : <Clock size={24} />}
        </div>
        <div>
          <div style={{
            fontSize: 18,
            fontWeight: 700,
            color: isReadyToMint ? '#10b981' : '#f59e0b',
          }}>
            {isSolo
              ? (isReadyToMint ? 'Ready to Mint!' : 'Review Your Content')
              : (project.is_fully_approved ? 'All Approved!' : 'Awaiting Approvals')}
          </div>
          <div style={{ fontSize: 14, color: '#94a3b8', marginTop: 4 }}>
            {isSolo
              ? (isReadyToMint
                  ? 'Review and confirm your content before minting.'
                  : 'Review your content and proceed when ready.')
              : (project.is_fully_approved
                  ? 'All collaborators have approved. Proceed to mint.'
                  : 'Waiting for all collaborators to approve content and revenue split.')}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isSolo ? '1fr' : '1fr 1fr', gap: 20 }}>
        {/* Your Approval Actions (simplified for solo projects) */}
        <div style={{
          background: 'var(--panel)',
          border: '1px solid var(--panel-border)',
          borderRadius: 12,
          padding: 24,
        }}>
          <h3 style={{ margin: '0 0 16px', color: 'var(--text)', fontSize: 16 }}>
            {isSolo ? 'Confirm Your Content' : 'Your Approval'}
          </h3>

          {isSolo ? (
            // Solo project: simplified confirmation view
            <div style={{
              textAlign: 'center',
              padding: 24,
              background: 'rgba(16, 185, 129, 0.1)',
              borderRadius: 8,
            }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
                <Check size={48} style={{ color: '#10b981' }} />
              </div>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#10b981' }}>
                Your content is ready to mint
              </div>
              <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 8 }}>
                ${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} x {editions.toLocaleString('en-US')} editions = ${(price * editions * 0.9).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} net (after 10% platform fee)
              </div>
            </div>
          ) : userHasApproved ? (
            <div style={{
              textAlign: 'center',
              padding: 24,
              background: 'rgba(16, 185, 129, 0.1)',
              borderRadius: 8,
            }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
                <Check size={48} style={{ color: '#10b981' }} />
              </div>
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
                  ${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} x {editions.toLocaleString('en-US')} editions = ${(price * editions).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} gross.
                  Your share: {currentUserRole?.revenue_percentage || 0}% = ${userEstimatedEarnings.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (after 10% platform fee)
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

        {/* Team Approval Status (hidden for solo projects) */}
        {!isSolo && (
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
        )}
      </div>

      {/* Next Button - always show for solo projects, show when approved for collaborative */}
      {(isSolo || project.is_fully_approved) && (
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
            {isSolo ? 'Continue to Mint' : 'Next'}
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
  mintMode?: 'issue' | 'series';
  selectedIssue?: ComicIssueListItem;
  unmintedCount?: number;
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
  mintMode,
  selectedIssue,
  unmintedCount,
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

      {/* Comic mint target info */}
      {mintMode && (
        <div style={{
          padding: 12,
          background: 'rgba(139, 92, 246, 0.08)',
          border: '1px solid rgba(139, 92, 246, 0.2)',
          borderRadius: 8,
          marginBottom: 20,
          fontSize: 13,
          color: '#94a3b8',
        }}>
          {mintMode === 'issue' && selectedIssue ? (
            <span>Minting: <strong style={{ color: 'var(--text)' }}>Issue #{selectedIssue.issue_number} - {selectedIssue.title}</strong></span>
          ) : mintMode === 'series' ? (
            <span>Minting: <strong style={{ color: 'var(--text)' }}>{unmintedCount} issue(s)</strong> (entire series)</span>
          ) : null}
        </div>
      )}

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
            <span style={{ color: 'var(--text)' }}>${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Editions:</span>
            <span style={{ color: 'var(--text)' }}>{editions.toLocaleString('en-US')}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Gross Revenue (if all sold):</span>
            <span style={{ color: 'var(--text)' }}>${gross.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Platform Fee (10%):</span>
            <span style={{ color: '#ef4444' }}>-${platformFee.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--panel-border)', paddingTop: 8 }}>
            <span style={{ fontWeight: 600 }}>Creator Pool:</span>
            <span style={{ color: '#10b981', fontWeight: 600 }}>${net.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
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
          {minting ? 'Minting...' : mintMode === 'issue' ? 'Mint Issue' : mintMode === 'series' ? 'Mint All Issues' : 'Mint & Publish NFT'}
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

interface ShareStepProps {
  project: CollaborativeProject;
  isProjectLead: boolean;
  onProjectUpdate?: (project: CollaborativeProject) => void;
}

function ShareStep({ project, isProjectLead, onProjectUpdate }: ShareStepProps) {
  // Use /studio/ route since projects don't have a Content entry yet
  // TODO: Once backend creates Content on mint, switch to /content/${content_id}
  const projectUrl = `${window.location.origin}/studio/${project.id}`;
  const [copied, setCopied] = useState(false);
  const [unpublishing, setUnpublishing] = useState(false);
  const [republishing, setRepublishing] = useState(false);
  const [showUnpublishConfirm, setShowUnpublishConfirm] = useState(false);
  const [showRepublishConfirm, setShowRepublishConfirm] = useState(false);
  const [actionError, setActionError] = useState('');

  const isUnpublished = project.status === 'unpublished';

  const handleCopy = () => {
    navigator.clipboard.writeText(projectUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleUnpublish = async () => {
    setUnpublishing(true);
    setActionError('');
    try {
      await collaborationApi.unpublishProject(project.id);
      const updatedProject = await collaborationApi.getCollaborativeProject(project.id);
      onProjectUpdate?.(updatedProject);
      setShowUnpublishConfirm(false);
    } catch (err: any) {
      setActionError(err.message || 'Failed to unpublish');
    } finally {
      setUnpublishing(false);
    }
  };

  const handleRepublish = async () => {
    setRepublishing(true);
    setActionError('');
    try {
      await collaborationApi.republishProject(project.id);
      const updatedProject = await collaborationApi.getCollaborativeProject(project.id);
      onProjectUpdate?.(updatedProject);
      setShowRepublishConfirm(false);
    } catch (err: any) {
      setActionError(err.message || 'Failed to republish');
    } finally {
      setRepublishing(false);
    }
  };

  return (
    <div style={{
      background: 'var(--panel)',
      border: '1px solid var(--panel-border)',
      borderRadius: 12,
      padding: 24,
      textAlign: 'center',
    }}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
        <PartyPopper size={64} style={{ color: isUnpublished ? '#64748b' : '#f59e0b' }} />
      </div>
      <h3 style={{ margin: '0 0 8px', color: 'var(--text)', fontSize: 24 }}>
        {isUnpublished ? 'Project Unpublished' : 'Successfully Minted!'}
      </h3>
      <p style={{ fontSize: 14, color: '#94a3b8', marginBottom: 24 }}>
        {isUnpublished
          ? 'This project has been removed from the marketplace. Existing buyers retain access.'
          : 'Your collaborative NFT is now live. Share it with the world!'}
      </p>

      {actionError && (
        <div style={{
          padding: 12,
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid #ef4444',
          borderRadius: 8,
          color: '#ef4444',
          fontSize: 13,
          marginBottom: 16,
        }}>
          {actionError}
        </div>
      )}

      {!isUnpublished && (
        <>
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
            marginBottom: 32,
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
        </>
      )}

      {/* Unpublish/Republish Actions (Project Lead Only) */}
      {isProjectLead && (
        <div style={{
          borderTop: '1px solid var(--panel-border)',
          paddingTop: 24,
          marginTop: isUnpublished ? 0 : 8,
        }}>
          {isUnpublished ? (
            <button
              onClick={() => setShowRepublishConfirm(true)}
              disabled={republishing}
              style={{
                padding: '12px 24px',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                border: 'none',
                borderRadius: 8,
                color: '#fff',
                fontWeight: 600,
                cursor: republishing ? 'wait' : 'pointer',
                fontSize: 14,
                opacity: republishing ? 0.7 : 1,
              }}
            >
              {republishing ? 'Republishing...' : 'Re-list on Marketplace'}
            </button>
          ) : (
            <button
              onClick={() => setShowUnpublishConfirm(true)}
              disabled={unpublishing}
              style={{
                padding: '10px 20px',
                background: 'transparent',
                border: '1px solid #ef4444',
                borderRadius: 8,
                color: '#ef4444',
                fontWeight: 600,
                cursor: unpublishing ? 'wait' : 'pointer',
                fontSize: 13,
                opacity: unpublishing ? 0.7 : 1,
              }}
            >
              {unpublishing ? 'Unpublishing...' : 'Remove from Marketplace'}
            </button>
          )}
        </div>
      )}

      {/* Unpublish Confirmation Modal */}
      {showUnpublishConfirm && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setShowUnpublishConfirm(false)}
        >
          <div
            style={{
              background: 'var(--panel)',
              borderRadius: 12,
              padding: 24,
              maxWidth: 400,
              width: '90%',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{
              margin: 0,
              marginBottom: 16,
              fontSize: 18,
              fontWeight: 700,
              color: 'var(--text)',
            }}>
              Remove from Marketplace?
            </h3>
            <p style={{
              margin: 0,
              marginBottom: 16,
              fontSize: 14,
              color: '#94a3b8',
              lineHeight: 1.5,
            }}>
              This will remove your content from the marketplace. No new purchases can be made.
            </p>
            <p style={{
              margin: 0,
              marginBottom: 24,
              fontSize: 13,
              color: '#64748b',
              lineHeight: 1.5,
            }}>
              Existing buyers will keep access to their purchased content. You can re-list this content later.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowUnpublishConfirm(false)}
                disabled={unpublishing}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--panel-border)',
                  borderRadius: 6,
                  padding: '10px 20px',
                  color: 'var(--text)',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: 13,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleUnpublish}
                disabled={unpublishing}
                style={{
                  background: '#ef4444',
                  border: 'none',
                  borderRadius: 6,
                  padding: '10px 20px',
                  color: '#fff',
                  fontWeight: 600,
                  cursor: unpublishing ? 'wait' : 'pointer',
                  fontSize: 13,
                }}
              >
                {unpublishing ? 'Removing...' : 'Yes, Remove'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Republish Confirmation Modal */}
      {showRepublishConfirm && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setShowRepublishConfirm(false)}
        >
          <div
            style={{
              background: 'var(--panel)',
              borderRadius: 12,
              padding: 24,
              maxWidth: 400,
              width: '90%',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{
              margin: 0,
              marginBottom: 16,
              fontSize: 18,
              fontWeight: 700,
              color: 'var(--text)',
            }}>
              Re-list on Marketplace?
            </h3>
            <p style={{
              margin: 0,
              marginBottom: 24,
              fontSize: 14,
              color: '#94a3b8',
              lineHeight: 1.5,
            }}>
              This will make your content available for purchase again on the marketplace.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowRepublishConfirm(false)}
                disabled={republishing}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--panel-border)',
                  borderRadius: 6,
                  padding: '10px 20px',
                  color: 'var(--text)',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: 13,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleRepublish}
                disabled={republishing}
                style={{
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  border: 'none',
                  borderRadius: 6,
                  padding: '10px 20px',
                  color: '#fff',
                  fontWeight: 600,
                  cursor: republishing ? 'wait' : 'pointer',
                  fontSize: 13,
                }}
              >
                {republishing ? 'Listing...' : 'Yes, Re-list'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
