import React from 'react';
import {
  CollaborativeProject,
  ProjectSection,
  ProjectComment,
} from '../../../services/collaborationApi';
import CollaborativeEditor from '../CollaborativeEditor';
import CollaborativeBookEditor from '../CollaborativeBookEditor';
import CollaborativeArtEditor from '../CollaborativeArtEditor';
import CollaborativeMusicEditor from '../CollaborativeMusicEditor';
import CollaborativeVideoEditor from '../CollaborativeVideoEditor';

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

export default function ContentTab({
  project,
  currentUser,
  onSectionUpdate,
  onCommentAdd,
  onProjectUpdate,
}: ContentTabProps) {
  // Route to the appropriate editor based on project content type
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

    default:
      // Fallback to generic section-based editor for unknown types
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
