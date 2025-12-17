import React, { useState, useEffect, useRef } from 'react';
import {
  CollaborativeProject,
  ProjectSection,
  collaborationApi,
} from '../../services/collaborationApi';

interface User {
  id: number;
  username: string;
  display_name?: string;
}

interface CollaborativeVideoEditorProps {
  project: CollaborativeProject;
  currentUser: User;
  onProjectUpdate?: (project: CollaborativeProject) => void;
}

interface VideoClip {
  id: number;
  title: string;
  media_file: string;
  duration?: number;
  order: number;
  owner: number;
  owner_username: string;
}

export default function CollaborativeVideoEditor({
  project,
  currentUser,
  onProjectUpdate,
}: CollaborativeVideoEditorProps) {
  const [clips, setClips] = useState<VideoClip[]>([]);
  const [selectedClipId, setSelectedClipId] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const collaborators = project.collaborators || [];
  const currentUserRole = collaborators.find(c => c.user === currentUser.id);
  const canEditVideo = currentUserRole?.can_edit?.includes('video') ?? currentUserRole?.can_edit_video ?? false;

  useEffect(() => {
    loadClips();
  }, [project.id]);

  const loadClips = async () => {
    try {
      const sections = await collaborationApi.getProjectSections(project.id);
      const videoSections = sections
        .filter(s => s.section_type === 'video')
        .sort((a, b) => a.order - b.order)
        .map(s => ({
          id: s.id,
          title: s.title,
          media_file: s.media_file || '',
          duration: undefined, // TODO: Parse duration from file if needed
          order: s.order,
          owner: s.owner,
          owner_username: s.owner_username,
        }));
      setClips(videoSections);
      if (videoSections.length > 0 && !selectedClipId) {
        setSelectedClipId(videoSections[0].id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load video clips');
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canEditVideo) {
      setError("You don't have permission to upload videos");
      return;
    }

    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-msvideo'];
    if (!validTypes.includes(file.type) && !file.name.match(/\.(mp4|mov|webm|avi)$/i)) {
      setError('Please upload an MP4, MOV, WebM, or AVI video file');
      return;
    }

    // Validate file size (50MB max)
    if (file.size > 50 * 1024 * 1024) {
      setError('File size must be under 50MB');
      return;
    }

    setUploading(true);
    setError('');

    try {
      const newSection = await collaborationApi.createProjectSection({
        project: project.id,
        section_type: 'video',
        title: file.name.replace(/\.[^/.]+$/, '') || 'Untitled Clip',
        order: clips.length,
        media_file: file,
      });

      const newClip: VideoClip = {
        id: newSection.id,
        title: newSection.title,
        media_file: newSection.media_file || '',
        duration: undefined,
        order: newSection.order,
        owner: newSection.owner,
        owner_username: newSection.owner_username,
      };

      setClips([...clips, newClip]);
      setSelectedClipId(newClip.id);
    } catch (err: any) {
      setError(err.message || 'Failed to upload video');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleUpdateTitle = async (clipId: number, title: string) => {
    try {
      await collaborationApi.updateProjectSection(clipId, { title });
      setClips(clips.map(c =>
        c.id === clipId ? { ...c, title } : c
      ));
    } catch (err: any) {
      setError(err.message || 'Failed to update title');
    }
  };

  const handleDelete = async (clipId: number) => {
    if (!confirm('Are you sure you want to delete this video clip?')) return;

    try {
      await collaborationApi.deleteProjectSection(clipId);
      const remaining = clips.filter(c => c.id !== clipId);
      setClips(remaining);
      if (selectedClipId === clipId) {
        setSelectedClipId(remaining[0]?.id || null);
        setPlaying(false);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to delete video clip');
    }
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (playing) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setPlaying(!playing);
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const toggleFullscreen = () => {
    if (videoRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        videoRef.current.requestFullscreen();
      }
    }
  };

  const selectedClip = clips.find(c => c.id === selectedClipId);
  const canEditSelectedClip = selectedClip && (
    selectedClip.owner === currentUser.id || canEditVideo
  );

  // Reset video when clip changes
  useEffect(() => {
    setPlaying(false);
    setCurrentTime(0);
    setDuration(0);
  }, [selectedClipId]);

  return (
    <div style={{ display: 'flex', gap: 20, height: 'calc(100vh - 300px)', minHeight: 500 }}>
      {/* Clip List Sidebar */}
      <div style={{
        width: 320,
        background: '#1e293b',
        borderRadius: 12,
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        overflow: 'hidden',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#f8fafc', fontWeight: 600, fontSize: 14 }}>
            Video Clips ({clips.length})
          </span>
          {canEditVideo && (
            <label style={{
              background: '#f59e0b',
              color: '#000',
              padding: '6px 12px',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
              cursor: uploading ? 'not-allowed' : 'pointer',
              opacity: uploading ? 0.5 : 1,
            }}>
              {uploading ? 'Uploading...' : '+ Add Clip'}
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*,.mp4,.mov,.webm,.avi"
                onChange={handleUpload}
                disabled={uploading}
                style={{ display: 'none' }}
              />
            </label>
          )}
        </div>

        <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {clips.length === 0 ? (
            <div style={{
              padding: 24,
              textAlign: 'center',
              color: '#64748b',
              fontSize: 13,
              border: '1px dashed #334155',
              borderRadius: 8,
            }}>
              No video clips yet.
              {canEditVideo && ' Click "+ Add Clip" to upload your first video.'}
            </div>
          ) : (
            clips.map((clip, index) => (
              <div
                key={clip.id}
                onClick={() => setSelectedClipId(clip.id)}
                style={{
                  background: selectedClipId === clip.id ? 'rgba(245, 158, 11, 0.15)' : '#0f172a',
                  border: `1px solid ${selectedClipId === clip.id ? '#f59e0b' : '#334155'}`,
                  borderRadius: 8,
                  padding: 8,
                  cursor: 'pointer',
                  display: 'flex',
                  gap: 10,
                  alignItems: 'center',
                }}
              >
                <div style={{
                  width: 64,
                  height: 36,
                  borderRadius: 4,
                  background: '#334155',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <span style={{ fontSize: 16 }}>🎬</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    color: selectedClipId === clip.id ? '#f59e0b' : '#f8fafc',
                    fontSize: 13,
                    fontWeight: 600,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {clip.title}
                  </div>
                  <div style={{ color: '#64748b', fontSize: 11 }}>
                    @{clip.owner_username}
                    {clip.duration && ` - ${formatTime(clip.duration)}`}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Video Player Area */}
      <div style={{
        flex: 1,
        background: '#1e293b',
        borderRadius: 12,
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid #ef4444',
            color: '#ef4444',
            padding: 12,
            borderRadius: 8,
            marginBottom: 16,
            fontSize: 13,
          }}>
            {error}
          </div>
        )}

        {selectedClip ? (
          <>
            {/* Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 16,
              paddingBottom: 16,
              borderBottom: '1px solid #334155',
            }}>
              <div style={{ flex: 1 }}>
                {canEditSelectedClip ? (
                  <input
                    type="text"
                    value={selectedClip.title}
                    onChange={(e) => handleUpdateTitle(selectedClip.id, e.target.value)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#f8fafc',
                      fontSize: 18,
                      fontWeight: 600,
                      width: '100%',
                      outline: 'none',
                    }}
                    placeholder="Untitled"
                  />
                ) : (
                  <h2 style={{ color: '#f8fafc', fontSize: 18, fontWeight: 600, margin: 0 }}>
                    {selectedClip.title}
                  </h2>
                )}
                <div style={{ color: '#64748b', fontSize: 12, marginTop: 4 }}>
                  Uploaded by @{selectedClip.owner_username}
                </div>
              </div>
              {canEditSelectedClip && (
                <button
                  onClick={() => handleDelete(selectedClip.id)}
                  style={{
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid #ef4444',
                    color: '#ef4444',
                    padding: '8px 16px',
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Delete
                </button>
              )}
            </div>

            {/* Video Player */}
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}>
              <div style={{
                flex: 1,
                background: '#0f172a',
                borderRadius: 8,
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
              }}>
                {selectedClip.media_file ? (
                  <video
                    ref={videoRef}
                    src={selectedClip.media_file}
                    onTimeUpdate={handleTimeUpdate}
                    onLoadedMetadata={handleLoadedMetadata}
                    onEnded={() => setPlaying(false)}
                    onClick={togglePlay}
                    style={{
                      maxWidth: '100%',
                      maxHeight: '100%',
                      cursor: 'pointer',
                    }}
                  />
                ) : (
                  <div style={{ color: '#64748b', fontSize: 14 }}>
                    No video available
                  </div>
                )}
              </div>

              {/* Controls */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                padding: '12px 16px',
                background: '#0f172a',
                borderRadius: 8,
              }}>
                <button
                  onClick={togglePlay}
                  disabled={!selectedClip.media_file}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    background: selectedClip.media_file ? '#f59e0b' : '#334155',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: selectedClip.media_file ? 'pointer' : 'not-allowed',
                    fontSize: 16,
                  }}
                >
                  {playing ? '⏸️' : '▶️'}
                </button>

                <span style={{ color: '#94a3b8', fontSize: 12, minWidth: 40 }}>
                  {formatTime(currentTime)}
                </span>

                <input
                  type="range"
                  min={0}
                  max={duration || 100}
                  value={currentTime}
                  onChange={handleSeek}
                  style={{
                    flex: 1,
                    accentColor: '#f59e0b',
                  }}
                />

                <span style={{ color: '#94a3b8', fontSize: 12, minWidth: 40 }}>
                  {formatTime(duration)}
                </span>

                <button
                  onClick={toggleFullscreen}
                  disabled={!selectedClip.media_file}
                  style={{
                    background: 'transparent',
                    border: '1px solid #334155',
                    color: '#94a3b8',
                    padding: '8px 12px',
                    borderRadius: 6,
                    cursor: selectedClip.media_file ? 'pointer' : 'not-allowed',
                    fontSize: 12,
                  }}
                >
                  Fullscreen
                </button>
              </div>
            </div>
          </>
        ) : (
          <div style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#64748b',
            fontSize: 14,
          }}>
            {clips.length === 0
              ? 'Upload a video clip to get started'
              : 'Select a clip to play'}
          </div>
        )}
      </div>
    </div>
  );
}
