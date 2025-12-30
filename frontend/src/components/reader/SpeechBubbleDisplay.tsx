/**
 * SpeechBubbleDisplay Component
 *
 * Read-only display of speech bubbles in comic panels.
 * Supports various bubble types with appropriate styling.
 */

import React from 'react';
import { SpeechBubbleData } from '../../services/libraryApi';

interface SpeechBubbleDisplayProps {
  bubble: SpeechBubbleData;
}

export function SpeechBubbleDisplay({ bubble }: SpeechBubbleDisplayProps) {
  // Get bubble border radius based on type
  const getBubbleBorderRadius = (): string => {
    switch (bubble.bubble_type) {
      case 'oval':
      case 'thought':
        return '50%';
      case 'shout':
      case 'burst':
        return '8px';
      case 'narrative':
      case 'caption':
        return '4px';
      case 'whisper':
        return '40%';
      case 'radio':
        return '12px';
      default:
        return '50%';
    }
  };

  // Get additional styling based on bubble type
  const getBubbleTypeStyle = (): React.CSSProperties => {
    const baseStyle: React.CSSProperties = {};

    switch (bubble.bubble_type) {
      case 'thought':
        // Thought bubbles have a cloud-like appearance
        baseStyle.boxShadow = '4px 4px 0 rgba(0,0,0,0.1)';
        break;
      case 'shout':
        // Shout bubbles are more angular
        baseStyle.fontWeight = 'bold';
        break;
      case 'whisper':
        // Whisper bubbles are subtle
        baseStyle.opacity = 0.9;
        baseStyle.fontStyle = 'italic';
        break;
      case 'narrative':
      case 'caption':
        // Narrative boxes are rectangular
        baseStyle.fontStyle = 'italic';
        break;
      case 'radio':
        // Radio/electronic speech
        baseStyle.border = `2px dashed ${bubble.border_color}`;
        break;
    }

    return baseStyle;
  };

  return (
    <div
      style={{
        position: 'absolute',
        left: `${bubble.x_percent}%`,
        top: `${bubble.y_percent}%`,
        width: `${bubble.width_percent}%`,
        height: `${bubble.height_percent}%`,
        zIndex: bubble.z_index,
        backgroundColor: bubble.background_color || '#ffffff',
        border: `${bubble.border_width}px solid ${bubble.border_color || '#000000'}`,
        borderRadius: getBubbleBorderRadius(),
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '8%',
        boxSizing: 'border-box',
        overflow: 'hidden',
        ...getBubbleTypeStyle(),
      }}
    >
      <span
        style={{
          fontFamily: bubble.font_family || 'Comic Sans MS, cursive, sans-serif',
          fontSize: `${bubble.font_size || 14}px`,
          color: bubble.font_color || '#000000',
          fontWeight: bubble.font_weight || 'normal',
          fontStyle: bubble.font_style || 'normal',
          textAlign: (bubble.text_align as 'left' | 'center' | 'right') || 'center',
          lineHeight: 1.3,
          wordWrap: 'break-word',
          overflowWrap: 'break-word',
          width: '100%',
        }}
      >
        {bubble.text}
      </span>
    </div>
  );
}

export default SpeechBubbleDisplay;
