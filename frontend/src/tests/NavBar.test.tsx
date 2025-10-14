/**
 * NavBar.test.tsx
 * 
 * Tests for the NavBar (Header) component in App.tsx
 * Verifies that authenticated and unauthenticated users see the correct links
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import App from '../App';

// Mock fetch globally
global.fetch = jest.fn();

describe('NavBar Authentication Links', () => {
  beforeEach(() => {
    // Reset mocks before each test
    (global.fetch as jest.Mock).mockReset();
  });

  test('shows "Sign in" link for unauthenticated users', async () => {
    // Mock unauthenticated response
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ authenticated: false, user_id: null, username: null }),
    });

    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    );

    // Wait for auth check to complete
    await waitFor(() => {
      const signInButton = screen.getByText(/sign in/i);
      expect(signInButton).toBeInTheDocument();
    });

    // Verify Profile link is NOT visible
    const profileLinks = screen.queryAllByText(/profile/i);
    expect(profileLinks.length).toBe(0);
  });

  test('shows Profile, Collaborators, and Logout links for authenticated users', async () => {
    // Mock authenticated response for /api/auth/status/
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          authenticated: true,
          user_id: 2,
          username: 'Learn4',
          wallet_address: null,
        }),
      })
      // Mock notifications endpoint (called if authenticated)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [], // No pending notifications
      })
      // Mock /api/content/ for HomePage
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    );

    // Wait for auth check and links to render
    await waitFor(() => {
      // Profile link should be visible
      const profileLink = screen.getByText(/profile/i);
      expect(profileLink).toBeInTheDocument();
    });

    // Collaborators link should be visible
    const collaboratorsLink = screen.getByText(/collaborators/i);
    expect(collaboratorsLink).toBeInTheDocument();

    // Logout link should be visible
    const logoutLink = screen.getByText(/logout/i);
    expect(logoutLink).toBeInTheDocument();

    // "Sign in" should NOT be visible
    const signInButton = screen.queryByText(/sign in/i);
    expect(signInButton).not.toBeInTheDocument();
  });

  test('shows notification badge when user has pending invites', async () => {
    // Mock authenticated response with 2 pending notifications
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          authenticated: true,
          user_id: 2,
          username: 'Learn4',
        }),
      })
      // Mock notifications endpoint with 2 pending invites
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { id: 1, sender_username: 'artist1', message: 'Collab invite' },
          { id: 2, sender_username: 'artist2', message: 'Another invite' },
        ],
      })
      // Mock /api/content/
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    );

    // Wait for notification badge to appear
    await waitFor(() => {
      // The badge shows the count (2)
      const badge = screen.getByText('2');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass('rb-badge');
    });
  });

  test('updates NavBar after login (polling)', async () => {
    // Start unauthenticated
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ authenticated: false }),
    });

    const { rerender } = render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    );

    // Initially shows "Sign in"
    await waitFor(() => {
      expect(screen.getByText(/sign in/i)).toBeInTheDocument();
    });

    // Simulate login (polling detects auth change)
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          authenticated: true,
          user_id: 2,
          username: 'Learn4',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

    // Force re-render (simulates polling interval)
    rerender(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    );

    // After auth update, Profile should appear
    await waitFor(() => {
      const profileLink = screen.getByText(/profile/i);
      expect(profileLink).toBeInTheDocument();
    });
  });
});
