import React, { useState, useEffect, useCallback } from 'react';
import {
  CollaborativeProject,
  ComicPage,
  ComicIssueListItem,
  ScriptData,
  ScriptPanel,
  PageStatus,
  collaborationApi,
} from '../../services/collaborationApi';
import {
  Plus,
  Trash2,
  Save,
  Loader2,
  FileText,
  ChevronRight,
  GripVertical,
  AlertCircle,
  BookOpen,
  ChevronDown,
  Hammer,
  Eye,
  X,
  ChevronLeft,
} from 'lucide-react';
import PageStatusBadge, { PageStatusDot } from './pages/PageStatusBadge';
import ReferenceImagesSection from './pages/ReferenceImagesSection';
import ArtDeliverySection from './pages/ArtDeliverySection';
import PageCommentsSection from './pages/PageCommentsSection';
import { useMobile } from '../../hooks/useMobile';

interface User {
  id: number;
  username: string;
  display_name?: string;
}

interface UnifiedWorkspaceEditorProps {
  project: CollaborativeProject;
  currentUser: User;
  onProjectUpdate?: (project: CollaborativeProject) => void;
}

function getLinkedTaskForPage(project: CollaborativeProject, pageNumber: number) {
  for (const collab of project.collaborators || []) {
    for (const task of collab.contract_tasks || []) {
      if (task.page_range_start != null && task.page_range_end != null &&
          pageNumber >= task.page_range_start && pageNumber <= task.page_range_end) {
        return {
          task_title: task.title,
          payment_amount: task.payment_amount,
          collaborator_username: collab.username || collab.display_name || 'collaborator',
          task_status: task.status,
          escrow_release_status: task.escrow_release_status,
          revision_limit: task.revision_limit,
          revisions_used: task.revisions_used,
        };
      }
    }
  }
  return null;
}

const createEmptyScriptData = (): ScriptData => ({
  page_description: '',
  panels: [],
});

const normalizeScriptData = (data: ScriptData | null | undefined): ScriptData => {
  if (!data) return createEmptyScriptData();
  return {
    page_description: data.page_description || '',
    panels: Array.isArray(data.panels) ? data.panels : [],
  };
};

const createEmptyPanel = (panelNumber: number): ScriptPanel => ({
  panel_number: panelNumber,
  scene: '',
  dialogue: '',
  notes: '',
});

export default function UnifiedWorkspaceEditor({
  project,
  currentUser,
  onProjectUpdate,
}: UnifiedWorkspaceEditorProps) {
  const { isPhone, isMobile } = useMobile();

  // Issue state
  const [issues, setIssues] = useState<ComicIssueListItem[]>([]);
  const [selectedIssueId, setSelectedIssueId] = useState<number | null>(null);
  const [loadingIssues, setLoadingIssues] = useState(true);

  const [pages, setPages] = useState<ComicPage[]>([]);
  const [selectedPageId, setSelectedPageId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Preview state
  const [showPreview, setShowPreview] = useState(false);
  const [previewPageIndex, setPreviewPageIndex] = useState(0);

  // Setup completion state (must be before any early returns)
  const [completingSetup, setCompletingSetup] = useState(false);
  const [setupError, setSetupError] = useState('');

  // Current page's script data (local state for editing)
  const [scriptData, setScriptData] = useState<ScriptData>(createEmptyScriptData());

  // Permissions — use loose equality for created_by in case of number/string mismatch
  const currentUserRole = project.collaborators?.find(c => c.user === currentUser.id);
  const isProjectOwner = String(project.created_by) === String(currentUser.id);
  const canEditScript = currentUserRole?.effective_permissions?.edit?.types?.includes('script') ||
    currentUserRole?.can_edit?.includes('script') ||
    currentUserRole?.can_edit?.includes('text') ||
    currentUserRole?.role?.toLowerCase().includes('writer') ||
    currentUserRole?.role?.toLowerCase().includes('author') ||
    isProjectOwner;
  const canUploadArt = currentUserRole?.can_edit_images ||
    currentUserRole?.role?.toLowerCase().includes('artist') ||
    isProjectOwner;
  const canReview = isProjectOwner;

  // Load issues on mount
  useEffect(() => {
    loadIssues();
  }, [project.id]);

  // Load pages when issue selection changes
  useEffect(() => {
    if (selectedIssueId) {
      loadPagesForIssue(selectedIssueId);
    }
  }, [selectedIssueId]);

  const loadIssues = async () => {
    setLoadingIssues(true);
    setError('');
    try {
      const issuesData = await collaborationApi.getComicIssues({ project: project.id });
      setIssues(issuesData);
      if (issuesData.length > 0) {
        setSelectedIssueId(issuesData[0].id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load issues');
    } finally {
      setLoadingIssues(false);
    }
  };

  const loadPagesForIssue = async (issueId: number) => {
    setLoading(true);
    setError('');
    try {
      const pagesData = await collaborationApi.getComicIssuePages(issueId);
      setPages(pagesData.sort((a, b) => a.page_number - b.page_number));
      if (pagesData.length > 0) {
        const firstPage = pagesData[0];
        setSelectedPageId(firstPage.id);
        setScriptData(normalizeScriptData(firstPage.script_data));
      } else {
        setSelectedPageId(null);
        setScriptData(createEmptyScriptData());
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load pages');
    } finally {
      setLoading(false);
    }
  };

  const handlePageSelect = useCallback((pageId: number) => {
    if (hasUnsavedChanges && selectedPageId) {
      saveCurrentPage();
    }
    const page = pages.find(p => p.id === pageId);
    setSelectedPageId(pageId);
    setScriptData(normalizeScriptData(page?.script_data));
    setHasUnsavedChanges(false);
  }, [pages, hasUnsavedChanges, selectedPageId]);

  const saveCurrentPage = async () => {
    if (!selectedPageId || !canEditScript) return;
    setSaving(true);
    try {
      await collaborationApi.updateComicPage(selectedPageId, {
        script_data: scriptData,
      });
      setPages(prev => prev.map(p =>
        p.id === selectedPageId ? { ...p, script_data: scriptData } : p
      ));
      setHasUnsavedChanges(false);
    } catch (err: any) {
      setError(err.message || 'Failed to save script');
    } finally {
      setSaving(false);
    }
  };

  // Auto-save with debounce
  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const timer = setTimeout(() => { saveCurrentPage(); }, 2000);
    return () => clearTimeout(timer);
  }, [scriptData, hasUnsavedChanges]);

  const handlePageDescriptionChange = (value: string) => {
    setScriptData(prev => ({ ...prev, page_description: value }));
    setHasUnsavedChanges(true);
  };

  const handleAddPanel = () => {
    const newPanelNumber = (scriptData.panels.length > 0
      ? Math.max(...scriptData.panels.map(p => p.panel_number)) + 1
      : 1);
    setScriptData(prev => ({
      ...prev,
      panels: [...prev.panels, createEmptyPanel(newPanelNumber)],
    }));
    setHasUnsavedChanges(true);
  };

  const handlePanelChange = (panelNumber: number, field: keyof ScriptPanel, value: string | number) => {
    setScriptData(prev => ({
      ...prev,
      panels: prev.panels.map(p =>
        p.panel_number === panelNumber ? { ...p, [field]: value } : p
      ),
    }));
    setHasUnsavedChanges(true);
  };

  const handleDeletePanel = (panelNumber: number) => {
    setScriptData(prev => ({
      ...prev,
      panels: prev.panels.filter(p => p.panel_number !== panelNumber),
    }));
    setHasUnsavedChanges(true);
  };

  const handleAddPage = async () => {
    if (!selectedIssueId) {
      setError('Please select an issue first');
      return;
    }
    try {
      const newPage = await collaborationApi.createComicPage({
        issue: selectedIssueId,
        script_data: createEmptyScriptData(),
      });
      setPages(prev => [...prev, newPage].sort((a, b) => a.page_number - b.page_number));
      setSelectedPageId(newPage.id);
      setScriptData(createEmptyScriptData());
      setHasUnsavedChanges(false);
    } catch (err: any) {
      setError(err.message || 'Failed to create page');
    }
  };

  const handleDeletePage = async (pageId: number) => {
    if (!confirm('Are you sure you want to delete this page? This cannot be undone.')) return;
    try {
      await collaborationApi.deleteComicPage(pageId);
      const updatedPages = pages.filter(p => p.id !== pageId);
      setPages(updatedPages);
      if (selectedPageId === pageId) {
        if (updatedPages.length > 0) {
          const newSelected = updatedPages[0];
          setSelectedPageId(newSelected.id);
          setScriptData(normalizeScriptData(newSelected.script_data));
        } else {
          setSelectedPageId(null);
          setScriptData(createEmptyScriptData());
        }
      }
      setHasUnsavedChanges(false);
    } catch (err: any) {
      setError(err.message || 'Failed to delete page');
    }
  };

  const handlePageStatusChange = (pageId: number, newStatus: string) => {
    setPages(prev => prev.map(p =>
      p.id === pageId ? { ...p, page_status: newStatus as PageStatus } : p
    ));
  };

  const handleReferenceImagesChange = (pageId: number, images: any[]) => {
    setPages(prev => prev.map(p =>
      p.id === pageId ? { ...p, reference_images: images } : p
    ));
  };

  const handleArtDeliveriesChange = (pageId: number, deliveries: any[]) => {
    setPages(prev => prev.map(p =>
      p.id === pageId ? { ...p, art_deliveries: deliveries } : p
    ));
  };

  const selectedPage = pages.find(p => p.id === selectedPageId);

  // Pages that have at least one art delivery (for preview)
  const pagesWithArt = pages
    .filter(p => p.art_deliveries && p.art_deliveries.length > 0)
    .sort((a, b) => a.page_number - b.page_number);

  if (loadingIssues) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: 400, color: 'var(--text-muted)',
      }}>
        <Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} />
        <span style={{ marginLeft: 12 }}>Loading workspace...</span>
      </div>
    );
  }

  if (project.content_type !== 'comic') {
    return (
      <div style={{
        background: 'var(--panel)', border: '1px solid var(--panel-border)',
        borderRadius: 12, padding: 40, textAlign: 'center',
      }}>
        <Hammer size={48} style={{ color: 'var(--text-muted)', marginBottom: 16 }} />
        <h3 style={{ margin: '0 0 8px', color: 'var(--text)', fontSize: 18 }}>Workspace</h3>
        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 14 }}>
          The workspace is only available for comic projects.
        </p>
      </div>
    );
  }

  // ── Workspace access gating ──
  // Non-owners see holding state if workspace isn't set up or funded
  const hasEscrowCollaborators = project.collaborators?.some(
    c => c.contract_type === 'work_for_hire' || c.contract_type === 'hybrid'
  );

  if (!isProjectOwner && hasEscrowCollaborators) {
    const myRole = project.collaborators?.find(c => c.user === currentUser.id);
    const isEscrowRole = myRole && (myRole.contract_type === 'work_for_hire' || myRole.contract_type === 'hybrid');

    if (isEscrowRole) {
      // Check if workspace is set up
      if (!project.workspace_setup_complete) {
        return (
          <div style={{
            background: 'var(--panel)', border: '1px solid var(--panel-border)',
            borderRadius: 12, padding: 48, textAlign: 'center', maxWidth: 480, margin: '40px auto',
          }}>
            <FileText size={48} style={{ color: 'var(--text-muted)', marginBottom: 16 }} />
            <h3 style={{ fontFamily: 'var(--font-heading)', margin: '0 0 8px', color: 'var(--text)', fontSize: 22, fontWeight: 400 }}>
              Workspace is being prepared
            </h3>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.6 }}>
              The project owner is setting up your workspace — writing page briefs, adding references, and defining deliverables. You'll be notified when it's ready to work on.
            </p>
          </div>
        );
      }

      // Workspace set up but escrow not funded
      const escrowFunded = myRole.escrow_funded_amount && parseFloat(myRole.escrow_funded_amount) > 0;
      if (!escrowFunded) {
        return (
          <div style={{
            background: 'var(--panel)', border: '1px solid var(--panel-border)',
            borderRadius: 12, padding: 48, textAlign: 'center', maxWidth: 480, margin: '40px auto',
          }}>
            <FileText size={48} style={{ color: '#f59e0b', marginBottom: 16 }} />
            <h3 style={{ fontFamily: 'var(--font-heading)', margin: '0 0 8px', color: 'var(--text)', fontSize: 22, fontWeight: 400 }}>
              Workspace ready — awaiting funding
            </h3>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.6 }}>
              Your workspace has been set up. The project owner needs to fund the escrow before production begins. You'll be notified when funding is complete.
            </p>
          </div>
        );
      }
    }
  }

  const handleCreateFirstIssue = async () => {
    setError('');
    try {
      const issue = await collaborationApi.createComicIssue({
        project: project.id,
        title: 'Issue #1',
        issue_number: 1,
      });
      // Auto-create first page
      const page = await collaborationApi.createComicPage({
        issue: issue.id,
        script_data: createEmptyScriptData(),
      });
      setIssues([issue]);
      setSelectedIssueId(issue.id);
      setPages([page]);
      setSelectedPageId(page.id);
      setScriptData(createEmptyScriptData());
    } catch (err: any) {
      setError(err.message || 'Failed to create issue');
    }
  };

  if (issues.length === 0) {
    return (
      <div style={{
        background: 'var(--panel)', border: '1px solid var(--panel-border)',
        borderRadius: 12, padding: 48, textAlign: 'center', maxWidth: 480, margin: '40px auto',
      }}>
        <BookOpen size={48} style={{ color: '#E8981F', marginBottom: 16 }} />
        <h3 style={{ fontFamily: 'var(--font-heading)', margin: '0 0 8px', color: 'var(--text)', fontSize: 22, fontWeight: 400 }}>
          Start your first issue
        </h3>
        <p style={{ margin: '0 0 24px', color: '#6b6560', fontSize: 14, lineHeight: 1.6 }}>
          Issues organize your comic into chapters or volumes. We'll create Issue #1 with a blank first page to get you started.
        </p>
        {error && (
          <div style={{ color: '#ef4444', fontSize: 13, marginBottom: 12 }}>{error}</div>
        )}
        <button
          onClick={handleCreateFirstIssue}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '14px 28px', background: '#E8981F', color: '#fff', border: 'none',
            borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(232,152,31,0.25)', fontFamily: 'var(--font-body)',
          }}
        >
          <Plus size={18} /> Create Issue #1
        </button>
      </div>
    );
  }

  // Setup completion handler for project owner
  const handleCompleteSetup = async () => {
    setCompletingSetup(true);
    setSetupError('');
    try {
      const { API_URL } = await import('../../config');
      const res = await fetch(`${API_URL}/api/collaborative-projects/${project.id}/workspace/complete-setup/`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': document.cookie.match(/csrftoken=([^;]+)/)?.[1] || '',
        },
      });
      const data = await res.json();
      if (!res.ok) {
        setSetupError(data.error || 'Setup incomplete');
        if (data.missing) setSetupError(data.missing.join('\n'));
      } else {
        onProjectUpdate?.({ ...project, workspace_setup_complete: true } as any);
      }
    } catch (err: any) {
      setSetupError(err.message || 'Failed to complete setup');
    } finally {
      setCompletingSetup(false);
    }
  };

  // Count pages with descriptions for setup progress
  const totalPageCount = pages.length;
  const pagesWithDesc = pages.filter(p => {
    const desc = (p.script_data as any)?.page_description || '';
    return desc.trim().length > 0;
  }).length;

  return (
    <div>
      {/* Setup banner for project owner */}
      {isProjectOwner && !project.workspace_setup_complete && hasEscrowCollaborators && totalPageCount > 0 && (
        <div style={{
          background: 'linear-gradient(135deg, #f59e0b15 0%, #8b5cf615 100%)',
          border: '1px solid #f59e0b40',
          borderRadius: 12, padding: 16, marginBottom: 16,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: 12,
        }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
              Workspace Setup — {pagesWithDesc}/{totalPageCount} pages have descriptions
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Write page briefs for your artist. Complete setup to notify them and fund escrow.
            </div>
            {setupError && (
              <div style={{ fontSize: 12, color: '#ef4444', marginTop: 6, whiteSpace: 'pre-line' }}>{setupError}</div>
            )}
          </div>
          <button
            onClick={handleCompleteSetup}
            disabled={completingSetup || pagesWithDesc < totalPageCount}
            style={{
              padding: '10px 20px', borderRadius: 8, border: 'none',
              background: pagesWithDesc >= totalPageCount ? '#10b981' : 'var(--bg-secondary)',
              color: pagesWithDesc >= totalPageCount ? '#fff' : 'var(--text-muted)',
              fontSize: 13, fontWeight: 600,
              cursor: pagesWithDesc >= totalPageCount ? 'pointer' : 'not-allowed',
            }}
          >
            {completingSetup ? 'Completing...' : 'Complete Setup'}
          </button>
        </div>
      )}

    <div style={{
      display: 'flex',
      flexDirection: isPhone ? 'column' : 'row',
      gap: isPhone ? 12 : 24,
      height: isPhone ? undefined : 'calc(100vh - 280px)',
      minHeight: isPhone ? undefined : 500,
    }}>
      {/* Page List Sidebar */}
      <div style={{
        width: isPhone ? '100%' : (isMobile ? 180 : 220),
        flexShrink: 0,
        background: 'var(--panel)', border: '1px solid var(--panel-border)',
        borderRadius: isPhone ? 8 : 12, display: 'flex',
        flexDirection: isPhone ? 'row' : 'column',
        ...(isPhone ? { maxHeight: 120, overflowX: 'auto', overflowY: 'hidden' } : {}),
      }}>
        {/* Issue Selector */}
        {!isPhone && (
        <div style={{ padding: 12, borderBottom: '1px solid var(--panel-border)' }}>
          <label style={{
            display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 600,
            color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px',
          }}>
            Issue
          </label>
          <div style={{ position: 'relative' }}>
            <select
              value={selectedIssueId || ''}
              onChange={(e) => {
                const id = Number(e.target.value);
                if (id) {
                  if (hasUnsavedChanges && selectedPageId) saveCurrentPage();
                  setSelectedIssueId(id);
                }
              }}
              style={{
                width: '100%', padding: '8px 28px 8px 10px',
                background: 'var(--bg)', border: '1px solid var(--panel-border)',
                borderRadius: 6, color: 'var(--text)', fontSize: 13,
                cursor: 'pointer', appearance: 'none',
              }}
            >
              {issues.map(issue => (
                <option key={issue.id} value={issue.id}>
                  #{issue.issue_number}: {issue.title}
                </option>
              ))}
            </select>
            <ChevronDown size={14} style={{
              position: 'absolute', right: 8, top: '50%',
              transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none',
            }} />
          </div>
        </div>
        )}

        {/* Pages Header */}
        {!isPhone && (
        <div style={{
          padding: '12px 16px', borderBottom: '1px solid var(--panel-border)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>Pages</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => { setPreviewPageIndex(0); setShowPreview(true); }}
              disabled={pagesWithArt.length === 0}
              title={pagesWithArt.length === 0 ? 'Upload art to preview' : 'Preview book'}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '6px 10px',
                background: pagesWithArt.length > 0 ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                border: pagesWithArt.length > 0 ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid var(--panel-border)',
                borderRadius: 6,
                color: pagesWithArt.length > 0 ? '#10b981' : '#64748b',
                fontSize: 12, fontWeight: 500,
                cursor: pagesWithArt.length > 0 ? 'pointer' : 'not-allowed',
                opacity: pagesWithArt.length > 0 ? 1 : 0.5,
              }}
            >
              <Eye size={14} /> Preview
            </button>
            {(canEditScript || isProjectOwner) && selectedIssueId && (
              <button
                onClick={handleAddPage}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '6px 10px',
                  background: 'rgba(139, 92, 246, 0.1)',
                  border: '1px solid rgba(139, 92, 246, 0.3)',
                  borderRadius: 6, color: '#8b5cf6', fontSize: 12, fontWeight: 500, cursor: 'pointer',
                }}
              >
                <Plus size={14} /> Add
              </button>
            )}
          </div>
        </div>
        )}

        {/* Pages list */}
        <div style={{
          flex: 1, padding: isPhone ? 4 : 8,
          ...(isPhone
            ? { display: 'flex', flexDirection: 'row', overflowX: 'auto', gap: 4, alignItems: 'center' }
            : { overflow: 'auto' }),
        }}>
          {loading ? (
            <div style={{
              padding: 24, textAlign: 'center', color: 'var(--text-muted)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
              <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
              <span>Loading pages...</span>
            </div>
          ) : pages.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              No pages in this issue yet.
              {(canEditScript || isProjectOwner) && selectedIssueId && (
                <div style={{ marginTop: 8 }}>Click "Add" to create your first page.</div>
              )}
            </div>
          ) : (
            pages.map(page => {
              const isSelected = page.id === selectedPageId;
              const hasScript = page.script_data?.page_description ||
                (page.script_data?.panels && page.script_data.panels.length > 0);

              return isPhone ? (
                // Mobile: compact page chip
                <div
                  key={page.id}
                  onClick={() => handlePageSelect(page.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    padding: '8px 12px', flexShrink: 0, minHeight: 44,
                    background: isSelected ? 'rgba(139, 92, 246, 0.1)' : 'transparent',
                    border: isSelected
                      ? '1px solid rgba(139, 92, 246, 0.3)'
                      : '1px solid var(--panel-border)',
                    borderRadius: 8, cursor: 'pointer',
                  }}
                >
                  <PageStatusDot status={page.page_status || 'script_only'} />
                  <span style={{
                    fontSize: 13, fontWeight: isSelected ? 600 : 400,
                    color: isSelected ? '#8b5cf6' : 'var(--text)',
                    whiteSpace: 'nowrap',
                  }}>
                    P{page.page_number}
                  </span>
                  {getLinkedTaskForPage(project, page.page_number) && (
                    <span style={{ fontSize: 9, fontWeight: 700, color: '#8b5cf6' }}>$</span>
                  )}
                </div>
              ) : (
                // Desktop: full page row
                <div
                  key={page.id}
                  onClick={() => handlePageSelect(page.id)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 12px', marginBottom: 4,
                    background: isSelected ? 'rgba(139, 92, 246, 0.1)' : 'transparent',
                    border: isSelected
                      ? '1px solid rgba(139, 92, 246, 0.3)'
                      : '1px solid transparent',
                    borderRadius: 8, cursor: 'pointer', transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <PageStatusDot status={page.page_status || 'script_only'} />
                    <span style={{
                      fontSize: 14,
                      fontWeight: isSelected ? 600 : 400,
                      color: isSelected ? '#8b5cf6' : 'var(--text)',
                    }}>
                      Page {page.page_number}
                    </span>
                    {getLinkedTaskForPage(project, page.page_number) && (
                      <span title={getLinkedTaskForPage(project, page.page_number)?.task_title} style={{
                        fontSize: 10, fontWeight: 700, color: '#8b5cf6',
                        background: 'rgba(139, 92, 246, 0.15)',
                        padding: '1px 4px', borderRadius: 3,
                      }}>$</span>
                    )}
                    {hasScript && (
                      <FileText size={12} style={{ color: '#10b981', opacity: 0.7 }} />
                    )}
                  </div>
                  {isSelected && (canEditScript || isProjectOwner) && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeletePage(page.id); }}
                      title="Delete page"
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: 0, background: 'none',
                        border: 'none', color: '#ef4444',
                        cursor: 'pointer', opacity: 0.5, flexShrink: 0,
                      }}
                      onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                      onMouseLeave={e => (e.currentTarget.style.opacity = '0.5')}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{
        flex: 1, background: 'var(--panel)', border: '1px solid var(--panel-border)',
        borderRadius: isPhone ? 8 : 12, display: 'flex', flexDirection: 'column', overflow: 'hidden',
        minHeight: 0,
      }}>
        {/* Header */}
        <div style={{
          padding: isPhone ? 12 : 16, borderBottom: '1px solid var(--panel-border)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: isPhone ? 8 : 12 }}>
            <h3 style={{ margin: 0, fontSize: isPhone ? 16 : 18, fontWeight: 600, color: 'var(--text)' }}>
              {selectedPage ? `Page ${selectedPage.page_number}` : 'Select a Page'}
            </h3>
            {selectedPage && (
              <PageStatusBadge status={selectedPage.page_status || 'script_only'} />
            )}
            {!canEditScript && !canUploadArt && (
              <span style={{ fontSize: 12, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 4 }}>
                <AlertCircle size={12} /> View only
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {hasUnsavedChanges && (
              <span style={{ fontSize: 12, color: '#f59e0b' }}>Unsaved changes</span>
            )}
            {saving && (
              <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> Saving...
              </span>
            )}
            {canEditScript && (
              <button
                onClick={saveCurrentPage}
                disabled={!hasUnsavedChanges || saving}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '8px 16px',
                  background: hasUnsavedChanges ? '#10b981' : '#64748b',
                  border: 'none', borderRadius: 8, color: '#fff',
                  fontSize: 13, fontWeight: 500,
                  cursor: hasUnsavedChanges && !saving ? 'pointer' : 'not-allowed',
                  opacity: hasUnsavedChanges ? 1 : 0.5,
                }}
              >
                <Save size={14} /> Save
              </button>
            )}
          </div>
        </div>

        {/* Scrollable Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
          {error && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444',
              borderRadius: 8, padding: 12, marginBottom: 16, color: '#ef4444', fontSize: 13,
            }}>
              {error}
            </div>
          )}

          {!selectedPage ? (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', height: '100%', color: 'var(--text-muted)',
            }}>
              <Hammer size={48} style={{ marginBottom: 16, opacity: 0.5 }} />
              <p style={{ margin: 0, fontSize: 14 }}>
                {pages.length === 0
                  ? 'Create a page to start your workspace'
                  : 'Select a page from the sidebar'}
              </p>
            </div>
          ) : (
            <>
              {/* === SCRIPT SECTION === */}
              <div style={{ marginBottom: 24 }}>
                <label style={{
                  display: 'block', marginBottom: 8,
                  fontSize: 14, fontWeight: 600, color: 'var(--text-muted)',
                }}>
                  Page Description
                </label>
                <textarea
                  value={scriptData.page_description}
                  onChange={(e) => handlePageDescriptionChange(e.target.value)}
                  placeholder="Describe the overall setting, mood, and action for this page..."
                  disabled={!canEditScript}
                  style={{
                    width: '100%', minHeight: 80, padding: 12,
                    background: 'var(--bg)', border: '1px solid var(--panel-border)',
                    borderRadius: 8, color: 'var(--text)', fontSize: 14,
                    lineHeight: 1.5, resize: 'vertical', fontFamily: 'inherit',
                  }}
                />
              </div>

              {/* Panels */}
              <div style={{ marginBottom: 24 }}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  marginBottom: 16,
                }}>
                  <label style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-muted)' }}>
                    Panels ({scriptData.panels.length})
                  </label>
                  {canEditScript && (
                    <button
                      onClick={handleAddPanel}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '6px 12px',
                        background: 'rgba(139, 92, 246, 0.1)',
                        border: '1px solid rgba(139, 92, 246, 0.3)',
                        borderRadius: 6, color: '#8b5cf6', fontSize: 12,
                        fontWeight: 500, cursor: 'pointer',
                      }}
                    >
                      <Plus size={14} /> Add Panel
                    </button>
                  )}
                </div>

                {scriptData.panels.length === 0 ? (
                  <div style={{
                    padding: 32, textAlign: 'center', background: 'var(--bg)',
                    borderRadius: 8, border: '1px dashed var(--panel-border)',
                    color: 'var(--text-muted)', fontSize: 13,
                  }}>
                    No panels defined yet.
                    {canEditScript && ' Click "Add Panel" to start describing your panels.'}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {scriptData.panels.map((panel) => (
                      <div
                        key={panel.panel_number}
                        style={{
                          background: 'var(--bg)', border: '1px solid var(--panel-border)',
                          borderRadius: 8, overflow: 'hidden',
                        }}
                      >
                        <div style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          padding: '10px 12px', background: 'rgba(139, 92, 246, 0.05)',
                          borderBottom: '1px solid var(--panel-border)',
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <GripVertical size={14} style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
                            <span style={{ fontSize: 13, fontWeight: 600, color: '#8b5cf6' }}>
                              Panel {panel.panel_number}
                            </span>
                          </div>
                          {canEditScript && (
                            <button
                              onClick={() => handleDeletePanel(panel.panel_number)}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 4,
                                padding: '4px 8px', background: 'transparent', border: 'none',
                                borderRadius: 4, color: '#ef4444', fontSize: 11,
                                cursor: 'pointer', opacity: 0.6,
                              }}
                            >
                              <Trash2 size={12} /> Delete
                            </button>
                          )}
                        </div>
                        <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
                          <div>
                            <label style={{
                              display: 'block', marginBottom: 4, fontSize: 12, fontWeight: 600,
                              color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px',
                            }}>Scene Description</label>
                            <textarea
                              value={panel.scene}
                              onChange={(e) => handlePanelChange(panel.panel_number, 'scene', e.target.value)}
                              placeholder="Describe what the artist should draw..."
                              disabled={!canEditScript}
                              style={{
                                width: '100%', minHeight: 60, padding: 10,
                                background: 'var(--panel)', border: '1px solid var(--panel-border)',
                                borderRadius: 6, color: 'var(--text)', fontSize: 13,
                                lineHeight: 1.4, resize: 'vertical', fontFamily: 'inherit',
                              }}
                            />
                          </div>
                          <div>
                            <label style={{
                              display: 'block', marginBottom: 4, fontSize: 12, fontWeight: 600,
                              color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px',
                            }}>Dialogue</label>
                            <textarea
                              value={panel.dialogue}
                              onChange={(e) => handlePanelChange(panel.panel_number, 'dialogue', e.target.value)}
                              placeholder="Speech or thoughts for this panel..."
                              disabled={!canEditScript}
                              style={{
                                width: '100%', minHeight: 50, padding: 10,
                                background: 'var(--panel)', border: '1px solid var(--panel-border)',
                                borderRadius: 6, color: 'var(--text)', fontSize: 13,
                                lineHeight: 1.4, resize: 'vertical', fontFamily: 'inherit',
                              }}
                            />
                          </div>
                          <div>
                            <label style={{
                              display: 'block', marginBottom: 4, fontSize: 12, fontWeight: 600,
                              color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px',
                            }}>Notes for Artist</label>
                            <textarea
                              value={panel.notes}
                              onChange={(e) => handlePanelChange(panel.panel_number, 'notes', e.target.value)}
                              placeholder="Additional notes, emotions, lighting, references..."
                              disabled={!canEditScript}
                              style={{
                                width: '100%', minHeight: 40, padding: 10,
                                background: 'var(--panel)', border: '1px solid var(--panel-border)',
                                borderRadius: 6, color: 'var(--text)', fontSize: 13,
                                lineHeight: 1.4, resize: 'vertical', fontFamily: 'inherit',
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Divider */}
              <div style={{
                borderTop: '1px solid var(--panel-border)',
                margin: '8px 0 24px',
              }} />

              {/* === REFERENCE IMAGES SECTION === */}
              <ReferenceImagesSection
                pageId={selectedPage.id}
                referenceImages={selectedPage.reference_images || []}
                canEdit={canEditScript || isProjectOwner}
                onImagesChange={(images) => handleReferenceImagesChange(selectedPage.id, images)}
              />

              {/* === ART DELIVERY SECTION === */}
              <ArtDeliverySection
                pageId={selectedPage.id}
                deliveries={selectedPage.art_deliveries || []}
                canUploadArt={canUploadArt || false}
                canReview={canReview}
                onDeliveriesChange={(deliveries) => handleArtDeliveriesChange(selectedPage.id, deliveries)}
                onPageStatusChange={(status) => handlePageStatusChange(selectedPage.id, status)}
                linkedTask={getLinkedTaskForPage(project, selectedPage.page_number)}
                onTaskAutoSigned={async () => {
                  // Refresh project data to update task statuses
                  if (onProjectUpdate) {
                    const { collaborationApi } = await import('../../services/collaborationApi');
                    const updated = await collaborationApi.getCollaborativeProject(project.id);
                    onProjectUpdate(updated);
                  }
                }}
              />

              {/* Divider */}
              <div style={{
                borderTop: '1px solid var(--panel-border)',
                margin: '8px 0 24px',
              }} />

              {/* === COMMENTS SECTION === */}
              <PageCommentsSection
                project={project}
                currentUser={currentUser}
                comicPageId={selectedPage.id}
              />
            </>
          )}
        </div>
      </div>

      {/* Book Preview Modal */}
      {showPreview && pagesWithArt.length > 0 && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0, 0, 0, 0.92)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          {/* Top bar */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '16px 24px', width: '100%', flexShrink: 0,
          }}>
            <span style={{ color: '#fff', fontSize: 16, fontWeight: 600 }}>
              Page {pagesWithArt[previewPageIndex]?.page_number} of {pagesWithArt.length} pages with art
            </span>
            <button
              onClick={() => setShowPreview(false)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 16px', background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8,
                color: '#fff', fontSize: 13, cursor: 'pointer',
              }}
            >
              <X size={16} /> Close
            </button>
          </div>

          {/* Page image */}
          <div style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '60px 80px', maxWidth: '100%', minHeight: 0, overflow: 'hidden',
          }}>
            {(() => {
              const page = pagesWithArt[previewPageIndex];
              const latestArt = page?.art_deliveries?.[0];
              if (!latestArt) return null;
              const isImage = latestArt.file_type?.startsWith('image/');
              return isImage ? (
                <img
                  src={latestArt.file}
                  alt={`Page ${page.page_number}`}
                  style={{
                    maxWidth: '100%', maxHeight: 'calc(100vh - 140px)',
                    objectFit: 'contain', borderRadius: 4,
                    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                  }}
                />
              ) : (
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  gap: 12, color: 'var(--text-muted)',
                }}>
                  <FileText size={48} />
                  <span>{latestArt.filename}</span>
                  <a
                    href={latestArt.file}
                    download={latestArt.filename}
                    style={{ color: '#8b5cf6', fontSize: 14 }}
                  >
                    Download to view
                  </a>
                </div>
              );
            })()}
          </div>

          {/* Navigation */}
          <div style={{
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            gap: 16, padding: '16px 24px', flexShrink: 0,
          }}>
            <button
              onClick={() => setPreviewPageIndex(Math.max(0, previewPageIndex - 1))}
              disabled={previewPageIndex === 0}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '10px 20px', background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8,
                color: '#fff', fontSize: 14, cursor: 'pointer',
                opacity: previewPageIndex === 0 ? 0.3 : 1,
              }}
            >
              <ChevronLeft size={18} /> Previous
            </button>

            {/* Page dots */}
            <div style={{ display: 'flex', gap: 6 }}>
              {pagesWithArt.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setPreviewPageIndex(i)}
                  style={{
                    width: i === previewPageIndex ? 24 : 8,
                    height: 8,
                    borderRadius: 4,
                    background: i === previewPageIndex ? '#8b5cf6' : 'rgba(255,255,255,0.3)',
                    border: 'none', cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                />
              ))}
            </div>

            <button
              onClick={() => setPreviewPageIndex(Math.min(pagesWithArt.length - 1, previewPageIndex + 1))}
              disabled={previewPageIndex === pagesWithArt.length - 1}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '10px 20px', background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8,
                color: '#fff', fontSize: 14, cursor: 'pointer',
                opacity: previewPageIndex === pagesWithArt.length - 1 ? 0.3 : 1,
              }}
            >
              Next <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
    </div>
  );
}
