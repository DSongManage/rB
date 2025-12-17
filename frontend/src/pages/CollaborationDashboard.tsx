import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  collaborationApi,
  CollaborativeProjectListItem,
  CollaborativeProject,
  CollaboratorRole,
} from '../services/collaborationApi';
import { PendingInviteCard } from '../components/collaboration/PendingInviteCard';
import { InviteResponseModal } from '../components/collaboration/InviteResponseModal';
import { useAuth } from '../hooks/useAuth';

type FilterType = 'all' | 'book' | 'music' | 'video' | 'art';
type SortType = 'recent' | 'oldest' | 'title';

interface PendingInvite {
  project: CollaborativeProject;
  invite: CollaboratorRole;
}

export default function CollaborationDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [projects, setProjects] = useState<CollaborativeProjectListItem[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingInvites, setLoadingInvites] = useState(true);
  const [error, setError] = useState<string>('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [sort, setSort] = useState<SortType>('recent');
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);

  // Modal state for viewing invite details
  const [selectedInviteProjectId, setSelectedInviteProjectId] = useState<number | null>(null);

  // Load projects and invites on mount
  useEffect(() => {
    loadProjects();
    loadPendingInvites();
  }, []);

  const loadProjects = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await collaborationApi.getCollaborativeProjects();
      setProjects(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  // Load pending invites using dedicated API endpoint
  const loadPendingInvites = async () => {
    setLoadingInvites(true);
    try {
      // Use the efficient API that returns only pending invites for current user
      const invites = await collaborationApi.getPendingInvites();
      setPendingInvites(invites);
    } catch (err: any) {
      console.error('Failed to load pending invites:', err);
      setPendingInvites([]);
    } finally {
      setLoadingInvites(false);
    }
  };

  // Filter and sort projects
  const filteredAndSortedProjects = useMemo(() => {
    let filtered = projects;

    // Apply filter
    if (filter !== 'all') {
      filtered = filtered.filter(p => p.content_type === filter);
    }

    // Apply sort
    const sorted = [...filtered].sort((a, b) => {
      switch (sort) {
        case 'recent':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'title':
          return a.title.localeCompare(b.title);
        default:
          return 0;
      }
    });

    return sorted;
  }, [projects, filter, sort]);

  // Group projects by status
  const activeProjects = filteredAndSortedProjects.filter(
    p => p.status === 'active' || p.status === 'draft'
  );
  const readyToMintProjects = filteredAndSortedProjects.filter(
    p => p.status === 'ready_for_mint'
  );
  const completedProjects = filteredAndSortedProjects.filter(
    p => p.status === 'minted' || p.status === 'cancelled'
  );

  return (
    <div className="page" style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 32px' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 32,
      }}>
        <div>
          <h1 style={{
            margin: 0,
            fontSize: 32,
            fontWeight: 800,
            color: 'var(--text)',
            marginBottom: 8,
          }}>
            My Collaborative Projects
          </h1>
          <p style={{
            margin: 0,
            fontSize: 14,
            color: '#94a3b8',
          }}>
            Manage your collaborative creations with other artists
          </p>
        </div>
      </div>

      {/* Toolbar: New Project, Filter, Sort */}
      <div style={{
        display: 'flex',
        gap: 12,
        marginBottom: 24,
        flexWrap: 'wrap',
      }}>
        <button
          onClick={() => setShowNewProjectModal(true)}
          style={{
            background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
            border: 'none',
            borderRadius: 8,
            padding: '10px 20px',
            color: '#fff',
            fontWeight: 700,
            cursor: 'pointer',
            fontSize: 14,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span style={{ fontSize: 18 }}>+</span>
          New Collaboration
        </button>

        {/* Filter */}
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as FilterType)}
          style={{
            background: 'var(--panel)',
            border: '1px solid var(--panel-border)',
            borderRadius: 8,
            padding: '10px 16px',
            color: 'var(--text)',
            fontSize: 14,
            cursor: 'pointer',
            outline: 'none',
          }}
        >
          <option value="all">All Types</option>
          <option value="book">📖 Books</option>
          <option value="music">🎵 Music</option>
          <option value="video">🎬 Video</option>
          <option value="art">🎨 Art</option>
        </select>

        {/* Sort */}
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortType)}
          style={{
            background: 'var(--panel)',
            border: '1px solid var(--panel-border)',
            borderRadius: 8,
            padding: '10px 16px',
            color: 'var(--text)',
            fontSize: 14,
            cursor: 'pointer',
            outline: 'none',
          }}
        >
          <option value="recent">Most Recent</option>
          <option value="oldest">Oldest First</option>
          <option value="title">Title (A-Z)</option>
        </select>

        <button
          onClick={loadProjects}
          style={{
            background: 'transparent',
            border: '1px solid var(--panel-border)',
            borderRadius: 8,
            padding: '10px 16px',
            color: 'var(--text)',
            cursor: 'pointer',
            fontSize: 14,
            marginLeft: 'auto',
          }}
        >
          🔄 Refresh
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid #ef4444',
          borderRadius: 8,
          padding: 16,
          color: '#ef4444',
          fontSize: 14,
          marginBottom: 24,
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

      {/* Loading State */}
      {loading && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}>
          {[1, 2, 3].map(i => (
            <div
              key={i}
              style={{
                background: 'var(--panel)',
                border: '1px solid var(--panel-border)',
                borderRadius: 12,
                padding: 20,
                height: 140,
                animation: 'pulse 2s ease-in-out infinite',
              }}
            />
          ))}
        </div>
      )}

      {/* Projects Display */}
      {!loading && (
        <>
          {/* Empty State */}
          {projects.length === 0 && (
            <div style={{
              background: 'var(--panel)',
              border: '2px dashed var(--panel-border)',
              borderRadius: 12,
              padding: 48,
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🤝</div>
              <h3 style={{
                margin: 0,
                fontSize: 20,
                fontWeight: 700,
                color: 'var(--text)',
                marginBottom: 8,
              }}>
                No Collaborative Projects Yet
              </h3>
              <p style={{
                margin: 0,
                fontSize: 14,
                color: '#94a3b8',
                marginBottom: 24,
                maxWidth: 500,
                marginLeft: 'auto',
                marginRight: 'auto',
              }}>
                Start your first collaboration! Work with other creators to build amazing content together.
              </p>
              <button
                onClick={() => setShowNewProjectModal(true)}
                style={{
                  background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                  border: 'none',
                  borderRadius: 8,
                  padding: '12px 24px',
                  color: '#fff',
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontSize: 14,
                }}
              >
                Create Your First Collaboration
              </button>
            </div>
          )}

          {/* Pending Invites Section */}
          {pendingInvites.length > 0 && (
            <div style={{ marginBottom: 32 }}>
              <h2 style={{
                fontSize: 18,
                fontWeight: 700,
                color: 'var(--text)',
                marginBottom: 16,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}>
                <span style={{
                  background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                  padding: '4px 12px',
                  borderRadius: 6,
                  fontSize: 12,
                  color: '#fff',
                  animation: 'pulse 2s ease-in-out infinite',
                }}>
                  {pendingInvites.length}
                </span>
                Pending Invites
              </h2>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
                gap: 16,
              }}>
                {pendingInvites.map(({ project, invite }) => (
                  <PendingInviteCard
                    key={project.id}
                    project={project}
                    myInvite={invite}
                    onAction={() => {
                      loadProjects();
                      loadPendingInvites();
                    }}
                    onViewDetails={(id) => setSelectedInviteProjectId(id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Loading indicator for pending invites */}
          {loadingInvites && pendingInvites.length === 0 && (
            <div style={{
              background: '#f59e0b10',
              border: '1px dashed #f59e0b40',
              borderRadius: 12,
              padding: 16,
              marginBottom: 24,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}>
              <div
                style={{
                  width: 20,
                  height: 20,
                  border: '2px solid #f59e0b40',
                  borderTopColor: '#f59e0b',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                }}
              />
              <span style={{ color: '#f59e0b', fontSize: 14 }}>
                Checking for pending invites...
              </span>
            </div>
          )}

          {/* Ready to Mint Projects */}
          {readyToMintProjects.length > 0 && (
            <div style={{ marginBottom: 32 }}>
              <h2 style={{
                fontSize: 18,
                fontWeight: 700,
                color: 'var(--text)',
                marginBottom: 16,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}>
                <span style={{
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  padding: '4px 12px',
                  borderRadius: 6,
                  fontSize: 12,
                  color: '#fff',
                }}>
                  {readyToMintProjects.length}
                </span>
                Ready to Mint
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {readyToMintProjects.map(project => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    onRefresh={loadProjects}
                    currentUserId={user?.id}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Active Projects */}
          {activeProjects.length > 0 && (
            <div style={{ marginBottom: 32 }}>
              <h2 style={{
                fontSize: 18,
                fontWeight: 700,
                color: 'var(--text)',
                marginBottom: 16,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}>
                <span style={{
                  background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                  padding: '4px 12px',
                  borderRadius: 6,
                  fontSize: 12,
                  color: '#fff',
                }}>
                  {activeProjects.length}
                </span>
                Active Projects
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {activeProjects.map(project => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    onRefresh={loadProjects}
                    currentUserId={user?.id}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Completed Projects */}
          {completedProjects.length > 0 && (
            <div style={{ marginBottom: 32 }}>
              <h2 style={{
                fontSize: 18,
                fontWeight: 700,
                color: 'var(--text)',
                marginBottom: 16,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}>
                <span style={{
                  background: '#64748b',
                  padding: '4px 12px',
                  borderRadius: 6,
                  fontSize: 12,
                  color: '#fff',
                }}>
                  {completedProjects.length}
                </span>
                Completed Projects
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {completedProjects.slice(0, 3).map(project => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    onRefresh={loadProjects}
                    currentUserId={user?.id}
                  />
                ))}
              </div>
              {completedProjects.length > 3 && (
                <button
                  style={{
                    background: 'transparent',
                    border: '1px solid var(--panel-border)',
                    borderRadius: 8,
                    padding: '10px 16px',
                    color: 'var(--text)',
                    cursor: 'pointer',
                    fontSize: 13,
                    width: '100%',
                    marginTop: 12,
                  }}
                >
                  Show All {completedProjects.length} Completed Projects →
                </button>
              )}
            </div>
          )}
        </>
      )}

      {/* New Project Modal */}
      {showNewProjectModal && (
        <NewProjectModal
          onClose={() => setShowNewProjectModal(false)}
          onCreated={(project) => {
            setShowNewProjectModal(false);
            loadProjects();
            navigate(`/collaborations/${project.id}`);
          }}
        />
      )}

      {/* Invite Response Modal */}
      {selectedInviteProjectId && (
        <InviteResponseModal
          open={true}
          onClose={() => {
            setSelectedInviteProjectId(null);
            loadProjects();
            loadPendingInvites();
          }}
          projectId={selectedInviteProjectId}
        />
      )}
    </div>
  );
}

// Project Card Component
interface ProjectCardProps {
  project: CollaborativeProjectListItem;
  onRefresh: () => void;
  currentUserId?: number;
}

function ProjectCard({ project, onRefresh, currentUserId }: ProjectCardProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Check if current user is the project owner
  const isOwner = currentUserId && project.created_by === currentUserId;

  const getContentTypeIcon = (type: string) => {
    switch (type) {
      case 'book': return '📖';
      case 'music': return '🎵';
      case 'video': return '🎬';
      case 'art': return '🎨';
      default: return '📄';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return { text: 'Draft', color: '#64748b' };
      case 'active':
        return { text: 'Active', color: '#3b82f6' };
      case 'ready_for_mint':
        return { text: '✅ Ready to Mint', color: '#10b981' };
      case 'minted':
        return { text: 'Minted', color: '#8b5cf6' };
      case 'cancelled':
        return { text: 'Cancelled', color: '#ef4444' };
      default:
        return { text: status, color: '#64748b' };
    }
  };

  const statusBadge = getStatusBadge(project.status);

  const handleEdit = () => {
    navigate(`/collaborations/${project.id}`);
  };

  const handleViewDetails = () => {
    navigate(`/collaborations/${project.id}/details`);
  };

  const handleMint = () => {
    // TODO: Implement minting flow
    alert('Minting flow coming soon!');
  };

  const handleDelete = async () => {
    setLoading(true);
    try {
      await collaborationApi.deleteCollaborativeProject(project.id);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to delete project');
    } finally {
      setLoading(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <div
      style={{
        background: 'var(--panel)',
        border: '1px solid var(--panel-border)',
        borderRadius: 12,
        padding: 20,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = '#f59e0b';
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(245, 158, 11, 0.1)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--panel-border)';
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'none';
      }}
      onClick={handleEdit}
    >
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
      }}>
        <div style={{ flex: 1 }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 8,
          }}>
            <span style={{ fontSize: 24 }}>{getContentTypeIcon(project.content_type)}</span>
            <h3 style={{
              margin: 0,
              fontSize: 18,
              fontWeight: 700,
              color: 'var(--text)',
            }}>
              {project.title}
            </h3>
          </div>

          <div style={{
            fontSize: 13,
            color: '#94a3b8',
            marginBottom: 8,
          }}>
            With {project.total_collaborators} collaborator{project.total_collaborators !== 1 ? 's' : ''}
            {' • '}
            Created by @{project.created_by_username}
          </div>
        </div>

        {/* Status Badge */}
        <div style={{
          background: statusBadge.color,
          color: '#fff',
          padding: '6px 12px',
          borderRadius: 6,
          fontSize: 12,
          fontWeight: 600,
          whiteSpace: 'nowrap',
        }}>
          {statusBadge.text}
        </div>
      </div>

      {/* Footer: Timestamp + Actions */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 16,
        paddingTop: 16,
        borderTop: '1px solid var(--panel-border)',
      }}>
        <div style={{
          fontSize: 12,
          color: '#64748b',
        }}>
          Created {formatTimeAgo(new Date(project.created_at))}
        </div>

        {/* Action Buttons */}
        <div
          style={{ display: 'flex', gap: 8 }}
          onClick={(e) => e.stopPropagation()}
        >
          {project.status === 'ready_for_mint' && (
            <button
              onClick={handleMint}
              disabled={loading}
              style={{
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                border: 'none',
                borderRadius: 6,
                padding: '8px 16px',
                color: '#fff',
                fontWeight: 600,
                cursor: loading ? 'wait' : 'pointer',
                fontSize: 12,
              }}
            >
              🚀 Mint NFT
            </button>
          )}

          {(project.status === 'draft' || project.status === 'active') && (
            <button
              onClick={handleEdit}
              style={{
                background: '#3b82f6',
                border: 'none',
                borderRadius: 6,
                padding: '8px 16px',
                color: '#fff',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: 12,
              }}
            >
              Continue Editing
            </button>
          )}

          <button
            onClick={handleViewDetails}
            style={{
              background: 'transparent',
              border: '1px solid var(--panel-border)',
              borderRadius: 6,
              padding: '8px 16px',
              color: 'var(--text)',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: 12,
            }}
          >
            View Details
          </button>

          {/* Delete/Cancel button for project owners */}
          {isOwner && (project.status === 'draft' || project.status === 'active') && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              disabled={loading}
              style={{
                background: 'transparent',
                border: '1px solid #ef4444',
                borderRadius: 6,
                padding: '8px 16px',
                color: '#ef4444',
                fontWeight: 600,
                cursor: loading ? 'wait' : 'pointer',
                fontSize: 12,
              }}
            >
              Cancel
            </button>
          )}
        </div>
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
          onClick={() => setShowDeleteConfirm(false)}
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
              Cancel Collaboration?
            </h3>
            <p style={{
              margin: 0,
              marginBottom: 24,
              fontSize: 14,
              color: '#94a3b8',
              lineHeight: 1.5,
            }}>
              Are you sure you want to cancel "{project.title}"? This will remove the project and cancel any pending invitations. This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={loading}
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
                Keep Project
              </button>
              <button
                onClick={handleDelete}
                disabled={loading}
                style={{
                  background: '#ef4444',
                  border: 'none',
                  borderRadius: 6,
                  padding: '10px 20px',
                  color: '#fff',
                  fontWeight: 600,
                  cursor: loading ? 'wait' : 'pointer',
                  fontSize: 13,
                }}
              >
                {loading ? 'Canceling...' : 'Yes, Cancel Project'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// New Project Modal Component
interface NewProjectModalProps {
  onClose: () => void;
  onCreated: (project: CollaborativeProject) => void;
}

function NewProjectModal({ onClose, onCreated }: NewProjectModalProps) {
  const [title, setTitle] = useState('');
  const [contentType, setContentType] = useState<'book' | 'music' | 'video' | 'art'>('book');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    if (!title.trim()) {
      setError('Please enter a project title');
      return;
    }

    setCreating(true);
    setError('');

    try {
      const project = await collaborationApi.createCollaborativeProject({
        title: title.trim(),
        content_type: contentType,
        description: description.trim(),
      });
      onCreated(project);
    } catch (err: any) {
      setError(err.message || 'Failed to create project');
    } finally {
      setCreating(false);
    }
  };

  return (
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
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--panel)',
          borderRadius: 16,
          padding: 32,
          maxWidth: 500,
          width: '90%',
          maxHeight: '90vh',
          overflow: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{
          margin: 0,
          marginBottom: 24,
          fontSize: 24,
          fontWeight: 700,
          color: 'var(--text)',
        }}>
          Create New Collaboration
        </h2>

        {/* Error */}
        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid #ef4444',
            borderRadius: 8,
            padding: 12,
            color: '#ef4444',
            fontSize: 13,
            marginBottom: 16,
          }}>
            {error}
          </div>
        )}

        {/* Title */}
        <div style={{ marginBottom: 20 }}>
          <label style={{
            display: 'block',
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--text)',
            marginBottom: 8,
          }}>
            Project Title *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter project title..."
            style={{
              width: '100%',
              background: 'var(--bg)',
              border: '1px solid var(--panel-border)',
              borderRadius: 8,
              padding: '12px 16px',
              color: 'var(--text)',
              fontSize: 14,
              outline: 'none',
            }}
          />
        </div>

        {/* Content Type */}
        <div style={{ marginBottom: 20 }}>
          <label style={{
            display: 'block',
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--text)',
            marginBottom: 8,
          }}>
            Content Type *
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {(['book', 'music', 'video', 'art'] as const).map(type => (
              <button
                key={type}
                onClick={() => setContentType(type)}
                style={{
                  background: contentType === type ? '#3b82f6' : 'var(--bg)',
                  border: contentType === type ? '2px solid #3b82f6' : '1px solid var(--panel-border)',
                  borderRadius: 8,
                  padding: '12px 16px',
                  color: contentType === type ? '#fff' : 'var(--text)',
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span style={{ fontSize: 20 }}>
                  {type === 'book' && '📖'}
                  {type === 'music' && '🎵'}
                  {type === 'video' && '🎬'}
                  {type === 'art' && '🎨'}
                </span>
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Description */}
        <div style={{ marginBottom: 24 }}>
          <label style={{
            display: 'block',
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--text)',
            marginBottom: 8,
          }}>
            Description (optional)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe your collaboration..."
            rows={4}
            style={{
              width: '100%',
              background: 'var(--bg)',
              border: '1px solid var(--panel-border)',
              borderRadius: 8,
              padding: '12px 16px',
              color: 'var(--text)',
              fontSize: 14,
              outline: 'none',
              resize: 'vertical',
              fontFamily: 'inherit',
            }}
          />
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={handleCreate}
            disabled={creating}
            style={{
              flex: 1,
              background: creating ? '#6b7280' : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              border: 'none',
              borderRadius: 8,
              padding: '12px 24px',
              color: '#fff',
              fontWeight: 700,
              cursor: creating ? 'wait' : 'pointer',
              fontSize: 14,
            }}
          >
            {creating ? 'Creating...' : 'Create Project'}
          </button>
          <button
            onClick={onClose}
            disabled={creating}
            style={{
              background: 'transparent',
              border: '1px solid var(--panel-border)',
              borderRadius: 8,
              padding: '12px 24px',
              color: 'var(--text)',
              fontWeight: 600,
              cursor: creating ? 'not-allowed' : 'pointer',
              fontSize: 14,
            }}
          >
            Cancel
          </button>
        </div>
      </div>
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
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}
