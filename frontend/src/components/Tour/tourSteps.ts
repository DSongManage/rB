/**
 * Tour Step Definitions
 *
 * Defines all steps for consumer and creator tour tracks.
 * Uses data-tour attributes for stable element targeting.
 */

import { Step } from 'react-joyride';

// ============================================
// CONSUMER TRACK TOURS
// ============================================

/**
 * Welcome Tour - First tour shown after signup
 * Focuses on browsing, discovery, and basic navigation
 */
export const welcomeTourSteps: Step[] = [
  {
    target: 'body',
    content: 'Welcome to renaissBlock! Let us show you around so you can discover comics from writers and artists working together.',
    placement: 'center',
    disableBeacon: true,
    disableOverlay: true,
  },
  {
    target: '[data-tour="genre-filters"]',
    content: 'Browse comics and art from collaborating creators. Filter by type and genre.',
    placement: 'bottom',
    disableBeacon: true,
  },
  {
    target: '[data-tour="search-bar"]',
    content: 'Search for specific titles, genres, or creators.',
    placement: 'bottom',
    disableBeacon: true,
  },
  {
    target: '[data-tour="cart-button"]',
    content: 'Your shopping cart. Add content here and checkout when ready.',
    placement: 'bottom',
    disableBeacon: true,
  },
  {
    target: '[data-tour="notifications-button"]',
    content: 'Stay updated on your purchases, follows, and collaboration invites.',
    placement: 'bottom',
    disableBeacon: true,
  },
  {
    target: '[data-tour="profile-link"]',
    content: 'Access your profile, wallet, purchased content, and settings.',
    placement: 'bottom',
    disableBeacon: true,
  },
  {
    target: 'body',
    content: 'The main area shows comics from creators. Click any item to preview before buying. Ready to create? Visit the Studio!',
    placement: 'center',
    disableBeacon: true,
    disableOverlay: true,
  },
];

/**
 * Welcome Tour - Mobile version (fewer steps, adjusted placements)
 */
export const welcomeTourStepsMobile: Step[] = [
  {
    target: 'body',
    content: 'Welcome to renaissBlock! Let us show you around.',
    placement: 'center',
    disableBeacon: true,
    disableOverlay: true,
  },
  {
    target: '[data-tour="genre-filters"]',
    content: 'Browse content by category here.',
    placement: 'bottom',
    disableBeacon: true,
  },
  {
    target: '[data-tour="mobile-menu-toggle"]',
    content: 'Access your cart, notifications, and profile from this menu.',
    placement: 'bottom',
    disableBeacon: true,
  },
  {
    target: 'body',
    content: 'Tap any content card to preview and purchase. Enjoy exploring!',
    placement: 'center',
    disableBeacon: true,
    disableOverlay: true,
  },
];

/**
 * Purchase Tour - Triggered on first "Add to Cart" action
 * Guides users through the purchase flow
 */
export const purchaseTourSteps: Step[] = [
  {
    target: '[data-tour="cart-items"]',
    content: 'Items you\'ve added appear here. Review your selections before checkout.',
    placement: 'right',
    disableBeacon: true,
  },
  {
    target: '[data-tour="cart-summary"]',
    content: 'See your total with any applicable fees. We keep pricing transparent.',
    placement: 'left',
    disableBeacon: true,
  },
  {
    target: '[data-tour="checkout-button"]',
    content: 'Ready to purchase? Click here to complete your order securely.',
    placement: 'top',
    disableBeacon: true,
  },
];

/**
 * Library Tour - Triggered after first purchase
 * Shows users how to access purchased content
 */
export const libraryTourSteps: Step[] = [
  {
    target: '[data-tour="library-tabs"]',
    content: 'Your Library! Switch between Books, Art, and other content types you\'ve purchased.',
    placement: 'bottom',
    disableBeacon: true,
  },
  {
    target: '[data-tour="library-item"]',
    content: 'Click any item to start reading or viewing. Your progress is saved automatically.',
    placement: 'right',
    disableBeacon: true,
  },
  {
    target: 'body',
    content: 'All your purchased content appears in this sidebar. Happy reading!',
    placement: 'center',
    disableBeacon: true,
    disableOverlay: true,
  },
];

// ============================================
// CREATOR TRACK TOURS
// ============================================

/**
 * Creator Intro Tour - Triggered on first /studio visit
 * Introduces users to the creator experience
 */
export const creatorIntroTourSteps: Step[] = [
  {
    target: 'body',
    content: 'Welcome to the Creator Studio! This is where you\'ll create and publish your work.',
    placement: 'center',
    disableBeacon: true,
    disableOverlay: true,
  },
  {
    target: '[data-tour="content-type-selection"]',
    content: 'Choose what you want to create: Books, Comics, or Art. Each has its own editor optimized for that content type.',
    placement: 'bottom',
    disableBeacon: true,
  },
  {
    target: '[data-tour="comic-type-card"]',
    content: 'Comics let you create visual stories with panel layouts. Upload artwork or create directly in our editor.',
    placement: 'bottom',
    disableBeacon: true,
  },
  {
    target: 'body',
    content: 'All projects support collaboration - invite team members anytime from the Team tab. Your earnings go directly to your connected wallet in USDC.',
    placement: 'center',
    disableBeacon: true,
    disableOverlay: true,
  },
];

/**
 * Studio Tour - Guides through the creation wizard
 * Triggered when starting first project
 */
export const studioTourSteps: Step[] = [
  {
    target: '[data-tour="content-type-selector"]',
    content: 'First, choose what type of content you want to create: Book, Art, Video, or Music.',
    placement: 'bottom',
    disableBeacon: true,
  },
  {
    target: '[data-tour="upload-area"]',
    content: 'Upload your files or use our built-in editor to create directly.',
    placement: 'top',
    disableBeacon: true,
  },
  {
    target: '[data-tour="customize-panel"]',
    content: 'Set your price, number of editions, and how much to show as a free preview.',
    placement: 'left',
    disableBeacon: true,
  },
  {
    target: '[data-tour="publish-button"]',
    content: 'When everything looks good, publish to make your content available for purchase!',
    placement: 'top',
    disableBeacon: true,
  },
];

/**
 * Dashboard Tour - Shows creators their analytics
 * Triggered on first /dashboard visit
 */
export const dashboardTourSteps: Step[] = [
  {
    target: '[data-tour="earnings-card"]',
    content: 'Track your total earnings at a glance. See how much you\'ve made from your content.',
    placement: 'bottom',
    disableBeacon: true,
  },
  {
    target: '[data-tour="sales-chart"]',
    content: 'View your sales performance over time with detailed analytics.',
    placement: 'bottom',
    disableBeacon: true,
  },
  {
    target: '[data-tour="content-list"]',
    content: 'Manage all your published content. Edit, unpublish, or view stats for each item.',
    placement: 'top',
    disableBeacon: true,
  },
  {
    target: '[data-tour="wallet-section"]',
    content: 'Your connected wallet receives earnings automatically in USDC.',
    placement: 'left',
    disableBeacon: true,
  },
];

/**
 * Collaboration Tour - Guides through team project features
 * Triggered when creating first collaboration
 */
export const collaborationTourSteps: Step[] = [
  {
    target: '[data-tour="team-panel"]',
    content: 'Invite your writer or artist partner by email or username.',
    placement: 'right',
    disableBeacon: true,
  },
  {
    target: '[data-tour="roles-dropdown"]',
    content: 'Assign roles like Writer, Artist, Editor to define responsibilities.',
    placement: 'bottom',
    disableBeacon: true,
  },
  {
    target: '[data-tour="revenue-splits"]',
    content: 'Set fair revenue distribution. Every team member sees their share upfront.',
    placement: 'left',
    disableBeacon: true,
  },
  {
    target: '[data-tour="approval-workflow"]',
    content: 'All team members must approve before publishing. No surprises!',
    placement: 'top',
    disableBeacon: true,
  },
];

// ============================================
// TOUR STEP GETTER
// ============================================

import type { TourName } from '../../contexts/TourContext';

export function getTourSteps(tourName: TourName, isMobile: boolean = false): Step[] {
  switch (tourName) {
    // Consumer tours
    case 'welcome':
      return isMobile ? welcomeTourStepsMobile : welcomeTourSteps;
    case 'purchase':
      return purchaseTourSteps;
    case 'library':
      return libraryTourSteps;

    // Creator tours
    case 'creator-intro':
      return creatorIntroTourSteps;
    case 'studio':
      return studioTourSteps;
    case 'dashboard':
      return dashboardTourSteps;
    case 'collaboration':
      return collaborationTourSteps;

    default:
      return [];
  }
}

// Tour display names for UI
export const tourDisplayNames: Record<TourName, string> = {
  'welcome': 'Welcome Tour',
  'purchase': 'Shopping Tour',
  'library': 'Library Tour',
  'creator-intro': 'Creator Introduction',
  'studio': 'Studio Tour',
  'dashboard': 'Dashboard Tour',
  'collaboration': 'Collaboration Tour',
};
