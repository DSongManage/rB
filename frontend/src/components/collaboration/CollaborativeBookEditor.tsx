import React, { useState, useEffect } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import {
  CollaborativeProject,
  ProjectSection,
  collaborationApi,
} from '../../services/collaborationApi';

interface User {
  id: number;
  username: string;
  display_name?: string;
}

interface CollaborativeBookEditorProps {
  project: CollaborativeProject;
  currentUser: User;
  onProjectUpdate?: (project: CollaborativeProject) => void;
}

// Represent chapters as sections with section_type='text'
interface Chapter {
  id: number;
  title: string;
  content_html: string;
  order: number;
  owner: number;
  owner_username: string;
}

export default function CollaborativeBookEditor({
  project,
  currentUser,
  onProjectUpdate,
}: CollaborativeBookEditorProps) {
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [selectedChapterId, setSelectedChapterId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [error, setError] = useState('');

  const collaborators = project.collaborators || [];
  const currentUserRole = collaborators.find(c => c.user === currentUser.id);
  const canEditText = currentUserRole?.can_edit?.includes('text') ?? currentUserRole?.can_edit_text ?? false;

  // Load chapters from sections
  useEffect(() => {
    loadChapters();
  }, [project.id]);

  const loadChapters = async () => {
    try {
      const sections = await collaborationApi.getProjectSections(project.id);
      const textSections = sections
        .filter(s => s.section_type === 'text')
        .sort((a, b) => a.order - b.order)
        .map(s => ({
          id: s.id,
          title: s.title,
          content_html: s.content_html || '',
          order: s.order,
          owner: s.owner,
          owner_username: s.owner_username,
        }));
      setChapters(textSections);
      if (textSections.length > 0 && !selectedChapterId) {
        setSelectedChapterId(textSections[0].id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load chapters');
    }
  };

  const handleAddChapter = async () => {
    if (!canEditText) {
      setError("You don't have permission to add chapters");
      return;
    }

    try {
      const newSection = await collaborationApi.createProjectSection({
        project: project.id,
        section_type: 'text',
        title: `Chapter ${chapters.length + 1}`,
        content_html: '',
        order: chapters.length,
      });

      const newChapter: Chapter = {
        id: newSection.id,
        title: newSection.title,
        content_html: newSection.content_html || '',
        order: newSection.order,
        owner: newSection.owner,
        owner_username: newSection.owner_username,
      };

      setChapters([...chapters, newChapter]);
      setSelectedChapterId(newChapter.id);
    } catch (err: any) {
      setError(err.message || 'Failed to add chapter');
    }
  };

  const handleUpdateChapter = async (chapterId: number, title: string, content: string) => {
    setSaving(true);
    try {
      const updated = await collaborationApi.updateProjectSection(chapterId, {
        title,
        content_html: content,
      });
      setChapters(chapters.map(ch =>
        ch.id === chapterId
          ? { ...ch, title: updated.title, content_html: updated.content_html || '' }
          : ch
      ));
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
      await collaborationApi.deleteProjectSection(chapterId);
      const remaining = chapters.filter(ch => ch.id !== chapterId);
      setChapters(remaining);
      if (selectedChapterId === chapterId) {
        setSelectedChapterId(remaining[0]?.id || null);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to delete chapter');
    }
  };

  const selectedChapter = chapters.find(ch => ch.id === selectedChapterId);
  const canEditSelectedChapter = selectedChapter && (
    selectedChapter.owner === currentUser.id || canEditText
  );

  return (
    <div style={{ display: 'flex', gap: 20, height: 'calc(100vh - 300px)', minHeight: 500 }}>
      {/* Chapter Sidebar */}
      <div style={{
        width: 280,
        background: 'var(--panel)',
        border: '1px solid var(--panel-border)',
        borderRadius: 12,
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}>
          <h3 style={{ margin: 0, color: 'var(--text)', fontSize: 16 }}>
            Chapters ({chapters.length})
          </h3>
          {canEditText && (
            <button
              onClick={handleAddChapter}
              style={{
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                border: 'none',
                borderRadius: 6,
                padding: '6px 12px',
                color: '#fff',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: 12,
              }}
            >
              + Add
            </button>
          )}
        </div>

        {/* Chapter List */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}>
          {chapters.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: 24,
              color: '#64748b',
              fontSize: 13,
            }}>
              No chapters yet.
              {canEditText && ' Click "+ Add" to create one.'}
            </div>
          ) : (
            chapters.map((chapter, index) => {
              const isSelected = selectedChapterId === chapter.id;
              const isOwner = chapter.owner === currentUser.id;

              return (
                <div
                  key={chapter.id}
                  onClick={() => setSelectedChapterId(chapter.id)}
                  style={{
                    padding: 12,
                    background: isSelected ? 'rgba(245, 158, 11, 0.1)' : 'var(--bg)',
                    border: isSelected
                      ? '1px solid #f59e0b'
                      : '1px solid var(--panel-border)',
                    borderRadius: 8,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: isSelected ? '#f59e0b' : 'var(--text)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {chapter.title || `Chapter ${index + 1}`}
                      </div>
                      <div style={{
                        fontSize: 11,
                        color: '#94a3b8',
                        marginTop: 2,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}>
                        <span style={{
                          width: 14,
                          height: 14,
                          borderRadius: '50%',
                          background: isOwner
                            ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
                            : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#fff',
                          fontSize: 8,
                          fontWeight: 700,
                        }}>
                          {chapter.owner_username.charAt(0).toUpperCase()}
                        </span>
                        @{chapter.owner_username}
                        {isOwner && <span style={{ color: '#f59e0b' }}>(you)</span>}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Chapter Editor */}
      <div style={{
        flex: 1,
        background: 'var(--panel)',
        border: '1px solid var(--panel-border)',
        borderRadius: 12,
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
      }}>
        {error && (
          <div style={{
            padding: 12,
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid #ef4444',
            borderRadius: 8,
            color: '#ef4444',
            fontSize: 13,
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
              x
            </button>
          </div>
        )}

        {selectedChapter ? (
          <ChapterEditor
            chapter={selectedChapter}
            canEdit={canEditSelectedChapter || false}
            onUpdate={(title, content) => handleUpdateChapter(selectedChapter.id, title, content)}
            onDelete={() => handleDeleteChapter(selectedChapter.id)}
            saving={saving}
            lastSaved={lastSaved}
          />
        ) : (
          <div style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#64748b',
            fontSize: 14,
          }}>
            {chapters.length > 0
              ? 'Select a chapter to edit'
              : 'Add your first chapter to get started'}
          </div>
        )}
      </div>
    </div>
  );
}

// Chapter Editor Sub-component
interface ChapterEditorProps {
  chapter: Chapter;
  canEdit: boolean;
  onUpdate: (title: string, content: string) => void;
  onDelete: () => void;
  saving: boolean;
  lastSaved: Date | null;
}

function ChapterEditor({
  chapter,
  canEdit,
  onUpdate,
  onDelete,
  saving,
  lastSaved,
}: ChapterEditorProps) {
  const [title, setTitle] = useState(chapter.title);
  const [content, setContent] = useState(chapter.content_html);

  // Sync when chapter changes
  useEffect(() => {
    setTitle(chapter.title);
    setContent(chapter.content_html);
  }, [chapter.id]);

  // Auto-save with debounce
  useEffect(() => {
    if (!canEdit) return;

    const timer = setTimeout(() => {
      if (title !== chapter.title || content !== chapter.content_html) {
        onUpdate(title, content);
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [title, content]);

  const quillModules = {
    toolbar: [
      [{ header: [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ list: 'ordered' }, { list: 'bullet' }],
      ['blockquote', 'code-block'],
      ['link'],
      ['clean'],
    ],
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Chapter Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        gap: 16,
      }}>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={!canEdit}
          placeholder="Chapter Title"
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            borderBottom: '2px solid var(--panel-border)',
            color: 'var(--text)',
            fontSize: 20,
            fontWeight: 700,
            padding: '8px 0',
            outline: 'none',
          }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {saving && (
            <span style={{ fontSize: 12, color: '#f59e0b' }}>Saving...</span>
          )}
          {!saving && lastSaved && (
            <span style={{ fontSize: 12, color: '#10b981' }}>
              Saved {formatTimeAgo(lastSaved)}
            </span>
          )}
          {canEdit && (
            <button
              onClick={onDelete}
              style={{
                background: 'transparent',
                border: '1px solid #ef4444',
                borderRadius: 6,
                padding: '6px 12px',
                color: '#ef4444',
                cursor: 'pointer',
                fontSize: 12,
              }}
            >
              Delete
            </button>
          )}
        </div>
      </div>

      {/* Owner Badge */}
      <div style={{
        marginBottom: 12,
        fontSize: 12,
        color: '#94a3b8',
      }}>
        Written by @{chapter.owner_username}
        {!canEdit && (
          <span style={{ color: '#ef4444', marginLeft: 8 }}>
            (Read-only - you can only edit your own chapters)
          </span>
        )}
      </div>

      {/* Editor */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 300,
      }}>
        <ReactQuill
          theme="snow"
          value={content}
          onChange={setContent}
          readOnly={!canEdit}
          modules={quillModules}
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
          }}
        />
      </div>
    </div>
  );
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}
