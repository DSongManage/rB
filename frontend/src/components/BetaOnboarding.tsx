import React, { useEffect, useState } from 'react';
import { BetaWelcomeModal } from './BetaBadge';
import { useAuth } from '../hooks/useAuth';
import { useTour } from '../contexts/TourContext';
import { API_URL } from '../config';

/**
 * BetaOnboarding Component
 *
 * Shows welcome modal to new beta users on first login
 * Uses server-side flag (has_seen_beta_welcome) to track completion
 * This ensures users don't see the modal again even on different browsers/devices
 * Triggers the welcome tour after the modal is closed
 */
export function BetaOnboarding() {
  const { isAuthenticated, user, refreshAuth } = useAuth();
  const { startTour, hasCompletedTour } = useTour();
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      return;
    }

    // Check server-side flag - only show if user hasn't seen the welcome modal
    if (user.has_seen_beta_welcome === false) {
      // Small delay to let the app load first
      setTimeout(() => {
        setShowWelcome(true);
      }, 1000);
    }
  }, [isAuthenticated, user]);

  const handleClose = async () => {
    setShowWelcome(false);

    // Mark as seen on the server
    if (user) {
      try {
        // Get CSRF token
        const csrfResponse = await fetch(`${API_URL}/api/auth/csrf/`, {
          credentials: 'include',
        });
        const csrfData = await csrfResponse.json();
        const csrfToken = csrfData?.csrfToken || '';

        await fetch(`${API_URL}/api/beta/welcome-seen/`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': csrfToken,
            'X-Requested-With': 'XMLHttpRequest',
          },
        });

        // Refresh auth to update the user object with the new flag
        refreshAuth();
      } catch (error) {
        console.error('[BetaOnboarding] Failed to mark welcome as seen:', error);
      }
    }

    // Start the welcome tour after closing the modal (if not already completed)
    if (!hasCompletedTour('welcome')) {
      // Small delay to let the modal close animation finish
      setTimeout(() => {
        startTour('welcome');
      }, 500);
    }
  };

  return (
    <>
      {showWelcome && <BetaWelcomeModal onClose={handleClose} />}
    </>
  );
}

export default BetaOnboarding;
