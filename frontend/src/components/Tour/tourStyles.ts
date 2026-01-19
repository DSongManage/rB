/**
 * Tour Styles
 *
 * Matches the renaissBlock dark theme with amber accent.
 * Colors: --bg: #141414, --panel: #1a1a1a, --accent: #f59e0b
 */

import { Styles } from 'react-joyride';

export const tourStyles: Partial<Styles> = {
  options: {
    // Background for tooltip
    backgroundColor: '#1a1a1a',
    // Arrow color matches tooltip background
    arrowColor: '#1a1a1a',
    // NO overlay - completely transparent (user prefers border highlight only)
    overlayColor: 'rgba(0, 0, 0, 0)',
    // Primary accent color (amber)
    primaryColor: '#f59e0b',
    // Text color
    textColor: '#e5e7eb',
    // Strong spotlight border/glow to highlight elements without dark overlay
    spotlightShadow: '0 0 0 4px #f59e0b, 0 0 20px rgba(245, 158, 11, 0.6)',
    // High z-index to appear above everything
    zIndex: 10000,
    // Beacon color (pulsing dot)
    beaconSize: 36,
  },
  // Tooltip container
  tooltip: {
    borderRadius: 12,
    padding: 0,
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1)',
  },
  // Tooltip content area
  tooltipContainer: {
    textAlign: 'left' as const,
    padding: '20px 24px',
  },
  // Tooltip title (if used)
  tooltipTitle: {
    fontSize: 16,
    fontWeight: 700,
    marginBottom: 8,
    color: '#ffffff',
  },
  // Tooltip content text
  tooltipContent: {
    fontSize: 14,
    lineHeight: 1.6,
    color: '#d1d5db',
    padding: 0,
  },
  // Footer with buttons
  tooltipFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 24px 20px',
    borderTop: '1px solid rgba(255, 255, 255, 0.1)',
    marginTop: 0,
  },
  // Next button
  buttonNext: {
    backgroundColor: '#f59e0b',
    color: '#000000',
    fontWeight: 600,
    fontSize: 13,
    padding: '8px 16px',
    borderRadius: 8,
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  // Back button
  buttonBack: {
    color: '#9ca3af',
    fontWeight: 500,
    fontSize: 13,
    padding: '8px 12px',
    marginRight: 8,
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
  },
  // Skip button
  buttonSkip: {
    color: '#6b7280',
    fontWeight: 500,
    fontSize: 12,
    padding: '8px 12px',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
  },
  // Close button (X)
  buttonClose: {
    color: '#9ca3af',
    padding: 8,
    position: 'absolute' as const,
    right: 8,
    top: 8,
  },
  // Spotlight (highlighted area around target)
  spotlight: {
    borderRadius: 8,
  },
  // Beacon (pulsing dot) - we disable these mostly
  beacon: {
    display: 'none',
  },
  beaconInner: {
    backgroundColor: '#f59e0b',
  },
  beaconOuter: {
    backgroundColor: 'rgba(245, 158, 11, 0.3)',
    border: '2px solid #f59e0b',
  },
  // Overlay
  overlay: {
    mixBlendMode: undefined,
  },
};

// Custom CSS for additional styling (to be added to index.css or App.css)
export const tourCSS = `
/* Tour tooltip animations */
.react-joyride__tooltip {
  animation: tourFadeIn 0.2s ease-out;
}

@keyframes tourFadeIn {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Spotlight border highlight effect - NO dark overlay, just a glowing border */
.react-joyride__spotlight {
  box-shadow: 0 0 0 4px #f59e0b, 0 0 30px rgba(245, 158, 11, 0.5) !important;
  border-radius: 8px !important;
}

/* Button hover states */
.react-joyride__tooltip button[data-action="primary"]:hover {
  background-color: #d97706 !important;
}

.react-joyride__tooltip button[data-action="back"]:hover,
.react-joyride__tooltip button[data-action="skip"]:hover {
  color: #e5e7eb !important;
}

/* Progress indicator styling */
.tour-progress {
  display: flex;
  gap: 6px;
  align-items: center;
}

.tour-progress-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #4b5563;
  transition: all 0.2s ease;
}

.tour-progress-dot.active {
  background: #f59e0b;
  width: 8px;
  height: 8px;
}

.tour-progress-dot.completed {
  background: #10b981;
}
`;
