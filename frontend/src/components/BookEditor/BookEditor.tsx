import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { bookApi, BookProject, Chapter } from '../../services/bookApi';
import ChapterList from './ChapterList';
import ChapterEditor from './ChapterEditor';
import PublishModal from './PublishModal';
import { Menu, X, Settings, AlertTriangle } from 'lucide-react';

interface BookEditorProps {
  onPublish: (contentId: number) => void;
  onBack: () => void;
  existingContentId?: number; // If provided, load the book project for this content
  existingBookProjectId?: number; // If provided, load the book project directly by ID
}

export default function BookEditor({ onPublish, onBack, existingContentId, existingBookProjectId }: BookEditorProps) {
  const navigate = useNavigate();
  const [project, setProject] = useState<BookProject | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [selectedChapterId, setSelectedChapterId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(true);

  // Unpublish/Republish state
  const [unpublishing, setUnpublishing] = useState(false);
  const [republishing, setRepublishing] = useState(false);
  const [showUnpublishConfirm, setShowUnpublishConfirm] = useState(false);
  const [showRepublishConfirm, setShowRepublishConfirm] = useState(false);

  // Mobile responsive state
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Title validation state
  const [titleError, setTitleError] = useState<string>('');
  const [showLeaveWarning, setShowLeaveWarning] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null);

  // Check if title is valid (not "Untitled Book" or empty)
  const hasValidTitle = Boolean(
    project?.title &&
    project.title.trim() !== '' &&
    project.title.trim().toLowerCase() !== 'untitled book'
  );

  // Check if there's unsaved content (chapters with content but no valid title)
  const hasUnsavedContent = Boolean(
    !hasValidTitle &&
    chapters.some(ch => ch.content_html && ch.content_html.trim() !== '')
  );

  // Handle window resize for mobile detection
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      // Close drawer when switching to desktop
      if (!mobile) {
        setDrawerOpen(false);
        setSettingsOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Warn before closing browser/tab if there's unsaved content without valid title
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedContent) {
        e.preventDefault();
        e.returnValue = 'You have unsaved content. Please add a title to save your work.';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedContent]);

  // Note: useBlocker removed - requires data router (createBrowserRouter) which we don't use
  // The beforeunload event handler above still warns on browser close/refresh

  // Initialize: Create a new project or load existing
  useEffect(() => {
    initializeProject();
  }, [existingContentId, existingBookProjectId]);

  const initializeProject = async () => {
    setLoading(true);
    try {
      if (existingBookProjectId) {
        // Load existing project directly by ID
        const existingProject = await bookApi.getProject(existingBookProjectId);
        setProject(existingProject);
        setChapters(existingProject.chapters || []);
        // Select first unminted chapter or first chapter
        const firstUnminted = existingProject.chapters?.find(ch => !ch.is_published);
        if (firstUnminted) {
          setSelectedChapterId(firstUnminted.id);
        } else if (existingProject.chapters && existingProject.chapters.length > 0) {
          setSelectedChapterId(existingProject.chapters[0].id);
        }
      } else if (existingContentId) {
        // Load existing project by content ID
        const existingProject = await bookApi.getProjectByContentId(existingContentId);
        setProject(existingProject);
        setChapters(existingProject.chapters || []);
        // Select the target chapter if specified (when editing a specific chapter's content)
        // Otherwise select first unminted chapter or first chapter
        if (existingProject.target_chapter_id) {
          setSelectedChapterId(existingProject.target_chapter_id);
        } else {
          const firstUnminted = existingProject.chapters?.find(ch => !ch.is_published);
          if (firstUnminted) {
            setSelectedChapterId(firstUnminted.id);
          } else if (existingProject.chapters && existingProject.chapters.length > 0) {
            setSelectedChapterId(existingProject.chapters[0].id);
          }
        }
      } else {
        // Create a new project
        const newProject = await bookApi.createProject('Untitled Book', '');
        setProject(newProject);
        setChapters(newProject.chapters || []);
      }
    } catch (err: any) {
      // If content was deleted (404), navigate back to studio home
      if (err.message?.toLowerCase().includes('not found') || err.message?.includes('404')) {
        console.log('[BookEditor] Content no longer exists, navigating back to studio');
        onBack();
      } else {
        setError(err.message || 'Failed to initialize project');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAddChapter = async () => {
    if (!project) return;

    try {
      const newChapter = await bookApi.createChapter(project.id, `Chapter ${chapters.length + 1}`);
      // Use functional update to ensure latest state
      setChapters(prevChapters => [...prevChapters, newChapter]);
      setSelectedChapterId(newChapter.id);

      // Force a small delay to ensure state updates complete before render
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (err: any) {
      setError(err.message || 'Failed to add chapter');
    }
  };

  const handleUpdateChapter = async (chapterId: number, title: string, content: string, synopsis?: string) => {
    setSaving(true);
    try {
      const updateData: Partial<Chapter> = { title, content_html: content };
      if (synopsis !== undefined) {
        updateData.synopsis = synopsis;
      }
      const updatedChapter = await bookApi.updateChapter(chapterId, updateData);
      setChapters(chapters.map(ch => ch.id === chapterId ? updatedChapter : ch));
      setLastSaved(new Date());
    } catch (err: any) {
      setError(err.message || 'Failed to save chapter');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteChapter = async (chapterId: number) => {
    if (!confirm('Are you sure you want to delete this chapter?')) return;
    
    try {
      await bookApi.deleteChapter(chapterId);
      setChapters(chapters.filter(ch => ch.id !== chapterId));
      if (selectedChapterId === chapterId) {
        setSelectedChapterId(chapters[0]?.id || null);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to delete chapter');
    }
  };

  const handlePublish = async (type: 'chapter' | 'book') => {
    if (!project) return;
    
    try {
      let response;
      if (type === 'chapter' && selectedChapterId) {
        console.log('[BookEditor] Preparing chapter for mint:', selectedChapterId);
        response = await bookApi.prepareChapterForMint(selectedChapterId);
      } else {
        console.log('[BookEditor] Preparing book for mint:', project.id);
        response = await bookApi.prepareBookForMint(project.id);
      }
      
      console.log('[BookEditor] Prepare response:', response);
      console.log('[BookEditor] Calling onPublish with contentId:', response.content_id);
      
      setShowPublishModal(false);
      onPublish(response.content_id);
    } catch (err: any) {
      console.error('[BookEditor] Publish error:', err);
      setError(err.message || 'Failed to prepare for publishing');
    }
  };

  const handleUpdateProjectTitle = async (title: string) => {
    if (!project) return;

    // Clear previous error
    setTitleError('');

    // Validate title
    const trimmedTitle = title.trim();
    if (trimmedTitle.toLowerCase() === 'untitled book') {
      setTitleError('Please provide a unique title for your book');
      return;
    }

    if (trimmedTitle === '') {
      setTitleError('Title is required');
      return;
    }

    try {
      const updatedProject = await bookApi.updateProject(project.id, { title: trimmedTitle });
      setProject(updatedProject);
      setTitleError('');
    } catch (err: any) {
      // Check if it's a duplicate title error from the backend
      const errorMsg = err.message || 'Failed to update project title';
      if (errorMsg.toLowerCase().includes('already have a book')) {
        setTitleError('You already have a book with this title');
      } else {
        setError(errorMsg);
      }
    }
  };

  const handleCoverImageUpload = async (file: File) => {
    if (!project) return;
    
    try {
      const updatedProject = await bookApi.uploadCoverImage(project.id, file);
      setProject(updatedProject);
    } catch (err: any) {
      setError(err.message || 'Failed to upload cover image');
    }
  };

  const selectedChapter = chapters.find(ch => ch.id === selectedChapterId) || null;

  // Check if project can be deleted (no published chapters and not whole-book published)
  const hasPublishedChapters = chapters.some(ch => ch.is_published);
  const isWholeBookPublished = !!(project?.is_published && project?.has_published_content);
  const isPublished = hasPublishedChapters || isWholeBookPublished;
  const canDeleteProject = !isPublished;

  // Detect delisted state: has published_content but not currently published
  const isUnpublished = !isPublished && (
    (project?.has_published_content) ||
    chapters.some(ch => ch.has_published_content && !ch.is_published)
  );

  const refreshProjectAndChapters = async () => {
    if (!project) return;
    const updatedProject = await bookApi.getProject(project.id);
    setProject(updatedProject);
    setChapters(updatedProject.chapters || []);
  };

  const handleUnpublish = async () => {
    if (!project) return;
    setUnpublishing(true);
    setError('');
    try {
      await bookApi.unpublishBook(project.id);
      await refreshProjectAndChapters();
      setShowUnpublishConfirm(false);
    } catch (err: any) {
      setError(err.message || 'Failed to unpublish');
    } finally {
      setUnpublishing(false);
    }
  };

  const handleRepublish = async () => {
    if (!project) return;
    setRepublishing(true);
    setError('');
    try {
      await bookApi.republishBook(project.id);
      await refreshProjectAndChapters();
      setShowRepublishConfirm(false);
    } catch (err: any) {
      setError(err.message || 'Failed to republish');
    } finally {
      setRepublishing(false);
    }
  };

  const handleDeleteProject = async () => {
    if (!project || !canDeleteProject) return;

    const confirmMessage = chapters.length > 0
      ? `Are you sure you want to delete "${project.title}"? This will permanently delete ${chapters.length} unpublished chapter(s).`
      : `Are you sure you want to delete "${project.title}"?`;

    if (!window.confirm(confirmMessage)) return;

    try {
      await bookApi.deleteProject(project.id);
      navigate('/profile'); // Navigate to profile page after deletion
    } catch (err: any) {
      setError(err.message || 'Failed to delete project');
    }
  };

  if (loading) {
    return (
      <div style={{ 
        width: '100%', 
        height: '60vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        color: '#94a3b8',
        fontSize: 16,
      }}>
        Loading book project...
      </div>
    );
  }

  // Helper function for handling chapter selection (closes drawer on mobile)
  const handleChapterSelect = (chapterId: number) => {
    setSelectedChapterId(chapterId);
    if (isMobile) {
      setDrawerOpen(false);
    }
  };

  // Cover/Synopsis component (reused in drawer and settings modal)
  const CoverSynopsisSection = () => (
    <>
      {/* Compact Cover Image */}
      <div style={{
        background: 'var(--panel)',
        border: '1px solid var(--panel-border)',
        borderRadius: 12,
        padding: 12,
        flexShrink: 0,
      }}>
        <div style={{
          display: 'flex',
          gap: 12,
          alignItems: 'flex-start',
        }}>
          {/* Cover thumbnail */}
          <div style={{
            width: 60,
            height: 80,
            borderRadius: 6,
            overflow: 'hidden',
            background: '#1e1e1e',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid var(--panel-border)',
            flexShrink: 0,
          }}>
            {project?.cover_image_url ? (
              <img
                src={project.cover_image_url}
                alt="Cover"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <span style={{ color: '#4b5563', fontSize: 9 }}>No cover</span>
            )}
          </div>
          {/* Cover info + upload */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
              Book Cover
            </div>
            <div style={{ fontSize: 10, color: '#64748b', marginBottom: 8, lineHeight: 1.4 }}>
              Recommended: 1600×2400px
            </div>
            <label style={{
              display: 'inline-block',
              background: 'transparent',
              border: '1px solid var(--panel-border)',
              borderRadius: 5,
              padding: '4px 10px',
              color: '#94a3b8',
              fontWeight: 500,
              cursor: 'pointer',
              fontSize: 11,
              transition: 'all 0.15s ease',
            }}>
              {project?.cover_image_url ? 'Change' : 'Upload'}
              <input
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleCoverImageUpload(file);
                }}
              />
            </label>
          </div>
        </div>
      </div>

      {/* Book Synopsis */}
      <div style={{
        background: 'var(--panel)',
        border: '1px solid var(--panel-border)',
        borderRadius: 12,
        padding: 12,
        flexShrink: 0,
      }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>
          Book Synopsis
        </div>
        <textarea
          value={project?.description || ''}
          onChange={(e) => {
            if (project) {
              setProject({ ...project, description: e.target.value });
            }
          }}
          onBlur={async () => {
            if (project) {
              try {
                await bookApi.updateProject(project.id, { description: project.description });
              } catch (err) {
                console.error('Failed to update synopsis:', err);
              }
            }
          }}
          placeholder="What is this book about? Write a compelling synopsis..."
          style={{
            width: '100%',
            minHeight: 80,
            background: 'var(--bg)',
            border: '1px solid var(--panel-border)',
            borderRadius: 8,
            padding: 10,
            color: 'var(--text)',
            fontSize: 12,
            resize: 'vertical',
            outline: 'none',
          }}
        />
        <div style={{ fontSize: 10, color: '#64748b', marginTop: 4 }}>
          {(project?.description || '').split(/\s+/).filter(w => w).length}/200 words recommended
        </div>
      </div>
    </>
  );

  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Mobile Header */}
      {isMobile ? (
        <div style={{ flexShrink: 0 }}>
          <div className="book-editor-mobile-header">
            <button
              className="menu-btn"
              onClick={() => setDrawerOpen(true)}
              title="Open chapters"
            >
              <Menu size={20} />
            </button>
            <input
              className="title-input"
              type="text"
              value={project?.title || ''}
              onChange={(e) => {
                if (project) {
                  setProject({ ...project, title: e.target.value });
                  setTitleError(''); // Clear error on change
                }
              }}
              onBlur={(e) => handleUpdateProjectTitle(e.target.value)}
              placeholder="Book Title"
              style={titleError ? { borderColor: '#ef4444' } : undefined}
            />
            <button
              className="settings-btn"
              onClick={() => setSettingsOpen(true)}
              title="Book settings"
            >
              <Settings size={18} />
            </button>
            <button
              className="publish-btn"
              onClick={() => setShowPublishModal(true)}
              disabled={chapters.length === 0}
            >
              Publish
            </button>
          </div>
          {titleError && (
            <div style={{ color: '#ef4444', fontSize: 12, padding: '4px 16px', background: 'var(--panel)' }}>
              {titleError}
            </div>
          )}
        </div>
      ) : (
        /* Desktop Header */
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 0',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 1, flexWrap: 'wrap' }}>
            <button
              onClick={onBack}
              style={{
                background: 'transparent',
                border: '1px solid var(--panel-border)',
                borderRadius: 8,
                padding: '8px 16px',
                color: 'var(--text)',
                cursor: 'pointer',
                fontSize: 14,
              }}
            >
              ← Back
            </button>
            <div style={{ flex: 1, minWidth: 200 }}>
              <input
                type="text"
                value={project?.title || ''}
                onChange={(e) => {
                  if (project) {
                    setProject({ ...project, title: e.target.value });
                    setTitleError(''); // Clear error on change
                  }
                }}
                onBlur={(e) => handleUpdateProjectTitle(e.target.value)}
                placeholder="Book Title"
                style={{
                  background: 'transparent',
                  border: titleError ? '1px solid #ef4444' : 'none',
                  borderRadius: titleError ? 4 : 0,
                  padding: titleError ? '4px 8px' : 0,
                  color: 'var(--text)',
                  fontSize: 20,
                  fontWeight: 700,
                  outline: 'none',
                  width: '100%',
                }}
              />
              {titleError && (
                <div style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>
                  {titleError}
                </div>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {canDeleteProject && !isUnpublished && (
              <button
                onClick={handleDeleteProject}
                style={{
                  background: 'transparent',
                  border: '1px solid #ef4444',
                  borderRadius: 8,
                  padding: '8px 16px',
                  color: '#ef4444',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: 14,
                }}
                title="Delete this book project"
              >
                {chapters.length === 0 ? 'Cancel Project' : 'Delete Project'}
              </button>
            )}
            {isPublished && (
              <button
                onClick={() => setShowUnpublishConfirm(true)}
                disabled={unpublishing}
                style={{
                  background: 'transparent',
                  border: '1px solid #ef4444',
                  borderRadius: 8,
                  padding: '8px 16px',
                  color: '#ef4444',
                  fontWeight: 600,
                  cursor: unpublishing ? 'wait' : 'pointer',
                  fontSize: 14,
                }}
              >
                {unpublishing ? 'Removing...' : 'Remove from Marketplace'}
              </button>
            )}
            {isUnpublished && (
              <button
                onClick={() => setShowRepublishConfirm(true)}
                disabled={republishing}
                style={{
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  border: 'none',
                  borderRadius: 8,
                  padding: '8px 16px',
                  color: '#fff',
                  fontWeight: 700,
                  cursor: republishing ? 'wait' : 'pointer',
                  fontSize: 14,
                }}
              >
                {republishing ? 'Listing...' : 'Re-list on Marketplace'}
              </button>
            )}
            {selectedChapterId && selectedChapter && (
              <button
                onClick={() => handleDeleteChapter(selectedChapterId)}
                disabled={selectedChapter.is_published}
                style={{
                  background: 'transparent',
                  border: selectedChapter.is_published ? '1px solid #6b7280' : '1px solid #ef4444',
                  borderRadius: 8,
                  padding: '8px 16px',
                  color: selectedChapter.is_published ? '#6b7280' : '#ef4444',
                  fontWeight: 600,
                  cursor: selectedChapter.is_published ? 'not-allowed' : 'pointer',
                  fontSize: 14,
                  opacity: selectedChapter.is_published ? 0.5 : 1,
                }}
                title={selectedChapter.is_published ? 'Cannot delete a minted chapter' : 'Delete this chapter'}
              >
                Delete Chapter
              </button>
            )}
            <button
              onClick={() => setShowPublishModal(true)}
              disabled={chapters.length === 0}
              style={{
                background: chapters.length === 0 ? '#6b7280' : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                border: 'none',
                borderRadius: 8,
                padding: '8px 20px',
                color: '#fff',
                fontWeight: 700,
                cursor: chapters.length === 0 ? 'not-allowed' : 'pointer',
                fontSize: 14,
              }}
            >
              Publish
            </button>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid #ef4444',
          borderRadius: 8,
          padding: 12,
          color: '#ef4444',
          fontSize: 14,
          flexShrink: 0,
          marginBottom: 16,
        }}>
          {error}
          <button
            onClick={() => setError('')}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#ef4444',
              cursor: 'pointer',
              float: 'right',
              fontWeight: 700,
            }}
          >
            ×
          </button>
        </div>
      )}

      {/* Mobile Drawer */}
      {isMobile && drawerOpen && (
        <>
          <div
            className="book-editor-drawer-overlay"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="book-editor-drawer">
            <div className="book-editor-drawer-header">
              <h3>{project?.title || 'Untitled Book'}</h3>
              <button
                className="book-editor-drawer-close"
                onClick={() => setDrawerOpen(false)}
              >
                <X size={20} />
              </button>
            </div>
            <CoverSynopsisSection />
            <ChapterList
              chapters={chapters}
              selectedChapterId={selectedChapterId}
              onSelectChapter={handleChapterSelect}
              onAddChapter={handleAddChapter}
            />
            {/* Back button in drawer */}
            <button
              onClick={onBack}
              style={{
                background: 'transparent',
                border: '1px solid var(--panel-border)',
                borderRadius: 8,
                padding: '10px 16px',
                color: 'var(--text)',
                cursor: 'pointer',
                fontSize: 14,
                marginTop: 'auto',
              }}
            >
              ← Back to Studio
            </button>
          </div>
        </>
      )}

      {/* Mobile Settings Modal */}
      {isMobile && settingsOpen && (
        <div
          className="book-settings-modal-overlay"
          onClick={() => setSettingsOpen(false)}
        >
          <div
            className="book-settings-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="book-settings-modal-header">
              <h3>Book Settings</h3>
              <button
                className="book-settings-modal-close"
                onClick={() => setSettingsOpen(false)}
              >
                <X size={20} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <CoverSynopsisSection />
              {/* Delete buttons */}
              {canDeleteProject && (
                <button
                  onClick={() => {
                    setSettingsOpen(false);
                    handleDeleteProject();
                  }}
                  style={{
                    background: 'transparent',
                    border: '1px solid #ef4444',
                    borderRadius: 8,
                    padding: '12px 16px',
                    color: '#ef4444',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: 14,
                  }}
                >
                  {chapters.length === 0 ? 'Cancel Project' : 'Delete Project'}
                </button>
              )}
              {selectedChapterId && selectedChapter && !selectedChapter.is_published && (
                <button
                  onClick={() => {
                    setSettingsOpen(false);
                    handleDeleteChapter(selectedChapterId);
                  }}
                  style={{
                    background: 'transparent',
                    border: '1px solid #ef4444',
                    borderRadius: 8,
                    padding: '12px 16px',
                    color: '#ef4444',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: 14,
                  }}
                >
                  Delete Current Chapter
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Content: Conditional layout for mobile vs desktop */}
      <div style={{
        display: 'flex',
        gap: isMobile ? 0 : 16,
        flex: 1,
        minHeight: 0,
        overflow: 'hidden',
      }}>
        {/* Desktop Sidebar: Cover + Chapters */}
        {!isMobile && (
          <div style={{
            width: 260,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            height: '100%',
            overflow: 'hidden',
          }}>
            <CoverSynopsisSection />
            <ChapterList
              chapters={chapters}
              selectedChapterId={selectedChapterId}
              onSelectChapter={setSelectedChapterId}
              onAddChapter={handleAddChapter}
            />
          </div>
        )}

        {/* Editor (full width on mobile) */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          minHeight: 0,
          overflow: 'hidden',
        }}>
          <ChapterEditor
            chapter={selectedChapter}
            onUpdateChapter={handleUpdateChapter}
            saving={saving}
            lastSaved={lastSaved}
            showManagement={selectedChapter?.is_published}
            canAutosave={hasValidTitle}
            onManagementChange={async () => {
              if (project?.id) {
                try {
                  const updatedProject = await bookApi.getProject(project.id);
                  setProject(updatedProject);
                  setChapters(updatedProject.chapters || []);
                  const chapterStillExists = updatedProject.chapters?.some(ch => ch.id === selectedChapterId);
                  if (!chapterStillExists) {
                    if (updatedProject.chapters && updatedProject.chapters.length > 0) {
                      setSelectedChapterId(updatedProject.chapters[0].id);
                    } else {
                      setSelectedChapterId(null);
                    }
                  }
                } catch (err) {
                  onBack();
                }
              }
            }}
          />
        </div>
      </div>

      {/* Navigation Warning Modal */}
      {showLeaveWarning && (
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
          onClick={() => {
            setShowLeaveWarning(false);
          }}
        >
          <div
            style={{
              background: 'var(--panel)',
              border: '1px solid var(--panel-border)',
              borderRadius: 16,
              padding: 24,
              maxWidth: 400,
              width: '90%',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <AlertTriangle size={24} color="#f59e0b" />
              <h3 style={{ margin: 0, color: 'var(--text)', fontSize: 18 }}>
                Unsaved Content
              </h3>
            </div>
            <p style={{ color: '#94a3b8', fontSize: 14, marginBottom: 20, lineHeight: 1.5 }}>
              Your chapter content won't be saved because the book doesn't have a title yet.
              Please add a title to save your work, or discard the project.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowLeaveWarning(false);
                }}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--panel-border)',
                  borderRadius: 8,
                  padding: '10px 20px',
                  color: 'var(--text)',
                  cursor: 'pointer',
                  fontSize: 14,
                }}
              >
                Add Title
              </button>
              <button
                onClick={() => {
                  setShowLeaveWarning(false);
                  pendingNavigation?.();
                }}
                style={{
                  background: '#ef4444',
                  border: 'none',
                  borderRadius: 8,
                  padding: '10px 20px',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: 600,
                }}
              >
                Discard & Leave
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Publish Modal */}
      <PublishModal
        open={showPublishModal}
        onClose={() => setShowPublishModal(false)}
        project={project}
        currentChapter={selectedChapter}
        onPublish={handlePublish}
      />

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
              This will remove your book from the marketplace. No new purchases can be made.
            </p>
            <p style={{
              margin: 0,
              marginBottom: 24,
              fontSize: 13,
              color: '#64748b',
              lineHeight: 1.5,
            }}>
              Existing buyers will keep access to their purchased content. You can re-list this book later.
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
              This will make your book available for purchase again on the marketplace.
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

