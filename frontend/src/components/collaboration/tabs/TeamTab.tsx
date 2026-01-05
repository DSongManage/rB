import React, { useState, useEffect, useRef } from 'react';
import {
  CollaborativeProject,
  CollaboratorRole,
  collaborationApi,
} from '../../../services/collaborationApi';
import { TeamOverview } from '../TeamOverview';
import { TaskTracker } from '../TaskTracker';
import { API_URL } from '../../../config';
import { ClipboardList, AlertTriangle, Search, X, User as UserIcon, Check, XCircle, Loader2 } from 'lucide-react';

interface User {
  id: number;
  username: string;
  display_name?: string;
}

interface TeamTabProps {
  project: CollaborativeProject;
  currentUser: User;
  onProjectUpdate?: (project: CollaborativeProject) => void;
}

interface SearchResult {
  id: number;
  username: string;
  display_name?: string;
  avatar_url?: string;
}

export default function TeamTab({
  project,
  currentUser,
  onProjectUpdate,
}: TeamTabProps) {
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteRole, setInviteRole] = useState('');
  const [invitePercentage, setInvitePercentage] = useState(10);
  const [inviteError, setInviteError] = useState('');
  const [inviting, setInviting] = useState(false);

  // Counter-proposal response state
  const [respondingToCounterProposal, setRespondingToCounterProposal] = useState<number | null>(null);
  const [counterProposalError, setCounterProposalError] = useState('');
  const [declineMessageFor, setDeclineMessageFor] = useState<number | null>(null);
  const [declineMessage, setDeclineMessage] = useState('');

  // User search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<SearchResult | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isProjectLead = project.created_by === currentUser.id;
  const sections = project.sections || [];
  const collaborators = project.collaborators || [];

  // Find project lead's current revenue percentage
  const leadCollaborator = collaborators.find(c => c.user === project.created_by);
  const leadPercentage = leadCollaborator?.revenue_percentage || 100;

  // Calculate max percentage the lead can give away (their current share)
  const maxInvitePercentage = Math.max(0, leadPercentage - 1); // Keep at least 1% for lead

  // Debounced user search
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);

    searchDebounceRef.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const params = new URLSearchParams({ q: searchQuery, page_size: '8' });
        const res = await fetch(`${API_URL}/api/users/search/?${params.toString()}`, {
          credentials: 'include'
        });
        if (res.ok) {
          const data = await res.json();
          // Filter out current user and existing collaborators
          const existingUserIds = new Set([
            currentUser.id,
            ...collaborators.map(c => c.user)
          ]);
          const filtered = (data.results || []).filter(
            (u: SearchResult) => !existingUserIds.has(u.id)
          );
          setSearchResults(filtered);
          setShowDropdown(filtered.length > 0);
        }
      } catch (err) {
        console.error('User search failed:', err);
      } finally {
        setSearchLoading(false);
      }
    }, 300);

    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchQuery, currentUser.id, collaborators]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectUser = (user: SearchResult) => {
    setSelectedUser(user);
    setSearchQuery('');
    setShowDropdown(false);
    setSearchResults([]);
  };

  const handleClearSelectedUser = () => {
    setSelectedUser(null);
    setSearchQuery('');
  };

  const handleInvite = async () => {
    if (!selectedUser) {
      setInviteError('Please select a user to invite');
      return;
    }
    if (!inviteRole.trim()) {
      setInviteError('Please enter a role');
      return;
    }
    if (invitePercentage <= 0 || invitePercentage > maxInvitePercentage) {
      setInviteError(`Percentage must be between 1 and ${maxInvitePercentage}%`);
      return;
    }

    setInviting(true);
    setInviteError('');

    try {
      await collaborationApi.inviteCollaborator(project.id, {
        user_id: selectedUser.id,
        role: inviteRole.trim(),
        revenue_percentage: invitePercentage,
        can_edit_text: true,
        can_edit_images: true,
        can_edit_audio: true,
        can_edit_video: true,
      });

      // Refresh project data
      const updatedProject = await collaborationApi.getCollaborativeProject(project.id);
      onProjectUpdate?.(updatedProject);
      setShowInviteForm(false);
      setSelectedUser(null);
      setSearchQuery('');
      setInviteRole('');
      setInvitePercentage(10);
    } catch (err: any) {
      setInviteError(err.message || 'Failed to invite collaborator');
    } finally {
      setInviting(false);
    }
  };

  // Handle counter-proposal response (accept or decline)
  const handleCounterProposalResponse = async (collaboratorId: number, action: 'accept' | 'decline', message?: string) => {
    setRespondingToCounterProposal(collaboratorId);
    setCounterProposalError('');

    try {
      const result = await collaborationApi.respondToCounterProposal(project.id, {
        collaborator_id: collaboratorId,
        action,
        message,
      });

      // Refresh project data to reflect the changes
      if (result.project) {
        onProjectUpdate?.(result.project);
      } else {
        const updatedProject = await collaborationApi.getCollaborativeProject(project.id);
        onProjectUpdate?.(updatedProject);
      }

      // Clear decline message state after successful decline
      if (action === 'decline') {
        setDeclineMessageFor(null);
        setDeclineMessage('');
      }
    } catch (err: any) {
      setCounterProposalError(err.message || `Failed to ${action} counter-proposal`);
    } finally {
      setRespondingToCounterProposal(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header with Invite Button */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <h2 style={{ margin: 0, color: 'var(--text)', fontSize: 20 }}>
          Team Members
        </h2>
        {isProjectLead && (
          <button
            onClick={() => setShowInviteForm(!showInviteForm)}
            style={{
              background: showInviteForm
                ? 'transparent'
                : 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
              border: showInviteForm ? '1px solid var(--panel-border)' : 'none',
              borderRadius: 8,
              padding: '10px 20px',
              color: showInviteForm ? '#94a3b8' : '#fff',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            {showInviteForm ? 'Cancel' : '+ Invite Collaborator'}
          </button>
        )}
      </div>

      {/* Invite Form */}
      {showInviteForm && (
        <div style={{
          background: 'var(--panel)',
          border: '1px solid var(--panel-border)',
          borderRadius: 12,
          padding: 24,
          overflow: 'hidden',
        }}>
          <h3 style={{ margin: '0 0 16px', color: 'var(--text)', fontSize: 16 }}>
            Invite New Collaborator
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* User Search Input */}
            <div ref={dropdownRef} style={{ position: 'relative' }}>
              <label style={{ display: 'block', fontSize: 12, color: '#94a3b8', marginBottom: 6 }}>
                Find Collaborator
              </label>
              {selectedUser ? (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 12px',
                  background: 'var(--bg)',
                  border: '1px solid #8b5cf6',
                  borderRadius: 8,
                  boxSizing: 'border-box',
                }}>
                  <div style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: selectedUser.avatar_url
                      ? `url(${selectedUser.avatar_url}) center/cover`
                      : 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 14,
                    fontWeight: 600,
                    color: '#fff',
                  }}>
                    {!selectedUser.avatar_url && selectedUser.username.slice(0, 1).toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
                      @{selectedUser.username}
                    </div>
                    {selectedUser.display_name && (
                      <div style={{ fontSize: 12, color: '#94a3b8' }}>
                        {selectedUser.display_name}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={handleClearSelectedUser}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      padding: 4,
                      cursor: 'pointer',
                      color: '#94a3b8',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <X size={18} />
                  </button>
                </div>
              ) : (
                <>
                  <div style={{ position: 'relative' }}>
                    <Search size={16} style={{
                      position: 'absolute',
                      left: 12,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: '#64748b',
                    }} />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
                      placeholder="Search by @username or name..."
                      style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        padding: '10px 12px 10px 38px',
                        background: 'var(--bg)',
                        border: '1px solid var(--panel-border)',
                        borderRadius: 8,
                        color: 'var(--text)',
                        fontSize: 14,
                      }}
                    />
                    {searchLoading && (
                      <div style={{
                        position: 'absolute',
                        right: 12,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: '#64748b',
                        fontSize: 12,
                      }}>
                        ...
                      </div>
                    )}
                  </div>
                  {/* Search Results Dropdown */}
                  {showDropdown && searchResults.length > 0 && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      marginTop: 4,
                      background: 'var(--panel)',
                      border: '1px solid var(--panel-border)',
                      borderRadius: 8,
                      boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
                      zIndex: 100,
                      maxHeight: 300,
                      overflowY: 'auto',
                    }}>
                      {searchResults.map((user) => (
                        <div
                          key={user.id}
                          onClick={() => handleSelectUser(user)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            padding: '10px 12px',
                            cursor: 'pointer',
                            borderBottom: '1px solid var(--panel-border)',
                            transition: 'background 0.15s',
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(139, 92, 246, 0.1)'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                          <div style={{
                            width: 36,
                            height: 36,
                            borderRadius: '50%',
                            background: user.avatar_url
                              ? `url(${user.avatar_url}) center/cover`
                              : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 14,
                            fontWeight: 600,
                            color: '#fff',
                          }}>
                            {!user.avatar_url && user.username.slice(0, 1).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
                              @{user.username}
                            </div>
                            {user.display_name && (
                              <div style={{ fontSize: 12, color: '#94a3b8' }}>
                                {user.display_name}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: '#94a3b8', marginBottom: 6 }}>
                Role
              </label>
              <input
                type="text"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                placeholder="e.g. Illustrator, Editor, Co-Author"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '10px 12px',
                  background: 'var(--bg)',
                  border: '1px solid var(--panel-border)',
                  borderRadius: 8,
                  color: 'var(--text)',
                  fontSize: 14,
                }}
              />
            </div>
          </div>

          {/* Revenue Split with Equity Warning */}
          <div style={{ marginTop: 20 }}>
            <label style={{ display: 'block', fontSize: 12, color: '#94a3b8', marginBottom: 6 }}>
              Revenue Split: {invitePercentage}%
            </label>
            <input
              type="range"
              min={1}
              max={maxInvitePercentage > 0 ? maxInvitePercentage : 1}
              value={Math.min(invitePercentage, maxInvitePercentage || 1)}
              onChange={(e) => setInvitePercentage(Number(e.target.value))}
              disabled={maxInvitePercentage <= 0}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                accentColor: '#f59e0b',
              }}
            />

            {/* Equity Dilution Warning */}
            <div style={{
              marginTop: 12,
              padding: 12,
              background: 'rgba(245, 158, 11, 0.1)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              borderRadius: 8,
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 8,
                color: '#f59e0b',
                fontWeight: 600,
                fontSize: 13,
              }}>
                <AlertTriangle size={16} />
                Impact on your share
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 14,
              }}>
                <span style={{ color: '#94a3b8' }}>Your current share:</span>
                <span style={{ color: 'var(--text)', fontWeight: 600 }}>{leadPercentage}%</span>
                <span style={{ color: '#64748b' }}>→</span>
                <span style={{ color: '#10b981', fontWeight: 700 }}>
                  {leadPercentage - invitePercentage}%
                </span>
                <span style={{ color: '#ef4444', fontSize: 12 }}>
                  (-{invitePercentage}%)
                </span>
              </div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 6 }}>
                This percentage comes from your share only and does not affect other collaborators.
              </div>
            </div>
          </div>

          {inviteError && (
            <div style={{
              marginTop: 16,
              padding: 12,
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid #ef4444',
              borderRadius: 8,
              color: '#ef4444',
              fontSize: 13,
            }}>
              {inviteError}
            </div>
          )}

          <div style={{ marginTop: 20, display: 'flex', gap: 12 }}>
            <button
              onClick={handleInvite}
              disabled={inviting || !selectedUser}
              style={{
                background: selectedUser
                  ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                  : '#374151',
                border: 'none',
                borderRadius: 8,
                padding: '10px 24px',
                color: '#fff',
                fontWeight: 600,
                cursor: inviting || !selectedUser ? 'not-allowed' : 'pointer',
                fontSize: 14,
                opacity: inviting ? 0.7 : 1,
              }}
            >
              {inviting ? 'Inviting...' : 'Send Invitation'}
            </button>
            <button
              onClick={() => {
                setShowInviteForm(false);
                setSelectedUser(null);
                setSearchQuery('');
                setInviteError('');
              }}
              style={{
                background: 'transparent',
                border: '1px solid var(--panel-border)',
                borderRadius: 8,
                padding: '10px 24px',
                color: '#94a3b8',
                cursor: 'pointer',
                fontSize: 14,
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Team Overview Component */}
      <TeamOverview
        collaborators={collaborators}
        sections={sections}
        projectCreatorId={project.created_by}
      />

      {/* Contract Tasks Section */}
      {collaborators.filter(c => c.status === 'accepted' && c.tasks_total > 0).length > 0 && (
        <div style={{
          background: 'var(--panel)',
          border: '1px solid var(--panel-border)',
          borderRadius: 12,
          padding: 24,
        }}>
          <h3 style={{ margin: '0 0 20px', color: 'var(--text)', fontSize: 18, display: 'flex', alignItems: 'center', gap: 10 }}>
            <ClipboardList size={20} style={{ color: '#8b5cf6' }} /> Contract Tasks
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {collaborators
              .filter(c => c.status === 'accepted' && c.tasks_total > 0)
              .map((collab) => (
                <TaskTracker
                  key={collab.id}
                  collaboratorRole={collab}
                  currentUserId={currentUser.id}
                  isProjectOwner={isProjectLead}
                  projectId={project.id}
                  onTaskUpdate={async () => {
                    const updatedProject = await collaborationApi.getCollaborativeProject(project.id);
                    onProjectUpdate?.(updatedProject);
                  }}
                />
              ))}
          </div>
        </div>
      )}

      {/* Counter-proposals (only show when there's an actual difference) */}
      {collaborators.some(c =>
        c.proposed_percentage != null &&
        !isNaN(Number(c.proposed_percentage)) &&
        Math.abs(Number(c.proposed_percentage) - Number(c.revenue_percentage)) > 0.001
      ) && (
        <div style={{
          background: 'var(--panel)',
          border: '1px solid var(--panel-border)',
          borderRadius: 12,
          padding: 24,
        }}>
          <h3 style={{ margin: '0 0 16px', color: 'var(--text)', fontSize: 16 }}>
            Counter-Proposals
          </h3>

          {/* Error message */}
          {counterProposalError && (
            <div style={{
              marginBottom: 16,
              padding: 12,
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid #ef4444',
              borderRadius: 8,
              color: '#ef4444',
              fontSize: 13,
            }}>
              {counterProposalError}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {collaborators
              .filter(c =>
                c.proposed_percentage != null &&
                !isNaN(Number(c.proposed_percentage)) &&
                Math.abs(Number(c.proposed_percentage) - Number(c.revenue_percentage)) > 0.001
              )
              .map((collab) => {
                const isResponding = respondingToCounterProposal === collab.id;
                const proposedDiff = Number(collab.proposed_percentage) - Number(collab.revenue_percentage);

                return (
                  <div
                    key={collab.id}
                    style={{
                      padding: 16,
                      background: 'var(--bg)',
                      borderRadius: 8,
                      border: '1px solid rgba(245, 158, 11, 0.3)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 14, color: 'var(--text)', fontWeight: 600 }}>
                          @{collab.username}
                        </span>
                        <span style={{ fontSize: 12, color: '#94a3b8' }}>
                          proposes
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 13, color: '#94a3b8', textDecoration: 'line-through' }}>
                          {collab.revenue_percentage}%
                        </span>
                        <span style={{ fontSize: 16, color: '#f59e0b', fontWeight: 700 }}>
                          {collab.proposed_percentage}%
                        </span>
                        <span style={{
                          fontSize: 11,
                          color: proposedDiff > 0 ? '#ef4444' : '#10b981',
                          fontWeight: 500,
                        }}>
                          ({proposedDiff > 0 ? '+' : ''}{proposedDiff.toFixed(1)}%)
                        </span>
                      </div>
                    </div>

                    {collab.counter_message && (
                      <div style={{
                        marginTop: 8,
                        fontSize: 13,
                        color: '#94a3b8',
                        fontStyle: 'italic',
                      }}>
                        "{collab.counter_message}"
                      </div>
                    )}

                    {/* Accept/Decline buttons (only for project lead) */}
                    {isProjectLead && (
                      <div style={{
                        marginTop: 12,
                        paddingTop: 12,
                        borderTop: '1px solid rgba(148, 163, 184, 0.2)',
                      }}>
                        {declineMessageFor === collab.id ? (
                          /* Decline with message form */
                          <div style={{
                            background: 'rgba(239, 68, 68, 0.05)',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            borderRadius: 8,
                            padding: 12,
                          }}>
                            <label style={{
                              display: 'block',
                              fontSize: 12,
                              color: '#94a3b8',
                              marginBottom: 8,
                            }}>
                              Add a note (optional):
                            </label>
                            <textarea
                              value={declineMessage}
                              onChange={(e) => setDeclineMessage(e.target.value)}
                              placeholder="Explain why you're declining..."
                              maxLength={500}
                              style={{
                                width: '100%',
                                minHeight: 70,
                                padding: 10,
                                background: 'var(--bg)',
                                border: '1px solid #334155',
                                borderRadius: 6,
                                color: '#f8fafc',
                                fontSize: 13,
                                resize: 'vertical',
                                marginBottom: 10,
                              }}
                            />
                            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                              <button
                                onClick={() => {
                                  setDeclineMessageFor(null);
                                  setDeclineMessage('');
                                }}
                                style={{
                                  padding: '8px 14px',
                                  background: 'transparent',
                                  border: '1px solid #475569',
                                  borderRadius: 6,
                                  color: '#94a3b8',
                                  fontSize: 13,
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                }}
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handleCounterProposalResponse(collab.id, 'decline', declineMessage || undefined)}
                                disabled={isResponding}
                                style={{
                                  padding: '8px 14px',
                                  background: '#ef4444',
                                  border: 'none',
                                  borderRadius: 6,
                                  color: '#fff',
                                  fontSize: 13,
                                  fontWeight: 600,
                                  cursor: isResponding ? 'not-allowed' : 'pointer',
                                  opacity: isResponding ? 0.7 : 1,
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 6,
                                }}
                              >
                                {isResponding ? (
                                  <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                                ) : (
                                  <XCircle size={14} />
                                )}
                                Send Decline
                              </button>
                            </div>
                          </div>
                        ) : (
                          /* Normal Accept/Decline buttons */
                          <div style={{ display: 'flex', gap: 10 }}>
                            <button
                              onClick={() => handleCounterProposalResponse(collab.id, 'accept')}
                              disabled={isResponding}
                              style={{
                                flex: 1,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 6,
                                padding: '8px 16px',
                                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                border: 'none',
                                borderRadius: 6,
                                color: '#fff',
                                fontSize: 13,
                                fontWeight: 600,
                                cursor: isResponding ? 'not-allowed' : 'pointer',
                                opacity: isResponding ? 0.7 : 1,
                              }}
                            >
                              {isResponding ? (
                                <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                              ) : (
                                <Check size={14} />
                              )}
                              Accept
                            </button>
                            <button
                              onClick={() => setDeclineMessageFor(collab.id)}
                              disabled={isResponding}
                              style={{
                                flex: 1,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 6,
                                padding: '8px 16px',
                                background: 'transparent',
                                border: '1px solid #ef4444',
                                borderRadius: 6,
                                color: '#ef4444',
                                fontSize: 13,
                                fontWeight: 600,
                                cursor: isResponding ? 'not-allowed' : 'pointer',
                                opacity: isResponding ? 0.7 : 1,
                              }}
                            >
                              <XCircle size={14} />
                              Decline
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
