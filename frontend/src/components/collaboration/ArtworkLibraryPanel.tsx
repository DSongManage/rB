import React, { useState, useEffect, useCallback } from 'react';
import { Image, Upload, Trash2, ChevronDown, ChevronUp, Loader2, User } from 'lucide-react';
import { collaborationApi, ArtworkLibraryItem } from '../../services/collaborationApi';

interface ArtworkLibraryPanelProps {
  projectId: number;
  canEdit: boolean;
  onDragStart: (item: ArtworkLibraryItem, e: React.DragEvent) => void;
  isExpanded?: boolean;
  onToggle?: () => void;
}

export function ArtworkLibraryPanel({
  projectId,
  canEdit,
  onDragStart,
  isExpanded = true,
  onToggle,
}: ArtworkLibraryPanelProps) {
  const [items, setItems] = useState<ArtworkLibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [hoveredItem, setHoveredItem] = useState<number | null>(null);

  // Load artwork library
  const loadArtwork = useCallback(async () => {
    try {
      setLoading(true);
      const data = await collaborationApi.getArtworkLibrary(projectId);
      setItems(data);
      setError('');
    } catch (err: any) {
      setError(err.message || 'Failed to load artwork');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadArtwork();
  }, [loadArtwork]);

  // Handle file upload (supports multiple files)
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const validTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
    const validFiles: File[] = [];
    const errors: string[] = [];

    // Validate all files first
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!validTypes.includes(file.type)) {
        errors.push(`${file.name}: invalid type (use PNG, JPG, WebP, or GIF)`);
      } else if (file.size > 50 * 1024 * 1024) {
        errors.push(`${file.name}: exceeds 50MB limit`);
      } else {
        validFiles.push(file);
      }
    }

    if (errors.length > 0) {
      setError(errors.join('; '));
    }

    if (validFiles.length === 0) return;

    setUploading(true);
    if (errors.length === 0) setError('');

    const uploadedItems: ArtworkLibraryItem[] = [];
    const uploadErrors: string[] = [];

    // Upload files sequentially to avoid overwhelming the server
    for (const file of validFiles) {
      try {
        const newItem = await collaborationApi.uploadArtworkToLibrary(projectId, file);
        uploadedItems.push(newItem);
      } catch (err: any) {
        uploadErrors.push(`${file.name}: ${err.message || 'upload failed'}`);
      }
    }

    // Add all successful uploads to the list
    if (uploadedItems.length > 0) {
      setItems((prev) => [...uploadedItems, ...prev]);
    }

    // Show errors if any uploads failed
    if (uploadErrors.length > 0) {
      setError((prev) => (prev ? prev + '; ' : '') + uploadErrors.join('; '));
    }

    setUploading(false);
    e.target.value = '';
  };

  // Handle delete
  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      await collaborationApi.deleteArtworkFromLibrary(id);
      setItems((prev) => prev.filter((item) => item.id !== id));
    } catch (err: any) {
      setError(err.message || 'Delete failed');
    }
  };

  // Drag start handler
  const handleDragStart = (item: ArtworkLibraryItem, e: React.DragEvent) => {
    e.dataTransfer.setData(
      'application/json',
      JSON.stringify({
        type: 'artwork-library-item',
        artworkId: item.id,
        file_url: item.file_url,
        uploaderId: item.uploader,
      })
    );
    e.dataTransfer.effectAllowed = 'copy';

    // Create ghost image
    const ghost = document.createElement('img');
    ghost.src = item.thumbnail_url;
    ghost.style.width = '80px';
    ghost.style.height = '80px';
    ghost.style.objectFit = 'cover';
    ghost.style.borderRadius = '4px';
    ghost.style.opacity = '0.8';
    ghost.style.position = 'absolute';
    ghost.style.top = '-1000px';
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 40, 40);
    setTimeout(() => ghost.remove(), 0);

    onDragStart(item, e);
  };

  return (
    <div
      style={{
        background: '#0f172a',
        borderRadius: 8,
        border: '1px solid #334155',
        overflow: 'hidden',
        marginBottom: 12,
      }}
    >
      {/* Header */}
      <button
        onClick={onToggle}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 12px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: '#f8fafc',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Image size={14} style={{ color: '#22c55e' }} />
          <span style={{ fontSize: 12, fontWeight: 600 }}>Artwork Library</span>
          <span
            style={{
              fontSize: 10,
              background: '#334155',
              padding: '2px 6px',
              borderRadius: 4,
              color: '#94a3b8',
            }}
          >
            {items.length}
          </span>
        </div>
        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {/* Content */}
      {isExpanded && (
        <div style={{ padding: '0 12px 12px' }}>
          {/* Upload button */}
          {canEdit && (
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                padding: '8px 12px',
                background: '#1e293b',
                border: '1px dashed #475569',
                borderRadius: 6,
                color: '#94a3b8',
                fontSize: 11,
                cursor: uploading ? 'wait' : 'pointer',
                marginBottom: 8,
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                if (!uploading) {
                  e.currentTarget.style.borderColor = '#22c55e';
                  e.currentTarget.style.color = '#22c55e';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#475569';
                e.currentTarget.style.color = '#94a3b8';
              }}
            >
              {uploading ? (
                <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
              ) : (
                <Upload size={12} />
              )}
              {uploading ? 'Uploading...' : 'Add Artwork'}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                multiple
                onChange={handleUpload}
                disabled={uploading}
                style={{ display: 'none' }}
              />
            </label>
          )}

          {/* Error message */}
          {error && (
            <div
              style={{
                fontSize: 10,
                color: '#ef4444',
                marginBottom: 8,
                padding: '4px 8px',
                background: 'rgba(239, 68, 68, 0.1)',
                borderRadius: 4,
              }}
            >
              {error}
            </div>
          )}

          {/* Loading state */}
          {loading && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                padding: 16,
                color: '#64748b',
              }}
            >
              <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
            </div>
          )}

          {/* Thumbnail grid (2 columns) */}
          {!loading && items.length > 0 && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: 6,
                maxHeight: 200,
                overflowY: 'auto',
              }}
            >
              {items.map((item) => (
                <div
                  key={item.id}
                  draggable={canEdit}
                  onDragStart={(e) => handleDragStart(item, e)}
                  onMouseEnter={() => setHoveredItem(item.id)}
                  onMouseLeave={() => setHoveredItem(null)}
                  style={{
                    position: 'relative',
                    aspectRatio: '1',
                    borderRadius: 6,
                    overflow: 'hidden',
                    cursor: canEdit ? 'grab' : 'default',
                    border: '1px solid #334155',
                    background: '#1e293b',
                    transition: 'all 0.15s ease',
                    transform: hoveredItem === item.id ? 'scale(1.02)' : 'scale(1)',
                    boxShadow:
                      hoveredItem === item.id ? '0 4px 12px rgba(0,0,0,0.3)' : 'none',
                  }}
                >
                  <img
                    src={item.thumbnail_url}
                    alt={item.title || item.filename}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      pointerEvents: 'none',
                    }}
                  />

                  {/* Hover overlay */}
                  {hoveredItem === item.id && (
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        background:
                          'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 60%)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'flex-end',
                        padding: 6,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 9,
                          color: '#f8fafc',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {item.title || item.filename}
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          fontSize: 8,
                          color: '#94a3b8',
                        }}
                      >
                        <User size={8} />
                        {item.uploader_username}
                      </div>

                      {/* Delete button */}
                      {canEdit && (
                        <button
                          onClick={(e) => handleDelete(item.id, e)}
                          style={{
                            position: 'absolute',
                            top: 4,
                            right: 4,
                            width: 20,
                            height: 20,
                            borderRadius: 4,
                            background: 'rgba(239, 68, 68, 0.9)',
                            border: 'none',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Trash2 size={10} color="#fff" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Empty state */}
          {!loading && items.length === 0 && (
            <div
              style={{
                textAlign: 'center',
                padding: 16,
                color: '#64748b',
                fontSize: 11,
              }}
            >
              <Image size={24} style={{ marginBottom: 8, opacity: 0.5 }} />
              <p style={{ margin: 0 }}>No artwork yet</p>
              {canEdit && (
                <p style={{ margin: '4px 0 0', fontSize: 10 }}>
                  Upload drawings to share with the team
                </p>
              )}
            </div>
          )}

          {/* Drag hint */}
          {!loading && items.length > 0 && canEdit && (
            <div
              style={{
                marginTop: 8,
                fontSize: 9,
                color: '#64748b',
                textAlign: 'center',
              }}
            >
              Drag artwork onto panels to assign
            </div>
          )}
        </div>
      )}
    </div>
  );
}
