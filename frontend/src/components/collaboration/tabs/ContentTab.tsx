import React from 'react';
import {
  CollaborativeProject,
  ProjectSection,
  ProjectComment,
  CollaboratorRole,
} from '../../../services/collaborationApi';
import CollaborativeEditor from '../CollaborativeEditor';
import CollaborativeBookEditor from '../CollaborativeBookEditor';
import CollaborativeArtEditor from '../CollaborativeArtEditor';
import CollaborativeMusicEditor from '../CollaborativeMusicEditor';
import CollaborativeVideoEditor from '../CollaborativeVideoEditor';
import CollaborativeComicEditor from '../CollaborativeComicEditor';
import ReviewerInterface from '../ReviewerInterface';
import { CommentsPanel } from '../CommentsPanel';
import { Eye, Palette, Music, Video, FileText, AlertCircle } from 'lucide-react';

interface User {
  id: number;
  username: string;
  display_name?: string;
}

interface ContentTabProps {
  project: CollaborativeProject;
  currentUser: User;
  onSectionUpdate?: (section: ProjectSection) => void;
  onCommentAdd?: (comment: ProjectComment) => void;
  onProjectUpdate?: (project: CollaborativeProject) => void;
}

// Helper to get user's effective permissions from their role
function getEffectivePermissions(role: CollaboratorRole | undefined) {
  if (!role) return null;

  // Check new permissions structure first
  const perms = role.effective_permissions || role.permissions;
  if (perms && typeof perms === 'object' && Object.keys(perms).length > 0) {
    return {
      create: perms.create || [],
      edit: perms.edit || { scope: 'none', types: [] },
      review: perms.review || [],
      ui_components: role.ui_components || [],
    };
  }

  // Fallback to legacy boolean flags
  const create: string[] = [];
  const editTypes: string[] = [];
  if (role.can_edit_text) {
    create.push('text');
    editTypes.push('text');
  }
  if (role.can_edit_images) {
    create.push('image');
    editTypes.push('image');
  }
  if (role.can_edit_audio) {
    create.push('audio');
    editTypes.push('audio');
  }
  if (role.can_edit_video) {
    create.push('video');
    editTypes.push('video');
  }

  return {
    create,
    edit: { scope: 'own', types: editTypes },
    review: [],
    ui_components: role.ui_components || [],
  };
}

// Check if user is project owner (has full access)
function isProjectOwner(project: CollaborativeProject, userId: number): boolean {
  return project.created_by === userId;
}

// Determine what interface type to show based on permissions
function getInterfaceType(permissions: ReturnType<typeof getEffectivePermissions>): 'creator' | 'reviewer' | 'none' {
  if (!permissions) return 'none';

  const isCreator =
    permissions.create.length > 0 ||
    (permissions.edit.types && permissions.edit.types.length > 0);

  const isReviewer =
    permissions.review.length > 0 && !isCreator;

  if (isCreator) return 'creator';
  if (isReviewer) return 'reviewer';
  return 'none';
}

export default function ContentTab({
  project,
  currentUser,
  onSectionUpdate,
  onCommentAdd,
  onProjectUpdate,
}: ContentTabProps) {
  const collaborators = project.collaborators || [];
  const currentUserRole = collaborators.find(c => c.user === currentUser.id);
  const isOwner = isProjectOwner(project, currentUser.id);

  // Owner sees everything - route by project type
  if (isOwner) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {renderByProjectType(project, currentUser, onSectionUpdate, onCommentAdd, onProjectUpdate)}
        <CommentsPanel project={project} currentUser={currentUser} />
      </div>
    );
  }

  // Non-owner: check permissions and render appropriate interface
  const permissions = getEffectivePermissions(currentUserRole);
  const interfaceType = getInterfaceType(permissions);

  // No permissions - show access denied
  if (interfaceType === 'none' || !permissions) {
    return (
      <div style={{
        padding: 40,
        textAlign: 'center',
        color: '#94a3b8',
      }}>
        <AlertCircle size={48} style={{ marginBottom: 16, color: '#f59e0b' }} />
        <h3 style={{ color: '#f8fafc', marginBottom: 8 }}>No Content Access</h3>
        <p style={{ fontSize: 14 }}>
          You don't have permission to view or edit content in this project yet.
          <br />
          Contact the project owner to update your permissions.
        </p>
      </div>
    );
  }

  // Reviewer interface - read-only with commenting
  if (interfaceType === 'reviewer') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <ReviewerInterface
          project={project}
          currentUser={currentUser}
          reviewableTypes={permissions.review}
          onCommentAdd={onCommentAdd}
        />
        <CommentsPanel project={project} currentUser={currentUser} />
      </div>
    );
  }

  // Creator interface - route based on what they can create/edit
  const uiComponents = permissions.ui_components || [];

  // Check what UI components this role should see
  const hasChapterEditor = uiComponents.includes('chapter_editor') || permissions.create.includes('text') || permissions.edit.types?.includes('text');
  const hasImageUploader = uiComponents.includes('image_uploader') || permissions.create.includes('image') || permissions.edit.types?.includes('image');
  const hasAudioUploader = uiComponents.includes('audio_uploader') || permissions.create.includes('audio') || permissions.edit.types?.includes('audio');
  const hasVideoUploader = uiComponents.includes('video_uploader') || permissions.create.includes('video') || permissions.edit.types?.includes('video');

  // Route by project type first - all collaborators see the same editor for their project
  // The individual editors handle permission-based restrictions internally
  const renderEditorByProjectType = () => {
    switch (project.content_type) {
      case 'comic':
        return (
          <CollaborativeComicEditor
            project={project}
            currentUser={currentUser}
            onProjectUpdate={onProjectUpdate}
          />
        );

      case 'art':
        return (
          <CollaborativeArtEditor
            project={project}
            currentUser={currentUser}
            onProjectUpdate={onProjectUpdate}
          />
        );

      case 'music':
        return (
          <CollaborativeMusicEditor
            project={project}
            currentUser={currentUser}
            onProjectUpdate={onProjectUpdate}
          />
        );

      case 'video':
        return (
          <CollaborativeVideoEditor
            project={project}
            currentUser={currentUser}
            onProjectUpdate={onProjectUpdate}
          />
        );

      case 'book':
        return (
          <CollaborativeBookEditor
            project={project}
            currentUser={currentUser}
            onProjectUpdate={onProjectUpdate}
          />
        );

      default:
        // For unknown or mixed project types, use permission-based hybrid interface
        return (
          <HybridCreatorInterface
            project={project}
            currentUser={currentUser}
            permissions={permissions}
            onProjectUpdate={onProjectUpdate}
          />
        );
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {renderEditorByProjectType()}
      <CommentsPanel project={project} currentUser={currentUser} />
    </div>
  );
}

// Helper: render based on project content type (for owner or fallback)
function renderByProjectType(
  project: CollaborativeProject,
  currentUser: { id: number; username: string; display_name?: string },
  onSectionUpdate?: (section: ProjectSection) => void,
  onCommentAdd?: (comment: ProjectComment) => void,
  onProjectUpdate?: (project: CollaborativeProject) => void
) {
  switch (project.content_type) {
    case 'book':
      return (
        <CollaborativeBookEditor
          project={project}
          currentUser={currentUser}
          onProjectUpdate={onProjectUpdate}
        />
      );

    case 'art':
      return (
        <CollaborativeArtEditor
          project={project}
          currentUser={currentUser}
          onProjectUpdate={onProjectUpdate}
        />
      );

    case 'music':
      return (
        <CollaborativeMusicEditor
          project={project}
          currentUser={currentUser}
          onProjectUpdate={onProjectUpdate}
        />
      );

    case 'video':
      return (
        <CollaborativeVideoEditor
          project={project}
          currentUser={currentUser}
          onProjectUpdate={onProjectUpdate}
        />
      );

    case 'comic':
      return (
        <CollaborativeComicEditor
          project={project}
          currentUser={currentUser}
          onProjectUpdate={onProjectUpdate}
        />
      );

    default:
      return (
        <CollaborativeEditor
          project={project}
          currentUser={currentUser}
          onSectionUpdate={onSectionUpdate}
          onCommentAdd={onCommentAdd}
          onProjectUpdate={onProjectUpdate}
        />
      );
  }
}

// Hybrid interface for users with multiple content type permissions
interface HybridCreatorInterfaceProps {
  project: CollaborativeProject;
  currentUser: { id: number; username: string; display_name?: string };
  permissions: ReturnType<typeof getEffectivePermissions>;
  onProjectUpdate?: (project: CollaborativeProject) => void;
}

function HybridCreatorInterface({
  project,
  currentUser,
  permissions,
  onProjectUpdate,
}: HybridCreatorInterfaceProps) {
  const [activeTab, setActiveTab] = React.useState<'text' | 'image' | 'audio' | 'video'>('text');

  const hasText = permissions?.create.includes('text') || permissions?.edit.types?.includes('text');
  const hasImage = permissions?.create.includes('image') || permissions?.edit.types?.includes('image');
  const hasAudio = permissions?.create.includes('audio') || permissions?.edit.types?.includes('audio');
  const hasVideo = permissions?.create.includes('video') || permissions?.edit.types?.includes('video');

  // Set initial active tab based on what's available
  React.useEffect(() => {
    if (hasText) setActiveTab('text');
    else if (hasImage) setActiveTab('image');
    else if (hasAudio) setActiveTab('audio');
    else if (hasVideo) setActiveTab('video');
  }, [hasText, hasImage, hasAudio, hasVideo]);

  const tabs = [
    { key: 'text', label: 'Text', icon: <FileText size={16} />, available: hasText },
    { key: 'image', label: 'Images', icon: <Palette size={16} />, available: hasImage },
    { key: 'audio', label: 'Audio', icon: <Music size={16} />, available: hasAudio },
    { key: 'video', label: 'Video', icon: <Video size={16} />, available: hasVideo },
  ].filter(t => t.available);

  return (
    <div>
      {/* Tab navigation for multiple content types */}
      {tabs.length > 1 && (
        <div style={{
          display: 'flex',
          gap: 8,
          marginBottom: 16,
          borderBottom: '1px solid #334155',
          paddingBottom: 12,
        }}>
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 16px',
                background: activeTab === tab.key ? 'rgba(245,158,11,0.15)' : 'transparent',
                border: `1px solid ${activeTab === tab.key ? '#f59e0b' : '#334155'}`,
                borderRadius: 8,
                color: activeTab === tab.key ? '#f59e0b' : '#94a3b8',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Render appropriate editor based on active tab */}
      {activeTab === 'text' && hasText && (
        <CollaborativeBookEditor
          project={project}
          currentUser={currentUser}
          onProjectUpdate={onProjectUpdate}
        />
      )}
      {activeTab === 'image' && hasImage && (
        <CollaborativeArtEditor
          project={project}
          currentUser={currentUser}
          onProjectUpdate={onProjectUpdate}
        />
      )}
      {activeTab === 'audio' && hasAudio && (
        <CollaborativeMusicEditor
          project={project}
          currentUser={currentUser}
          onProjectUpdate={onProjectUpdate}
        />
      )}
      {activeTab === 'video' && hasVideo && (
        <CollaborativeVideoEditor
          project={project}
          currentUser={currentUser}
          onProjectUpdate={onProjectUpdate}
        />
      )}
    </div>
  );
}
