import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../../config';
import {
  collaborationApi,
  CollaborativeProject,
} from '../../services/collaborationApi';
import CollaborativeComicEditor from '../collaboration/CollaborativeComicEditor';
import { ArrowLeft, Loader2, Pencil, Trash2, Image, X } from 'lucide-react';

interface SoloComicEditorProps {
  onPublish: (contentId: number) => void;
  onBack: () => void;
  existingProjectId?: number;
}

interface User {
  id: number;
  username: string;
  display_name?: string;
}

export default function SoloComicEditor({
  onPublish,
  onBack,
  existingProjectId,
}: SoloComicEditorProps) {
  const navigate = useNavigate();
  const [project, setProject] = useState<CollaborativeProject | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState('');
  const [savingTitle, setSavingTitle] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [showCoverModal, setShowCoverModal] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);

  // Guard to prevent duplicate initialization (React StrictMode runs effects twice)
  const isInitializingRef = useRef(false);
  const hasInitializedRef = useRef(false);

  useEffect(() => {
    // Guard against React StrictMode double-invocation
    if (hasInitializedRef.current || isInitializingRef.current) {
      return;
    }
    initializeProject();
  }, [existingProjectId]);

  const initializeProject = async () => {
    // Prevent concurrent calls (React StrictMode protection)
    if (isInitializingRef.current) {
      console.log('[SoloComicEditor] Skipping duplicate initializeProject call');
      return;
    }
    isInitializingRef.current = true;

    setLoading(true);
    setError('');

    try {
      // 1. Get current user
      const authRes = await fetch(`${API_URL}/api/auth/status/`, {
        credentials: 'include',
      });
      const authData = await authRes.json();

      if (!authData.authenticated || !authData.user) {
        setError('You must be logged in to create a comic');
        setLoading(false);
        return;
      }

      setCurrentUser({
        id: authData.user.id,
        username: authData.user.username,
        display_name: authData.user.display_name,
      });

      // 2. Load existing project or create new one
      if (existingProjectId) {
        const existingProject = await collaborationApi.getCollaborativeProject(
          existingProjectId
        );
        setProject(existingProject);
      } else {
        // Create new solo comic project
        const newProject = await collaborationApi.createCollaborativeProject({
          title: 'Untitled Comic',
          content_type: 'comic',
          description: '',
          is_solo: true,
        });
        setProject(newProject);
      }
      hasInitializedRef.current = true;
    } catch (err: any) {
      setError(err.message || 'Failed to initialize comic editor');
    } finally {
      setLoading(false);
      isInitializingRef.current = false;
    }
  };

  const handleProjectUpdate = (updatedProject: CollaborativeProject) => {
    setProject(updatedProject);
  };

  const handleStartEditTitle = () => {
    setTitleValue(project?.title || 'Untitled Comic');
    setEditingTitle(true);
  };

  const handleSaveTitle = async () => {
    if (!project || !titleValue.trim()) return;

    const newTitle = titleValue.trim();
    if (newTitle === project.title) {
      setEditingTitle(false);
      return;
    }

    setSavingTitle(true);
    try {
      const updated = await collaborationApi.updateCollaborativeProject(project.id, {
        title: newTitle,
      });
      setProject(updated);
      setEditingTitle(false);
    } catch (err: any) {
      setError(err.message || 'Failed to update title');
    } finally {
      setSavingTitle(false);
    }
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveTitle();
    } else if (e.key === 'Escape') {
      setEditingTitle(false);
    }
  };

  const handleDelete = async () => {
    if (!project) return;

    setDeleting(true);
    try {
      await collaborationApi.deleteCollaborativeProject(project.id);
      // Navigate to profile page after deletion
      navigate('/profile');
    } catch (err: any) {
      setError(err.message || 'Failed to delete comic');
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !project) return;

    // Validate file type
    const validTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      setError('Cover image must be PNG, JPG, WebP, or GIF');
      return;
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      setError('Cover image must be under 10MB');
      return;
    }

    setUploadingCover(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('cover_image', file);

      const csrfToken = await getCsrfToken();
      const response = await fetch(
        `${API_URL}/api/collaborative-projects/${project.id}/`,
        {
          method: 'PATCH',
          credentials: 'include',
          headers: {
            'X-CSRFToken': csrfToken,
            'X-Requested-With': 'XMLHttpRequest',
          },
          body: formData,
        }
      );

      if (!response.ok) {
        throw new Error('Failed to upload cover image');
      }

      const updated = await response.json();
      setProject(updated);
      setShowCoverModal(false);
    } catch (err: any) {
      setError(err.message || 'Failed to upload cover image');
    } finally {
      setUploadingCover(false);
      if (coverInputRef.current) {
        coverInputRef.current.value = '';
      }
    }
  };

  // Helper to get CSRF token
  const getCsrfToken = async () => {
    const res = await fetch(`${API_URL}/api/auth/csrf/`, { credentials: 'include' });
    const data = await res.json();
    return data?.csrfToken || '';
  };

  const handlePublish = async () => {
    if (!project) return;

    setPublishing(true);
    setError('');

    try {
      // Prepare comic for minting - creates Content record
      const response = await fetch(
        `${API_URL}/api/collaborative-projects/${project.id}/prepare_comic_for_mint/`,
        {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': await getCsrfToken(),
            'X-Requested-With': 'XMLHttpRequest',
          },
        }
      );

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to prepare comic for publishing');
      }

      const data = await response.json();
      onPublish(data.content_id);
    } catch (err: any) {
      setError(err.message || 'Failed to publish comic');
      setPublishing(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 400 }}>
        <Loader2 size={32} className="animate-spin" style={{ color: '#f59e0b' }} />
        <span style={{ marginLeft: 12, color: '#94a3b8' }}>Loading comic editor...</span>
      </div>
    );
  }

  if (error && !project) {
    return (
      <div style={{ padding: 32, textAlign: 'center' }}>
        <p style={{ color: '#ef4444', marginBottom: 16 }}>{error}</p>
        <button
          onClick={onBack}
          style={{
            color: '#3b82f6',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            textDecoration: 'underline',
          }}
        >
          Go Back
        </button>
      </div>
    );
  }

  if (!project || !currentUser) {
    return null;
  }

  return (
    <div style={{ height: 'calc(100vh - 80px)', display: 'flex', flexDirection: 'column' }}>
      {/* Header with back button and publish */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 24px',
          borderBottom: '1px solid var(--panel-border)',
          background: 'var(--panel)',
        }}
      >
        <button
          onClick={onBack}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'none',
            border: 'none',
            color: '#94a3b8',
            cursor: 'pointer',
            fontSize: 14,
          }}
        >
          <ArrowLeft size={18} />
          Back to Studio
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {editingTitle ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                type="text"
                value={titleValue}
                onChange={(e) => setTitleValue(e.target.value)}
                onKeyDown={handleTitleKeyDown}
                onBlur={handleSaveTitle}
                autoFocus
                style={{
                  background: 'var(--bg-secondary, #1e293b)',
                  border: '1px solid #3b82f6',
                  borderRadius: 4,
                  color: '#e2e8f0',
                  fontSize: 13,
                  padding: '4px 8px',
                  minWidth: 150,
                  outline: 'none',
                }}
              />
              {savingTitle && <Loader2 size={14} className="animate-spin" style={{ color: '#3b82f6' }} />}
            </div>
          ) : (
            <button
              onClick={handleStartEditTitle}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: 'none',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                fontSize: 13,
                padding: '4px 8px',
                borderRadius: 4,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
              title="Click to edit title"
            >
              {project.title || 'Untitled Comic'}
              <Pencil size={12} style={{ opacity: 0.6 }} />
            </button>
          )}
          {/* Cover Art Button */}
          <button
            onClick={() => setShowCoverModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: project.cover_image ? '#3b82f6' : 'transparent',
              border: '1px solid #3b82f6',
              borderRadius: 6,
              padding: '6px 12px',
              color: project.cover_image ? '#fff' : '#3b82f6',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 500,
            }}
            title="Set cover image"
          >
            <Image size={14} />
            {project.cover_image ? 'Cover Set' : 'Add Cover'}
          </button>
          {/* Delete Button */}
          <button
            onClick={() => setShowDeleteConfirm(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'transparent',
              border: '1px solid #ef4444',
              borderRadius: 6,
              padding: '6px 12px',
              color: '#ef4444',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 500,
            }}
            title="Delete comic"
          >
            <Trash2 size={14} />
            Delete
          </button>
          <button
            onClick={handlePublish}
            disabled={publishing}
            style={{
              background: publishing ? '#6b7280' : '#22c55e',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '8px 16px',
              fontSize: 14,
              fontWeight: 600,
              cursor: publishing ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            {publishing && <Loader2 size={16} className="animate-spin" />}
            {publishing ? 'Preparing...' : 'Publish Comic'}
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div
          style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid #ef4444',
            color: '#ef4444',
            padding: '8px 16px',
            fontSize: 13,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{error}</span>
          <button
            onClick={() => setError('')}
            style={{
              background: 'none',
              border: 'none',
              color: '#ef4444',
              cursor: 'pointer',
              fontSize: 12,
            }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Comic Editor */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <CollaborativeComicEditor
          project={project}
          currentUser={currentUser}
          onProjectUpdate={handleProjectUpdate}
        />
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
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
          onClick={() => !deleting && setShowDeleteConfirm(false)}
        >
          <div
            style={{
              background: 'var(--panel, #1e293b)',
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
              color: '#e2e8f0',
            }}>
              Delete "{project.title}"?
            </h3>
            <p style={{
              margin: 0,
              marginBottom: 24,
              fontSize: 14,
              color: '#94a3b8',
              lineHeight: 1.5,
            }}>
              This will permanently delete this comic and all its pages. This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                style={{
                  background: 'transparent',
                  border: '1px solid #334155',
                  borderRadius: 6,
                  padding: '10px 20px',
                  color: '#e2e8f0',
                  fontWeight: 600,
                  cursor: deleting ? 'not-allowed' : 'pointer',
                  fontSize: 13,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                style={{
                  background: '#ef4444',
                  border: 'none',
                  borderRadius: 6,
                  padding: '10px 20px',
                  color: '#fff',
                  fontWeight: 600,
                  cursor: deleting ? 'not-allowed' : 'pointer',
                  fontSize: 13,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                {deleting && <Loader2 size={14} className="animate-spin" />}
                {deleting ? 'Deleting...' : 'Delete Comic'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cover Upload Modal */}
      {showCoverModal && (
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
          onClick={() => !uploadingCover && setShowCoverModal(false)}
        >
          <div
            style={{
              background: 'var(--panel, #1e293b)',
              borderRadius: 12,
              padding: 24,
              maxWidth: 500,
              width: '90%',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 16,
            }}>
              <h3 style={{
                margin: 0,
                fontSize: 18,
                fontWeight: 700,
                color: '#e2e8f0',
              }}>
                Cover Image
              </h3>
              <button
                onClick={() => setShowCoverModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#64748b',
                  cursor: 'pointer',
                  padding: 4,
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Current Cover Preview */}
            {project.cover_image && (
              <div style={{ marginBottom: 16 }}>
                <p style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>Current cover:</p>
                <img
                  src={project.cover_image}
                  alt="Current cover"
                  style={{
                    width: '100%',
                    maxHeight: 200,
                    objectFit: 'contain',
                    borderRadius: 8,
                    background: '#0f172a',
                  }}
                />
              </div>
            )}

            {/* Upload Area */}
            <div
              style={{
                border: '2px dashed #334155',
                borderRadius: 8,
                padding: 32,
                textAlign: 'center',
                cursor: 'pointer',
              }}
              onClick={() => coverInputRef.current?.click()}
            >
              <input
                ref={coverInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={handleCoverUpload}
                style={{ display: 'none' }}
              />
              {uploadingCover ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <Loader2 size={24} className="animate-spin" style={{ color: '#3b82f6' }} />
                  <span style={{ color: '#94a3b8' }}>Uploading...</span>
                </div>
              ) : (
                <>
                  <Image size={32} style={{ color: '#64748b', marginBottom: 12 }} />
                  <p style={{ margin: 0, fontSize: 14, color: '#94a3b8', marginBottom: 4 }}>
                    Click to upload cover image
                  </p>
                  <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>
                    PNG, JPG, WebP, or GIF (max 10MB)
                  </p>
                </>
              )}
            </div>

            <p style={{
              margin: 0,
              marginTop: 12,
              fontSize: 12,
              color: '#64748b',
              textAlign: 'center',
            }}>
              Recommended size: 800x1200 pixels (portrait orientation)
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
