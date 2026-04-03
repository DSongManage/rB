import React, { useState, useRef } from 'react';
import {
  Upload, Check, RotateCcw, FileIcon, Download,
  ChevronDown, ChevronUp, Loader2,
} from 'lucide-react';
import {
  PageArtDelivery,
  collaborationApi,
} from '../../../services/collaborationApi';
import PageStatusBadge from './PageStatusBadge';

interface ArtDeliverySectionProps {
  pageId: number;
  deliveries: PageArtDelivery[];
  canUploadArt: boolean;
  canReview: boolean;
  onDeliveriesChange: (deliveries: PageArtDelivery[]) => void;
  onPageStatusChange: (status: string) => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

export default function ArtDeliverySection({
  pageId,
  deliveries,
  canUploadArt,
  canReview,
  onDeliveriesChange,
  onPageStatusChange,
}: ArtDeliverySectionProps) {
  const [uploading, setUploading] = useState(false);
  const [revisionId, setRevisionId] = useState<number | null>(null);
  const [revisionNotes, setRevisionNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const latestDelivery = deliveries.length > 0 ? deliveries[0] : null;
  const olderDeliveries = deliveries.slice(1);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const delivery = await collaborationApi.uploadPageArtDelivery(pageId, file);
      onDeliveriesChange([delivery, ...deliveries]);
      onPageStatusChange('art_delivered');
    } catch (err) {
      console.error('Failed to upload art delivery:', err);
    } finally {
      setUploading(false);
    }
  };

  const handleApprove = async (id: number) => {
    setSubmitting(true);
    try {
      const updated = await collaborationApi.approveArtDelivery(id);
      onDeliveriesChange(deliveries.map(d => d.id === id ? updated : d));
      onPageStatusChange('approved');
    } catch (err) {
      console.error('Failed to approve delivery:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequestRevision = async (id: number) => {
    if (!revisionNotes.trim()) return;
    setSubmitting(true);
    try {
      const updated = await collaborationApi.requestArtRevision(id, revisionNotes);
      onDeliveriesChange(deliveries.map(d => d.id === id ? updated : d));
      onPageStatusChange('revision_requested');
      setRevisionId(null);
      setRevisionNotes('');
    } catch (err) {
      console.error('Failed to request revision:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (!canUploadArt || !e.dataTransfer.files[0]) return;
    handleUpload(e.dataTransfer.files[0]);
  };

  const isImageFile = (fileType: string) =>
    fileType.startsWith('image/');

  return (
    <div style={{ marginBottom: 24 }}>
      <label style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        marginBottom: 12,
        fontSize: 13,
        fontWeight: 600,
        color: 'var(--text-muted)',
      }}>
        <FileIcon size={14} />
        Art Delivery {deliveries.length > 0 && `(${deliveries.length} version${deliveries.length > 1 ? 's' : ''})`}
      </label>

      {/* Latest delivery */}
      {latestDelivery && (
        <div style={{
          background: 'var(--bg)',
          border: '1px solid var(--panel-border)',
          borderRadius: 10,
          overflow: 'hidden',
          marginBottom: 12,
        }}>
          {/* Preview */}
          {isImageFile(latestDelivery.file_type) && (
            <div style={{
              width: '100%',
              maxHeight: 300,
              overflow: 'hidden',
              borderBottom: '1px solid var(--panel-border)',
              background: '#000',
            }}>
              <img
                src={latestDelivery.file}
                alt={`Art v${latestDelivery.version}`}
                style={{
                  width: '100%',
                  maxHeight: 300,
                  objectFit: 'contain',
                }}
              />
            </div>
          )}

          {/* Info bar */}
          <div style={{ padding: 12 }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 8,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
                  v{latestDelivery.version}
                </span>
                <PageStatusBadge
                  status={latestDelivery.status === 'delivered' ? 'art_delivered'
                    : latestDelivery.status === 'revision_requested' ? 'revision_requested'
                    : 'approved'}
                  size="small"
                />
              </div>
              <a
                href={latestDelivery.file}
                download={latestDelivery.filename}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  color: '#8b5cf6', fontSize: 12, textDecoration: 'none',
                }}
              >
                <Download size={12} /> Download
              </a>
            </div>

            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
              {latestDelivery.filename} ({formatFileSize(latestDelivery.file_size)})
              &middot; by {latestDelivery.uploaded_by_username}
              &middot; {formatDate(latestDelivery.created_at)}
            </div>

            {/* Revision notes display */}
            {latestDelivery.revision_notes && (
              <div style={{
                padding: 8,
                background: 'rgba(249, 115, 22, 0.1)',
                border: '1px solid rgba(249, 115, 22, 0.2)',
                borderRadius: 6,
                fontSize: 12,
                color: '#f97316',
                marginBottom: 8,
              }}>
                <strong>Revision notes:</strong> {latestDelivery.revision_notes}
              </div>
            )}

            {/* Author actions */}
            {canReview && latestDelivery.status === 'delivered' && (
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button
                  onClick={() => handleApprove(latestDelivery.id)}
                  disabled={submitting}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '8px 16px',
                    background: '#10b981', border: 'none', borderRadius: 8,
                    color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  <Check size={14} /> Approve
                </button>
                <button
                  onClick={() => setRevisionId(latestDelivery.id)}
                  disabled={submitting}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '8px 16px',
                    background: 'rgba(249, 115, 22, 0.1)',
                    border: '1px solid rgba(249, 115, 22, 0.3)',
                    borderRadius: 8,
                    color: '#f97316', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  <RotateCcw size={14} /> Request Revision
                </button>
              </div>
            )}

            {/* Revision notes input */}
            {revisionId === latestDelivery.id && (
              <div style={{ marginTop: 8 }}>
                <textarea
                  value={revisionNotes}
                  onChange={e => setRevisionNotes(e.target.value)}
                  placeholder="Describe what needs to change..."
                  style={{
                    width: '100%',
                    minHeight: 60,
                    padding: 10,
                    background: 'var(--panel)',
                    border: '1px solid rgba(249, 115, 22, 0.3)',
                    borderRadius: 6,
                    color: 'var(--text)',
                    fontSize: 13,
                    resize: 'vertical',
                    fontFamily: 'inherit',
                  }}
                  autoFocus
                />
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button
                    onClick={() => handleRequestRevision(latestDelivery.id)}
                    disabled={submitting || !revisionNotes.trim()}
                    style={{
                      padding: '6px 12px',
                      background: '#f97316', border: 'none', borderRadius: 6,
                      color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      opacity: revisionNotes.trim() ? 1 : 0.5,
                    }}
                  >
                    {submitting ? 'Submitting...' : 'Submit Revision Request'}
                  </button>
                  <button
                    onClick={() => { setRevisionId(null); setRevisionNotes(''); }}
                    style={{
                      padding: '6px 12px',
                      background: 'transparent', border: '1px solid var(--panel-border)',
                      borderRadius: 6, color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Upload area */}
      {canUploadArt && (
        <div
          onDragOver={e => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            padding: latestDelivery ? 16 : 32,
            background: 'var(--bg)',
            border: '2px dashed var(--panel-border)',
            borderRadius: 10,
            color: 'var(--text-muted)',
            cursor: 'pointer',
            marginBottom: 12,
          }}
        >
          {uploading ? (
            <>
              <Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} />
              <span style={{ fontSize: 13 }}>Uploading...</span>
            </>
          ) : (
            <>
              <Upload size={latestDelivery ? 18 : 28} />
              <span style={{ fontSize: 13, fontWeight: 500 }}>
                {latestDelivery
                  ? 'Upload new version'
                  : 'Drop your finished artwork here or click to upload'}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                PNG, JPG, PDF, PSD, or any image format
              </span>
            </>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf,.psd"
            onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0])}
            style={{ display: 'none' }}
          />
        </div>
      )}

      {/* Version history */}
      {olderDeliveries.length > 0 && (
        <div>
          <button
            onClick={() => setShowHistory(!showHistory)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted)', fontSize: 12, padding: 0,
            }}
          >
            {showHistory ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {olderDeliveries.length} older version{olderDeliveries.length > 1 ? 's' : ''}
          </button>
          {showHistory && (
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {olderDeliveries.map(d => (
                <div
                  key={d.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 12px',
                    background: 'var(--bg)',
                    border: '1px solid var(--panel-border)',
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 600, color: 'var(--text)' }}>v{d.version}</span>
                    <PageStatusBadge
                      status={d.status === 'delivered' ? 'art_delivered'
                        : d.status === 'revision_requested' ? 'revision_requested'
                        : 'approved'}
                      size="small"
                    />
                    <span style={{ color: 'var(--text-muted)' }}>
                      {d.filename} &middot; {formatDate(d.created_at)}
                    </span>
                  </div>
                  <a
                    href={d.file}
                    download={d.filename}
                    style={{ color: '#8b5cf6', textDecoration: 'none', display: 'flex' }}
                  >
                    <Download size={12} />
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
