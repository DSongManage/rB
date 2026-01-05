import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { API_URL } from '../config';
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
import { AlertTriangle, Pencil } from 'lucide-react';
import { useMobile } from '../hooks/useMobile';

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
  const { isMobile, isPhone } = useMobile();

  const [project, setProject] = useState<CollaborativeProject | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  // Title editing state
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [savingTitle, setSavingTitle] = useState(false);

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
      const authResponse = await fetch(`${API_URL}/api/auth/status/`, { credentials: 'include' });
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

  const handleSectionUpdate = (_section: ProjectSection) => {
    // Optionally refresh project data
  };

  const handleCommentAdd = (_comment: ProjectComment) => {
    // Optionally refresh project data
  };

  const handleProjectUpdate = (updatedProject: CollaborativeProject) => {
    setProject(updatedProject);
  };

  // Save project title
  const handleSaveTitle = async () => {
    if (!project || !editedTitle.trim() || editedTitle.trim() === project.title) {
      setIsEditingTitle(false);
      return;
    }

    setSavingTitle(true);
    try {
      const csrfRes = await fetch(`${API_URL}/api/auth/csrf/`, { credentials: 'include' });
      const csrfData = await csrfRes.json();
      const csrf = csrfData?.csrfToken || '';

      const res = await fetch(`${API_URL}/api/collaborative-projects/${project.id}/`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrf,
          'X-Requested-With': 'XMLHttpRequest',
        },
        credentials: 'include',
        body: JSON.stringify({ title: editedTitle.trim() }),
      });

      if (res.ok) {
        const updated = await res.json();
        setProject(updated);
        setIsEditingTitle(false);
      } else {
        const err = await res.json();
        console.error('Failed to update title:', err);
      }
    } catch (err) {
      console.error('Failed to update title:', err);
    } finally {
      setSavingTitle(false);
    }
  };

  const startEditingTitle = () => {
    setEditedTitle(project?.title || '');
    setIsEditingTitle(true);
  };

  const cancelEditingTitle = () => {
    setIsEditingTitle(false);
    setEditedTitle('');
  };

  // Check if title is a placeholder
  const isPlaceholderTitle = project?.title?.startsWith('Collaboration Invite');

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
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
            <AlertTriangle size={48} />
          </div>
          <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
            Error Loading Project
          </div>
          <div style={{ fontSize: 14, marginBottom: 24 }}>
            {error}
          </div>
          <button
            onClick={() => navigate('/profile')}
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
    <div className="page" style={{
      maxWidth: activeTab === 'content' ? 'none' : 1400,
      width: '100%',
      margin: '0 auto',
      padding: isMobile
        ? (activeTab === 'content' ? '12px 8px' : '12px 8px')
        : (activeTab === 'content' ? '24px 16px' : 24)
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        flexDirection: isPhone ? 'column' : 'row',
        justifyContent: 'space-between',
        alignItems: isPhone ? 'stretch' : 'flex-start',
        marginBottom: isMobile ? 16 : 20,
        gap: isPhone ? 12 : 0,
      }}>
        <div>
          <button
            onClick={() => navigate('/profile')}
            style={{
              background: 'transparent',
              border: '1px solid var(--panel-border)',
              borderRadius: 8,
              padding: isMobile ? '6px 12px' : '8px 16px',
              color: 'var(--text)',
              cursor: 'pointer',
              fontSize: isMobile ? 13 : 14,
              marginBottom: isMobile ? 8 : 12,
            }}
          >
            &larr; {isPhone ? 'Back' : 'Back to Dashboard'}
          </button>
          {/* Editable Title */}
          {isEditingTitle ? (
            <div style={{ display: 'flex', flexDirection: isPhone ? 'column' : 'row', alignItems: isPhone ? 'stretch' : 'center', gap: isPhone ? 8 : 12, marginBottom: 8 }}>
              <input
                type="text"
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                placeholder="Enter project title..."
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveTitle();
                  if (e.key === 'Escape') cancelEditingTitle();
                }}
                style={{
                  fontSize: isMobile ? 20 : 28,
                  fontWeight: 700,
                  background: 'var(--panel)',
                  border: '2px solid #f59e0b',
                  borderRadius: 8,
                  padding: isMobile ? '6px 12px' : '8px 16px',
                  color: 'var(--text)',
                  minWidth: isPhone ? 'auto' : 400,
                  width: isPhone ? '100%' : 'auto',
                }}
              />
              <button
                onClick={handleSaveTitle}
                disabled={savingTitle || !editedTitle.trim()}
                style={{
                  background: '#10b981',
                  border: 'none',
                  borderRadius: 8,
                  padding: '10px 20px',
                  color: '#fff',
                  fontWeight: 600,
                  cursor: savingTitle ? 'not-allowed' : 'pointer',
                  opacity: savingTitle ? 0.6 : 1,
                }}
              >
                {savingTitle ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={cancelEditingTitle}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--panel-border)',
                  borderRadius: 8,
                  padding: '10px 20px',
                  color: '#94a3b8',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <h1 style={{
                margin: 0,
                fontSize: 28,
                fontWeight: 700,
                color: isPlaceholderTitle ? '#f59e0b' : 'var(--text)',
              }}>
                {project.title}
              </h1>
              {project.created_by === currentUser.id && (
                <button
                  onClick={startEditingTitle}
                  title="Edit project title"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    padding: 4,
                    cursor: 'pointer',
                    fontSize: 18,
                    color: '#94a3b8',
                  }}
                >
                  <Pencil size={16} />
                </button>
              )}
            </div>
          )}

          {/* Placeholder title warning */}
          {isPlaceholderTitle && !isEditingTitle && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginTop: 8,
              padding: '8px 12px',
              background: 'rgba(245, 158, 11, 0.1)',
              border: '1px solid #f59e0b',
              borderRadius: 8,
              fontSize: 13,
              color: '#f59e0b',
            }}>
              <AlertTriangle size={16} />
              <span>
                {project.created_by === currentUser.id
                  ? 'This project has a placeholder title. Click the edit button to set a proper title before publishing.'
                  : 'This project has a placeholder title. Only the owner can change the title.'}
              </span>
            </div>
          )}

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

