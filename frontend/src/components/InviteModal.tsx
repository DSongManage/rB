import React, { useState } from 'react';
import { BookOpen, Palette, Music, Film } from 'lucide-react';

// Types for contract tasks
interface ContractTask {
  id: string;
  title: string;
  description: string;
  deadline: string;
}

// Project type options
type ProjectType = 'book' | 'art' | 'music' | 'video';

const PROJECT_TYPE_OPTIONS: { value: ProjectType; label: string; icon: React.ReactNode; description: string }[] = [
  { value: 'book', label: 'Book', icon: <BookOpen size={28} />, description: 'Written content with chapters' },
  { value: 'art', label: 'Art', icon: <Palette size={28} />, description: 'Visual artwork and illustrations' },
  { value: 'music', label: 'Music', icon: <Music size={28} />, description: 'Audio tracks and albums' },
  { value: 'video', label: 'Film', icon: <Film size={28} />, description: 'Video content and films' },
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

const DEFAULT_PITCH = `Hi! I'd love to collaborate with you on an upcoming project.

**Project Vision:**
[Describe your project idea here]

**Your Role:**
[What you'd like them to contribute]

Looking forward to creating something amazing together!`;

// Generate unique ID for tasks
const generateId = () => Math.random().toString(36).substr(2, 9);

// Format date for input
const getDefaultDeadline = (daysFromNow: number = 14) => {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toISOString().slice(0, 16);
};

export default function InviteModal({ open, onClose, recipient, projectId, projectTitle, projectType: initialProjectType }: InviteModalProps) {
  const [message, setMessage] = useState(DEFAULT_PITCH);
  const [equityPercent, setEquityPercent] = useState(50);
  const [role, setRole] = useState('');
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Project type - required for new collaborations
  const [projectType, setProjectType] = useState<ProjectType>(initialProjectType || 'book');

  // Contract tasks
  const [tasks, setTasks] = useState<ContractTask[]>([]);
  const [showTaskForm, setShowTaskForm] = useState(false);

  // Permissions - defaults based on project type
  const [canEditText, setCanEditText] = useState(true);
  const [canEditImages, setCanEditImages] = useState(true);
  const [canEditAudio, setCanEditAudio] = useState(false);
  const [canEditVideo, setCanEditVideo] = useState(false);

  // Update permissions when project type changes
  const handleProjectTypeChange = (newType: ProjectType) => {
    setProjectType(newType);
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
      const res = await fetch('/api/auth/csrf/', { credentials: 'include' });
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
        const res = await fetch(`/api/collaborative-projects/${projectId}/invite_collaborator/`, {
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
        const res = await fetch('/api/invite/', {
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
    setMessage(DEFAULT_PITCH);
    setEquityPercent(50);
    setRole('');
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
      <div style={{
        background: '#0f172a',
        border: '1px solid #334155',
        borderRadius: 16,
        width: '100%',
        maxWidth: 1000,
        maxHeight: '90vh',
        overflow: 'auto',
        boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)',
      }}>
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
                  fontSize: 9,
                  fontWeight: 700,
                  padding: '4px 8px',
                  borderRadius: 4,
                  textTransform: 'uppercase',
                  letterSpacing: 0.8,
                }}>
                  {recipient.status_category}
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

        {/* Form */}
        <div style={{ padding: 24, display: 'grid', gap: 20 }}>
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
                    onClick={() => handleProjectTypeChange(option.value)}
                    style={{
                      background: projectType === option.value ? 'rgba(245,158,11,0.15)' : '#1e293b',
                      border: `2px solid ${projectType === option.value ? '#f59e0b' : '#334155'}`,
                      borderRadius: 12,
                      padding: 16,
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 8,
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <span style={{ color: projectType === option.value ? '#f59e0b' : '#94a3b8' }}>
                      {option.icon}
                    </span>
                    <span style={{
                      color: projectType === option.value ? '#f59e0b' : '#f8fafc',
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

          {/* Role */}
          <div>
            <label style={{ display: 'block', color: '#cbd5e1', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
              Their Role
            </label>
            <input
              type="text"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="e.g., Illustrator, Co-Author, Editor..."
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
