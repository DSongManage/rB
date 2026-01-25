import React, { useState, useEffect, useCallback } from 'react';
import {
  CollaborativeProject,
  ComicPage,
  ComicIssueListItem,
  ScriptData,
  ScriptPanel,
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
} from 'lucide-react';

interface User {
  id: number;
  username: string;
  display_name?: string;
}

interface CollaborativeScriptEditorProps {
  project: CollaborativeProject;
  currentUser: User;
  onProjectUpdate?: (project: CollaborativeProject) => void;
}

// Default empty script data
const createEmptyScriptData = (): ScriptData => ({
  page_description: '',
  panels: [],
});

// Normalize script data to ensure panels is always an array
const normalizeScriptData = (data: ScriptData | null | undefined): ScriptData => {
  if (!data) return createEmptyScriptData();
  return {
    page_description: data.page_description || '',
    panels: Array.isArray(data.panels) ? data.panels : [],
  };
};

// Default empty panel
const createEmptyPanel = (panelNumber: number): ScriptPanel => ({
  panel_number: panelNumber,
  scene: '',
  dialogue: '',
  notes: '',
});

export default function CollaborativeScriptEditor({
  project,
  currentUser,
  onProjectUpdate,
}: CollaborativeScriptEditorProps) {
  // Issue state - Script tab now works with issues (same as Comic tab)
  const [issues, setIssues] = useState<ComicIssueListItem[]>([]);
  const [selectedIssueId, setSelectedIssueId] = useState<number | null>(null);
  const [loadingIssues, setLoadingIssues] = useState(true);

  const [pages, setPages] = useState<ComicPage[]>([]);
  const [selectedPageId, setSelectedPageId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Current page's script data (local state for editing)
  const [scriptData, setScriptData] = useState<ScriptData>(createEmptyScriptData());

  // Check if current user can edit scripts (writer role)
  const currentUserRole = project.collaborators?.find(c => c.user === currentUser.id);
  const canEditScript = currentUserRole?.effective_permissions?.edit?.types?.includes('script') ||
    currentUserRole?.can_edit?.includes('script') ||
    currentUserRole?.can_edit?.includes('text') ||
    currentUserRole?.role?.toLowerCase().includes('writer') ||
    currentUserRole?.role?.toLowerCase().includes('author') ||
    project.created_by === currentUser.id;

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
      // Select first issue if exists
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

      // Select first page if exists
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

  // Load script data when page selection changes
  const handlePageSelect = useCallback((pageId: number) => {
    // Save current changes before switching
    if (hasUnsavedChanges && selectedPageId) {
      saveCurrentPage();
    }

    const page = pages.find(p => p.id === pageId);
    setSelectedPageId(pageId);
    setScriptData(normalizeScriptData(page?.script_data));
    setHasUnsavedChanges(false);
  }, [pages, hasUnsavedChanges, selectedPageId]);

  // Save current page's script data
  const saveCurrentPage = async () => {
    if (!selectedPageId || !canEditScript) return;

    setSaving(true);
    try {
      await collaborationApi.updateComicPage(selectedPageId, {
        script_data: scriptData,
      });

      // Update local pages state
      setPages(prev => prev.map(p =>
        p.id === selectedPageId
          ? { ...p, script_data: scriptData }
          : p
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

    const timer = setTimeout(() => {
      saveCurrentPage();
    }, 2000);

    return () => clearTimeout(timer);
  }, [scriptData, hasUnsavedChanges]);

  // Update page description
  const handlePageDescriptionChange = (value: string) => {
    setScriptData(prev => ({ ...prev, page_description: value }));
    setHasUnsavedChanges(true);
  };

  // Add new panel
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

  // Update panel field
  const handlePanelChange = (panelNumber: number, field: keyof ScriptPanel, value: string | number) => {
    setScriptData(prev => ({
      ...prev,
      panels: prev.panels.map(p =>
        p.panel_number === panelNumber
          ? { ...p, [field]: value }
          : p
      ),
    }));
    setHasUnsavedChanges(true);
  };

  // Delete panel
  const handleDeletePanel = (panelNumber: number) => {
    setScriptData(prev => ({
      ...prev,
      panels: prev.panels.filter(p => p.panel_number !== panelNumber),
    }));
    setHasUnsavedChanges(true);
  };

  // Add new page
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

  // Delete page
  const handleDeletePage = async (pageId: number) => {
    if (!confirm('Are you sure you want to delete this page? This cannot be undone.')) {
      return;
    }

    try {
      await collaborationApi.deleteComicPage(pageId);

      const updatedPages = pages.filter(p => p.id !== pageId);
      setPages(updatedPages);

      // Select another page if the deleted one was selected
      if (selectedPageId === pageId) {
        if (updatedPages.length > 0) {
          const newSelected = updatedPages[0];
          setSelectedPageId(newSelected.id);
          setScriptData(newSelected.script_data || createEmptyScriptData());
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

  const selectedPage = pages.find(p => p.id === selectedPageId);
  const selectedIssue = issues.find(i => i.id === selectedIssueId);

  if (loadingIssues) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: 400,
        color: '#94a3b8',
      }}>
        <Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} />
        <span style={{ marginLeft: 12 }}>Loading issues...</span>
      </div>
    );
  }

  // Show message if not a comic project
  if (project.content_type !== 'comic') {
    return (
      <div style={{
        background: 'var(--panel)',
        border: '1px solid var(--panel-border)',
        borderRadius: 12,
        padding: 40,
        textAlign: 'center',
      }}>
        <FileText size={48} style={{ color: '#64748b', marginBottom: 16 }} />
        <h3 style={{ margin: '0 0 8px', color: 'var(--text)', fontSize: 18 }}>
          Script Editor
        </h3>
        <p style={{ margin: 0, color: '#64748b', fontSize: 14 }}>
          The script editor is only available for comic projects.
        </p>
      </div>
    );
  }

  // Show message if no issues exist
  if (issues.length === 0) {
    return (
      <div style={{
        background: 'var(--panel)',
        border: '1px solid var(--panel-border)',
        borderRadius: 12,
        padding: 40,
        textAlign: 'center',
      }}>
        <BookOpen size={48} style={{ color: '#64748b', marginBottom: 16 }} />
        <h3 style={{ margin: '0 0 8px', color: 'var(--text)', fontSize: 18 }}>
          No Issues Found
        </h3>
        <p style={{ margin: 0, color: '#64748b', fontSize: 14 }}>
          Create an issue in the Comic tab first to start writing your script.
        </p>
        <p style={{ margin: '12px 0 0', color: '#94a3b8', fontSize: 13 }}>
          Issues organize your comic pages into chapters or volumes.
        </p>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      gap: 24,
      height: 'calc(100vh - 280px)',
      minHeight: 500,
    }}>
      {/* Page List Sidebar */}
      <div style={{
        width: 220,
        flexShrink: 0,
        background: 'var(--panel)',
        border: '1px solid var(--panel-border)',
        borderRadius: 12,
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Issue Selector */}
        <div style={{
          padding: 12,
          borderBottom: '1px solid var(--panel-border)',
        }}>
          <label style={{
            display: 'block',
            marginBottom: 6,
            fontSize: 11,
            fontWeight: 600,
            color: '#64748b',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}>
            Issue
          </label>
          <div style={{ position: 'relative' }}>
            <select
              value={selectedIssueId || ''}
              onChange={(e) => {
                const id = Number(e.target.value);
                if (id) {
                  // Save current changes before switching
                  if (hasUnsavedChanges && selectedPageId) {
                    saveCurrentPage();
                  }
                  setSelectedIssueId(id);
                }
              }}
              style={{
                width: '100%',
                padding: '8px 28px 8px 10px',
                background: 'var(--bg)',
                border: '1px solid var(--panel-border)',
                borderRadius: 6,
                color: 'var(--text)',
                fontSize: 13,
                cursor: 'pointer',
                appearance: 'none',
              }}
            >
              {issues.map(issue => (
                <option key={issue.id} value={issue.id}>
                  #{issue.issue_number}: {issue.title}
                </option>
              ))}
            </select>
            <ChevronDown
              size={14}
              style={{
                position: 'absolute',
                right: 8,
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#64748b',
                pointerEvents: 'none',
              }}
            />
          </div>
        </div>

        {/* Pages Header */}
        <div style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--panel-border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>Pages</span>
          {canEditScript && selectedIssueId && (
            <button
              onClick={handleAddPage}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '6px 10px',
                background: 'rgba(139, 92, 246, 0.1)',
                border: '1px solid rgba(139, 92, 246, 0.3)',
                borderRadius: 6,
                color: '#8b5cf6',
                fontSize: 12,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              <Plus size={14} />
              Add
            </button>
          )}
        </div>

        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: 8,
        }}>
          {loading ? (
            <div style={{
              padding: 24,
              textAlign: 'center',
              color: '#94a3b8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}>
              <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
              <span>Loading pages...</span>
            </div>
          ) : pages.length === 0 ? (
            <div style={{
              padding: 24,
              textAlign: 'center',
              color: '#64748b',
              fontSize: 13,
            }}>
              No pages in this issue yet.
              {canEditScript && selectedIssueId && (
                <div style={{ marginTop: 8 }}>
                  Click "Add" to create your first page.
                </div>
              )}
            </div>
          ) : (
            pages.map(page => {
              const isSelected = page.id === selectedPageId;
              const hasScript = page.script_data?.page_description ||
                (page.script_data?.panels && page.script_data.panels.length > 0);

              return (
                <div
                  key={page.id}
                  onClick={() => handlePageSelect(page.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    marginBottom: 4,
                    background: isSelected ? 'rgba(139, 92, 246, 0.1)' : 'transparent',
                    border: isSelected
                      ? '1px solid rgba(139, 92, 246, 0.3)'
                      : '1px solid transparent',
                    borderRadius: 8,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <ChevronRight
                      size={14}
                      style={{
                        color: isSelected ? '#8b5cf6' : '#64748b',
                        transform: isSelected ? 'rotate(90deg)' : 'none',
                        transition: 'transform 0.15s ease',
                      }}
                    />
                    <span style={{
                      fontSize: 13,
                      fontWeight: isSelected ? 600 : 400,
                      color: isSelected ? '#8b5cf6' : 'var(--text)',
                    }}>
                      Page {page.page_number}
                    </span>
                    {hasScript && (
                      <FileText
                        size={12}
                        style={{ color: '#10b981', opacity: 0.7 }}
                      />
                    )}
                  </div>
                  {canEditScript && isSelected && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeletePage(page.id);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 24,
                        height: 24,
                        background: 'transparent',
                        border: 'none',
                        borderRadius: 4,
                        color: '#ef4444',
                        cursor: 'pointer',
                        opacity: 0.6,
                      }}
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

      {/* Script Editor Main Area */}
      <div style={{
        flex: 1,
        background: 'var(--panel)',
        border: '1px solid var(--panel-border)',
        borderRadius: 12,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Editor Header */}
        <div style={{
          padding: 16,
          borderBottom: '1px solid var(--panel-border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>
              {selectedPage ? `Page ${selectedPage.page_number} Script` : 'Select a Page'}
            </h3>
            {!canEditScript && (
              <p style={{ margin: '4px 0 0', fontSize: 12, color: '#f59e0b' }}>
                <AlertCircle size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                View only - you don't have script editing permissions
              </p>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {hasUnsavedChanges && (
              <span style={{ fontSize: 12, color: '#f59e0b' }}>Unsaved changes</span>
            )}
            {saving && (
              <span style={{ fontSize: 12, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
                Saving...
              </span>
            )}
            {canEditScript && (
              <button
                onClick={saveCurrentPage}
                disabled={!hasUnsavedChanges || saving}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 16px',
                  background: hasUnsavedChanges ? '#10b981' : '#64748b',
                  border: 'none',
                  borderRadius: 8,
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: hasUnsavedChanges && !saving ? 'pointer' : 'not-allowed',
                  opacity: hasUnsavedChanges ? 1 : 0.5,
                }}
              >
                <Save size={14} />
                Save
              </button>
            )}
          </div>
        </div>

        {/* Editor Content */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: 24,
        }}>
          {error && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid #ef4444',
              borderRadius: 8,
              padding: 12,
              marginBottom: 16,
              color: '#ef4444',
              fontSize: 13,
            }}>
              {error}
            </div>
          )}

          {!selectedPage ? (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: '#64748b',
            }}>
              <FileText size={48} style={{ marginBottom: 16, opacity: 0.5 }} />
              <p style={{ margin: 0, fontSize: 14 }}>
                {pages.length === 0
                  ? 'Create a page to start writing your script'
                  : 'Select a page from the sidebar to edit its script'}
              </p>
            </div>
          ) : (
            <>
              {/* Page Description */}
              <div style={{ marginBottom: 24 }}>
                <label style={{
                  display: 'block',
                  marginBottom: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#94a3b8',
                }}>
                  Page Description
                </label>
                <textarea
                  value={scriptData.page_description}
                  onChange={(e) => handlePageDescriptionChange(e.target.value)}
                  placeholder="Describe the overall setting, mood, and action for this page..."
                  disabled={!canEditScript}
                  style={{
                    width: '100%',
                    minHeight: 80,
                    padding: 12,
                    background: 'var(--bg)',
                    border: '1px solid var(--panel-border)',
                    borderRadius: 8,
                    color: 'var(--text)',
                    fontSize: 14,
                    lineHeight: 1.5,
                    resize: 'vertical',
                    fontFamily: 'inherit',
                  }}
                />
              </div>

              {/* Panels */}
              <div>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 16,
                }}>
                  <label style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: '#94a3b8',
                  }}>
                    Panels ({scriptData.panels.length})
                  </label>
                  {canEditScript && (
                    <button
                      onClick={handleAddPanel}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '6px 12px',
                        background: 'rgba(139, 92, 246, 0.1)',
                        border: '1px solid rgba(139, 92, 246, 0.3)',
                        borderRadius: 6,
                        color: '#8b5cf6',
                        fontSize: 12,
                        fontWeight: 500,
                        cursor: 'pointer',
                      }}
                    >
                      <Plus size={14} />
                      Add Panel
                    </button>
                  )}
                </div>

                {scriptData.panels.length === 0 ? (
                  <div style={{
                    padding: 32,
                    textAlign: 'center',
                    background: 'var(--bg)',
                    borderRadius: 8,
                    border: '1px dashed var(--panel-border)',
                    color: '#64748b',
                    fontSize: 13,
                  }}>
                    No panels defined yet.
                    {canEditScript && ' Click "Add Panel" to start describing your panels.'}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {scriptData.panels.map((panel, index) => (
                      <div
                        key={panel.panel_number}
                        style={{
                          background: 'var(--bg)',
                          border: '1px solid var(--panel-border)',
                          borderRadius: 8,
                          overflow: 'hidden',
                        }}
                      >
                        {/* Panel Header */}
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '10px 12px',
                          background: 'rgba(139, 92, 246, 0.05)',
                          borderBottom: '1px solid var(--panel-border)',
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <GripVertical size={14} style={{ color: '#64748b', opacity: 0.5 }} />
                            <span style={{ fontSize: 13, fontWeight: 600, color: '#8b5cf6' }}>
                              Panel {panel.panel_number}
                            </span>
                          </div>
                          {canEditScript && (
                            <button
                              onClick={() => handleDeletePanel(panel.panel_number)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                                padding: '4px 8px',
                                background: 'transparent',
                                border: 'none',
                                borderRadius: 4,
                                color: '#ef4444',
                                fontSize: 11,
                                cursor: 'pointer',
                                opacity: 0.6,
                              }}
                            >
                              <Trash2 size={12} />
                              Delete
                            </button>
                          )}
                        </div>

                        {/* Panel Fields */}
                        <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
                          {/* Scene */}
                          <div>
                            <label style={{
                              display: 'block',
                              marginBottom: 4,
                              fontSize: 11,
                              fontWeight: 600,
                              color: '#64748b',
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px',
                            }}>
                              Scene Description
                            </label>
                            <textarea
                              value={panel.scene}
                              onChange={(e) => handlePanelChange(panel.panel_number, 'scene', e.target.value)}
                              placeholder="Describe what the artist should draw..."
                              disabled={!canEditScript}
                              style={{
                                width: '100%',
                                minHeight: 60,
                                padding: 10,
                                background: 'var(--panel)',
                                border: '1px solid var(--panel-border)',
                                borderRadius: 6,
                                color: 'var(--text)',
                                fontSize: 13,
                                lineHeight: 1.4,
                                resize: 'vertical',
                                fontFamily: 'inherit',
                              }}
                            />
                          </div>

                          {/* Dialogue */}
                          <div>
                            <label style={{
                              display: 'block',
                              marginBottom: 4,
                              fontSize: 11,
                              fontWeight: 600,
                              color: '#64748b',
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px',
                            }}>
                              Dialogue
                            </label>
                            <textarea
                              value={panel.dialogue}
                              onChange={(e) => handlePanelChange(panel.panel_number, 'dialogue', e.target.value)}
                              placeholder="Speech or thoughts for this panel..."
                              disabled={!canEditScript}
                              style={{
                                width: '100%',
                                minHeight: 50,
                                padding: 10,
                                background: 'var(--panel)',
                                border: '1px solid var(--panel-border)',
                                borderRadius: 6,
                                color: 'var(--text)',
                                fontSize: 13,
                                lineHeight: 1.4,
                                resize: 'vertical',
                                fontFamily: 'inherit',
                              }}
                            />
                          </div>

                          {/* Notes */}
                          <div>
                            <label style={{
                              display: 'block',
                              marginBottom: 4,
                              fontSize: 11,
                              fontWeight: 600,
                              color: '#64748b',
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px',
                            }}>
                              Notes for Artist
                            </label>
                            <textarea
                              value={panel.notes}
                              onChange={(e) => handlePanelChange(panel.panel_number, 'notes', e.target.value)}
                              placeholder="Additional notes, emotions, lighting, references..."
                              disabled={!canEditScript}
                              style={{
                                width: '100%',
                                minHeight: 40,
                                padding: 10,
                                background: 'var(--panel)',
                                border: '1px solid var(--panel-border)',
                                borderRadius: 6,
                                color: 'var(--text)',
                                fontSize: 13,
                                lineHeight: 1.4,
                                resize: 'vertical',
                                fontFamily: 'inherit',
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
