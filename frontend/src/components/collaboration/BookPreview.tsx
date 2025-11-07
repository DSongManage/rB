/**
 * BookPreview Component
 * Preview layout for book content type
 */

import React from 'react';
import { CollaborativeProject } from '../../services/collaborationApi';

interface BookPreviewProps {
  project: CollaborativeProject;
}

export function BookPreview({ project }: BookPreviewProps) {
  // Sort sections by order
  const sortedSections = [...(project.sections || [])].sort((a, b) => a.order - b.order);

  // Get collaborators list
  const collaboratorsList = project.collaborators
    ?.filter(c => c.status === 'accepted')
    .map(c => ({
      username: c.username,
      role: c.role,
      percentage: c.revenue_percentage,
    })) || [];

  // Strip HTML tags for plain text preview
  const stripHtml = (html: string): string => {
    const tmp = document.createElement('DIV');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  };

  return (
    <div
      style={{
        maxWidth: 800,
        margin: '0 auto',
        background: '#fff',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
        borderRadius: 12,
        overflow: 'hidden',
      }}
    >
      {/* Book cover / header */}
      <div
        style={{
          padding: 48,
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: '#fff',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 48, marginBottom: 12 }}>📖</div>
        <h1
          style={{
            margin: 0,
            fontSize: 32,
            fontWeight: 700,
            marginBottom: 16,
          }}
        >
          {project.title}
        </h1>
        <div
          style={{
            fontSize: 18,
            opacity: 0.9,
          }}
        >
          By {collaboratorsList.map(c => `@${c.username}`).join(' & ')}
        </div>
        {project.description && (
          <div
            style={{
              marginTop: 16,
              fontSize: 14,
              opacity: 0.8,
              maxWidth: 600,
              margin: '16px auto 0',
            }}
          >
            {project.description}
          </div>
        )}
      </div>

      {/* Book content */}
      <div
        style={{
          padding: 48,
          color: '#1f2937',
        }}
      >
        {sortedSections.length === 0 ? (
          <div
            style={{
              padding: 40,
              textAlign: 'center',
              color: '#9ca3af',
            }}
          >
            <div style={{ fontSize: 48, marginBottom: 12 }}>📄</div>
            <div style={{ fontSize: 16 }}>No content yet</div>
            <div style={{ fontSize: 14, marginTop: 8 }}>
              Add sections to see the preview
            </div>
          </div>
        ) : (
          sortedSections.map((section, index) => (
            <div
              key={section.id}
              style={{
                marginBottom: index < sortedSections.length - 1 ? 48 : 0,
              }}
            >
              {/* Section header */}
              {section.title && (
                <h2
                  style={{
                    fontSize: 24,
                    fontWeight: 700,
                    marginBottom: 16,
                    color: '#111827',
                  }}
                >
                  {section.title}
                </h2>
              )}

              {/* Text section */}
              {section.section_type === 'text' && section.content_html && (
                <div
                  style={{
                    fontSize: 16,
                    lineHeight: 1.8,
                    color: '#374151',
                  }}
                  dangerouslySetInnerHTML={{ __html: section.content_html }}
                />
              )}

              {/* Image section */}
              {section.section_type === 'image' && section.media_file && (
                <div
                  style={{
                    textAlign: 'center',
                    marginTop: 24,
                    marginBottom: 24,
                  }}
                >
                  <img
                    src={section.media_file}
                    alt={section.title}
                    style={{
                      maxWidth: '100%',
                      height: 'auto',
                      borderRadius: 8,
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                    }}
                  />
                  {section.title && (
                    <div
                      style={{
                        marginTop: 12,
                        fontSize: 14,
                        color: '#6b7280',
                        fontStyle: 'italic',
                      }}
                    >
                      {section.title}
                    </div>
                  )}
                </div>
              )}

              {/* Section attribution */}
              <div
                style={{
                  marginTop: 12,
                  fontSize: 12,
                  color: '#9ca3af',
                  fontStyle: 'italic',
                }}
              >
                By @{section.owner_username}
              </div>
            </div>
          ))
        )}

        {/* Revenue split section */}
        {collaboratorsList.length > 0 && (
          <div
            style={{
              marginTop: 48,
              paddingTop: 24,
              borderTop: '2px solid #e5e7eb',
            }}
          >
            <h3
              style={{
                fontSize: 18,
                fontWeight: 700,
                marginBottom: 16,
                color: '#111827',
              }}
            >
              Revenue Split
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {collaboratorsList.map((collab) => (
                <div
                  key={collab.username}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: 12,
                    background: '#f9fafb',
                    borderRadius: 8,
                  }}
                >
                  <div>
                    <span style={{ fontWeight: 600, color: '#111827' }}>
                      @{collab.username}
                    </span>
                    {collab.role && (
                      <span style={{ marginLeft: 8, color: '#6b7280' }}>
                        ({collab.role})
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: 18,
                      fontWeight: 700,
                      color: '#059669',
                    }}
                  >
                    {collab.percentage}%
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default BookPreview;
