import React from 'react';
import {
  CollaborativeProject,
  ProjectSection,
  ProjectComment,
} from '../../../services/collaborationApi';
import CollaborativeEditor from '../CollaborativeEditor';
import CollaborativeBookEditor from '../CollaborativeBookEditor';

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
  // For book projects, use the CollaborativeBookEditor
  if (project.content_type === 'book') {
    return (
      <CollaborativeBookEditor
        project={project}
        currentUser={currentUser}
        onProjectUpdate={onProjectUpdate}
      />
    );
  }

  // For other content types, use the standard section-based editor
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
