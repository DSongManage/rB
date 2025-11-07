/**
 * PreviewExport Component
 * Export and sharing functionality for collaborative project previews
 */

import React, { useState } from 'react';
import { CollaborativeProject } from '../../services/collaborationApi';

interface PreviewExportProps {
  project: CollaborativeProject;
}

export function PreviewExport({ project }: PreviewExportProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [shareUrl, setShareUrl] = useState<string>('');
  const [showShareModal, setShowShareModal] = useState(false);

  // Generate preview URL for sharing
  const handleGenerateShareLink = async () => {
    try {
      setIsGenerating(true);
      // TODO: API call to generate shareable preview link
      const url = `${window.location.origin}/preview/${project.id}`;
      setShareUrl(url);
      setShowShareModal(true);
    } catch (error) {
      console.error('Failed to generate share link:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  // Copy share link to clipboard
  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    alert('Link copied to clipboard!');
  };

  // Export as PDF (for books/text)
  const handleExportPDF = async () => {
    try {
      setIsGenerating(true);
      // TODO: API call to generate PDF
      alert('PDF export coming soon!');
    } catch (error) {
      console.error('Failed to export PDF:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  // Download audio file (for music)
  const handleDownloadAudio = () => {
    const audioSection = project.sections?.find(s => s.section_type === 'audio');
    if (audioSection?.media_file) {
      window.open(audioSection.media_file, '_blank');
    }
  };

  // Download video file (for video)
  const handleDownloadVideo = () => {
    const videoSection = project.sections?.find(s => s.section_type === 'video');
    if (videoSection?.media_file) {
      window.open(videoSection.media_file, '_blank');
    }
  };

  // Download image (for art)
  const handleDownloadImage = () => {
    const imageSection = project.sections?.find(s => s.section_type === 'image');
    if (imageSection?.media_file) {
      window.open(imageSection.media_file, '_blank');
    }
  };

  return (
    <div>
      <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 16 }}>
        Export & Share
      </h3>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 12,
        }}
      >
        {/* Share preview link */}
        <button
          onClick={handleGenerateShareLink}
          disabled={isGenerating}
          style={{
            padding: '12px 16px',
            background: 'var(--panel)',
            border: '1px solid var(--panel-border)',
            borderRadius: 8,
            color: 'var(--text)',
            cursor: isGenerating ? 'not-allowed' : 'pointer',
            fontSize: 14,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            if (!isGenerating) {
              e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)';
              e.currentTarget.style.borderColor = '#3b82f6';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--panel)';
            e.currentTarget.style.borderColor = 'var(--panel-border)';
          }}
        >
          <span style={{ fontSize: 18 }}>🔗</span>
          Share Preview
        </button>

        {/* Export options based on content type */}
        {project.content_type === 'book' && (
          <button
            onClick={handleExportPDF}
            disabled={isGenerating}
            style={{
              padding: '12px 16px',
              background: 'var(--panel)',
              border: '1px solid var(--panel-border)',
              borderRadius: 8,
              color: 'var(--text)',
              cursor: isGenerating ? 'not-allowed' : 'pointer',
              fontSize: 14,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              if (!isGenerating) {
                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                e.currentTarget.style.borderColor = '#ef4444';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--panel)';
              e.currentTarget.style.borderColor = 'var(--panel-border)';
            }}
          >
            <span style={{ fontSize: 18 }}>📄</span>
            Export PDF
          </button>
        )}

        {project.content_type === 'music' && (
          <button
            onClick={handleDownloadAudio}
            style={{
              padding: '12px 16px',
              background: 'var(--panel)',
              border: '1px solid var(--panel-border)',
              borderRadius: 8,
              color: 'var(--text)',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(245, 158, 11, 0.1)';
              e.currentTarget.style.borderColor = '#f59e0b';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--panel)';
              e.currentTarget.style.borderColor = 'var(--panel-border)';
            }}
          >
            <span style={{ fontSize: 18 }}>🎵</span>
            Download Audio
          </button>
        )}

        {project.content_type === 'video' && (
          <button
            onClick={handleDownloadVideo}
            style={{
              padding: '12px 16px',
              background: 'var(--panel)',
              border: '1px solid var(--panel-border)',
              borderRadius: 8,
              color: 'var(--text)',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
              e.currentTarget.style.borderColor = '#ef4444';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--panel)';
              e.currentTarget.style.borderColor = 'var(--panel-border)';
            }}
          >
            <span style={{ fontSize: 18 }}>🎬</span>
            Download Video
          </button>
        )}

        {project.content_type === 'art' && (
          <button
            onClick={handleDownloadImage}
            style={{
              padding: '12px 16px',
              background: 'var(--panel)',
              border: '1px solid var(--panel-border)',
              borderRadius: 8,
              color: 'var(--text)',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(139, 92, 246, 0.1)';
              e.currentTarget.style.borderColor = '#8b5cf6';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--panel)';
              e.currentTarget.style.borderColor = 'var(--panel-border)';
            }}
          >
            <span style={{ fontSize: 18 }}>🎨</span>
            Download Art
          </button>
        )}
      </div>

      {/* Share modal */}
      {showShareModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
          onClick={() => setShowShareModal(false)}
        >
          <div
            style={{
              background: 'var(--panel)',
              border: '1px solid var(--panel-border)',
              borderRadius: 12,
              padding: 24,
              maxWidth: 500,
              width: '90%',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: 0, marginBottom: 16, fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>
              Share Preview Link
            </h3>

            <p style={{ margin: 0, marginBottom: 16, fontSize: 14, color: '#94a3b8' }}>
              Share this private preview link with others. They'll be able to view the project without editing access.
            </p>

            <div
              style={{
                display: 'flex',
                gap: 8,
                marginBottom: 16,
              }}
            >
              <input
                type="text"
                value={shareUrl}
                readOnly
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  background: 'var(--bg)',
                  border: '1px solid var(--panel-border)',
                  borderRadius: 8,
                  color: 'var(--text)',
                  fontSize: 13,
                  outline: 'none',
                }}
              />
              <button
                onClick={handleCopyLink}
                style={{
                  padding: '10px 20px',
                  background: '#3b82f6',
                  border: 'none',
                  borderRadius: 8,
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Copy
              </button>
            </div>

            <button
              onClick={() => setShowShareModal(false)}
              style={{
                width: '100%',
                padding: '10px',
                background: 'transparent',
                border: '1px solid var(--panel-border)',
                borderRadius: 8,
                color: 'var(--text)',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default PreviewExport;
