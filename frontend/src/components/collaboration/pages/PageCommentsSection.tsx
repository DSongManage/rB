import React from 'react';
import { CollaborativeProject } from '../../../services/collaborationApi';
import { CommentsPanel } from '../CommentsPanel';

interface User {
  id: number;
  username: string;
  display_name?: string;
}

interface PageCommentsSectionProps {
  project: CollaborativeProject;
  currentUser: User;
  comicPageId: number;
}

export default function PageCommentsSection({
  project,
  currentUser,
  comicPageId,
}: PageCommentsSectionProps) {
  return (
    <div style={{ marginBottom: 24 }}>
      <CommentsPanel
        project={project}
        currentUser={currentUser}
        comicPageId={comicPageId}
        defaultExpanded={true}
      />
    </div>
  );
}
