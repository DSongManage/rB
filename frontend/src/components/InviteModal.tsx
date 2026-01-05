import React, { useState, useEffect } from 'react';
import {
  BookOpen, Palette, Music, Film, Check, Plus, User,
  Pen, Users, Image, CheckCircle, FileText, Mic, Mic2,
  Brush, PaintBucket, Eye, Sliders, Volume2, Video,
  Scissors, PlayCircle, Briefcase, LayoutGrid, Type, PenTool
} from 'lucide-react';
import { API_URL } from '../config';

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
    default: return <User {...iconProps} />;
  }
};

// Types for contract tasks
interface ContractTask {
  id: string;
  title: string;
  description: string;
  deadline: string;
}

// Types for role definitions
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

// Project type options
type ProjectType = 'book' | 'art' | 'music' | 'video' | 'comic';

const PROJECT_TYPE_OPTIONS: { value: ProjectType; label: string; icon: React.ReactNode; description: string; comingSoon?: boolean }[] = [
  { value: 'book', label: 'Book', icon: <BookOpen size={28} />, description: 'Written content with chapters' },
  { value: 'comic', label: 'Comic', icon: <LayoutGrid size={28} />, description: 'Comic books with panels' },
  { value: 'art', label: 'Art', icon: <Palette size={28} />, description: 'Visual artwork and illustrations' },
  { value: 'music', label: 'Music', icon: <Music size={28} />, description: 'Audio tracks and albums', comingSoon: true },
  { value: 'video', label: 'Film', icon: <Film size={28} />, description: 'Video content and films', comingSoon: true },
];

type InviteModalProps = {
  open: boolean;
  onClose: () => void;
  recipient: {
    id: number;
    username: string;
    display_name?: string;
    avatar_url?: string;
    status?: string;
    status_category?: 'green'|'yellow'|'red';
    roles?: string[];
    genres?: string[];
  };
  // Optional: If provided, this is a project-specific invite
  projectId?: number;
  projectTitle?: string;
  projectType?: ProjectType;
};

// Dynamic pitch template that includes project title when available
const getDefaultPitch = (projectTitle?: string) => {
  if (projectTitle) {
    return `Hi! I'd love to collaborate with you on "${projectTitle}".

**Project Vision:**
[Describe your project idea here]

**Your Role:**
[What you'd like them to contribute]

Looking forward to creating something amazing together!`;
  }
  return `Hi! I'd love to collaborate with you on an upcoming project.

**Project Vision:**
[Describe your project idea here]

**Your Role:**
[What you'd like them to contribute]

Looking forward to creating something amazing together!`;
};

// Generate unique ID for tasks
const generateId = () => Math.random().toString(36).substr(2, 9);

// Format date for input
const getDefaultDeadline = (daysFromNow: number = 14) => {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toISOString().slice(0, 16);
};

export default function InviteModal({ open, onClose, recipient, projectId, projectTitle, projectType: initialProjectType }: InviteModalProps) {
  // Custom project title for new collaborations (when no projectId/projectTitle is passed)
  const [customProjectTitle, setCustomProjectTitle] = useState('');

  // Effective title: use passed projectTitle or custom one
  const effectiveTitle = projectTitle || customProjectTitle || '';

  const [message, setMessage] = useState(getDefaultPitch(projectTitle));
  const [equityPercent, setEquityPercent] = useState(50);
  const [role, setRole] = useState('');
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Project type - required for new collaborations
  const [projectType, setProjectType] = useState<ProjectType>(initialProjectType || 'book');

  // Role definitions from API
  const [roleDefinitions, setRoleDefinitions] = useState<RoleDefinition[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [loadingRoles, setLoadingRoles] = useState(false);
  const [showCustomRole, setShowCustomRole] = useState(false);

  // Contract tasks
  const [tasks, setTasks] = useState<ContractTask[]>([]);
  const [showTaskForm, setShowTaskForm] = useState(false);

  // Permissions - defaults based on project type
  const [canEditText, setCanEditText] = useState(true);
  const [canEditImages, setCanEditImages] = useState(true);
  const [canEditAudio, setCanEditAudio] = useState(false);
  const [canEditVideo, setCanEditVideo] = useState(false);

  // Fetch role definitions when project type changes
  useEffect(() => {
    if (!open) return;

    const fetchRoleDefinitions = async () => {
      setLoadingRoles(true);
      try {
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
  }, [projectType, open]);

  // Update pitch message when custom project title changes (for new collaborations)
  useEffect(() => {
    if (!projectId && customProjectTitle) {
      setMessage(getDefaultPitch(customProjectTitle));
    } else if (!projectId && !customProjectTitle) {
      setMessage(getDefaultPitch());
    }
  }, [customProjectTitle, projectId]);

  // Handle role selection - auto-populate permissions from role definition
  const handleRoleSelect = (roleId: number | null) => {
    setSelectedRoleId(roleId);
    setShowCustomRole(false);

    if (roleId) {
      const roleDef = roleDefinitions.find(r => r.id === roleId);
      if (roleDef) {
        setRole(roleDef.name);
        // Auto-populate permissions from role definition
        const perms = roleDef.default_permissions;
        const editTypes = perms.edit?.types || [];
        setCanEditText(editTypes.includes('text') || perms.create?.includes('text'));
        setCanEditImages(editTypes.includes('image') || perms.create?.includes('image'));
        setCanEditAudio(editTypes.includes('audio') || perms.create?.includes('audio'));
        setCanEditVideo(editTypes.includes('video') || perms.create?.includes('video'));
      }
    } else {
      setRole('');
    }
  };

  // Handle custom role selection
  const handleCustomRole = () => {
    setSelectedRoleId(null);
    setShowCustomRole(true);
    setRole('');
  };

  // Update permissions when project type changes
  const handleProjectTypeChange = (newType: ProjectType) => {
    setProjectType(newType);
    // Reset role selection when project type changes
    setSelectedRoleId(null);
    setShowCustomRole(false);
    setRole('');
    // Set smart defaults based on project type
    switch (newType) {
      case 'book':
        setCanEditText(true);
        setCanEditImages(true);
        setCanEditAudio(false);
        setCanEditVideo(false);
        break;
      case 'art':
        setCanEditText(false);
        setCanEditImages(true);
        setCanEditAudio(false);
        setCanEditVideo(false);
        break;
      case 'music':
        setCanEditText(false);
        setCanEditImages(true); // For album art
        setCanEditAudio(true);
        setCanEditVideo(false);
        break;
      case 'video':
        setCanEditText(false);
        setCanEditImages(true); // For thumbnails
        setCanEditAudio(true);
        setCanEditVideo(true);
        break;
      case 'comic':
        setCanEditText(true);   // For speech bubbles
        setCanEditImages(true); // For panel artwork
        setCanEditAudio(false);
        setCanEditVideo(false);
        break;
    }
  };

  if (!open) return null;

  const statusColors = {
    green: { bg: '#10b981', text: '#fff' },
    yellow: { bg: '#f59e0b', text: '#000' },
    red: { bg: '#ef4444', text: '#fff' },
  };
  const statusColor = statusColors[recipient.status_category || 'green'];

  async function fetchCsrf() {
    try {
      const res = await fetch(`${API_URL}/api/auth/csrf/`, { credentials: 'include' });
      const data = await res.json();
      return data?.csrfToken || '';
    } catch {
      return '';
    }
  }

  const addTask = () => {
    setTasks([...tasks, {
      id: generateId(),
      title: '',
      description: '',
      deadline: getDefaultDeadline(),
    }]);
    setShowTaskForm(true);
  };

  const updateTask = (id: string, field: keyof ContractTask, value: string) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  const removeTask = (id: string) => {
    setTasks(tasks.filter(t => t.id !== id));
  };

  const handleSend = async () => {
    setSuccessMsg('');
    setErrorMsg('');

    // Validate tasks have required fields
    for (const task of tasks) {
      if (!task.title.trim()) {
        setErrorMsg('All tasks must have a title');
        return;
      }
      if (!task.deadline) {
        setErrorMsg('All tasks must have a deadline');
        return;
      }
    }

    setSending(true);

    try {
      const csrf = await fetchCsrf();

      // If we have a projectId, use the new collaborative invite endpoint
      if (projectId) {
        const res = await fetch(`${API_URL}/api/collaborative-projects/${projectId}/invite_collaborator/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': csrf,
            'X-Requested-With': 'XMLHttpRequest',
          },
          credentials: 'include',
          body: JSON.stringify({
            user_id: recipient.id,
            role: role || 'Collaborator',
            role_definition_id: selectedRoleId || undefined,
            revenue_percentage: equityPercent,
            can_edit_text: canEditText,
            can_edit_images: canEditImages,
            can_edit_audio: canEditAudio,
            can_edit_video: canEditVideo,
            tasks: tasks.map(t => ({
              title: t.title,
              description: t.description,
              deadline: new Date(t.deadline).toISOString(),
            })),
          }),
        });

        if (res.ok) {
          setSuccessMsg(`Invite sent to @${recipient.username}!`);
          setTimeout(() => {
            onClose();
            resetForm();
          }, 2000);
        } else {
          const error = await res.json();
          setErrorMsg(error.error || 'Failed to send invite');
        }
      } else {
        // Use the old general invite endpoint (enhanced with tasks support)
        const res = await fetch(`${API_URL}/api/invite/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': csrf,
            'X-Requested-With': 'XMLHttpRequest',
          },
          credentials: 'include',
          body: JSON.stringify({
            message,
            equity_percent: equityPercent,
            collaborators: [recipient.id],
            attachments: '',
            role: role || 'Collaborator',
            project_type: projectType,
            tasks: tasks.map(t => ({
              title: t.title,
              description: t.description,
              deadline: new Date(t.deadline).toISOString(),
            })),
          }),
        });

        if (res.ok) {
          setSuccessMsg(`Invite sent to @${recipient.username}!`);
          setTimeout(() => {
            onClose();
            resetForm();
          }, 2000);
        } else {
          const error = await res.text();
          setErrorMsg(`Failed to send invite: ${error}`);
        }
      }
    } catch (err: any) {
      setErrorMsg(`Error: ${err.message || 'Unknown error'}`);
    } finally {
      setSending(false);
    }
  };

  const resetForm = () => {
    setCustomProjectTitle('');
    setMessage(getDefaultPitch(projectTitle));
    setEquityPercent(50);
    setRole('');
    setSelectedRoleId(null);
    setShowCustomRole(false);
    setProjectType(initialProjectType || 'book');
    setTasks([]);
    setSuccessMsg('');
    setErrorMsg('');
    setCanEditText(true);
    setCanEditImages(true);
    setCanEditAudio(false);
    setCanEditVideo(false);
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.85)',
      display: 'grid',
      placeItems: 'center',
      zIndex: 1000,
      padding: 20,
    }}>
      <div
        className="invite-modal-scroll"
        style={{
          background: '#0f172a',
          border: '1px solid #334155',
          borderRadius: 16,
          width: '100%',
          maxWidth: 1000,
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)',
        }}
      >
        {/* Header */}
        <div style={{
          padding: 24,
          borderBottom: '1px solid #334155',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
        }}>
          <div style={{
            width: 64,
            height: 64,
            borderRadius: 12,
            background: recipient.avatar_url ? `url(${recipient.avatar_url})` : '#1e293b',
            backgroundSize: 'cover',
            display: 'grid',
            placeItems: 'center',
            color: '#f59e0b',
            fontWeight: 700,
            fontSize: 24,
            border: '2px solid #334155',
          }}>
            {!recipient.avatar_url && recipient.username.slice(0, 1).toUpperCase()}
          </div>

          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
              <span style={{ color: '#f8fafc', fontWeight: 600, fontSize: 20 }}>@{recipient.username}</span>
              {recipient.status && (
                <div style={{
                  background: statusColor.bg,
                  color: statusColor.text,
                  fontSize: 10,
                  fontWeight: 600,
                  padding: '4px 10px',
                  borderRadius: 4,
                  letterSpacing: 0.3,
                }}>
                  {recipient.status}
                </div>
              )}
            </div>
            {recipient.display_name && (
              <div style={{ color: '#cbd5e1', fontSize: 14, marginBottom: 8 }}>{recipient.display_name}</div>
            )}
            {projectTitle && (
              <div style={{ color: '#f59e0b', fontSize: 12, fontWeight: 600 }}>
                Inviting to: {projectTitle}
              </div>
            )}
            {/* Capabilities badges */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              {recipient.roles?.map((r, i) => (
                <span key={`r-${i}`} style={{
                  background: 'rgba(245,158,11,0.15)',
                  color: '#f59e0b',
                  fontSize: 10,
                  fontWeight: 600,
                  padding: '2px 6px',
                  borderRadius: 3,
                  border: '1px solid rgba(245,158,11,0.4)',
                }}>
                  {r}
                </span>
              ))}
              {recipient.genres?.map((g, i) => (
                <span key={`g-${i}`} style={{
                  background: 'rgba(59,130,246,0.15)',
                  color: '#3b82f6',
                  fontSize: 10,
                  fontWeight: 600,
                  padding: '2px 6px',
                  borderRadius: 3,
                  border: '1px solid rgba(59,130,246,0.4)',
                }}>
                  {g}
                </span>
              ))}
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              fontSize: 24,
              cursor: 'pointer',
              padding: 8,
            }}
          >
            ×
          </button>
        </div>

        {/* Project Context Banner */}
        {effectiveTitle && (
          <div style={{
            padding: '16px 24px',
            background: 'linear-gradient(90deg, rgba(245,158,11,0.1) 0%, rgba(245,158,11,0.05) 100%)',
            borderBottom: '1px solid rgba(245,158,11,0.2)',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}>
            <div style={{
              width: 40,
              height: 40,
              borderRadius: 8,
              background: 'rgba(245,158,11,0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#f59e0b',
            }}>
              <BookOpen size={20} />
            </div>
            <div>
              <div style={{ color: '#94a3b8', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Project
              </div>
              <div style={{ color: '#f8fafc', fontSize: 16, fontWeight: 600 }}>
                {effectiveTitle}
              </div>
            </div>
          </div>
        )}

        {/* Form */}
        <div style={{ padding: 24, display: 'grid', gap: 20 }}>
          {/* Project Title Input - for new collaborations (first field) */}
          {!projectId && (
            <div>
              <label style={{ display: 'block', color: '#cbd5e1', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
                Project Title <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="text"
                value={customProjectTitle}
                onChange={(e) => setCustomProjectTitle(e.target.value)}
                placeholder="Enter a title for your project..."
                style={{
                  width: '100%',
                  background: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: 8,
                  padding: 12,
                  color: '#f8fafc',
                  fontSize: 14,
                }}
              />
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                Give your project a name that describes what you're creating together
              </div>
            </div>
          )}

          {/* Project Type Selector - REQUIRED for new collaborations */}
          {!projectId && (
            <div>
              <label style={{ display: 'block', color: '#cbd5e1', fontSize: 13, fontWeight: 600, marginBottom: 12 }}>
                Project Type <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                {PROJECT_TYPE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => !option.comingSoon && handleProjectTypeChange(option.value)}
                    disabled={option.comingSoon}
                    style={{
                      background: option.comingSoon
                        ? '#1e293b'
                        : projectType === option.value
                          ? 'rgba(245,158,11,0.15)'
                          : '#1e293b',
                      border: `2px solid ${option.comingSoon ? '#334155' : projectType === option.value ? '#f59e0b' : '#334155'}`,
                      borderRadius: 12,
                      padding: 16,
                      cursor: option.comingSoon ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 8,
                      transition: 'all 0.2s ease',
                      opacity: option.comingSoon ? 0.5 : 1,
                      position: 'relative',
                    }}
                  >
                    {option.comingSoon && (
                      <span style={{
                        position: 'absolute',
                        top: 6,
                        right: 6,
                        background: '#f59e0b',
                        color: '#000',
                        fontSize: 8,
                        fontWeight: 700,
                        padding: '2px 4px',
                        borderRadius: 3,
                      }}>
                        SOON
                      </span>
                    )}
                    <span style={{ color: option.comingSoon ? '#64748b' : projectType === option.value ? '#f59e0b' : '#94a3b8' }}>
                      {option.icon}
                    </span>
                    <span style={{
                      color: option.comingSoon ? '#64748b' : projectType === option.value ? '#f59e0b' : '#f8fafc',
                      fontSize: 14,
                      fontWeight: 600
                    }}>
                      {option.label}
                    </span>
                    <span style={{
                      color: '#64748b',
                      fontSize: 11,
                      textAlign: 'center',
                      lineHeight: 1.3
                    }}>
                      {option.description}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Role Selection */}
          <div>
            <label style={{ display: 'block', color: '#cbd5e1', fontSize: 13, fontWeight: 600, marginBottom: 12 }}>
              Their Role <span style={{ color: '#ef4444' }}>*</span>
            </label>

            {loadingRoles ? (
              <div style={{ color: '#64748b', fontSize: 13, padding: 12 }}>
                Loading roles...
              </div>
            ) : (
              <>
                {/* Role cards grid */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                  gap: 10,
                  marginBottom: 12,
                }}>
                  {roleDefinitions.map((roleDef) => (
                    <button
                      key={roleDef.id}
                      type="button"
                      onClick={() => handleRoleSelect(roleDef.id)}
                      style={{
                        background: selectedRoleId === roleDef.id ? 'rgba(245,158,11,0.15)' : '#1e293b',
                        border: `2px solid ${selectedRoleId === roleDef.id ? '#f59e0b' : '#334155'}`,
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
                          background: '#f59e0b',
                          borderRadius: '50%',
                          width: 16,
                          height: 16,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}>
                          <Check size={10} color="#000" strokeWidth={3} />
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
                        color: selectedRoleId === roleDef.id ? '#f59e0b' : '#f8fafc',
                        fontSize: 12,
                        fontWeight: 600,
                        textAlign: 'center',
                      }}>
                        {roleDef.name}
                      </span>
                      <span style={{
                        color: '#64748b',
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
                      background: showCustomRole ? 'rgba(245,158,11,0.15)' : '#1e293b',
                      border: `2px solid ${showCustomRole ? '#f59e0b' : '#334155'}`,
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
                      color: '#94a3b8',
                    }}>
                      <Plus size={20} strokeWidth={1.5} />
                    </div>
                    <span style={{
                      color: showCustomRole ? '#f59e0b' : '#94a3b8',
                      fontSize: 12,
                      fontWeight: 600,
                    }}>
                      Custom Role
                    </span>
                    <span style={{
                      color: '#64748b',
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
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    placeholder="Enter custom role name..."
                    style={{
                      width: '100%',
                      background: '#1e293b',
                      border: '1px solid #f59e0b',
                      borderRadius: 8,
                      padding: 12,
                      color: '#f8fafc',
                      fontSize: 14,
                    }}
                  />
                )}

                {/* Selected role info */}
                {selectedRoleId && !showCustomRole && (
                  <div style={{
                    background: 'rgba(245,158,11,0.1)',
                    border: '1px solid rgba(245,158,11,0.3)',
                    borderRadius: 8,
                    padding: 12,
                  }}>
                    {(() => {
                      const selectedRole = roleDefinitions.find(r => r.id === selectedRoleId);
                      if (!selectedRole) return null;
                      return (
                        <>
                          <div style={{ color: '#f59e0b', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                            {selectedRole.name}
                          </div>
                          <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 8 }}>
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

          {/* Project Pitch */}
          <div>
            <label style={{ display: 'block', color: '#cbd5e1', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
              Project Pitch
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Describe your project and what you're looking for..."
              style={{
                width: '100%',
                minHeight: 150,
                background: '#1e293b',
                border: '1px solid #334155',
                borderRadius: 8,
                padding: 12,
                color: '#f8fafc',
                fontSize: 14,
                fontFamily: 'inherit',
                resize: 'vertical',
              }}
            />
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
              {message.length}/1000 characters
            </div>
          </div>

          {/* Contract Tasks Section */}
          <div style={{
            background: '#1e293b',
            border: '1px solid #334155',
            borderRadius: 12,
            padding: 20,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <div style={{ color: '#f8fafc', fontSize: 15, fontWeight: 600 }}>
                  Contract Tasks
                </div>
                <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 2 }}>
                  Define specific deliverables with deadlines. These become binding after acceptance.
                </div>
              </div>
              <button
                onClick={addTask}
                style={{
                  background: 'rgba(245,158,11,0.15)',
                  border: '1px solid #f59e0b',
                  color: '#f59e0b',
                  padding: '8px 16px',
                  borderRadius: 8,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: 13,
                }}
              >
                + Add Task
              </button>
            </div>

            {tasks.length === 0 ? (
              <div style={{
                padding: 24,
                textAlign: 'center',
                color: '#64748b',
                fontSize: 13,
                border: '1px dashed #334155',
                borderRadius: 8,
              }}>
                No tasks defined yet. Add tasks to create a concrete contract.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {tasks.map((task, index) => (
                  <div key={task.id} style={{
                    background: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: 8,
                    padding: 16,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                      <div style={{ flex: 1, display: 'grid', gap: 12 }}>
                        <div style={{ display: 'flex', gap: 12 }}>
                          <div style={{ flex: 2 }}>
                            <label style={{ display: 'block', color: '#94a3b8', fontSize: 11, marginBottom: 4 }}>
                              Task {index + 1}: Title *
                            </label>
                            <input
                              type="text"
                              value={task.title}
                              onChange={(e) => updateTask(task.id, 'title', e.target.value)}
                              placeholder="e.g., Character designs for Chapter 1"
                              style={{
                                width: '100%',
                                background: '#1e293b',
                                border: '1px solid #334155',
                                borderRadius: 6,
                                padding: 10,
                                color: '#f8fafc',
                                fontSize: 13,
                              }}
                            />
                          </div>
                          <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', color: '#94a3b8', fontSize: 11, marginBottom: 4 }}>
                              Deadline *
                            </label>
                            <input
                              type="datetime-local"
                              value={task.deadline}
                              onChange={(e) => updateTask(task.id, 'deadline', e.target.value)}
                              style={{
                                width: '100%',
                                background: '#1e293b',
                                border: '1px solid #334155',
                                borderRadius: 6,
                                padding: 10,
                                color: '#f8fafc',
                                fontSize: 13,
                              }}
                            />
                          </div>
                        </div>
                        <div>
                          <label style={{ display: 'block', color: '#94a3b8', fontSize: 11, marginBottom: 4 }}>
                            Description (optional)
                          </label>
                          <textarea
                            value={task.description}
                            onChange={(e) => updateTask(task.id, 'description', e.target.value)}
                            placeholder="Detailed requirements, expectations, or notes..."
                            rows={2}
                            style={{
                              width: '100%',
                              background: '#1e293b',
                              border: '1px solid #334155',
                              borderRadius: 6,
                              padding: 10,
                              color: '#f8fafc',
                              fontSize: 13,
                              fontFamily: 'inherit',
                              resize: 'vertical',
                            }}
                          />
                        </div>
                      </div>
                      <button
                        onClick={() => removeTask(task.id)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#ef4444',
                          fontSize: 18,
                          cursor: 'pointer',
                          padding: 4,
                        }}
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {tasks.length > 0 && (
              <div style={{
                marginTop: 16,
                padding: 12,
                background: 'rgba(245,158,11,0.1)',
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}>
                <span style={{ fontSize: 16 }}>⚠️</span>
                <span style={{ color: '#f59e0b', fontSize: 12 }}>
                  Tasks become immutable after the collaborator accepts. Changes require mutual agreement.
                </span>
              </div>
            )}
          </div>

          {/* Permissions */}
          {projectId && (
            <div>
              <label style={{ display: 'block', color: '#cbd5e1', fontSize: 13, fontWeight: 600, marginBottom: 12 }}>
                Editing Permissions
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                {[
                  { key: 'text', label: 'Text', value: canEditText, setter: setCanEditText },
                  { key: 'images', label: 'Images', value: canEditImages, setter: setCanEditImages },
                  { key: 'audio', label: 'Audio', value: canEditAudio, setter: setCanEditAudio },
                  { key: 'video', label: 'Video', value: canEditVideo, setter: setCanEditVideo },
                ].map(perm => (
                  <label key={perm.key} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 16px',
                    background: perm.value ? 'rgba(16,185,129,0.15)' : '#1e293b',
                    border: `1px solid ${perm.value ? '#10b981' : '#334155'}`,
                    borderRadius: 8,
                    cursor: 'pointer',
                  }}>
                    <input
                      type="checkbox"
                      checked={perm.value}
                      onChange={(e) => perm.setter(e.target.checked)}
                      style={{ accentColor: '#10b981' }}
                    />
                    <span style={{ color: perm.value ? '#10b981' : '#94a3b8', fontSize: 13 }}>
                      {perm.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Equity Slider */}
          <div>
            <label style={{ display: 'block', color: '#cbd5e1', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
              Revenue Split for @{recipient.username}: {equityPercent}%
            </label>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={equityPercent}
              onChange={(e) => setEquityPercent(parseInt(e.target.value))}
              style={{ width: '100%' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748b', marginTop: 4 }}>
              <span>You keep: {100 - equityPercent}%</span>
              <span>They get: {equityPercent}%</span>
            </div>
          </div>

          {/* Preview Pane */}
          <div style={{
            background: '#1e293b',
            border: '1px solid #334155',
            borderRadius: 8,
            padding: 16,
          }}>
            <div style={{ color: '#94a3b8', fontSize: 12, fontWeight: 600, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Preview
            </div>

            {/* Project Title in Preview */}
            {effectiveTitle && (
              <div style={{
                marginBottom: 12,
                paddingBottom: 12,
                borderBottom: '1px solid #334155',
              }}>
                <div style={{ color: '#f59e0b', fontSize: 11, fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Project
                </div>
                <div style={{ color: '#f8fafc', fontSize: 15, fontWeight: 600 }}>
                  {effectiveTitle}
                </div>
              </div>
            )}

            <div style={{ color: '#cbd5e1', fontSize: 13, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
              {message || '(Your pitch will appear here)'}
            </div>

            {/* Tasks Preview */}
            {tasks.length > 0 && (
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #334155' }}>
                <div style={{ fontSize: 12, color: '#f59e0b', fontWeight: 600, marginBottom: 8 }}>
                  Contract Tasks ({tasks.length})
                </div>
                {tasks.map((task, i) => (
                  <div key={task.id} style={{
                    padding: 10,
                    background: '#0f172a',
                    borderRadius: 6,
                    marginBottom: 8,
                    borderLeft: '3px solid #f59e0b',
                  }}>
                    <div style={{ color: '#f8fafc', fontSize: 13, fontWeight: 600 }}>{task.title || '(Untitled)'}</div>
                    {task.description && (
                      <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 4 }}>{task.description}</div>
                    )}
                    <div style={{ color: '#f59e0b', fontSize: 11, marginTop: 6 }}>
                      Due: {task.deadline ? new Date(task.deadline).toLocaleDateString() : '(No deadline)'}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #334155' }}>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>Revenue Split</div>
              <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                <div style={{
                  flex: 100 - equityPercent,
                  background: '#334155',
                  height: 32,
                  borderRadius: 6,
                  display: 'grid',
                  placeItems: 'center',
                  color: '#cbd5e1',
                  fontSize: 12,
                  fontWeight: 600,
                }}>
                  You: {100 - equityPercent}%
                </div>
                <div style={{
                  flex: equityPercent,
                  background: '#f59e0b',
                  height: 32,
                  borderRadius: 6,
                  display: 'grid',
                  placeItems: 'center',
                  color: '#000',
                  fontSize: 12,
                  fontWeight: 600,
                }}>
                  @{recipient.username}: {equityPercent}%
                </div>
              </div>
            </div>
          </div>

          {/* Success/Error Messages */}
          {successMsg && (
            <div style={{
              background: 'rgba(16,185,129,0.1)',
              border: '1px solid #10b981',
              color: '#10b981',
              padding: 12,
              borderRadius: 8,
              fontSize: 13,
            }}>
              {successMsg}
            </div>
          )}
          {errorMsg && (
            <div style={{
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid #ef4444',
              color: '#ef4444',
              padding: 12,
              borderRadius: 8,
              fontSize: 13,
            }}>
              {errorMsg}
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: '1px solid #334155',
                color: '#cbd5e1',
                padding: '10px 20px',
                borderRadius: 8,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSend}
              disabled={sending || !message.trim() || message.length > 1000}
              style={{
                background: sending ? '#64748b' : '#f59e0b',
                color: '#000',
                border: 'none',
                padding: '10px 24px',
                borderRadius: 8,
                fontWeight: 700,
                cursor: sending ? 'not-allowed' : 'pointer',
                opacity: (!message.trim() || message.length > 1000) ? 0.5 : 1,
              }}
            >
              {sending ? 'Sending...' : 'Send Invite'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
