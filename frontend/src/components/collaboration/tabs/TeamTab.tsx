import React, { useState, useEffect, useRef } from 'react';
import {
  CollaborativeProject,
  CollaboratorRole,
  MilestoneTemplate,
  collaborationApi,
} from '../../../services/collaborationApi';
import { TeamOverview } from '../TeamOverview';
import { TaskTracker } from '../TaskTracker';
import { EscrowStatusBar } from '../EscrowStatusBar';
import { MilestoneTimeline } from '../MilestoneTimeline';
import { EscrowFundingModal } from '../EscrowFundingModal';
import { API_URL } from '../../../config';
import {
  ClipboardList, AlertTriangle, Search, X, User as UserIcon, Check, XCircle, Loader2,
  Pen, Users, Palette, Image, CheckCircle, FileText, Mic2, Brush, PaintBucket,
  Eye, Music, Sliders, Mic, Volume2, Film, Video, Scissors, PlayCircle, Briefcase,
  Type, PenTool, Plus, ChevronDown, Calendar, DollarSign, Shield
} from 'lucide-react';

// Role definition interface
interface RoleDefinition {
  id: number;
  name: string;
  category: string;
  description: string;
  applicable_to_book: boolean;
  applicable_to_art: boolean;
  applicable_to_music: boolean;
  applicable_to_video: boolean;
  applicable_to_comic: boolean;
  default_permissions: {
    create: string[];
    edit: { scope: string; types: string[] };
    review: string[];
  };
  ui_components: string[];
  icon: string;
  color: string;
}

// Contract task interface
interface ContractTask {
  id: string;
  title: string;
  description: string;
  deadline: string;
  payment_amount?: string;
  page_range_start?: number;
  page_range_end?: number;
}

// Helper to render role icon based on icon string
const RoleIcon = ({ icon, size = 20 }: { icon: string; size?: number }) => {
  const iconProps = { size, strokeWidth: 1.5 };
  switch (icon) {
    case 'pen': return <Pen {...iconProps} />;
    case 'users': return <Users {...iconProps} />;
    case 'palette': return <Palette {...iconProps} />;
    case 'image': return <Image {...iconProps} />;
    case 'check-circle': return <CheckCircle {...iconProps} />;
    case 'spell-check': return <FileText {...iconProps} />;
    case 'microphone': return <Mic2 {...iconProps} />;
    case 'brush': return <Brush {...iconProps} />;
    case 'paint-brush': return <PaintBucket {...iconProps} />;
    case 'eye': return <Eye {...iconProps} />;
    case 'music': return <Music {...iconProps} />;
    case 'sliders': return <Sliders {...iconProps} />;
    case 'mic': return <Mic {...iconProps} />;
    case 'file-text': return <FileText {...iconProps} />;
    case 'volume-2': return <Volume2 {...iconProps} />;
    case 'film': return <Film {...iconProps} />;
    case 'video': return <Video {...iconProps} />;
    case 'scissors': return <Scissors {...iconProps} />;
    case 'play-circle': return <PlayCircle {...iconProps} />;
    case 'briefcase': return <Briefcase {...iconProps} />;
    case 'type': return <Type {...iconProps} />;
    case 'pen-tool': return <PenTool {...iconProps} />;
    default: return <UserIcon {...iconProps} />;
  }
};

// Generate unique ID for tasks
const generateId = () => Math.random().toString(36).substr(2, 9);

// Format date for input
const getDefaultDeadline = (daysFromNow: number = 14) => {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toISOString().slice(0, 16);
};

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

  // Role definitions state
  const [roleDefinitions, setRoleDefinitions] = useState<RoleDefinition[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [loadingRoles, setLoadingRoles] = useState(false);
  const [showCustomRole, setShowCustomRole] = useState(false);

  // Contract type and escrow state
  const [contractType, setContractType] = useState<'revenue_share' | 'work_for_hire' | 'hybrid'>('revenue_share');
  const [totalContractAmount, setTotalContractAmount] = useState('');
  const [milestoneTemplates, setMilestoneTemplates] = useState<MilestoneTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [fundingModalRole, setFundingModalRole] = useState<CollaboratorRole | null>(null);

  // Contract tasks state
  const [tasks, setTasks] = useState<ContractTask[]>([]);

  // Escrow fee mode, message, funding deadline
  const [escrowFeeMode, setEscrowFeeMode] = useState<'writer_pays' | 'artist_pays' | 'split'>('writer_pays');
  const [inviteMessage, setInviteMessage] = useState('');
  const [fundingDeadline, setFundingDeadline] = useState(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );

  // Permissions state
  const [canEditText, setCanEditText] = useState(true);
  const [canEditImages, setCanEditImages] = useState(true);
  const [canEditAudio, setCanEditAudio] = useState(false);
  const [canEditVideo, setCanEditVideo] = useState(false);

  // Counter-proposal response state
  const [respondingToCounterProposal, setRespondingToCounterProposal] = useState<number | null>(null);
  const [counterProposalError, setCounterProposalError] = useState('');
  const [declineMessageFor, setDeclineMessageFor] = useState<number | null>(null);
  const [declineMessage, setDeclineMessage] = useState('');

  // Voting power warning modal state
  const [showVotingPowerWarning, setShowVotingPowerWarning] = useState(false);

  // User search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<SearchResult | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [exactLookupLoading, setExactLookupLoading] = useState(false);
  const [exactLookupError, setExactLookupError] = useState('');
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Function to look up user by exact username (bypasses public profile filter)
  const handleExactUsernameLookup = async () => {
    if (!searchQuery.trim()) return;

    setExactLookupLoading(true);
    setExactLookupError('');

    try {
      const params = new URLSearchParams({ exact_username: searchQuery.trim() });
      const res = await fetch(`${API_URL}/api/users/search/?${params.toString()}`, {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        const results = data.results || [];
        // Filter out current user and existing collaborators
        const existingUserIds = new Set([
          currentUser.id,
          ...collaborators.map(c => c.user)
        ]);
        const filtered = results.filter((u: SearchResult) => !existingUserIds.has(u.id));

        if (filtered.length > 0) {
          // Found the user - select them
          setSelectedUser(filtered[0]);
          setSearchQuery('');
          setShowDropdown(false);
          setExactLookupError('');
        } else if (results.length > 0) {
          // User found but already a collaborator
          setExactLookupError('This user is already a collaborator on this project.');
        } else {
          setExactLookupError(`No user found with username "${searchQuery}". Please check the spelling.`);
        }
      } else {
        setExactLookupError('Failed to look up user. Please try again.');
      }
    } catch (err) {
      setExactLookupError('Failed to look up user. Please try again.');
    } finally {
      setExactLookupLoading(false);
    }
  };

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

  // Fetch role definitions when invite form is shown
  useEffect(() => {
    if (!showInviteForm) return;

    const fetchRoleDefinitions = async () => {
      setLoadingRoles(true);
      try {
        const projectType = project.content_type;
        const res = await fetch(`${API_URL}/api/role-definitions/?project_type=${projectType}`, {
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          setRoleDefinitions(data);
        }
      } catch (err) {
        console.error('Failed to fetch role definitions:', err);
      } finally {
        setLoadingRoles(false);
      }
    };

    fetchRoleDefinitions();
  }, [showInviteForm, project.content_type]);

  // Load milestone templates when role is selected and contract type is escrow
  useEffect(() => {
    if (contractType === 'revenue_share' || !selectedRoleId) {
      setMilestoneTemplates([]);
      setSelectedTemplateId(null);
      return;
    }
    const fetchTemplates = async () => {
      try {
        const templates = await collaborationApi.getMilestoneTemplates(selectedRoleId);
        setMilestoneTemplates(templates);
      } catch {
        setMilestoneTemplates([]);
      }
    };
    fetchTemplates();
  }, [contractType, selectedRoleId]);

  // Handle role selection - auto-populate permissions from role definition
  const handleRoleSelect = (roleId: number | null) => {
    setSelectedRoleId(roleId);
    setShowCustomRole(false);

    if (roleId) {
      const roleDef = roleDefinitions.find(r => r.id === roleId);
      if (roleDef) {
        setInviteRole(roleDef.name);
        // Auto-populate permissions from role definition
        const perms = roleDef.default_permissions;
        const editTypes = perms.edit?.types || [];
        setCanEditText(editTypes.includes('text') || perms.create?.includes('text'));
        setCanEditImages(editTypes.includes('image') || perms.create?.includes('image'));
        setCanEditAudio(editTypes.includes('audio') || perms.create?.includes('audio'));
        setCanEditVideo(editTypes.includes('video') || perms.create?.includes('video'));
      }
    } else {
      setInviteRole('');
    }
  };

  // Handle custom role selection
  const handleCustomRole = () => {
    setSelectedRoleId(null);
    setShowCustomRole(true);
    setInviteRole('');
  };

  // Task management functions
  const addTask = () => {
    const nextPage = tasks.length + 1;
    setTasks([...tasks, {
      id: generateId(),
      title: '',
      description: '',
      deadline: getDefaultDeadline(),
      page_range_start: nextPage,
      page_range_end: nextPage,
    }]);
  };

  const updateTask = (id: string, field: keyof ContractTask, value: string | number) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  const removeTask = (id: string) => {
    setTasks(tasks.filter(t => t.id !== id));
  };

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

  // Check if allocation requires voting power warning
  const needsVotingPowerWarning = invitePercentage >= 50;
  const newLeadPercentage = leadPercentage - invitePercentage;

  const handleInviteClick = () => {
    // Validate before showing warning or sending
    if (!selectedUser) {
      setInviteError('Please select a user to invite');
      return;
    }
    if (!inviteRole.trim()) {
      setInviteError('Please select a role for the collaborator');
      return;
    }
    if (contractType === 'revenue_share' || contractType === 'hybrid') {
      if (invitePercentage <= 0 || invitePercentage > maxInvitePercentage) {
        setInviteError(`Percentage must be between 1 and ${maxInvitePercentage}%`);
        return;
      }
    }

    // Validate tasks have required fields
    for (const task of tasks) {
      if (!task.title.trim()) {
        setInviteError('All contract tasks must have a title');
        return;
      }
      if (!task.deadline) {
        setInviteError('All contract tasks must have a deadline');
        return;
      }
      if (contractType !== 'revenue_share' && (!task.payment_amount || parseFloat(task.payment_amount) <= 0)) {
        setInviteError('All tasks must have a payment amount for escrow contracts');
        return;
      }
    }

    // Validate task payment amounts sum to total contract amount
    if (contractType !== 'revenue_share' && tasks.length > 0 && !selectedTemplateId) {
      const taskSum = tasks.reduce((sum, t) => sum + (parseFloat(t.payment_amount || '0') || 0), 0);
      const total = parseFloat(totalContractAmount || '0');
      if (Math.abs(taskSum - total) > 0.01) {
        setInviteError(`Task payments ($${taskSum.toFixed(2)}) must equal total contract amount ($${total.toFixed(2)})`);
        return;
      }
    }

    setInviteError('');

    // Show warning if allocating ≥50%
    if (needsVotingPowerWarning) {
      setShowVotingPowerWarning(true);
      return;
    }

    // Otherwise proceed directly
    handleInvite();
  };

  const handleInvite = async () => {
    if (!selectedUser) {
      setInviteError('Please select a user to invite');
      return;
    }

    setShowVotingPowerWarning(false);
    setInviting(true);
    setInviteError('');

    try {
      await collaborationApi.inviteCollaborator(project.id, {
        user_id: selectedUser.id,
        role: inviteRole.trim(),
        role_definition_id: selectedRoleId || undefined,
        revenue_percentage: contractType === 'work_for_hire' ? 0 : invitePercentage,
        can_edit_text: canEditText,
        can_edit_images: canEditImages,
        can_edit_audio: canEditAudio,
        can_edit_video: canEditVideo,
        contract_type: contractType,
        total_contract_amount: contractType !== 'revenue_share' ? totalContractAmount : undefined,
        milestone_template_id: selectedTemplateId || undefined,
        escrow_fee_mode: contractType !== 'revenue_share' ? escrowFeeMode : undefined,
        message: inviteMessage || undefined,
        funding_deadline: contractType !== 'revenue_share' ? fundingDeadline : undefined,
        tasks: tasks.length > 0 && !selectedTemplateId ? tasks.map(t => ({
          title: t.title,
          description: t.description,
          deadline: new Date(t.deadline).toISOString(),
          ...(t.payment_amount ? { payment_amount: t.payment_amount } : {}),
          ...(t.page_range_start ? { page_range_start: t.page_range_start } : {}),
          ...(t.page_range_end ? { page_range_end: t.page_range_end } : {}),
        })) : undefined,
      });

      // Refresh project data
      const updatedProject = await collaborationApi.getCollaborativeProject(project.id);
      onProjectUpdate?.(updatedProject);
      setShowInviteForm(false);
      setSelectedUser(null);
      setSearchQuery('');
      setInviteRole('');
      setInvitePercentage(10);
      setSelectedRoleId(null);
      setShowCustomRole(false);
      setTasks([]);
      setContractType('revenue_share');
      setTotalContractAmount('');
      setSelectedTemplateId(null);
      // Reset permissions
      setCanEditText(true);
      setCanEditImages(true);
      setCanEditAudio(false);
      setCanEditVideo(false);
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
        {isProjectLead && !showInviteForm && (<>
          <button
            type="button"
            onClick={() => setShowInviteForm(true)}
            style={{
              background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
              border: 'none',
              borderRadius: 8,
              padding: '10px 20px',
              color: '#fff',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: 14,
              WebkitTapHighlightColor: 'transparent',
              touchAction: 'manipulation',
              minHeight: 44,
            }}
          >
            + Invite Collaborator
          </button>
        </>)}
      </div>

      {/* Invite Form */}
      {showInviteForm && (
        <div
          data-tour="team-panel"
          style={{
            background: 'var(--panel)',
            border: '1px solid var(--panel-border)',
            borderRadius: 12,
            padding: 24,
            overflow: 'visible',
          }}
        >
          <h3 style={{ margin: '0 0 16px', color: 'var(--text)', fontSize: 18 }}>
            Invite New Collaborator
          </h3>

          <div>
            {/* User Search Input */}
            <div ref={dropdownRef} style={{ position: 'relative', maxWidth: 500 }}>
              <label style={{ display: 'block', fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>
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
                      <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
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
                      color: 'var(--text-muted)',
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
                      color: 'var(--text-muted)',
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
                        color: 'var(--text-muted)',
                        fontSize: 13,
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
                              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                                {user.display_name}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {/* No Results Message */}
                  {!searchLoading && searchQuery.length >= 2 && searchResults.length === 0 && (
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
                      padding: 16,
                    }}>
                      <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', marginBottom: 8 }}>
                        No collaborators found for "{searchQuery}"
                      </div>
                      <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', marginBottom: 12 }}>
                        Only users with <strong style={{ color: '#f59e0b' }}>public profiles</strong> appear in search.
                      </div>
                      {/* Exact username lookup button */}
                      <button
                        onClick={handleExactUsernameLookup}
                        disabled={exactLookupLoading}
                        style={{
                          width: '100%',
                          padding: '10px 16px',
                          background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
                          border: 'none',
                          borderRadius: 6,
                          color: '#fff',
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: exactLookupLoading ? 'not-allowed' : 'pointer',
                          opacity: exactLookupLoading ? 0.7 : 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 8,
                        }}
                      >
                        {exactLookupLoading ? (
                          <>
                            <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                            Looking up...
                          </>
                        ) : (
                          <>
                            <UserIcon size={14} />
                            Invite @{searchQuery} by exact username
                          </>
                        )}
                      </button>
                      {exactLookupError && (
                        <div style={{
                          marginTop: 10,
                          padding: 10,
                          background: 'rgba(239, 68, 68, 0.1)',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          borderRadius: 6,
                          color: '#f87171',
                          fontSize: 13,
                          textAlign: 'center',
                        }}>
                          {exactLookupError}
                        </div>
                      )}
                    </div>
                  )}
                  {/* Helper text below input */}
                  <div style={{ marginTop: 6, fontSize: 13, color: 'var(--text-muted)' }}>
                    Only users with public profiles can be found
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Role Selection Section */}
          <div style={{ marginTop: 20 }} data-tour="roles-dropdown">
            <label style={{ display: 'block', fontSize: 13, color: 'var(--text-muted)', marginBottom: 10 }}>
              Their Role <span style={{ color: '#ef4444' }}>*</span>
            </label>

            {loadingRoles ? (
              <div style={{
                color: 'var(--text-muted)',
                fontSize: 13,
                padding: 16,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}>
                <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                Loading roles for {project.content_type} projects...
              </div>
            ) : (
              <>
                {/* Role cards grid */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                  gap: 10,
                  marginBottom: 12,
                }}>
                  {roleDefinitions.map((roleDef) => (
                    <button
                      key={roleDef.id}
                      type="button"
                      onClick={() => handleRoleSelect(roleDef.id)}
                      style={{
                        background: selectedRoleId === roleDef.id ? 'rgba(139, 92, 246, 0.15)' : 'var(--bg)',
                        border: `2px solid ${selectedRoleId === roleDef.id ? '#8b5cf6' : 'var(--panel-border)'}`,
                        borderRadius: 10,
                        padding: '12px 10px',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 6,
                        transition: 'all 0.2s ease',
                        position: 'relative',
                      }}
                    >
                      {selectedRoleId === roleDef.id && (
                        <div style={{
                          position: 'absolute',
                          top: 6,
                          right: 6,
                          background: '#8b5cf6',
                          borderRadius: '50%',
                          width: 16,
                          height: 16,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}>
                          <Check size={10} color="#fff" strokeWidth={3} />
                        </div>
                      )}
                      <div style={{
                        width: 36,
                        height: 36,
                        borderRadius: 8,
                        background: `${roleDef.color}20`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: roleDef.color,
                      }}>
                        <RoleIcon icon={roleDef.icon} size={20} />
                      </div>
                      <span style={{
                        color: selectedRoleId === roleDef.id ? '#8b5cf6' : 'var(--text)',
                        fontSize: 13,
                        fontWeight: 600,
                        textAlign: 'center',
                      }}>
                        {roleDef.name}
                      </span>
                      <span style={{
                        color: 'var(--text-muted)',
                        fontSize: 9,
                        textAlign: 'center',
                        lineHeight: 1.2,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}>
                        {roleDef.description.slice(0, 50)}{roleDef.description.length > 50 ? '...' : ''}
                      </span>
                    </button>
                  ))}

                  {/* Custom role option */}
                  <button
                    type="button"
                    onClick={handleCustomRole}
                    style={{
                      background: showCustomRole ? 'rgba(139, 92, 246, 0.15)' : 'var(--bg)',
                      border: `2px solid ${showCustomRole ? '#8b5cf6' : 'var(--panel-border)'}`,
                      borderRadius: 10,
                      padding: '12px 10px',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 6,
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <div style={{
                      width: 36,
                      height: 36,
                      borderRadius: 8,
                      background: 'rgba(148, 163, 184, 0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--text-muted)',
                    }}>
                      <Plus size={20} strokeWidth={1.5} />
                    </div>
                    <span style={{
                      color: showCustomRole ? '#8b5cf6' : '#94a3b8',
                      fontSize: 13,
                      fontWeight: 600,
                    }}>
                      Custom Role
                    </span>
                    <span style={{
                      color: 'var(--text-muted)',
                      fontSize: 9,
                      textAlign: 'center',
                    }}>
                      Define your own
                    </span>
                  </button>
                </div>

                {/* Custom role input (shown when custom role is selected) */}
                {showCustomRole && (
                  <input
                    type="text"
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    placeholder="Enter custom role name..."
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      background: 'var(--bg)',
                      border: '1px solid #8b5cf6',
                      borderRadius: 8,
                      padding: '10px 12px',
                      color: 'var(--text)',
                      fontSize: 14,
                    }}
                  />
                )}

                {/* Selected role info */}
                {selectedRoleId && !showCustomRole && (
                  <div style={{
                    background: 'rgba(139, 92, 246, 0.1)',
                    border: '1px solid rgba(139, 92, 246, 0.3)',
                    borderRadius: 8,
                    padding: 12,
                  }}>
                    {(() => {
                      const selectedRole = roleDefinitions.find(r => r.id === selectedRoleId);
                      if (!selectedRole) return null;
                      return (
                        <>
                          <div style={{ color: '#8b5cf6', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                            {selectedRole.name}
                          </div>
                          <div style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 8 }}>
                            {selectedRole.description}
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {selectedRole.default_permissions.create?.length > 0 && (
                              <span style={{
                                background: 'rgba(16,185,129,0.15)',
                                color: '#10b981',
                                fontSize: 10,
                                padding: '2px 8px',
                                borderRadius: 4,
                              }}>
                                Can create: {selectedRole.default_permissions.create.join(', ')}
                              </span>
                            )}
                            {selectedRole.default_permissions.edit?.types?.length > 0 && (
                              <span style={{
                                background: 'rgba(59,130,246,0.15)',
                                color: '#3b82f6',
                                fontSize: 10,
                                padding: '2px 8px',
                                borderRadius: 4,
                              }}>
                                Can edit: {selectedRole.default_permissions.edit.types.join(', ')} ({selectedRole.default_permissions.edit.scope})
                              </span>
                            )}
                            {selectedRole.default_permissions.review?.length > 0 && (
                              <span style={{
                                background: 'rgba(168,85,247,0.15)',
                                color: '#a855f7',
                                fontSize: 10,
                                padding: '2px 8px',
                                borderRadius: 4,
                              }}>
                                Can review: {selectedRole.default_permissions.review.join(', ')}
                              </span>
                            )}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Contract Type Selection */}
          <div style={{ marginTop: 20 }}>
            <label style={{ display: 'block', fontSize: 13, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Shield size={14} style={{ color: '#8b5cf6' }} />
                Payment Structure
              </div>
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              {([
                { value: 'revenue_share', label: 'Revenue Share', desc: 'Ongoing % of sales' },
                { value: 'work_for_hire', label: 'Work for Hire', desc: 'Upfront via escrow' },
                { value: 'hybrid', label: 'Hybrid', desc: 'Upfront + rev share' },
              ] as const).map(opt => (
                <button
                  key={opt.value}
                  onClick={() => {
                    setContractType(opt.value);
                    if (opt.value === 'work_for_hire') setInvitePercentage(0);
                    else if (opt.value === 'revenue_share' && invitePercentage === 0) setInvitePercentage(10);
                  }}
                  style={{
                    background: contractType === opt.value ? '#8b5cf615' : 'var(--bg)',
                    border: `1px solid ${contractType === opt.value ? '#8b5cf6' : 'var(--panel-border)'}`,
                    borderRadius: 8,
                    padding: '10px 12px',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600, color: contractType === opt.value ? '#a78bfa' : 'var(--text)' }}>
                    {opt.label}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{opt.desc}</div>
                </button>
              ))}
            </div>

            {/* Total Contract Amount (for escrow types) */}
            {contractType !== 'revenue_share' && (
              <div style={{ marginTop: 12 }}>
                <label style={{ display: 'block', fontSize: 13, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600 }}>
                  <DollarSign size={12} style={{ display: 'inline', verticalAlign: 'middle' }} /> Total Contract Amount (USD)
                </label>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  value={totalContractAmount}
                  onChange={(e) => setTotalContractAmount(e.target.value)}
                  placeholder="e.g., 1500.00"
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    background: 'var(--bg)', border: '1px solid var(--panel-border)',
                    borderRadius: 6, padding: 10, color: 'var(--text)', fontSize: 13,
                  }}
                />

                {/* Milestone Template Selector */}
                {milestoneTemplates.length > 0 && (
                  <div style={{ marginTop: 10 }}>
                    <label style={{ display: 'block', fontSize: 13, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600 }}>
                      Milestone Template (auto-generates tasks)
                    </label>
                    <select
                      value={selectedTemplateId || ''}
                      onChange={(e) => setSelectedTemplateId(e.target.value ? Number(e.target.value) : null)}
                      style={{
                        width: '100%', boxSizing: 'border-box',
                        background: 'var(--bg)', border: '1px solid var(--panel-border)',
                        borderRadius: 6, padding: 10, color: 'var(--text)', fontSize: 13,
                      }}
                    >
                      <option value="">Manual tasks (define below)</option>
                      {milestoneTemplates.map(t => (
                        <option key={t.id} value={t.id}>
                          {t.name} ({t.total_pages} pages, {t.milestones.length} milestones)
                        </option>
                      ))}
                    </select>
                    {selectedTemplateId && (
                      <div style={{
                        marginTop: 8, padding: 10, borderRadius: 8,
                        background: '#8b5cf610', border: '1px solid #8b5cf630',
                        fontSize: 13, color: '#a78bfa',
                      }}>
                        {milestoneTemplates.find(t => t.id === selectedTemplateId)?.description}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Revenue Split with Equity Warning — hidden for pure Work for Hire */}
          {contractType !== 'work_for_hire' && (
          <div style={{ marginTop: 20 }} data-tour="revenue-splits">
            <label style={{ display: 'block', fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>
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
                <span style={{ color: 'var(--text-muted)' }}>Your current share:</span>
                <span style={{ color: 'var(--text)', fontWeight: 600 }}>{leadPercentage}%</span>
                <span style={{ color: 'var(--text-muted)' }}>→</span>
                <span style={{ color: '#10b981', fontWeight: 700 }}>
                  {leadPercentage - invitePercentage}%
                </span>
                <span style={{ color: '#ef4444', fontSize: 12 }}>
                  (-{invitePercentage}%)
                </span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>
                This percentage comes from your share only and does not affect other collaborators.
              </div>
            </div>
          </div>
          )}

          {/* Contract Tasks Section */}
          <div style={{
            marginTop: 24,
            background: 'var(--bg)',
            border: '1px solid var(--panel-border)',
            borderRadius: 12,
            padding: 20,
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: 16,
            }}>
              <div>
                <div style={{
                  color: 'var(--text)',
                  fontSize: 15,
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}>
                  <ClipboardList size={18} style={{ color: '#8b5cf6' }} />
                  Contract Tasks
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
                  Define specific deliverables with deadlines. These become binding after acceptance.
                </div>
              </div>
              <button
                onClick={addTask}
                style={{
                  background: 'rgba(139, 92, 246, 0.15)',
                  border: '1px solid #8b5cf6',
                  color: '#8b5cf6',
                  padding: '8px 16px',
                  borderRadius: 8,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: 13,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  whiteSpace: 'nowrap',
                }}
              >
                <Plus size={14} />
                Add Task
              </button>
            </div>

            {tasks.length === 0 ? (
              <div style={{
                padding: 24,
                textAlign: 'center',
                color: 'var(--text-muted)',
                fontSize: 13,
                border: '2px dashed var(--panel-border)',
                borderRadius: 8,
                background: 'rgba(0, 0, 0, 0.1)',
              }}>
                <Calendar size={32} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
                <div>No tasks defined yet</div>
                <div style={{ fontSize: 13, marginTop: 4 }}>
                  Add tasks to create a concrete contract with clear deliverables
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {tasks.map((task, index) => (
                  <div key={task.id} style={{
                    background: 'var(--panel)',
                    border: '1px solid var(--panel-border)',
                    borderRadius: 10,
                    padding: 16,
                  }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: 12,
                    }}>
                      <div style={{ flex: 1, display: 'grid', gap: 12 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12 }}>
                          <div>
                            <label style={{
                              display: 'block',
                              color: 'var(--text-muted)',
                              fontSize: 13,
                              marginBottom: 4,
                              fontWeight: 600,
                            }}>
                              Task {index + 1}: Title <span style={{ color: '#ef4444' }}>*</span>
                            </label>
                            <input
                              type="text"
                              value={task.title}
                              onChange={(e) => updateTask(task.id, 'title', e.target.value)}
                              placeholder="e.g., Character designs for Chapter 1"
                              style={{
                                width: '100%',
                                boxSizing: 'border-box',
                                background: 'var(--bg)',
                                border: '1px solid var(--panel-border)',
                                borderRadius: 6,
                                padding: 10,
                                color: 'var(--text)',
                                fontSize: 13,
                              }}
                            />
                          </div>
                          <div>
                            <label style={{
                              display: 'block',
                              color: 'var(--text-muted)',
                              fontSize: 13,
                              marginBottom: 4,
                              fontWeight: 600,
                            }}>
                              Deadline <span style={{ color: '#ef4444' }}>*</span>
                            </label>
                            <input
                              type="datetime-local"
                              value={task.deadline}
                              onChange={(e) => updateTask(task.id, 'deadline', e.target.value)}
                              style={{
                                background: 'var(--bg)',
                                border: '1px solid var(--panel-border)',
                                borderRadius: 6,
                                padding: 10,
                                color: 'var(--text)',
                                fontSize: 13,
                              }}
                            />
                          </div>
                        </div>
                        <div>
                          <label style={{
                            display: 'block',
                            color: 'var(--text-muted)',
                            fontSize: 13,
                            marginBottom: 4,
                            fontWeight: 600,
                          }}>
                            Description (optional)
                          </label>
                          <textarea
                            value={task.description}
                            onChange={(e) => updateTask(task.id, 'description', e.target.value)}
                            placeholder="Detailed requirements, expectations, or notes..."
                            rows={2}
                            style={{
                              width: '100%',
                              boxSizing: 'border-box',
                              background: 'var(--bg)',
                              border: '1px solid var(--panel-border)',
                              borderRadius: 6,
                              padding: 10,
                              color: 'var(--text)',
                              fontSize: 13,
                              fontFamily: 'inherit',
                              resize: 'vertical',
                            }}
                          />
                        </div>
                        {contractType !== 'revenue_share' && (
                          <div>
                            <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: 13, marginBottom: 4 }}>
                              Payment Amount (USD) *
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={task.payment_amount || ''}
                              onChange={(e) => updateTask(task.id, 'payment_amount', e.target.value)}
                              placeholder="e.g., 1.00"
                              style={{
                                width: '200px',
                                background: 'var(--bg)',
                                border: '1px solid var(--panel-border)',
                                borderRadius: 6,
                                padding: 10,
                                color: 'var(--text)',
                                fontSize: 13,
                              }}
                            />
                          </div>
                        )}
                        {/* Page count for this milestone */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <label style={{ color: 'var(--text-muted)', fontSize: 13, whiteSpace: 'nowrap' }}>
                            Pages:
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={50}
                            value={task.page_range_end && task.page_range_start
                              ? task.page_range_end - task.page_range_start + 1
                              : task.page_range_start || ''}
                            onChange={(e) => {
                              const count = parseInt(e.target.value) || 1;
                              // Calculate page range based on previous tasks' ranges
                              const taskIndex = tasks.findIndex(t => t.id === task.id);
                              let startPage = 1;
                              for (let i = 0; i < taskIndex; i++) {
                                const prev = tasks[i];
                                if (prev.page_range_end) startPage = prev.page_range_end + 1;
                                else if (prev.page_range_start) startPage = prev.page_range_start + 1;
                              }
                              updateTask(task.id, 'page_range_start', startPage as any);
                              updateTask(task.id, 'page_range_end', (startPage + count - 1) as any);
                            }}
                            placeholder="1"
                            style={{
                              width: '60px',
                              background: 'var(--bg)',
                              border: '1px solid var(--panel-border)',
                              borderRadius: 6,
                              padding: '6px 8px',
                              color: 'var(--text)',
                              fontSize: 13,
                            }}
                          />
                          <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                            {task.page_range_start && task.page_range_end
                              ? `Pages ${task.page_range_start}–${task.page_range_end} will be auto-created in workspace`
                              : 'How many pages this milestone covers'}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => removeTask(task.id)}
                        title="Remove task"
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#ef4444',
                          fontSize: 18,
                          cursor: 'pointer',
                          padding: 4,
                          marginTop: 20,
                        }}
                      >
                        <X size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {contractType !== 'revenue_share' && tasks.length > 0 && !selectedTemplateId && (
              <div style={{
                marginTop: 12,
                padding: 10,
                background: 'rgba(139, 92, 246, 0.08)',
                border: '1px solid rgba(139, 92, 246, 0.2)',
                borderRadius: 8,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: 13,
              }}>
                <span style={{ color: '#a78bfa' }}>
                  Task payments total: ${tasks.reduce((sum, t) => sum + (parseFloat(t.payment_amount || '0') || 0), 0).toFixed(2)}
                </span>
                <span style={{ color: 'var(--text-muted)' }}>
                  Contract total: ${parseFloat(totalContractAmount || '0').toFixed(2)}
                </span>
              </div>
            )}
            {tasks.length > 0 && (
              <div style={{
                marginTop: 16,
                padding: 12,
                background: 'rgba(245, 158, 11, 0.1)',
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                border: '1px solid rgba(245, 158, 11, 0.3)',
              }}>
                <AlertTriangle size={16} style={{ color: '#f59e0b', flexShrink: 0 }} />
                <span style={{ color: '#f59e0b', fontSize: 12 }}>
                  Tasks become immutable after the collaborator accepts. Changes require mutual agreement.
                </span>
              </div>
            )}
          </div>

          {/* Escrow Fee Mode (work_for_hire / hybrid only) */}
          {contractType !== 'revenue_share' && (
            <div style={{ marginTop: 20 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <Shield size={14} style={{ color: '#8b5cf6' }} /> Escrow Fee (3%) — Who Pays?
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                {([
                  { value: 'writer_pays', label: 'I Pay', sub: '+3% on top' },
                  { value: 'artist_pays', label: 'Artist Pays', sub: '-3% from payout' },
                  { value: 'split', label: 'Split', sub: '1.5% each' },
                ] as const).map(opt => (
                  <button key={opt.value} type="button" onClick={() => setEscrowFeeMode(opt.value)} style={{
                    padding: '10px 8px', borderRadius: 8, cursor: 'pointer', textAlign: 'center',
                    background: escrowFeeMode === opt.value ? 'rgba(139, 92, 246, 0.12)' : 'var(--bg)',
                    border: `1.5px solid ${escrowFeeMode === opt.value ? '#8b5cf6' : 'var(--panel-border)'}`,
                    color: escrowFeeMode === opt.value ? '#8b5cf6' : 'var(--text)',
                    fontSize: 13, fontWeight: 600,
                  }}>
                    {opt.label}
                    <div style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-muted)', marginTop: 2 }}>{opt.sub}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Funding Deadline */}
          {contractType !== 'revenue_share' && (
            <div style={{ marginTop: 16 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 6, display: 'block' }}>
                Escrow Funding Deadline
              </label>
              <input
                type="date"
                value={fundingDeadline}
                onChange={(e) => setFundingDeadline(e.target.value)}
                style={{
                  width: '100%', padding: '8px 12px', borderRadius: 8,
                  border: '1px solid var(--panel-border)', background: 'var(--bg)',
                  color: 'var(--text)', fontSize: 14,
                }}
              />
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                Escrow must be funded by this date. Work begins after funding.
              </div>
            </div>
          )}

          {/* Project Pitch / Message */}
          <div style={{ marginTop: 16 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 6, display: 'block' }}>
              Message to Collaborator
            </label>
            <textarea
              value={inviteMessage}
              onChange={(e) => setInviteMessage(e.target.value)}
              placeholder="Describe your project vision and what you're looking for..."
              maxLength={1000}
              rows={3}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 8,
                border: '1px solid var(--panel-border)', background: 'var(--bg)',
                color: 'var(--text)', fontSize: 13, resize: 'vertical',
              }}
            />
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'right', marginTop: 2 }}>
              {inviteMessage.length}/1000
            </div>
          </div>

          {/* Preview */}
          {selectedUser && inviteRole.trim() && (
            <div style={{
              marginTop: 16, padding: 16, borderRadius: 10,
              background: 'var(--bg-secondary)', border: '1px solid var(--panel-border)',
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#8b5cf6', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
                Preview
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
                {project.title}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>
                Inviting @{selectedUser.username} as {inviteRole}
                {contractType !== 'revenue_share' && totalContractAmount && ` · $${totalContractAmount} via escrow`}
                {contractType === 'revenue_share' && ` · ${invitePercentage}% revenue share`}
              </div>
              {inviteMessage && (
                <div style={{ fontSize: 13, color: 'var(--text-dim)', fontStyle: 'italic', marginBottom: 8, lineHeight: 1.5 }}>
                  "{inviteMessage}"
                </div>
              )}
              {tasks.length > 0 && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {tasks.length} milestone{tasks.length !== 1 ? 's' : ''} defined
                </div>
              )}
              {contractType !== 'revenue_share' && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                  Escrow fee: {escrowFeeMode === 'writer_pays' ? 'You pay (+3%)' : escrowFeeMode === 'artist_pays' ? 'Artist pays (-3%)' : 'Split (1.5% each)'}
                </div>
              )}
            </div>
          )}

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
              onClick={handleInviteClick}
              disabled={inviting || !selectedUser || !inviteRole.trim()}
              style={{
                background: selectedUser && inviteRole.trim()
                  ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                  : '#374151',
                border: 'none',
                borderRadius: 8,
                padding: '10px 24px',
                color: '#fff',
                fontWeight: 600,
                cursor: inviting || !selectedUser || !inviteRole.trim() ? 'not-allowed' : 'pointer',
                fontSize: 14,
                opacity: inviting ? 0.7 : 1,
              }}
            >
              {inviting ? 'Sending Invitation...' : 'Send Invitation'}
            </button>
            <button
              onClick={() => {
                setShowInviteForm(false);
                setSelectedUser(null);
                setSearchQuery('');
                setInviteError('');
                setInviteRole('');
                setSelectedRoleId(null);
                setShowCustomRole(false);
                setTasks([]);
                setCanEditText(true);
                setCanEditImages(true);
                setCanEditAudio(false);
                setCanEditVideo(false);
              }}
              style={{
                background: 'transparent',
                border: '1px solid var(--panel-border)',
                borderRadius: 8,
                padding: '10px 24px',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: 14,
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Voting Power Warning Modal */}
      {showVotingPowerWarning && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
            border: '2px solid #f59e0b',
            borderRadius: 16,
            padding: 32,
            maxWidth: 500,
            width: '90%',
            boxShadow: '0 20px 60px rgba(245, 158, 11, 0.3)',
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              marginBottom: 20,
            }}>
              <div style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: 'rgba(245, 158, 11, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <AlertTriangle size={28} style={{ color: '#f59e0b' }} />
              </div>
              <h3 style={{ margin: 0, color: '#f59e0b', fontSize: 20, fontWeight: 700 }}>
                Voting Power Warning
              </h3>
            </div>

            <div style={{
              background: 'rgba(245, 158, 11, 0.1)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              borderRadius: 12,
              padding: 16,
              marginBottom: 20,
            }}>
              <div style={{ color: '#f8fafc', fontSize: 15, lineHeight: 1.6 }}>
                By allocating <strong style={{ color: '#f59e0b' }}>{invitePercentage}%</strong> revenue share to this collaborator, you will:
              </div>
              <ul style={{
                margin: '12px 0 0 0',
                paddingLeft: 20,
                color: 'var(--text)',
                fontSize: 14,
                lineHeight: 1.8,
              }}>
                {invitePercentage >= 50 && newLeadPercentage <= 50 && (
                  <li><strong style={{ color: '#ef4444' }}>Lose majority voting control</strong> ({leadPercentage}% → {newLeadPercentage}%)</li>
                )}
                <li>Require their approval for all project decisions</li>
                <li>Need their agreement for revenue changes</li>
                {invitePercentage === 50 && (
                  <li style={{ color: '#f59e0b' }}>50/50 splits can lead to deadlocks on decisions</li>
                )}
              </ul>
            </div>

            <div style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: 8,
              padding: 12,
              marginBottom: 24,
            }}>
              <div style={{ color: '#fca5a5', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                Important:
              </div>
              <div style={{ color: '#f87171', fontSize: 12 }}>
                Voting power equals revenue percentage. Allocations of 50% or more give collaborators
                significant control over project decisions including unpublishing after mint.
              </div>
            </div>

            <div style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 20 }}>
              Are you sure you want to proceed with this allocation?
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => setShowVotingPowerWarning(false)}
                style={{
                  flex: 1,
                  padding: '12px 20px',
                  borderRadius: 8,
                  border: '1px solid #64748b',
                  background: 'transparent',
                  color: 'var(--text-muted)',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Go Back
              </button>
              <button
                onClick={handleInvite}
                disabled={inviting}
                style={{
                  flex: 1,
                  padding: '12px 20px',
                  borderRadius: 8,
                  border: 'none',
                  background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                  color: '#000',
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: inviting ? 'not-allowed' : 'pointer',
                  opacity: inviting ? 0.7 : 1,
                }}
              >
                {inviting ? 'Sending...' : 'I Understand, Proceed'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Team Overview Component */}
      <TeamOverview
        collaborators={collaborators}
        sections={sections}
        projectCreatorId={project.created_by}
        currentUserId={currentUser.id}
        projectId={project.id}
        onInviteAction={() => onProjectUpdate?.(project)}
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

          {/* Project Complete banner — all escrow tasks signed off */}
          {collaborators
            .filter(c => c.status === 'accepted' && c.tasks_total > 0)
            .every(c => c.tasks_signed_off === c.tasks_total) && (
            <div style={{
              marginBottom: 20,
              padding: '16px 20px',
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: '50%',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Check size={20} style={{ color: '#fff' }} />
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#10b981' }}>
                  Project Complete
                </div>
                <div style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 2 }}>
                  All milestones signed off. Escrow fully released to collaborators.
                </div>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {collaborators
              .filter(c => c.status === 'accepted' && c.tasks_total > 0)
              .map((collab) => {
                const isEscrowContract = collab.contract_type === 'work_for_hire' || collab.contract_type === 'hybrid';
                const escrowFunded = isEscrowContract && parseFloat(collab.escrow_funded_amount || '0') >= parseFloat(collab.total_contract_amount || '0');
                const needsFunding = isEscrowContract && !escrowFunded;

                return (
                  <div key={collab.id}>
                    {/* Escrow Status Bar for escrow-based contracts */}
                    {isEscrowContract && (
                      <div style={{ marginBottom: 16 }}>
                        <EscrowStatusBar
                          contractType={collab.contract_type as 'work_for_hire' | 'hybrid'}
                          totalAmount={collab.total_contract_amount || '0'}
                          fundedAmount={collab.escrow_funded_amount || '0'}
                          releasedAmount={collab.escrow_released_amount || '0'}
                          trustPhase={collab.trust_phase || 'not_started'}
                          trustPagesCompleted={collab.trust_pages_completed || 0}
                          fundedAt={collab.escrow_funded_at}
                        />
                        {/* Fund Escrow button for project owner when not yet funded */}
                        {needsFunding && isProjectLead && (
                          <button
                            onClick={() => setFundingModalRole(collab)}
                            style={{
                              marginTop: 12,
                              width: '100%',
                              padding: '12px 20px',
                              background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
                              border: 'none',
                              borderRadius: 8,
                              color: '#fff',
                              fontSize: 14,
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 8,
                            }}
                          >
                            <DollarSign size={16} />
                            Fund Escrow — ${parseFloat(collab.total_contract_amount || '0').toFixed(2)} USDC
                          </button>
                        )}
                        {needsFunding && !isProjectLead && (
                          <div style={{
                            marginTop: 12,
                            padding: 12,
                            background: 'rgba(245, 158, 11, 0.1)',
                            border: '1px solid rgba(245, 158, 11, 0.3)',
                            borderRadius: 8,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                          }}>
                            <AlertTriangle size={16} style={{ color: '#f59e0b', flexShrink: 0 }} />
                            <span style={{ color: '#f59e0b', fontSize: 13 }}>
                              Waiting for project owner to fund escrow before work can begin.
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                    <TaskTracker
                      collaboratorRole={collab}
                      currentUserId={currentUser.id}
                      isProjectOwner={isProjectLead}
                      projectId={project.id}
                      onTaskUpdate={async () => {
                        const updatedProject = await collaborationApi.getCollaborativeProject(project.id);
                        onProjectUpdate?.(updatedProject);
                      }}
                    />
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Counter-proposals (only show when there's an actual difference) */}
      {collaborators.some(c =>
        (c.proposed_percentage != null &&
         !isNaN(Number(c.proposed_percentage)) &&
         Math.abs(Number(c.proposed_percentage) - Number(c.revenue_percentage)) > 0.001) ||
        c.proposed_total_amount != null ||
        (c.proposed_tasks && c.proposed_tasks.length > 0)
      ) && (
        <div style={{
          background: 'var(--panel)',
          border: '1px solid var(--panel-border)',
          borderRadius: 12,
          padding: 24,
        }}>
          <h3 style={{ margin: '0 0 16px', color: 'var(--text)', fontSize: 18 }}>
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
                (c.proposed_percentage != null &&
                 !isNaN(Number(c.proposed_percentage)) &&
                 Math.abs(Number(c.proposed_percentage) - Number(c.revenue_percentage)) > 0.001) ||
                c.proposed_total_amount != null ||
                (c.proposed_tasks && c.proposed_tasks.length > 0)
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
                        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                          proposes
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 13, color: 'var(--text-muted)', textDecoration: 'line-through' }}>
                          {collab.revenue_percentage}%
                        </span>
                        <span style={{ fontSize: 16, color: '#f59e0b', fontWeight: 700 }}>
                          {collab.proposed_percentage}%
                        </span>
                        <span style={{
                          fontSize: 13,
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
                        color: 'var(--text-muted)',
                        fontStyle: 'italic',
                      }}>
                        "{collab.counter_message}"
                      </div>
                    )}

                    {/* Proposed escrow amount change */}
                    {collab.proposed_total_amount != null && (
                      <div style={{
                        marginTop: 10,
                        padding: 10,
                        background: 'rgba(16, 185, 129, 0.08)',
                        border: '1px solid rgba(16, 185, 129, 0.2)',
                        borderRadius: 8,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                      }}>
                        <span style={{ color: '#10b981', fontSize: 13, fontWeight: 600 }}>Proposed Rate:</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: 13, textDecoration: 'line-through' }}>
                          ${parseFloat(collab.total_contract_amount).toFixed(2)}
                        </span>
                        <span style={{ color: '#10b981', fontSize: 14, fontWeight: 700 }}>
                          ${parseFloat(collab.proposed_total_amount).toFixed(2)}
                        </span>
                      </div>
                    )}

                    {/* Proposed task changes */}
                    {collab.proposed_tasks && collab.proposed_tasks.length > 0 && (
                      <div style={{
                        marginTop: 10,
                        padding: 10,
                        background: 'rgba(59, 130, 246, 0.08)',
                        border: '1px solid rgba(59, 130, 246, 0.2)',
                        borderRadius: 8,
                      }}>
                        <div style={{ color: '#93c5fd', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
                          Proposed Task Changes:
                        </div>
                        {collab.proposed_tasks.map((pt: any) => {
                          const originalTask = collab.contract_tasks?.find((t: any) => t.id === pt.task_id);
                          return (
                            <div key={pt.task_id} style={{
                              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                              padding: '4px 0', fontSize: 13, color: 'var(--text-muted)',
                            }}>
                              <span>{originalTask?.title || `Task #${pt.task_id}`}</span>
                              <div style={{ display: 'flex', gap: 12 }}>
                                {pt.payment_amount && originalTask && pt.payment_amount !== originalTask.payment_amount && (
                                  <span>
                                    <span style={{ textDecoration: 'line-through' }}>${parseFloat(originalTask.payment_amount).toFixed(2)}</span>
                                    {' → '}
                                    <span style={{ color: '#10b981', fontWeight: 600 }}>${parseFloat(pt.payment_amount).toFixed(2)}</span>
                                  </span>
                                )}
                                {pt.deadline && originalTask && pt.deadline !== originalTask.deadline && (
                                  <span style={{ color: '#93c5fd' }}>
                                    {new Date(pt.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
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
                              fontSize: 13,
                              color: 'var(--text-muted)',
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
                                border: '1px solid var(--border)',
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
                                  color: 'var(--text-muted)',
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

      {/* Escrow Funding Modal */}
      {fundingModalRole && (
        <EscrowFundingModal
          isOpen={true}
          onClose={() => setFundingModalRole(null)}
          onFunded={async () => {
            const updatedProject = await collaborationApi.getCollaborativeProject(project.id);
            onProjectUpdate?.(updatedProject);
          }}
          projectId={project.id}
          collaborator={fundingModalRole}
        />
      )}

    </div>
  );
}
