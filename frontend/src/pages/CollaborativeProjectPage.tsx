import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CollaborativeEditor } from '../components/collaboration';
import {
  collaborationApi,
  CollaborativeProject,
  ProjectSection,
  ProjectComment,
} from '../services/collaborationApi';

// Simple User interface - in real app, get from auth context
interface User {
  id: number;
  username: string;
  display_name?: string;
}

export default function CollaborativeProjectPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<CollaborativeProject | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    loadProjectAndUser();
  }, [projectId]);

  const loadProjectAndUser = async () => {
    if (!projectId) {
      setError('Invalid project ID');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Load project
      const projectData = await collaborationApi.getCollaborativeProject(parseInt(projectId, 10));
      setProject(projectData);

      // Get current user from auth status
      const authResponse = await fetch('/api/auth/status/', { credentials: 'include' });
      const authData = await authResponse.json();

      if (authData.authenticated && authData.user) {
        setCurrentUser({
          id: authData.user.id,
          username: authData.user.username,
          display_name: authData.user.display_name,
        });
      } else {
        setError('You must be logged in to access this project');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load project');
    } finally {
      setLoading(false);
    }
  };

  const handleSectionUpdate = (section: ProjectSection) => {
    console.log('Section updated:', section);
    // Optionally refresh project data
  };

  const handleCommentAdd = (comment: ProjectComment) => {
    console.log('Comment added:', comment);
    // Optionally refresh project data
  };

  const handleProjectUpdate = (updatedProject: CollaborativeProject) => {
    console.log('Project updated:', updatedProject);
    setProject(updatedProject);
  };

  if (loading) {
    return (
      <div className="page" style={{ maxWidth: 1400, margin: '0 auto', padding: 24 }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '60vh',
          color: '#94a3b8',
          fontSize: 16,
        }}>
          Loading project...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page" style={{ maxWidth: 1400, margin: '0 auto', padding: 24 }}>
        <div style={{
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid #ef4444',
          borderRadius: 12,
          padding: 24,
          color: '#ef4444',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
            Error Loading Project
          </div>
          <div style={{ fontSize: 14, marginBottom: 24 }}>
            {error}
          </div>
          <button
            onClick={() => navigate('/collaborations')}
            style={{
              background: '#ef4444',
              border: 'none',
              borderRadius: 8,
              padding: '10px 20px',
              color: '#fff',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            ← Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!project || !currentUser) {
    return null;
  }

  return (
    <div className="page" style={{ maxWidth: 1400, margin: '0 auto', padding: 24 }}>
      {/* Back Button */}
      <div style={{ marginBottom: 16 }}>
        <button
          onClick={() => navigate('/collaborations')}
          style={{
            background: 'transparent',
            border: '1px solid var(--panel-border)',
            borderRadius: 8,
            padding: '8px 16px',
            color: 'var(--text)',
            cursor: 'pointer',
            fontSize: 14,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          ← Back to Dashboard
        </button>
      </div>

      {/* Collaborative Editor */}
      <CollaborativeEditor
        project={project}
        currentUser={currentUser}
        onSectionUpdate={handleSectionUpdate}
        onCommentAdd={handleCommentAdd}
        onProjectUpdate={handleProjectUpdate}
      />
    </div>
  );
}
