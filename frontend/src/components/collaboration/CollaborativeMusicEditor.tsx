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

interface CollaborativeMusicEditorProps {
  project: CollaborativeProject;
  currentUser: User;
  onProjectUpdate?: (project: CollaborativeProject) => void;
}

interface Track {
  id: number;
  title: string;
  media_file: string;
  duration?: number;
  order: number;
  owner: number;
  owner_username: string;
}

export default function CollaborativeMusicEditor({
  project,
  currentUser,
  onProjectUpdate,
}: CollaborativeMusicEditorProps) {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [selectedTrackId, setSelectedTrackId] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const collaborators = project.collaborators || [];
  const currentUserRole = collaborators.find(c => c.user === currentUser.id);
  const canEditAudio = currentUserRole?.can_edit?.includes('audio') ?? currentUserRole?.can_edit_audio ?? false;

  useEffect(() => {
    loadTracks();
  }, [project.id]);

  const loadTracks = async () => {
    try {
      const sections = await collaborationApi.getProjectSections(project.id);
      const audioSections = sections
        .filter(s => s.section_type === 'audio')
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
      setTracks(audioSections);
      if (audioSections.length > 0 && !selectedTrackId) {
        setSelectedTrackId(audioSections[0].id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load tracks');
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canEditAudio) {
      setError("You don't have permission to upload audio");
      return;
    }

    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/m4a', 'audio/aac'];
    if (!validTypes.includes(file.type) && !file.name.match(/\.(mp3|wav|ogg|m4a|aac)$/i)) {
      setError('Please upload an MP3, WAV, OGG, M4A, or AAC audio file');
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
        section_type: 'audio',
        title: file.name.replace(/\.[^/.]+$/, '') || 'Untitled Track',
        order: tracks.length,
        media_file: file,
      });

      const newTrack: Track = {
        id: newSection.id,
        title: newSection.title,
        media_file: newSection.media_file || '',
        duration: undefined,
        order: newSection.order,
        owner: newSection.owner,
        owner_username: newSection.owner_username,
      };

      setTracks([...tracks, newTrack]);
      setSelectedTrackId(newTrack.id);
    } catch (err: any) {
      setError(err.message || 'Failed to upload track');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleUpdateTitle = async (trackId: number, title: string) => {
    try {
      await collaborationApi.updateProjectSection(trackId, { title });
      setTracks(tracks.map(t =>
        t.id === trackId ? { ...t, title } : t
      ));
    } catch (err: any) {
      setError(err.message || 'Failed to update title');
    }
  };

  const handleDelete = async (trackId: number) => {
    if (!confirm('Are you sure you want to delete this track?')) return;

    try {
      await collaborationApi.deleteProjectSection(trackId);
      const remaining = tracks.filter(t => t.id !== trackId);
      setTracks(remaining);
      if (selectedTrackId === trackId) {
        setSelectedTrackId(remaining[0]?.id || null);
        setPlaying(false);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to delete track');
    }
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setPlaying(!playing);
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const selectedTrack = tracks.find(t => t.id === selectedTrackId);
  const canEditSelectedTrack = selectedTrack && (
    selectedTrack.owner === currentUser.id || canEditAudio
  );

  // Reset audio when track changes
  useEffect(() => {
    setPlaying(false);
    setCurrentTime(0);
    setDuration(0);
  }, [selectedTrackId]);

  return (
    <div style={{ display: 'flex', gap: 20, height: 'calc(100vh - 300px)', minHeight: 500 }}>
      {/* Track List Sidebar */}
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
            Tracks ({tracks.length})
          </span>
          {canEditAudio && (
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
              {uploading ? 'Uploading...' : '+ Add Track'}
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac"
                onChange={handleUpload}
                disabled={uploading}
                style={{ display: 'none' }}
              />
            </label>
          )}
        </div>

        <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {tracks.length === 0 ? (
            <div style={{
              padding: 24,
              textAlign: 'center',
              color: '#64748b',
              fontSize: 13,
              border: '1px dashed #334155',
              borderRadius: 8,
            }}>
              No tracks yet.
              {canEditAudio && ' Click "+ Add Track" to upload your first track.'}
            </div>
          ) : (
            tracks.map((track, index) => (
              <div
                key={track.id}
                onClick={() => setSelectedTrackId(track.id)}
                style={{
                  background: selectedTrackId === track.id ? 'rgba(245, 158, 11, 0.15)' : '#0f172a',
                  border: `1px solid ${selectedTrackId === track.id ? '#f59e0b' : '#334155'}`,
                  borderRadius: 8,
                  padding: 12,
                  cursor: 'pointer',
                  display: 'flex',
                  gap: 12,
                  alignItems: 'center',
                }}
              >
                <div style={{
                  width: 32,
                  height: 32,
                  borderRadius: 6,
                  background: selectedTrackId === track.id ? '#f59e0b' : '#334155',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: selectedTrackId === track.id ? '#000' : '#94a3b8',
                  fontSize: 12,
                  fontWeight: 700,
                  flexShrink: 0,
                }}>
                  {index + 1}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    color: selectedTrackId === track.id ? '#f59e0b' : '#f8fafc',
                    fontSize: 13,
                    fontWeight: 600,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {track.title}
                  </div>
                  <div style={{ color: '#64748b', fontSize: 11 }}>
                    @{track.owner_username}
                    {track.duration && ` - ${formatTime(track.duration)}`}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Player Area */}
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

        {selectedTrack ? (
          <>
            {/* Hidden audio element */}
            <audio
              ref={audioRef}
              src={selectedTrack.media_file}
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onEnded={() => setPlaying(false)}
            />

            {/* Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 24,
              paddingBottom: 16,
              borderBottom: '1px solid #334155',
            }}>
              <div style={{ flex: 1 }}>
                {canEditSelectedTrack ? (
                  <input
                    type="text"
                    value={selectedTrack.title}
                    onChange={(e) => handleUpdateTitle(selectedTrack.id, e.target.value)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#f8fafc',
                      fontSize: 24,
                      fontWeight: 700,
                      width: '100%',
                      outline: 'none',
                    }}
                    placeholder="Untitled"
                  />
                ) : (
                  <h2 style={{ color: '#f8fafc', fontSize: 24, fontWeight: 700, margin: 0 }}>
                    {selectedTrack.title}
                  </h2>
                )}
                <div style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>
                  Uploaded by @{selectedTrack.owner_username}
                </div>
              </div>
              {canEditSelectedTrack && (
                <button
                  onClick={() => handleDelete(selectedTrack.id)}
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

            {/* Player UI */}
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 32,
            }}>
              {/* Album Art Placeholder */}
              <div style={{
                width: 200,
                height: 200,
                borderRadius: 12,
                background: 'linear-gradient(135deg, #334155 0%, #1e293b 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 64,
              }}>
                🎵
              </div>

              {/* Play Controls */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 16,
                width: '100%',
                maxWidth: 400,
              }}>
                <button
                  onClick={togglePlay}
                  disabled={!selectedTrack.media_file}
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: '50%',
                    background: selectedTrack.media_file ? '#f59e0b' : '#334155',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: selectedTrack.media_file ? 'pointer' : 'not-allowed',
                    fontSize: 24,
                  }}
                >
                  {playing ? '⏸️' : '▶️'}
                </button>

                {/* Progress Bar */}
                <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12 }}>
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
                  <span style={{ color: '#94a3b8', fontSize: 12, minWidth: 40, textAlign: 'right' }}>
                    {formatTime(duration)}
                  </span>
                </div>
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
            {tracks.length === 0
              ? 'Upload an audio track to get started'
              : 'Select a track to play'}
          </div>
        )}
      </div>
    </div>
  );
}
