/**
 * ComicPanelDisplay Component
 *
 * Read-only display of comic panels with artwork and speech bubbles.
 * Supports positioning, transforms (rotation, skew), and border styling.
 */

import React from 'react';
import { ComicPanelData } from '../../services/libraryApi';
import { SpeechBubbleDisplay } from './SpeechBubbleDisplay';

interface ComicPanelDisplayProps {
  panel: ComicPanelData;
}

export function ComicPanelDisplay({ panel }: ComicPanelDisplayProps) {
  // Build CSS transform string
  const buildTransform = (): string => {
    const transforms: string[] = [];

    if (panel.rotation) {
      transforms.push(`rotate(${panel.rotation}deg)`);
    }
    if (panel.skew_x) {
      transforms.push(`skewX(${panel.skew_x}deg)`);
    }
    if (panel.skew_y) {
      transforms.push(`skewY(${panel.skew_y}deg)`);
    }

    return transforms.length > 0 ? transforms.join(' ') : 'none';
  };

  // Get border style (handle special styles like jagged, wavy)
  const getBorderStyle = (): string => {
    switch (panel.border_style) {
      case 'jagged':
      case 'wavy':
        return 'solid'; // These would need CSS clip-path for proper effect
      case 'none':
        return 'none';
      default:
        return panel.border_style || 'solid';
    }
  };

  return (
    <div
      style={{
        position: 'absolute',
        left: `${panel.x_percent}%`,
        top: `${panel.y_percent}%`,
        width: `${panel.width_percent}%`,
        height: `${panel.height_percent}%`,
        zIndex: panel.z_index,
        transform: buildTransform(),
        transformOrigin: 'center center',
      }}
    >
      {/* Panel frame with border */}
      <div
        style={{
          width: '100%',
          height: '100%',
          border:
            panel.border_style !== 'none'
              ? `${panel.border_width || 2}px ${getBorderStyle()} ${panel.border_color || '#000000'}`
              : 'none',
          borderRadius: panel.border_radius || 0,
          backgroundColor: panel.background_color || '#ffffff',
          position: 'relative',
          overflow: 'hidden',
          boxSizing: 'border-box',
        }}
      >
        {/* Panel artwork */}
        {panel.artwork && (
          <img
            src={panel.artwork}
            alt=""
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              objectFit: (panel.artwork_fit as 'cover' | 'contain' | 'fill') || 'cover',
            }}
            draggable={false}
          />
        )}

        {/* Speech bubbles - sorted by z-index */}
        {panel.speech_bubbles &&
          [...panel.speech_bubbles]
            .sort((a, b) => a.z_index - b.z_index)
            .map((bubble) => <SpeechBubbleDisplay key={bubble.id} bubble={bubble} />)}
      </div>
    </div>
  );
}

export default ComicPanelDisplay;
