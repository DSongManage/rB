import React, { useEffect, useState } from 'react';
import { BetaWelcomeModal } from './BetaBadge';
import { useAuth } from '../hooks/useAuth';
import { useTour } from '../contexts/TourContext';

/**
 * BetaOnboarding Component
 *
 * Shows welcome modal to new beta users on first login
 * Stores completion in localStorage to avoid showing again
 * Triggers the welcome tour after the modal is closed
 */
export function BetaOnboarding() {
  const { isAuthenticated, user } = useAuth();
  const { startTour, hasCompletedTour } = useTour();
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      return;
    }

    // Check if user has seen the welcome modal
    const hasSeenWelcome = localStorage.getItem('beta_welcome_seen');
    const lastSeenUserId = localStorage.getItem('beta_welcome_user_id');

    // Show welcome if:
    // 1. Never seen before, OR
    // 2. Different user than last time (account switching)
    if (!hasSeenWelcome || lastSeenUserId !== String(user.id)) {
      // Small delay to let the app load first
      setTimeout(() => {
        setShowWelcome(true);
      }, 1000);
    }
  }, [isAuthenticated, user]);

  const handleClose = () => {
    if (user) {
      localStorage.setItem('beta_welcome_seen', 'true');
      localStorage.setItem('beta_welcome_user_id', String(user.id));
    }
    setShowWelcome(false);

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
