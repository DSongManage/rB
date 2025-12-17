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

interface CollaborativeArtEditorProps {
  project: CollaborativeProject;
  currentUser: User;
  onProjectUpdate?: (project: CollaborativeProject) => void;
}

interface ArtPiece {
  id: number;
  title: string;
  media_file: string;
  order: number;
  owner: number;
  owner_username: string;
}

export default function CollaborativeArtEditor({
  project,
  currentUser,
  onProjectUpdate,
}: CollaborativeArtEditorProps) {
  const [artPieces, setArtPieces] = useState<ArtPiece[]>([]);
  const [selectedPieceId, setSelectedPieceId] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const collaborators = project.collaborators || [];
  const currentUserRole = collaborators.find(c => c.user === currentUser.id);
  const canEditImages = currentUserRole?.can_edit?.includes('image') ?? currentUserRole?.can_edit_images ?? false;

  useEffect(() => {
    loadArtPieces();
  }, [project.id]);

  const loadArtPieces = async () => {
    try {
      const sections = await collaborationApi.getProjectSections(project.id);
      const imageSections = sections
        .filter(s => s.section_type === 'image')
        .sort((a, b) => a.order - b.order)
        .map(s => ({
          id: s.id,
          title: s.title,
          media_file: s.media_file || '',
          order: s.order,
          owner: s.owner,
          owner_username: s.owner_username,
        }));
      setArtPieces(imageSections);
      if (imageSections.length > 0 && !selectedPieceId) {
        setSelectedPieceId(imageSections[0].id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load art pieces');
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canEditImages) {
      setError("You don't have permission to upload images");
      return;
    }

    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      setError('Please upload a PNG, JPG, WebP, or GIF image');
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
        section_type: 'image',
        title: file.name.replace(/\.[^/.]+$/, '') || 'Untitled Art',
        order: artPieces.length,
        media_file: file,
      });

      const newPiece: ArtPiece = {
        id: newSection.id,
        title: newSection.title,
        media_file: newSection.media_file || '',
        order: newSection.order,
        owner: newSection.owner,
        owner_username: newSection.owner_username,
      };

      setArtPieces([...artPieces, newPiece]);
      setSelectedPieceId(newPiece.id);
    } catch (err: any) {
      setError(err.message || 'Failed to upload art');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleUpdateTitle = async (pieceId: number, title: string) => {
    try {
      await collaborationApi.updateProjectSection(pieceId, { title });
      setArtPieces(artPieces.map(p =>
        p.id === pieceId ? { ...p, title } : p
      ));
    } catch (err: any) {
      setError(err.message || 'Failed to update title');
    }
  };

  const handleDelete = async (pieceId: number) => {
    if (!confirm('Are you sure you want to delete this art piece?')) return;

    try {
      await collaborationApi.deleteProjectSection(pieceId);
      const remaining = artPieces.filter(p => p.id !== pieceId);
      setArtPieces(remaining);
      if (selectedPieceId === pieceId) {
        setSelectedPieceId(remaining[0]?.id || null);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to delete art piece');
    }
  };

  const selectedPiece = artPieces.find(p => p.id === selectedPieceId);
  const canEditSelectedPiece = selectedPiece && (
    selectedPiece.owner === currentUser.id || canEditImages
  );

  return (
    <div style={{ display: 'flex', gap: 20, height: 'calc(100vh - 300px)', minHeight: 500 }}>
      {/* Gallery Sidebar */}
      <div style={{
        width: 280,
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
            Gallery ({artPieces.length})
          </span>
          {canEditImages && (
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
              {uploading ? 'Uploading...' : '+ Add'}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={handleUpload}
                disabled={uploading}
                style={{ display: 'none' }}
              />
            </label>
          )}
        </div>

        <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {artPieces.length === 0 ? (
            <div style={{
              padding: 24,
              textAlign: 'center',
              color: '#64748b',
              fontSize: 13,
              border: '1px dashed #334155',
              borderRadius: 8,
            }}>
              No art pieces yet.
              {canEditImages && ' Click "+ Add" to upload your first piece.'}
            </div>
          ) : (
            artPieces.map(piece => (
              <div
                key={piece.id}
                onClick={() => setSelectedPieceId(piece.id)}
                style={{
                  background: selectedPieceId === piece.id ? 'rgba(245, 158, 11, 0.15)' : '#0f172a',
                  border: `1px solid ${selectedPieceId === piece.id ? '#f59e0b' : '#334155'}`,
                  borderRadius: 8,
                  padding: 8,
                  cursor: 'pointer',
                  display: 'flex',
                  gap: 10,
                  alignItems: 'center',
                }}
              >
                <div style={{
                  width: 48,
                  height: 48,
                  borderRadius: 6,
                  background: '#334155',
                  backgroundImage: piece.media_file ? `url(${piece.media_file})` : undefined,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  flexShrink: 0,
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    color: selectedPieceId === piece.id ? '#f59e0b' : '#f8fafc',
                    fontSize: 13,
                    fontWeight: 600,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {piece.title}
                  </div>
                  <div style={{ color: '#64748b', fontSize: 11 }}>
                    @{piece.owner_username}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Preview Area */}
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

        {selectedPiece ? (
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
                {canEditSelectedPiece ? (
                  <input
                    type="text"
                    value={selectedPiece.title}
                    onChange={(e) => handleUpdateTitle(selectedPiece.id, e.target.value)}
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
                    {selectedPiece.title}
                  </h2>
                )}
                <div style={{ color: '#64748b', fontSize: 12, marginTop: 4 }}>
                  Uploaded by @{selectedPiece.owner_username}
                </div>
              </div>
              {canEditSelectedPiece && (
                <button
                  onClick={() => handleDelete(selectedPiece.id)}
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

            {/* Image Display */}
            <div style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#0f172a',
              borderRadius: 8,
              overflow: 'hidden',
            }}>
              {selectedPiece.media_file ? (
                <img
                  src={selectedPiece.media_file}
                  alt={selectedPiece.title}
                  style={{
                    maxWidth: '100%',
                    maxHeight: '100%',
                    objectFit: 'contain',
                  }}
                />
              ) : (
                <div style={{ color: '#64748b', fontSize: 14 }}>
                  No image available
                </div>
              )}
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
            {artPieces.length === 0
              ? 'Upload an image to get started'
              : 'Select an art piece to view'}
          </div>
        )}
      </div>
    </div>
  );
}
