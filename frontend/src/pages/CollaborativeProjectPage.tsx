import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import TabNavigation, { TabId } from '../components/collaboration/tabs/TabNavigation';
import OverviewTab from '../components/collaboration/tabs/OverviewTab';
import TeamTab from '../components/collaboration/tabs/TeamTab';
import ActivityTab from '../components/collaboration/tabs/ActivityTab';
import PublishTab from '../components/collaboration/tabs/PublishTab';
import ContentTab from '../components/collaboration/tabs/ContentTab';
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
  const [searchParams, setSearchParams] = useSearchParams();

  const [project, setProject] = useState<CollaborativeProject | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  // Tab state from URL or default to 'overview'
  const activeTab = (searchParams.get('tab') as TabId) || 'overview';

  const setActiveTab = (tab: TabId) => {
    setSearchParams({ tab });
  };

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
          <div style={{ fontSize: 48, marginBottom: 16 }}>&#9888;&#65039;</div>
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
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!project || !currentUser) {
    return null;
  }

  // Calculate badges for tabs
  const unresolvedComments = project.recent_comments?.filter(c => !c.resolved).length || 0;
  const pendingApprovals = project.collaborators?.filter(
    c => c.status === 'accepted' && (!c.approved_current_version || !c.approved_revenue_split)
  ).length || 0;

  return (
    <div className="page" style={{ maxWidth: 1400, margin: '0 auto', padding: 24 }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 20,
      }}>
        <div>
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
              marginBottom: 12,
            }}
          >
            &larr; Back to Dashboard
          </button>
          <h1 style={{
            margin: 0,
            fontSize: 28,
            fontWeight: 700,
            color: 'var(--text)',
          }}>
            {project.title}
          </h1>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginTop: 8,
          }}>
            <span style={{
              background: 'rgba(139, 92, 246, 0.1)',
              color: '#8b5cf6',
              padding: '4px 10px',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
            }}>
              {project.content_type.charAt(0).toUpperCase() + project.content_type.slice(1)} Project
            </span>
            <span style={{
              background: project.status === 'ready_for_mint'
                ? 'rgba(16, 185, 129, 0.1)'
                : 'rgba(245, 158, 11, 0.1)',
              color: project.status === 'ready_for_mint' ? '#10b981' : '#f59e0b',
              padding: '4px 10px',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
            }}>
              {project.status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
            </span>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div style={{ marginBottom: 20 }}>
        <TabNavigation
          activeTab={activeTab}
          onTabChange={setActiveTab}
          badges={{
            activity: unresolvedComments,
            team: pendingApprovals,
          }}
          isFullyApproved={project.is_fully_approved}
        />
      </div>

      {/* Tab Content */}
      <div style={{ minHeight: '60vh' }}>
        {activeTab === 'overview' && (
          <OverviewTab
            project={project}
            currentUser={currentUser}
            onProjectUpdate={handleProjectUpdate}
          />
        )}

        {activeTab === 'content' && (
          <ContentTab
            project={project}
            currentUser={currentUser}
            onSectionUpdate={handleSectionUpdate}
            onCommentAdd={handleCommentAdd}
            onProjectUpdate={handleProjectUpdate}
          />
        )}

        {activeTab === 'team' && (
          <TeamTab
            project={project}
            currentUser={currentUser}
            onProjectUpdate={handleProjectUpdate}
          />
        )}

        {activeTab === 'activity' && (
          <ActivityTab project={project} currentUser={currentUser} />
        )}

        {activeTab === 'publish' && (
          <PublishTab
            project={project}
            currentUser={currentUser}
            onProjectUpdate={handleProjectUpdate}
          />
        )}
      </div>
    </div>
  );
}

