/**
 * Tour Provider Component
 *
 * Wraps React Joyride and integrates with TourContext.
 * Handles tour rendering, callbacks, and state management.
 */

import React, { useCallback, useMemo } from 'react';
import Joyride, { CallBackProps, STATUS, EVENTS, ACTIONS, TooltipRenderProps } from 'react-joyride';
import { useTour } from '../../contexts/TourContext';
import { useMobile } from '../../hooks/useMobile';
import { getTourSteps } from './tourSteps';
import { tourStyles } from './tourStyles';

// Custom tooltip component for more control
function TourTooltip({
  continuous,
  index,
  step,
  size,
  backProps,
  closeProps,
  primaryProps,
  skipProps,
  tooltipProps,
}: TooltipRenderProps) {
  const isFirst = index === 0;
  const isLast = index === size - 1;

  return (
    <div
      {...tooltipProps}
      style={{
        backgroundColor: '#1a1a1a',
        borderRadius: 12,
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1)',
        maxWidth: 340,
        minWidth: 280,
      }}
    >
      {/* Close button */}
      <button
        {...closeProps}
        style={{
          position: 'absolute',
          right: 8,
          top: 8,
          background: 'transparent',
          border: 'none',
          color: '#6b7280',
          cursor: 'pointer',
          padding: 4,
          fontSize: 18,
          lineHeight: 1,
        }}
        aria-label="Close tour"
      >
        &times;
      </button>

      {/* Content */}
      <div style={{ padding: '20px 24px' }}>
        {step.title && (
          <div style={{
            fontSize: 16,
            fontWeight: 700,
            color: '#ffffff',
            marginBottom: 8,
          }}>
            {typeof step.title === 'string' ? step.title : step.title}
          </div>
        )}
        <div style={{
          fontSize: 14,
          lineHeight: 1.6,
          color: '#d1d5db',
        }}>
          {typeof step.content === 'string' ? step.content : step.content}
        </div>
      </div>

      {/* Footer */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 24px 20px',
        borderTop: '1px solid rgba(255, 255, 255, 0.1)',
      }}>
        {/* Left side: Skip / Progress */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {!isLast && (
            <button
              {...skipProps}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#6b7280',
                fontSize: 12,
                cursor: 'pointer',
                padding: '4px 8px',
              }}
            >
              Skip tour
            </button>
          )}
          <div style={{
            fontSize: 12,
            color: '#6b7280',
          }}>
            {index + 1} / {size}
          </div>
        </div>

        {/* Right side: Back / Next */}
        <div style={{ display: 'flex', gap: 8 }}>
          {!isFirst && (
            <button
              {...backProps}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#9ca3af',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
                padding: '8px 12px',
              }}
            >
              Back
            </button>
          )}
          <button
            {...primaryProps}
            style={{
              backgroundColor: '#f59e0b',
              color: '#000000',
              fontWeight: 600,
              fontSize: 13,
              padding: '8px 16px',
              borderRadius: 8,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            {isLast ? 'Done' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function TourRenderer() {
  const { state, endTour, skipTour, goToStep } = useTour();
  const { isMobile } = useMobile();

  // Get steps for the active tour
  const steps = useMemo(() => {
    if (!state.activeTour) return [];
    return getTourSteps(state.activeTour, isMobile);
  }, [state.activeTour, isMobile]);

  // Handle Joyride callbacks
  const handleCallback = useCallback((data: CallBackProps) => {
    const { status, type, index, action } = data;

    // Handle tour completion
    if (status === STATUS.FINISHED) {
      endTour();
      return;
    }

    // Handle skip
    if (status === STATUS.SKIPPED) {
      skipTour();
      return;
    }

    // Handle step navigation
    if (type === EVENTS.STEP_AFTER) {
      if (action === ACTIONS.NEXT) {
        goToStep(index + 1);
      } else if (action === ACTIONS.PREV) {
        goToStep(index - 1);
      }
    }

    // Handle close button
    if (action === ACTIONS.CLOSE) {
      skipTour();
    }
  }, [endTour, skipTour, goToStep]);

  // Don't render if no active tour
  if (!state.isRunning || !state.activeTour || steps.length === 0) {
    return null;
  }

  return (
    <Joyride
      steps={steps}
      stepIndex={state.stepIndex}
      run={state.isRunning}
      continuous
      showSkipButton
      showProgress={false}
      disableScrolling={false}
      disableOverlayClose={false}
      spotlightClicks={false}
      callback={handleCallback}
      styles={tourStyles}
      tooltipComponent={TourTooltip}
      floaterProps={{
        disableAnimation: false,
        styles: {
          floater: {
            filter: 'drop-shadow(0 4px 12px rgba(0, 0, 0, 0.3))',
          },
        },
      }}
      locale={{
        back: 'Back',
        close: 'Close',
        last: 'Done',
        next: 'Next',
        skip: 'Skip tour',
      }}
    />
  );
}

export default TourRenderer;
