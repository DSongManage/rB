/**
 * ArtPreview Component
 * Preview layout for art content type
 */

import React from 'react';
import { CollaborativeProject } from '../../services/collaborationApi';
import { sanitizeHtml } from '../../utils/sanitize';

interface ArtPreviewProps {
  project: CollaborativeProject;
}

export function ArtPreview({ project }: ArtPreviewProps) {
  const sortedSections = [...(project.sections || [])].sort((a, b) => a.order - b.order);
  const imageSections = sortedSections.filter(s => s.section_type === 'image');
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
        maxWidth: 1000,
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
          background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
          color: '#fff',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 48, marginBottom: 12 }}>🎨</div>
        <h1 style={{ margin: 0, fontSize: 32, fontWeight: 700, marginBottom: 16 }}>
          {project.title}
        </h1>
        <div style={{ fontSize: 18, opacity: 0.9 }}>
          By {collaboratorsList.map(c => `@${c.username}`).join(' & ')}
        </div>
      </div>

      <div style={{ padding: 48 }}>
        {imageSections.map((section) => (
          <div key={section.id} style={{ marginBottom: 40, textAlign: 'center' }}>
            {section.media_file && (
              <img
                src={section.media_file}
                alt={section.title}
                style={{
                  maxWidth: '100%',
                  height: 'auto',
                  borderRadius: 8,
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
                }}
              />
            )}
            {section.title && (
              <h3 style={{ marginTop: 16, color: '#8b5cf6' }}>{section.title}</h3>
            )}
            {section.owner_username && (
              <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 8 }}>
                By @{section.owner_username}
              </div>
            )}
          </div>
        ))}

        {textSections.map((section) => (
          <div key={section.id} style={{ marginTop: 32, color: '#374151' }}>
            {section.title && <h3>{section.title}</h3>}
            {section.content_html && (
              <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(section.content_html) }} />
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
                  background: '#f3e8ff',
                  borderRadius: 8,
                  marginBottom: 8,
                }}
              >
                <span>@{c.username} {c.role && `(${c.role})`}</span>
                <span style={{ fontWeight: 700, color: '#7c3aed' }}>{c.percentage}%</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default ArtPreview;
