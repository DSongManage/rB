import React, { useState, useRef } from 'react';
import { Upload, X, ImageIcon, Edit3, Check } from 'lucide-react';
import {
  PageReferenceImage,
  collaborationApi,
} from '../../../services/collaborationApi';

interface ReferenceImagesSectionProps {
  pageId: number;
  referenceImages: PageReferenceImage[];
  canEdit: boolean;
  onImagesChange: (images: PageReferenceImage[]) => void;
}

export default function ReferenceImagesSection({
  pageId,
  referenceImages,
  canEdit,
  onImagesChange,
}: ReferenceImagesSectionProps) {
  const [uploading, setUploading] = useState(false);
  const [editingCaption, setEditingCaption] = useState<number | null>(null);
  const [captionText, setCaptionText] = useState('');
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (files: FileList) => {
    setUploading(true);
    try {
      const newImages: PageReferenceImage[] = [];
      for (let i = 0; i < files.length; i++) {
        const img = await collaborationApi.uploadPageReferenceImage(pageId, files[i]);
        newImages.push(img);
      }
      onImagesChange([...referenceImages, ...newImages]);
    } catch (err) {
      console.error('Failed to upload reference image:', err);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await collaborationApi.deletePageReferenceImage(id);
      onImagesChange(referenceImages.filter(img => img.id !== id));
    } catch (err) {
      console.error('Failed to delete reference image:', err);
    }
  };

  const handleSaveCaption = async (id: number) => {
    try {
      const updated = await collaborationApi.updatePageReferenceImage(id, { caption: captionText });
      onImagesChange(referenceImages.map(img => img.id === id ? updated : img));
      setEditingCaption(null);
    } catch (err) {
      console.error('Failed to update caption:', err);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (!canEdit || !e.dataTransfer.files.length) return;
    handleUpload(e.dataTransfer.files);
  };

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
      }}>
        <label style={{
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--text-muted)',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}>
          <ImageIcon size={14} />
          Reference Images ({referenceImages.length})
        </label>
      </div>

      {/* Image grid */}
      {referenceImages.length > 0 && (
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 12,
        }}>
          {referenceImages.map(img => (
            <div
              key={img.id}
              style={{
                position: 'relative',
                width: 140,
                borderRadius: 8,
                overflow: 'hidden',
                background: 'var(--bg)',
                border: '1px solid var(--panel-border)',
              }}
            >
              <img
                src={img.file}
                alt={img.caption || 'Reference'}
                onClick={() => setLightboxImage(img.file)}
                style={{
                  width: '100%',
                  height: 100,
                  objectFit: 'cover',
                  cursor: 'pointer',
                  display: 'block',
                }}
              />
              {/* Caption */}
              <div style={{ padding: '6px 8px' }}>
                {editingCaption === img.id ? (
                  <div style={{ display: 'flex', gap: 4 }}>
                    <input
                      value={captionText}
                      onChange={e => setCaptionText(e.target.value)}
                      style={{
                        flex: 1,
                        padding: '2px 4px',
                        fontSize: 11,
                        background: 'var(--panel)',
                        border: '1px solid var(--panel-border)',
                        borderRadius: 4,
                        color: 'var(--text)',
                      }}
                      autoFocus
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleSaveCaption(img.id);
                        if (e.key === 'Escape') setEditingCaption(null);
                      }}
                    />
                    <button
                      onClick={() => handleSaveCaption(img.id)}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: '#10b981', padding: 0, display: 'flex',
                      }}
                    >
                      <Check size={12} />
                    </button>
                  </div>
                ) : (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 4,
                  }}>
                    <span style={{
                      fontSize: 11,
                      color: img.caption ? 'var(--text)' : '#64748b',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {img.caption || 'No caption'}
                    </span>
                    {canEdit && (
                      <button
                        onClick={() => {
                          setEditingCaption(img.id);
                          setCaptionText(img.caption || '');
                        }}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: 'var(--text-muted)', padding: 0, display: 'flex', flexShrink: 0,
                        }}
                      >
                        <Edit3 size={10} />
                      </button>
                    )}
                  </div>
                )}
              </div>
              {/* Delete button */}
              {canEdit && (
                <button
                  onClick={() => handleDelete(img.id)}
                  style={{
                    position: 'absolute',
                    top: 4,
                    right: 4,
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    background: 'rgba(0,0,0,0.6)',
                    border: 'none',
                    color: '#fff',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <X size={12} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Upload area */}
      {canEdit && (
        <div
          onDragOver={e => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            padding: 16,
            background: 'var(--bg)',
            border: '1px dashed var(--panel-border)',
            borderRadius: 8,
            color: 'var(--text-muted)',
            fontSize: 13,
            cursor: 'pointer',
            transition: 'border-color 0.2s',
          }}
        >
          <Upload size={16} />
          {uploading ? 'Uploading...' : 'Drop images here or click to upload'}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={e => e.target.files && handleUpload(e.target.files)}
            style={{ display: 'none' }}
          />
        </div>
      )}

      {/* Lightbox */}
      {lightboxImage && (
        <div
          onClick={() => setLightboxImage(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.85)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <img
            src={lightboxImage}
            alt="Reference full size"
            style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: 8 }}
          />
        </div>
      )}
    </div>
  );
}
