import React, { useEffect, useState } from 'react';
import { bookApi, BookProject, Chapter } from '../../services/bookApi';
import ChapterList from './ChapterList';
import ChapterEditor from './ChapterEditor';
import PublishModal from './PublishModal';

interface BookEditorProps {
  onPublish: (contentId: number) => void;
  onBack: () => void;
  existingContentId?: number; // If provided, load the book project for this content
}

export default function BookEditor({ onPublish, onBack, existingContentId }: BookEditorProps) {
  const [project, setProject] = useState<BookProject | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [selectedChapterId, setSelectedChapterId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(true);

  // Initialize: Create a new project or load existing
  useEffect(() => {
    initializeProject();
  }, [existingContentId]);

  const initializeProject = async () => {
    setLoading(true);
    try {
      if (existingContentId) {
        // Load existing project by content ID
        const existingProject = await bookApi.getProjectByContentId(existingContentId);
        setProject(existingProject);
        setChapters(existingProject.chapters || []);
        // Select first unminted chapter or first chapter
        const firstUnminted = existingProject.chapters?.find(ch => !ch.is_published);
        if (firstUnminted) {
          setSelectedChapterId(firstUnminted.id);
        } else if (existingProject.chapters && existingProject.chapters.length > 0) {
          setSelectedChapterId(existingProject.chapters[0].id);
        }
      } else {
        // Create a new project
        const newProject = await bookApi.createProject('Untitled Book', '');
        setProject(newProject);
        setChapters(newProject.chapters || []);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to initialize project');
    } finally {
      setLoading(false);
    }
  };

  const handleAddChapter = async () => {
    if (!project) return;
    
    try {
      const newChapter = await bookApi.createChapter(project.id, `Chapter ${chapters.length + 1}`);
      setChapters([...chapters, newChapter]);
      setSelectedChapterId(newChapter.id);
    } catch (err: any) {
      setError(err.message || 'Failed to add chapter');
    }
  };

  const handleUpdateChapter = async (chapterId: number, title: string, content: string) => {
    setSaving(true);
    try {
      const updatedChapter = await bookApi.updateChapter(chapterId, { title, content_html: content });
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
        response = await bookApi.publishChapter(selectedChapterId);
      } else {
        response = await bookApi.publishBook(project.id);
      }
      
      setShowPublishModal(false);
      onPublish(response.content_id);
    } catch (err: any) {
      setError(err.message || 'Failed to publish');
    }
  };

  const handleUpdateProjectTitle = async (title: string) => {
    if (!project) return;
    
    try {
      const updatedProject = await bookApi.updateProject(project.id, { title });
      setProject(updatedProject);
    } catch (err: any) {
      setError(err.message || 'Failed to update project title');
    }
  };

  const selectedChapter = chapters.find(ch => ch.id === selectedChapterId) || null;

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

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '16px 0',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 1 }}>
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
          <input
            type="text"
            value={project?.title || ''}
            onChange={(e) => {
              if (project) {
                setProject({ ...project, title: e.target.value });
              }
            }}
            onBlur={(e) => handleUpdateProjectTitle(e.target.value)}
            placeholder="Book Title"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text)',
              fontSize: 20,
              fontWeight: 700,
              outline: 'none',
              flex: 1,
            }}
          />
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          {selectedChapterId && (
            <button
              onClick={() => handleDeleteChapter(selectedChapterId)}
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
            }}
          >
            ×
          </button>
        </div>
      )}

      {/* Main Content: Chapter List + Editor */}
      <div style={{ display: 'flex', gap: 16 }}>
        <ChapterList
          chapters={chapters}
          selectedChapterId={selectedChapterId}
          onSelectChapter={setSelectedChapterId}
          onAddChapter={handleAddChapter}
        />
        <ChapterEditor
          chapter={selectedChapter}
          onUpdateChapter={handleUpdateChapter}
          saving={saving}
          lastSaved={lastSaved}
        />
      </div>

      {/* Publish Modal */}
      <PublishModal
        open={showPublishModal}
        onClose={() => setShowPublishModal(false)}
        project={project}
        currentChapter={selectedChapter}
        onPublish={handlePublish}
      />
    </div>
  );
}

