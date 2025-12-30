/**
 * ComicThumbnailSidebar Component
 *
 * Displays page thumbnails for quick navigation in the comic reader.
 */

import React from 'react';
import { X } from 'lucide-react';
import { ComicPageData } from '../../services/libraryApi';

interface ComicThumbnailSidebarProps {
  pages: ComicPageData[];
  currentPage: number;
  onSelectPage: (pageIndex: number) => void;
  onClose: () => void;
}

export function ComicThumbnailSidebar({
  pages,
  currentPage,
  onSelectPage,
  onClose,
}: ComicThumbnailSidebarProps) {
  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 1000,
        }}
        onClick={onClose}
      />

      {/* Sidebar */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          width: 280,
          maxWidth: '80vw',
          backgroundColor: '#0f172a',
          zIndex: 1001,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '4px 0 20px rgba(0, 0, 0, 0.3)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #1e293b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span
            style={{
              fontSize: 16,
              fontWeight: 600,
              color: '#f8fafc',
            }}
          >
            Pages ({pages.length})
          </span>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              padding: 8,
              cursor: 'pointer',
              color: '#94a3b8',
              borderRadius: 4,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Thumbnail list */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: 16,
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 12,
          }}
        >
          {pages.map((page, index) => {
            const isActive = index === currentPage;
            const aspectRatio = page.canvas_width / page.canvas_height;

            return (
              <button
                key={page.id}
                onClick={() => {
                  onSelectPage(index);
                  onClose();
                }}
                style={{
                  background: isActive ? '#1e3a5f' : '#1e293b',
                  border: isActive ? '2px solid #3b82f6' : '2px solid transparent',
                  borderRadius: 8,
                  padding: 8,
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 8,
                  transition: 'all 0.2s ease',
                }}
              >
                {/* Mini page preview */}
                <div
                  style={{
                    width: '100%',
                    aspectRatio: `${aspectRatio}`,
                    backgroundColor: page.background_color || '#ffffff',
                    backgroundImage: page.background_image
                      ? `url(${page.background_image})`
                      : undefined,
                    backgroundSize: 'cover',
                    borderRadius: 4,
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  {/* Mini panel previews */}
                  {page.panels.map((panel) => (
                    <div
                      key={panel.id}
                      style={{
                        position: 'absolute',
                        left: `${panel.x_percent}%`,
                        top: `${panel.y_percent}%`,
                        width: `${panel.width_percent}%`,
                        height: `${panel.height_percent}%`,
                        border: '1px solid rgba(0,0,0,0.3)',
                        backgroundColor: panel.artwork
                          ? 'transparent'
                          : panel.background_color || 'rgba(255,255,255,0.8)',
                        backgroundImage: panel.artwork ? `url(${panel.artwork})` : undefined,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        transform: `rotate(${panel.rotation || 0}deg) skewX(${panel.skew_x || 0}deg) skewY(${panel.skew_y || 0}deg)`,
                        transformOrigin: 'center center',
                        borderRadius: panel.border_radius ? panel.border_radius / 4 : 0,
                      }}
                    />
                  ))}
                </div>

                {/* Page number */}
                <span
                  style={{
                    fontSize: 12,
                    color: isActive ? '#60a5fa' : '#94a3b8',
                    fontWeight: isActive ? 600 : 400,
                  }}
                >
                  Page {index + 1}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

export default ComicThumbnailSidebar;
