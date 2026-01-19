/**
 * Tour Context - User walkthrough/onboarding tour management
 *
 * Manages tour state for both consumer and creator tracks.
 * Persists completion status in localStorage.
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';

// Tour types - separated by user journey
export type ConsumerTour = 'welcome' | 'purchase' | 'library';
export type CreatorTour = 'creator-intro' | 'studio' | 'dashboard' | 'collaboration';
export type TourName = ConsumerTour | CreatorTour;

export interface TourState {
  activeTour: TourName | null;
  stepIndex: number;
  isRunning: boolean;
  completedTours: TourName[];
  toursEnabled: boolean;
}

export interface TourContextType {
  // State
  state: TourState;

  // Actions
  startTour: (tourName: TourName) => void;
  endTour: () => void;
  skipTour: () => void;
  nextStep: () => void;
  prevStep: () => void;
  goToStep: (index: number) => void;
  resetTour: (tourName: TourName) => void;
  resetAllTours: () => void;

  // Helpers
  hasCompletedTour: (tourName: TourName) => boolean;
  isConsumerTour: (tourName: TourName) => boolean;
  isCreatorTour: (tourName: TourName) => boolean;
  setToursEnabled: (enabled: boolean) => void;
}

const TourContext = createContext<TourContextType | undefined>(undefined);

// LocalStorage keys
const STORAGE_KEYS = {
  completedTours: 'rb_tour_completed',
  toursEnabled: 'rb_tours_enabled',
  userId: 'rb_tour_user_id',
};

// Consumer tours (for all users)
const CONSUMER_TOURS: ConsumerTour[] = ['welcome', 'purchase', 'library'];

// Creator tours (for users who visit /studio)
const CREATOR_TOURS: CreatorTour[] = ['creator-intro', 'studio', 'dashboard', 'collaboration'];

export function TourProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuth();

  const [state, setState] = useState<TourState>({
    activeTour: null,
    stepIndex: 0,
    isRunning: false,
    completedTours: [],
    toursEnabled: true,
  });

  // Load completed tours from localStorage on mount and when user changes
  useEffect(() => {
    if (!isAuthenticated || !user) {
      // Reset state if not authenticated
      setState(prev => ({
        ...prev,
        completedTours: [],
        activeTour: null,
        isRunning: false,
      }));
      return;
    }

    const storedUserId = localStorage.getItem(STORAGE_KEYS.userId);
    const currentUserId = String(user.id);

    // If different user, reset tour completion
    if (storedUserId && storedUserId !== currentUserId) {
      localStorage.removeItem(STORAGE_KEYS.completedTours);
    }

    // Store current user ID
    localStorage.setItem(STORAGE_KEYS.userId, currentUserId);

    // Load completed tours
    const storedTours = localStorage.getItem(STORAGE_KEYS.completedTours);
    const completedTours: TourName[] = storedTours ? JSON.parse(storedTours) : [];

    // Load tours enabled preference
    const storedEnabled = localStorage.getItem(STORAGE_KEYS.toursEnabled);
    const toursEnabled = storedEnabled !== 'false';

    setState(prev => ({
      ...prev,
      completedTours,
      toursEnabled,
    }));
  }, [isAuthenticated, user]);

  // Save completed tours to localStorage whenever they change
  const saveCompletedTours = useCallback((tours: TourName[]) => {
    localStorage.setItem(STORAGE_KEYS.completedTours, JSON.stringify(tours));
  }, []);

  const startTour = useCallback((tourName: TourName) => {
    if (!state.toursEnabled) return;

    setState(prev => ({
      ...prev,
      activeTour: tourName,
      stepIndex: 0,
      isRunning: true,
    }));
  }, [state.toursEnabled]);

  const endTour = useCallback(() => {
    setState(prev => {
      if (!prev.activeTour) return prev;

      const newCompletedTours = prev.completedTours.includes(prev.activeTour)
        ? prev.completedTours
        : [...prev.completedTours, prev.activeTour];

      saveCompletedTours(newCompletedTours);

      return {
        ...prev,
        activeTour: null,
        stepIndex: 0,
        isRunning: false,
        completedTours: newCompletedTours,
      };
    });
  }, [saveCompletedTours]);

  const skipTour = useCallback(() => {
    setState(prev => {
      if (!prev.activeTour) return prev;

      // Mark as completed even when skipped
      const newCompletedTours = prev.completedTours.includes(prev.activeTour)
        ? prev.completedTours
        : [...prev.completedTours, prev.activeTour];

      saveCompletedTours(newCompletedTours);

      return {
        ...prev,
        activeTour: null,
        stepIndex: 0,
        isRunning: false,
        completedTours: newCompletedTours,
      };
    });
  }, [saveCompletedTours]);

  const nextStep = useCallback(() => {
    setState(prev => ({
      ...prev,
      stepIndex: prev.stepIndex + 1,
    }));
  }, []);

  const prevStep = useCallback(() => {
    setState(prev => ({
      ...prev,
      stepIndex: Math.max(0, prev.stepIndex - 1),
    }));
  }, []);

  const goToStep = useCallback((index: number) => {
    setState(prev => ({
      ...prev,
      stepIndex: Math.max(0, index),
    }));
  }, []);

  const resetTour = useCallback((tourName: TourName) => {
    setState(prev => {
      const newCompletedTours = prev.completedTours.filter(t => t !== tourName);
      saveCompletedTours(newCompletedTours);
      return {
        ...prev,
        completedTours: newCompletedTours,
      };
    });
  }, [saveCompletedTours]);

  const resetAllTours = useCallback(() => {
    localStorage.removeItem(STORAGE_KEYS.completedTours);
    setState(prev => ({
      ...prev,
      completedTours: [],
    }));
  }, []);

  const hasCompletedTour = useCallback((tourName: TourName) => {
    return state.completedTours.includes(tourName);
  }, [state.completedTours]);

  const isConsumerTour = useCallback((tourName: TourName) => {
    return CONSUMER_TOURS.includes(tourName as ConsumerTour);
  }, []);

  const isCreatorTour = useCallback((tourName: TourName) => {
    return CREATOR_TOURS.includes(tourName as CreatorTour);
  }, []);

  const setToursEnabled = useCallback((enabled: boolean) => {
    localStorage.setItem(STORAGE_KEYS.toursEnabled, String(enabled));
    setState(prev => ({
      ...prev,
      toursEnabled: enabled,
      // Stop any running tour if disabling
      ...(enabled ? {} : { activeTour: null, isRunning: false }),
    }));
  }, []);

  return (
    <TourContext.Provider
      value={{
        state,
        startTour,
        endTour,
        skipTour,
        nextStep,
        prevStep,
        goToStep,
        resetTour,
        resetAllTours,
        hasCompletedTour,
        isConsumerTour,
        isCreatorTour,
        setToursEnabled,
      }}
    >
      {children}
    </TourContext.Provider>
  );
}

export function useTour() {
  const context = useContext(TourContext);
  if (!context) {
    throw new Error('useTour must be used within TourProvider');
  }
  return context;
}

export default TourContext;
