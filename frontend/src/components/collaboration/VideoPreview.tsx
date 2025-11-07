/**
 * VideoPreview Component
 * Preview layout for video content type
 */

import React from 'react';
import { CollaborativeProject } from '../../services/collaborationApi';

interface VideoPreviewProps {
  project: CollaborativeProject;
}

export function VideoPreview({ project }: VideoPreviewProps) {
  const sortedSections = [...(project.sections || [])].sort((a, b) => a.order - b.order);
  const videoSections = sortedSections.filter(s => s.section_type === 'video');
  const textSections = sortedSections.filter(s => s.section_type === 'text');

  const collaboratorsList = project.collaborators
    ?.filter(c => c.status === 'accepted')
    .map(c => ({
      username: c.username,
      role: c.role,
      percentage: c.revenue_percentage,
    })) || [];

  return (
    <div
      style={{
        maxWidth: 900,
        margin: '0 auto',
        background: '#fff',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
        borderRadius: 12,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: 48,
          background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
          color: '#fff',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 48, marginBottom: 12 }}>🎬</div>
        <h1 style={{ margin: 0, fontSize: 32, fontWeight: 700, marginBottom: 16 }}>
          {project.title}
        </h1>
        <div style={{ fontSize: 18, opacity: 0.9 }}>
          By {collaboratorsList.map(c => `@${c.username}`).join(' & ')}
        </div>
      </div>

      {videoSections.length > 0 && videoSections[0].media_file && (
        <div style={{ padding: 0, background: '#000' }}>
          <video
            controls
            style={{ width: '100%', display: 'block' }}
            src={videoSections[0].media_file}
          />
        </div>
      )}

      <div style={{ padding: 48, color: '#1f2937' }}>
        {textSections.map((section) => (
          <div key={section.id} style={{ marginBottom: 24 }}>
            {section.title && <h3 style={{ marginBottom: 12 }}>{section.title}</h3>}
            {section.content_html && (
              <div dangerouslySetInnerHTML={{ __html: section.content_html }} />
            )}
          </div>
        ))}

        {collaboratorsList.length > 0 && (
          <div style={{ marginTop: 48, paddingTop: 24, borderTop: '2px solid #e5e7eb' }}>
            <h3 style={{ marginBottom: 16 }}>Revenue Split</h3>
            {collaboratorsList.map((c) => (
              <div
                key={c.username}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: 12,
                  background: '#fee2e2',
                  borderRadius: 8,
                  marginBottom: 8,
                }}
              >
                <span>@{c.username} {c.role && `(${c.role})`}</span>
                <span style={{ fontWeight: 700, color: '#dc2626' }}>{c.percentage}%</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default VideoPreview;
