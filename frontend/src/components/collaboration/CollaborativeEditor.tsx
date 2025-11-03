import React, { useEffect, useState, useCallback } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import {
  CollaborativeProject,
  ProjectSection,
  ProjectComment,
  CollaboratorRole,
  collaborationApi,
  CreateSectionData,
  CreateCommentData
} from '../../services/collaborationApi';

// Simple User interface (extend as needed)
interface User {
  id: number;
  username: string;
  display_name?: string;
}

interface CollaborativeEditorProps {
  project: CollaborativeProject;
  currentUser: User;
  onSectionUpdate?: (section: ProjectSection) => void;
  onCommentAdd?: (comment: ProjectComment) => void;
  onProjectUpdate?: (project: CollaborativeProject) => void;
}

export default function CollaborativeEditor({
  project,
  currentUser,
  onSectionUpdate,
  onCommentAdd,
  onProjectUpdate,
}: CollaborativeEditorProps) {
  // State management
  const [sections, setSections] = useState<ProjectSection[]>(project.sections || []);
  const [comments, setComments] = useState<ProjectComment[]>(project.recent_comments || []);
  const [collaborators, setCollaborators] = useState<CollaboratorRole[]>(project.collaborators || []);
  const [currentlyEditingSection, setCurrentlyEditingSection] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [error, setError] = useState<string>('');
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Find current user's collaborator role
  const currentUserRole = collaborators.find(c => c.user === currentUser.id);

  // Check if user can edit a specific section type
  const canEditSectionType = useCallback((sectionType: 'text' | 'image' | 'audio' | 'video'): boolean => {
    if (!currentUserRole) return false;
    const permissions = currentUserRole.can_edit || [];
    return permissions.includes(sectionType);
  }, [currentUserRole]);

  // Check if user owns a section
  const ownsSection = useCallback((section: ProjectSection): boolean => {
    return section.owner === currentUser.id;
  }, [currentUser.id]);

  // Load sections and comments
  useEffect(() => {
    loadSections();
    loadComments();
  }, [project.id]);

  const loadSections = async () => {
    try {
      const loadedSections = await collaborationApi.getProjectSections(project.id);
      setSections(loadedSections);
    } catch (err: any) {
      setError(err.message || 'Failed to load sections');
    }
  };

  const loadComments = async () => {
    try {
      const loadedComments = await collaborationApi.getComments(project.id);
      setComments(loadedComments);
    } catch (err: any) {
      setError(err.message || 'Failed to load comments');
    }
  };

  // Add new section
  const handleAddSection = async (sectionType: 'text' | 'image' | 'audio' | 'video') => {
    if (!canEditSectionType(sectionType)) {
      setError(`You don't have permission to create ${sectionType} sections`);
      return;
    }

    try {
      const newSection = await collaborationApi.createProjectSection({
        project: project.id,
        section_type: sectionType,
        title: `New ${sectionType} section`,
        content_html: sectionType === 'text' ? '' : undefined,
        order: sections.length,
      });
      setSections([...sections, newSection]);
      setCurrentlyEditingSection(newSection.id);
      onSectionUpdate?.(newSection);
    } catch (err: any) {
      setError(err.message || 'Failed to create section');
    }
  };

  // Update section
  const handleUpdateSection = async (
    sectionId: number,
    updates: Partial<CreateSectionData>
  ) => {
    setSaving(true);
    try {
      const updatedSection = await collaborationApi.updateProjectSection(sectionId, updates);
      setSections(sections.map(s => s.id === sectionId ? updatedSection : s));
      setLastSaved(new Date());
      onSectionUpdate?.(updatedSection);
    } catch (err: any) {
      setError(err.message || 'Failed to update section');
    } finally {
      setSaving(false);
    }
  };

  // Delete section
  const handleDeleteSection = async (sectionId: number) => {
    if (!confirm('Are you sure you want to delete this section?')) return;

    try {
      await collaborationApi.deleteProjectSection(sectionId);
      setSections(sections.filter(s => s.id !== sectionId));
    } catch (err: any) {
      setError(err.message || 'Failed to delete section');
    }
  };

  // Upload media file
  const handleMediaUpload = async (sectionId: number, file: File) => {
    setSaving(true);
    try {
      const updatedSection = await collaborationApi.updateProjectSection(sectionId, {
        media_file: file,
      });
      setSections(sections.map(s => s.id === sectionId ? updatedSection : s));
      setLastSaved(new Date());
      onSectionUpdate?.(updatedSection);
    } catch (err: any) {
      setError(err.message || 'Failed to upload media');
    } finally {
      setSaving(false);
    }
  };

  // Add comment
  const handleAddComment = async () => {
    if (!commentText.trim()) return;

    try {
      const newComment = await collaborationApi.addComment({
        project: project.id,
        content: commentText,
      });
      setComments([newComment, ...comments]);
      setCommentText('');
      setShowCommentInput(false);
      onCommentAdd?.(newComment);
    } catch (err: any) {
      setError(err.message || 'Failed to add comment');
    }
  };

  // Approve version
  const handleApproveVersion = async () => {
    try {
      const updatedProject = await collaborationApi.approveCurrentVersion(project.id);
      onProjectUpdate?.(updatedProject);
      alert('Version approved! 🎉');
    } catch (err: any) {
      setError(err.message || 'Failed to approve version');
    }
  };

  // Preview project
  const handlePreview = async () => {
    setShowPreview(true);
  };

  // Get section type badge color
  const getSectionTypeBadgeColor = (type: string) => {
    switch (type) {
      case 'text': return '#3b82f6';
      case 'image': return '#8b5cf6';
      case 'audio': return '#f59e0b';
      case 'video': return '#ef4444';
      default: return '#64748b';
    }
  };

  // Get approval status
  const approvalStatus = {
    total: collaborators.filter(c => c.status === 'accepted').length,
    approved: collaborators.filter(c =>
      c.status === 'accepted' &&
      c.approved_current_version &&
      c.approved_revenue_split
    ).length,
  };

  const isFullyApproved = project.is_fully_approved;
  const userHasApproved = currentUserRole?.approved_current_version && currentUserRole?.approved_revenue_split;

  return (
    <div style={{
      width: '100%',
      height: '90vh',
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '16px 0',
      }}>
        <div style={{ flex: 1 }}>
          <h2 style={{
            margin: 0,
            color: 'var(--text)',
            fontSize: 24,
            fontWeight: 700
          }}>
            {project.title}
          </h2>
          <div style={{
            marginTop: 4,
            fontSize: 14,
            color: '#94a3b8'
          }}>
            {project.content_type.charAt(0).toUpperCase() + project.content_type.slice(1)} Project
            {' • '}
            Status: {project.status.replace(/_/g, ' ')}
          </div>
        </div>

        {/* Header Actions */}
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={handlePreview}
            style={{
              background: 'transparent',
              border: '1px solid var(--panel-border)',
              borderRadius: 8,
              padding: '8px 16px',
              color: 'var(--text)',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            👁️ Preview
          </button>

          {currentUserRole && !userHasApproved && (
            <button
              onClick={handleApproveVersion}
              style={{
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                border: 'none',
                borderRadius: 8,
                padding: '8px 20px',
                color: '#fff',
                fontWeight: 700,
                cursor: 'pointer',
                fontSize: 14,
              }}
            >
              ✓ Approve Version
            </button>
          )}

          {isFullyApproved && project.status === 'ready_for_mint' && (
            <button
              style={{
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                border: 'none',
                borderRadius: 8,
                padding: '8px 20px',
                color: '#fff',
                fontWeight: 700,
                cursor: 'pointer',
                fontSize: 14,
              }}
            >
              🚀 Ready to Mint
            </button>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid #ef4444',
          borderRadius: 8,
          padding: 12,
          color: '#ef4444',
          fontSize: 14,
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
              fontSize: 18,
            }}
          >
            ×
          </button>
        </div>
      )}

      {/* Main Layout: Sidebar + Editor */}
      <div style={{
        display: 'flex',
        gap: 16,
        flex: 1,
        overflow: 'hidden'
      }}>
        {/* Left Sidebar: Collaborators + Comments */}
        <div style={{
          width: 280,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          overflow: 'auto',
        }}>
          {/* Collaborators Panel */}
          <div style={{
            background: 'var(--panel)',
            border: '1px solid var(--panel-border)',
            borderRadius: 12,
            padding: 16,
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 12,
            }}>
              <h3 style={{
                margin: 0,
                fontSize: 14,
                fontWeight: 700,
                color: 'var(--text)'
              }}>
                Collaborators ({collaborators.length})
              </h3>
              {project.created_by === currentUser.id && (
                <button
                  onClick={() => setShowInviteModal(true)}
                  style={{
                    background: 'transparent',
                    border: '1px solid var(--panel-border)',
                    borderRadius: 6,
                    padding: '4px 8px',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    fontSize: 11,
                  }}
                >
                  + Invite
                </button>
              )}
            </div>

            {/* Collaborator List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {collaborators.map(collab => (
                <div
                  key={collab.id}
                  style={{
                    padding: 10,
                    background: collab.user === currentUser.id ? 'rgba(59, 130, 246, 0.1)' : 'var(--bg)',
                    border: '1px solid var(--panel-border)',
                    borderRadius: 8,
                  }}
                >
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}>
                    <div style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: collab.status === 'accepted' ? '#10b981' : '#94a3b8',
                    }} />
                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: 'var(--text)',
                      }}>
                        @{collab.username}
                        {collab.user === currentUser.id && ' (you)'}
                      </div>
                      <div style={{
                        fontSize: 11,
                        color: '#94a3b8',
                      }}>
                        {collab.role} • {collab.revenue_percentage}%
                      </div>
                    </div>
                  </div>

                  {/* Approval Status */}
                  {collab.status === 'accepted' && (
                    <div style={{ marginTop: 6, fontSize: 10, color: '#94a3b8' }}>
                      {collab.approved_current_version && collab.approved_revenue_split ? (
                        <span style={{ color: '#10b981' }}>✓ Approved</span>
                      ) : (
                        <span>⏳ Pending approval</span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Approval Status Panel */}
          <div style={{
            background: isFullyApproved
              ? 'rgba(16, 185, 129, 0.1)'
              : 'rgba(245, 158, 11, 0.1)',
            border: `1px solid ${isFullyApproved ? '#10b981' : '#f59e0b'}`,
            borderRadius: 12,
            padding: 12,
          }}>
            <div style={{
              fontSize: 12,
              fontWeight: 600,
              color: isFullyApproved ? '#10b981' : '#f59e0b',
              marginBottom: 6,
            }}>
              {isFullyApproved ? '✓ Fully Approved' : '⏳ Awaiting Approvals'}
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>
              {approvalStatus.approved} of {approvalStatus.total} collaborators approved
            </div>
          </div>

          {/* Comments Panel */}
          <div style={{
            background: 'var(--panel)',
            border: '1px solid var(--panel-border)',
            borderRadius: 12,
            padding: 16,
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 12,
            }}>
              <h3 style={{
                margin: 0,
                fontSize: 14,
                fontWeight: 700,
                color: 'var(--text)'
              }}>
                Comments ({comments.length})
              </h3>
              <button
                onClick={() => setShowCommentInput(!showCommentInput)}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--panel-border)',
                  borderRadius: 6,
                  padding: '4px 8px',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  fontSize: 11,
                }}
              >
                + Add
              </button>
            </div>

            {/* Comment Input */}
            {showCommentInput && (
              <div style={{ marginBottom: 12 }}>
                <textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Write a comment..."
                  style={{
                    width: '100%',
                    minHeight: 60,
                    background: 'var(--bg)',
                    border: '1px solid var(--panel-border)',
                    borderRadius: 8,
                    padding: 8,
                    color: 'var(--text)',
                    fontSize: 12,
                    resize: 'vertical',
                    outline: 'none',
                  }}
                />
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button
                    onClick={handleAddComment}
                    style={{
                      flex: 1,
                      background: '#3b82f6',
                      border: 'none',
                      borderRadius: 6,
                      padding: '6px 12px',
                      color: '#fff',
                      cursor: 'pointer',
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  >
                    Post
                  </button>
                  <button
                    onClick={() => {
                      setShowCommentInput(false);
                      setCommentText('');
                    }}
                    style={{
                      background: 'transparent',
                      border: '1px solid var(--panel-border)',
                      borderRadius: 6,
                      padding: '6px 12px',
                      color: '#94a3b8',
                      cursor: 'pointer',
                      fontSize: 11,
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Comment List */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              overflow: 'auto',
            }}>
              {comments.map(comment => (
                <div
                  key={comment.id}
                  style={{
                    padding: 10,
                    background: 'var(--bg)',
                    border: '1px solid var(--panel-border)',
                    borderRadius: 8,
                  }}
                >
                  <div style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: 'var(--text)',
                    marginBottom: 4,
                  }}>
                    @{comment.author_username}
                  </div>
                  <div style={{
                    fontSize: 11,
                    color: '#cbd5e1',
                    lineHeight: 1.5,
                  }}>
                    {comment.content}
                  </div>
                  <div style={{
                    fontSize: 10,
                    color: '#64748b',
                    marginTop: 6,
                  }}>
                    {formatTimeAgo(new Date(comment.created_at))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Editor Area */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          overflow: 'auto',
        }}>
          {/* Sections */}
          {sections.length === 0 ? (
            <div style={{
              background: 'var(--panel)',
              border: '1px solid var(--panel-border)',
              borderRadius: 12,
              padding: 32,
              textAlign: 'center',
              color: '#94a3b8',
            }}>
              <div style={{ fontSize: 16, marginBottom: 16 }}>
                No sections yet. Add your first section to get started!
              </div>
            </div>
          ) : (
            sections.map((section, index) => (
              <SectionEditor
                key={section.id}
                section={section}
                sectionNumber={index + 1}
                canEdit={ownsSection(section) || project.created_by === currentUser.id}
                isOwner={ownsSection(section)}
                isEditing={currentlyEditingSection === section.id}
                onStartEdit={() => setCurrentlyEditingSection(section.id)}
                onUpdate={(updates) => handleUpdateSection(section.id, updates)}
                onDelete={() => handleDeleteSection(section.id)}
                onMediaUpload={(file) => handleMediaUpload(section.id, file)}
                saving={saving}
              />
            ))
          )}

          {/* Add Section Buttons */}
          <div style={{
            background: 'var(--panel)',
            border: '1px dashed var(--panel-border)',
            borderRadius: 12,
            padding: 16,
          }}>
            <div style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--text)',
              marginBottom: 12,
            }}>
              Add Section
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {(['text', 'image', 'audio', 'video'] as const).map(type => {
                const canAdd = canEditSectionType(type);
                return (
                  <button
                    key={type}
                    onClick={() => handleAddSection(type)}
                    disabled={!canAdd}
                    style={{
                      background: canAdd ? getSectionTypeBadgeColor(type) : '#374151',
                      border: 'none',
                      borderRadius: 8,
                      padding: '8px 16px',
                      color: '#fff',
                      cursor: canAdd ? 'pointer' : 'not-allowed',
                      fontSize: 12,
                      fontWeight: 600,
                      opacity: canAdd ? 1 : 0.5,
                    }}
                  >
                    {type === 'text' && '📝'}
                    {type === 'image' && '🖼️'}
                    {type === 'audio' && '🎵'}
                    {type === 'video' && '🎬'}
                    {' '}
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Saving Status */}
          {saving && (
            <div style={{
              fontSize: 12,
              color: '#f59e0b',
              textAlign: 'right',
            }}>
              Saving...
            </div>
          )}
          {!saving && lastSaved && (
            <div style={{
              fontSize: 12,
              color: '#10b981',
              textAlign: 'right',
            }}>
              Saved {formatTimeAgo(lastSaved)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Section Editor Sub-component
interface SectionEditorProps {
  section: ProjectSection;
  sectionNumber: number;
  canEdit: boolean;
  isOwner: boolean;
  isEditing: boolean;
  onStartEdit: () => void;
  onUpdate: (updates: Partial<CreateSectionData>) => void;
  onDelete: () => void;
  onMediaUpload: (file: File) => void;
  saving: boolean;
}

function SectionEditor({
  section,
  sectionNumber,
  canEdit,
  isOwner,
  isEditing,
  onStartEdit,
  onUpdate,
  onDelete,
  onMediaUpload,
  saving,
}: SectionEditorProps) {
  const [title, setTitle] = useState(section.title);
  const [content, setContent] = useState(section.content_html || '');

  // Debounced auto-save for text sections
  useEffect(() => {
    if (!canEdit || section.section_type !== 'text') return;

    const timer = setTimeout(() => {
      if (title !== section.title || content !== section.content_html) {
        onUpdate({ title, content_html: content });
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, [title, content, section.id]);

  const getSectionIcon = (type: string) => {
    switch (type) {
      case 'text': return '📝';
      case 'image': return '🖼️';
      case 'audio': return '🎵';
      case 'video': return '🎬';
      default: return '📄';
    }
  };

  const getSectionColor = (type: string) => {
    switch (type) {
      case 'text': return '#3b82f6';
      case 'image': return '#8b5cf6';
      case 'audio': return '#f59e0b';
      case 'video': return '#ef4444';
      default: return '#64748b';
    }
  };

  return (
    <div
      style={{
        background: 'var(--panel)',
        border: `2px solid ${canEdit ? getSectionColor(section.section_type) : 'var(--panel-border)'}`,
        borderRadius: 12,
        padding: 20,
        position: 'relative',
      }}
      onClick={() => canEdit && !isEditing && onStartEdit()}
    >
      {/* Section Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 20 }}>{getSectionIcon(section.section_type)}</span>
          <div>
            <div style={{
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--text)',
            }}>
              Section {sectionNumber}: {section.section_type}
              {!canEdit && (
                <span style={{
                  marginLeft: 8,
                  fontSize: 11,
                  color: '#ef4444',
                }}>
                  🔒 @{section.owner_username}'s section
                </span>
              )}
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>
              Owner: @{section.owner_username}
            </div>
          </div>
        </div>

        {/* Actions */}
        {canEdit && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            style={{
              background: 'transparent',
              border: '1px solid #ef4444',
              borderRadius: 6,
              padding: '4px 12px',
              color: '#ef4444',
              cursor: 'pointer',
              fontSize: 11,
            }}
          >
            Delete
          </button>
        )}
      </div>

      {/* Section Content */}
      {!canEdit ? (
        // Read-only view for sections user can't edit
        <div style={{
          background: 'rgba(100, 100, 100, 0.1)',
          borderRadius: 8,
          padding: 16,
          opacity: 0.6,
        }}>
          <div style={{ fontSize: 13, color: '#94a3b8' }}>
            {section.section_type === 'text' && (
              <div dangerouslySetInnerHTML={{ __html: section.content_html || 'No content yet' }} />
            )}
            {section.section_type === 'image' && section.media_file && (
              <img
                src={section.media_file}
                alt={section.title}
                style={{ maxWidth: '100%', borderRadius: 8 }}
              />
            )}
            {section.section_type === 'audio' && section.media_file && (
              <audio controls style={{ width: '100%' }}>
                <source src={section.media_file} />
              </audio>
            )}
            {section.section_type === 'video' && section.media_file && (
              <video controls style={{ maxWidth: '100%', borderRadius: 8 }}>
                <source src={section.media_file} />
              </video>
            )}
            {!section.media_file && section.section_type !== 'text' && (
              <div style={{ textAlign: 'center', padding: 20 }}>
                No media uploaded yet
              </div>
            )}
          </div>
        </div>
      ) : (
        // Editable content
        <>
          {/* Title Input */}
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Section title"
            style={{
              width: '100%',
              background: 'var(--bg)',
              border: '1px solid var(--panel-border)',
              borderRadius: 8,
              padding: '10px 12px',
              color: 'var(--text)',
              fontSize: 14,
              fontWeight: 600,
              marginBottom: 12,
              outline: 'none',
            }}
          />

          {/* Content based on type */}
          {section.section_type === 'text' && (
            <div style={{ minHeight: 200 }}>
              <ReactQuill
                value={content}
                onChange={setContent}
                theme="snow"
                style={{
                  height: 200,
                  marginBottom: 50,
                }}
                modules={{
                  toolbar: [
                    [{ header: [1, 2, 3, false] }],
                    ['bold', 'italic', 'underline', 'strike'],
                    [{ list: 'ordered' }, { list: 'bullet' }],
                    ['blockquote', 'code-block'],
                    ['link'],
                    ['clean'],
                  ],
                }}
              />
            </div>
          )}

          {/* Media Upload */}
          {section.section_type !== 'text' && (
            <div>
              {section.media_file ? (
                <div style={{ marginBottom: 12 }}>
                  {section.section_type === 'image' && (
                    <img
                      src={section.media_file}
                      alt={section.title}
                      style={{ maxWidth: '100%', borderRadius: 8 }}
                    />
                  )}
                  {section.section_type === 'audio' && (
                    <audio controls style={{ width: '100%' }}>
                      <source src={section.media_file} />
                    </audio>
                  )}
                  {section.section_type === 'video' && (
                    <video controls style={{ maxWidth: '100%', borderRadius: 8 }}>
                      <source src={section.media_file} />
                    </video>
                  )}
                </div>
              ) : (
                <div style={{
                  border: '2px dashed var(--panel-border)',
                  borderRadius: 8,
                  padding: 32,
                  textAlign: 'center',
                  marginBottom: 12,
                }}>
                  <div style={{ fontSize: 14, color: '#94a3b8', marginBottom: 12 }}>
                    No {section.section_type} uploaded
                  </div>
                </div>
              )}

              <label style={{
                display: 'block',
                background: getSectionColor(section.section_type),
                border: 'none',
                borderRadius: 8,
                padding: '10px 16px',
                color: '#fff',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: 13,
                textAlign: 'center',
              }}>
                {section.media_file ? 'Replace' : 'Upload'} {section.section_type}
                <input
                  type="file"
                  accept={
                    section.section_type === 'image' ? 'image/*' :
                    section.section_type === 'audio' ? 'audio/*' :
                    section.section_type === 'video' ? 'video/*' : '*'
                  }
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      onMediaUpload(file);
                    }
                  }}
                />
              </label>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Utility function
function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
