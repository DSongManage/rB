/**
 * Tour Menu Component
 *
 * Provides UI for users to replay tours and manage tour preferences.
 * Can be used as a dropdown menu item or standalone component.
 */

import React, { useState } from 'react';
import { HelpCircle, Play, RotateCcw, X } from 'lucide-react';
import { useTour, TourName } from '../../contexts/TourContext';
import { tourDisplayNames } from './tourSteps';

interface TourMenuProps {
  variant?: 'button' | 'dropdown-item';
  onClose?: () => void;
}

export function TourMenu({ variant = 'button', onClose }: TourMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { startTour, hasCompletedTour, resetAllTours, state } = useTour();

  const consumerTours: TourName[] = ['welcome', 'purchase', 'library'];
  const creatorTours: TourName[] = ['creator-intro', 'studio', 'dashboard', 'collaboration'];

  const handleStartTour = (tourName: TourName) => {
    startTour(tourName);
    setIsOpen(false);
    onClose?.();
  };

  const handleResetAll = () => {
    resetAllTours();
    setIsOpen(false);
  };

  // Dropdown item variant (for use in profile menu)
  if (variant === 'dropdown-item') {
    return (
      <button
        onClick={() => handleStartTour('welcome')}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          width: '100%',
          padding: '10px 16px',
          background: 'transparent',
          border: 'none',
          color: 'var(--text-muted)',
          fontSize: 14,
          cursor: 'pointer',
          textAlign: 'left',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--dropdown-hover)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent';
        }}
      >
        <HelpCircle size={18} />
        Take the Tour
      </button>
    );
  }

  // Button with modal variant
  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 12px',
          background: 'transparent',
          border: '1px solid var(--panel-border-strong)',
          borderRadius: 8,
          color: 'var(--text-muted)',
          fontSize: 13,
          cursor: 'pointer',
          transition: 'all 0.2s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = '#f59e0b';
          e.currentTarget.style.color = '#f59e0b';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'var(--panel-border-strong)';
          e.currentTarget.style.color = 'var(--text-muted)';
        }}
        title="App Tour"
      >
        <HelpCircle size={16} />
        Tour
      </button>

      {/* Tour selection modal */}
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10001,
          }}
          onClick={() => setIsOpen(false)}
        >
          <div
            style={{
              background: 'var(--dropdown-bg)',
              borderRadius: 16,
              padding: 24,
              maxWidth: 400,
              width: '90%',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
              border: '1px solid var(--panel-border-strong)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 20,
            }}>
              <h3 style={{
                fontSize: 18,
                fontWeight: 700,
                color: 'var(--text)',
                margin: 0,
              }}>
                App Tours
              </h3>
              <button
                onClick={() => setIsOpen(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--subtle)',
                  cursor: 'pointer',
                  padding: 4,
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Consumer Tours */}
            <div style={{ marginBottom: 20 }}>
              <h4 style={{
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--subtle)',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                marginBottom: 12,
              }}>
                Getting Started
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {consumerTours.map((tour) => (
                  <TourButton
                    key={tour}
                    tourName={tour}
                    isCompleted={hasCompletedTour(tour)}
                    onClick={() => handleStartTour(tour)}
                    isRunning={state.activeTour === tour}
                  />
                ))}
              </div>
            </div>

            {/* Creator Tours */}
            <div style={{ marginBottom: 20 }}>
              <h4 style={{
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--subtle)',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                marginBottom: 12,
              }}>
                Creator Tools
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {creatorTours.map((tour) => (
                  <TourButton
                    key={tour}
                    tourName={tour}
                    isCompleted={hasCompletedTour(tour)}
                    onClick={() => handleStartTour(tour)}
                    isRunning={state.activeTour === tour}
                  />
                ))}
              </div>
            </div>

            {/* Reset all tours */}
            <button
              onClick={handleResetAll}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                width: '100%',
                padding: '10px 16px',
                background: 'transparent',
                border: '1px solid var(--panel-border-strong)',
                borderRadius: 8,
                color: 'var(--text-muted)',
                fontSize: 13,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.color = 'var(--text)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--panel-border-strong)';
                e.currentTarget.style.color = 'var(--text-muted)';
              }}
            >
              <RotateCcw size={14} />
              Reset All Tours
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// Individual tour button
function TourButton({
  tourName,
  isCompleted,
  onClick,
  isRunning,
}: {
  tourName: TourName;
  isCompleted: boolean;
  onClick: () => void;
  isRunning: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={isRunning}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        background: 'var(--bg-card)',
        border: '1px solid var(--panel-border-strong)',
        borderRadius: 8,
        cursor: isRunning ? 'not-allowed' : 'pointer',
        transition: 'all 0.2s ease',
        opacity: isRunning ? 0.5 : 1,
      }}
      onMouseEnter={(e) => {
        if (!isRunning) {
          e.currentTarget.style.borderColor = '#f59e0b';
          e.currentTarget.style.background = 'var(--dropdown-hover)';
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--panel-border-strong)';
        e.currentTarget.style.background = 'var(--bg-card)';
      }}
    >
      <span style={{
        fontSize: 14,
        color: 'var(--text)',
        fontWeight: 500,
      }}>
        {tourDisplayNames[tourName]}
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {isCompleted && (
          <span style={{
            fontSize: 11,
            color: '#10b981',
            fontWeight: 600,
          }}>
            Completed
          </span>
        )}
        <Play size={14} style={{ color: '#f59e0b' }} />
      </div>
    </button>
  );
}

export default TourMenu;
