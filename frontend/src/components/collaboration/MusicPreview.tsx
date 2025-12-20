/**
 * MusicPreview Component
 * Preview layout for music content type
 */

import React, { useRef, useState } from 'react';
import { CollaborativeProject } from '../../services/collaborationApi';
import { sanitizeHtml } from '../../utils/sanitize';

interface MusicPreviewProps {
  project: CollaborativeProject;
}

export function MusicPreview({ project }: MusicPreviewProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Sort sections by order
  const sortedSections = [...(project.sections || [])].sort((a, b) => a.order - b.order);

  // Find audio sections
  const audioSections = sortedSections.filter(s => s.section_type === 'audio');
  const textSections = sortedSections.filter(s => s.section_type === 'text');

  // Get collaborators list
  const collaboratorsList = project.collaborators
    ?.filter(c => c.status === 'accepted')
    .map(c => ({
      username: c.username,
      role: c.role,
      percentage: c.revenue_percentage,
    })) || [];

  // Audio player controls
  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div
      style={{
        maxWidth: 700,
        margin: '0 auto',
        background: '#fff',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
        borderRadius: 12,
        overflow: 'hidden',
      }}
    >
      {/* Music header */}
      <div
        style={{
          padding: 48,
          background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
          color: '#fff',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 48, marginBottom: 12 }}>🎵</div>
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
        <div style={{ fontSize: 18, opacity: 0.9 }}>
          By {collaboratorsList.map(c => `@${c.username}`).join(' & ')}
        </div>
        {project.description && (
          <div
            style={{
              marginTop: 16,
              fontSize: 14,
              opacity: 0.8,
              maxWidth: 500,
              margin: '16px auto 0',
            }}
          >
            {project.description}
          </div>
        )}
      </div>

      {/* Audio player */}
      {audioSections.length > 0 && audioSections[0].media_file && (
        <div
          style={{
            padding: 32,
            background: '#fafafa',
            borderBottom: '1px solid #e5e7eb',
          }}
        >
          <audio
            ref={audioRef}
            src={audioSections[0].media_file}
            onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
            onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
            onEnded={() => setIsPlaying(false)}
          />

          {/* Play/pause button */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
            }}
          >
            <button
              onClick={togglePlay}
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                border: 'none',
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                color: '#fff',
                cursor: 'pointer',
                fontSize: 24,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              {isPlaying ? '⏸️' : '▶️'}
            </button>

            {/* Progress bar */}
            <div style={{ flex: 1 }}>
              <input
                type="range"
                min="0"
                max={duration || 0}
                value={currentTime}
                onChange={(e) => {
                  const time = parseFloat(e.target.value);
                  setCurrentTime(time);
                  if (audioRef.current) {
                    audioRef.current.currentTime = time;
                  }
                }}
                style={{
                  width: '100%',
                  height: 6,
                  borderRadius: 3,
                  outline: 'none',
                  background: `linear-gradient(to right, #f59e0b 0%, #f59e0b ${(currentTime / duration) * 100}%, #e5e7eb ${(currentTime / duration) * 100}%, #e5e7eb 100%)`,
                }}
              />
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginTop: 8,
                  fontSize: 12,
                  color: '#6b7280',
                }}
              >
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lyrics/text content */}
      <div style={{ padding: 48, color: '#1f2937' }}>
        {textSections.length > 0 ? (
          <>
            <h3
              style={{
                fontSize: 20,
                fontWeight: 700,
                marginBottom: 24,
                color: '#111827',
              }}
            >
              Lyrics
            </h3>
            {textSections.map((section, index) => (
              <div
                key={section.id}
                style={{
                  marginBottom: index < textSections.length - 1 ? 32 : 0,
                }}
              >
                {section.title && (
                  <h4
                    style={{
                      fontSize: 16,
                      fontWeight: 700,
                      marginBottom: 12,
                      color: '#f59e0b',
                    }}
                  >
                    {section.title}
                  </h4>
                )}
                {section.content_html && (
                  <div
                    style={{
                      fontSize: 15,
                      lineHeight: 1.8,
                      color: '#374151',
                      whiteSpace: 'pre-wrap',
                    }}
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(section.content_html) }}
                  />
                )}
              </div>
            ))}
          </>
        ) : (
          <div
            style={{
              padding: 40,
              textAlign: 'center',
              color: '#9ca3af',
            }}
          >
            <div style={{ fontSize: 48, marginBottom: 12 }}>🎼</div>
            <div style={{ fontSize: 16 }}>No lyrics yet</div>
          </div>
        )}

        {/* Revenue split */}
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
                    background: '#fef3c7',
                    borderRadius: 8,
                  }}
                >
                  <div>
                    <span style={{ fontWeight: 600, color: '#111827' }}>
                      @{collab.username}
                    </span>
                    {collab.role && (
                      <span style={{ marginLeft: 8, color: '#92400e' }}>
                        ({collab.role})
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: 18,
                      fontWeight: 700,
                      color: '#d97706',
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

export default MusicPreview;
