/**
 * ActivityTab Component
 * Shows a unified timeline of task deadlines and project activities
 */

import React, { useMemo } from 'react';
import { Activity as ActivityIcon } from 'lucide-react';
import { CollaborativeProject } from '../../../services/collaborationApi';
import { useActivity } from '../../../hooks/useActivity';
import { UnifiedTimeline } from '../timeline';
import { mergeTasksAndActivities } from '../../../utils/timelineUtils';

interface User {
  id: number;
  username: string;
  display_name?: string;
}

interface ActivityTabProps {
  project: CollaborativeProject;
  currentUser: User;
}

export default function ActivityTab({
  project,
  currentUser,
}: ActivityTabProps) {
  // Activity tracking
  const {
    activities,
    onlineUsers,
    isPolling,
  } = useActivity({
    projectId: project.id,
    autoStart: true,
  });

  // Merge tasks and activities into unified timeline
  const timelineItems = useMemo(() => {
    const collaborators = project.collaborators || [];
    return mergeTasksAndActivities(collaborators, activities);
  }, [project.collaborators, activities]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ActivityIcon size={20} style={{ color: '#8b5cf6' }} />
          <h2 style={{ margin: 0, color: 'var(--text)', fontSize: 20, fontWeight: 600 }}>
            Project Timeline
          </h2>
        </div>

        {/* Online Status */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 14px',
            background: 'var(--panel)',
            border: '1px solid var(--panel-border)',
            borderRadius: 8,
          }}
        >
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: isPolling ? '#10b981' : '#64748b',
              boxShadow: isPolling ? '0 0 6px rgba(16, 185, 129, 0.5)' : 'none',
            }}
          />
          <span style={{ fontSize: 13, color: '#94a3b8' }}>
            {onlineUsers.length} collaborator{onlineUsers.length !== 1 ? 's' : ''} online
          </span>
        </div>
      </div>

      {/* Online users list (if any) */}
      {onlineUsers.length > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '12px 16px',
            background: 'var(--panel)',
            border: '1px solid var(--panel-border)',
            borderRadius: 10,
          }}
        >
          <span style={{ fontSize: 12, color: '#64748b', marginRight: 8 }}>Online now:</span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {onlineUsers.map((user) => (
              <div
                key={user.user_id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 10px',
                  background: 'rgba(16, 185, 129, 0.1)',
                  borderRadius: 20,
                }}
              >
                <div
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: '#10b981',
                  }}
                />
                <span style={{ fontSize: 12, color: '#10b981', fontWeight: 500 }}>
                  @{user.username}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Unified Timeline */}
      <UnifiedTimeline items={timelineItems} />
    </div>
  );
}
