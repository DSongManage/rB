import React, { useEffect, useState } from 'react';
import { BetaWelcomeModal } from './BetaBadge';
import { useAuth } from '../hooks/useAuth';

/**
 * BetaOnboarding Component
 *
 * Shows welcome modal to new beta users on their FIRST login only.
 * Uses per-user tracking in localStorage - once a user has seen it, they never see it again.
 */
export function BetaOnboarding() {
  const { isAuthenticated, user } = useAuth();
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      return;
    }

    // Get the set of user IDs who have seen the welcome modal
    const seenUsersRaw = localStorage.getItem('beta_welcome_seen_users');
    const seenUsers: Set<string> = seenUsersRaw
      ? new Set(JSON.parse(seenUsersRaw))
      : new Set();

    // Only show welcome if this specific user has NEVER seen it
    if (!seenUsers.has(String(user.id))) {
      // Small delay to let the app load first
      setTimeout(() => {
        setShowWelcome(true);
      }, 1000);
    }
  }, [isAuthenticated, user]);

  const handleClose = () => {
    if (user) {
      // Add this user to the set of users who have seen the modal
      const seenUsersRaw = localStorage.getItem('beta_welcome_seen_users');
      const seenUsers: Set<string> = seenUsersRaw
        ? new Set(JSON.parse(seenUsersRaw))
        : new Set();
      seenUsers.add(String(user.id));
      localStorage.setItem('beta_welcome_seen_users', JSON.stringify([...seenUsers]));
    }
    setShowWelcome(false);
  };

  return (
    <>
      {showWelcome && <BetaWelcomeModal onClose={handleClose} />}
    </>
  );
}

export default BetaOnboarding;
