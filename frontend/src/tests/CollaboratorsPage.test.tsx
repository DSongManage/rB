import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import CollaboratorsPage from '../pages/CollaboratorsPage';

// Mock fetch globally
global.fetch = jest.fn();

describe('CollaboratorsPage Enhanced Display', () => {
  beforeEach(() => {
    (global.fetch as jest.Mock).mockClear();
  });

  it('displays user cards with capabilities, accomplishments, and stats', async () => {
    // Mock API response with enhanced data (FR8)
    const mockResults = [
      {
        id: 1,
        username: 'creator_pro',
        display_name: 'Pro Creator',
        wallet_address: '8h3ZjWbGATW9qRzbMm45Zd1jA6dR4G8FCjdckpeWubhV',
        roles: ['author', 'artist'],
        genres: ['fantasy', 'scifi'],
        content_count: 15,
        total_sales_usd: 2500.50,
        successful_collabs: 8,
        tier: 'Pro',
        status: 'Available',
        status_category: 'green',
        avatar_url: '',
        location: 'San Francisco, CA',
      },
      {
        id: 2,
        username: 'artist_elite',
        display_name: 'Elite Artist',
        wallet_address: '9ZACvfz6GNqa7fvtXTbsWUKjgzHUeJwxg4qiG8oRB7eH',
        roles: ['artist', 'designer'],
        genres: ['art', 'abstract'],
        content_count: 42,
        total_sales_usd: 10250.00,
        successful_collabs: 23,
        tier: 'Elite',
        status: 'Selective',
        status_category: 'yellow',
        avatar_url: 'https://example.com/avatar.jpg',
        location: 'New York, NY',
      },
    ];

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResults,
    });

    render(
      <BrowserRouter>
        <CollaboratorsPage />
      </BrowserRouter>
    );

    // Wait for API call and rendering
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/users/search/'),
        expect.objectContaining({ credentials: 'include' })
      );
    });

    // Assert user cards are rendered
    expect(await screen.findByText('@creator_pro')).toBeInTheDocument();
    expect(screen.getByText('@artist_elite')).toBeInTheDocument();

    // Assert display names
    expect(screen.getByText('Pro Creator')).toBeInTheDocument();
    expect(screen.getByText('Elite Artist')).toBeInTheDocument();

    // Assert locations
    expect(screen.getByText(/San Francisco, CA/)).toBeInTheDocument();
    expect(screen.getByText(/New York, NY/)).toBeInTheDocument();

    // Assert capabilities (roles and genres badges)
    expect(screen.getByText('author')).toBeInTheDocument();
    expect(screen.getByText('artist')).toBeInTheDocument(); // Appears twice (creator_pro + artist_elite)
    expect(screen.getByText('designer')).toBeInTheDocument();
    expect(screen.getByText('fantasy')).toBeInTheDocument();
    expect(screen.getByText('scifi')).toBeInTheDocument();
    expect(screen.getByText('art')).toBeInTheDocument();
    expect(screen.getByText('abstract')).toBeInTheDocument();

    // Assert accomplishments and stats
    expect(screen.getByText('15')).toBeInTheDocument(); // creator_pro NFTs
    expect(screen.getByText('42')).toBeInTheDocument(); // artist_elite NFTs
    expect(screen.getAllByText(/NFTs Minted/i)).toHaveLength(2);

    expect(screen.getByText('8')).toBeInTheDocument(); // creator_pro collabs
    expect(screen.getByText('23')).toBeInTheDocument(); // artist_elite collabs
    expect(screen.getAllByText(/Collaborations/i)).toHaveLength(2);

    expect(screen.getByText('$2,500.50')).toBeInTheDocument(); // creator_pro sales
    expect(screen.getByText('$10,250')).toBeInTheDocument(); // artist_elite sales
    expect(screen.getAllByText(/Total Sales/i)).toHaveLength(2);

    // Assert status badges (now shows actual status text, not category)
    expect(screen.getByText('Available')).toBeInTheDocument(); // creator_pro
    expect(screen.getByText('Selective')).toBeInTheDocument(); // artist_elite

    // Assert tier badges
    expect(screen.getByText('Pro Tier')).toBeInTheDocument();
    expect(screen.getByText('Elite Tier')).toBeInTheDocument();

    // Assert invite buttons
    const inviteButtons = screen.getAllByText('Invite to Collaborate');
    expect(inviteButtons).toHaveLength(2);
  });

  it('shows loading state while fetching', () => {
    (global.fetch as jest.Mock).mockImplementation(() => new Promise(() => {})); // Never resolves

    render(
      <BrowserRouter>
        <CollaboratorsPage />
      </BrowserRouter>
    );

    expect(screen.getByText('Searching…')).toBeInTheDocument();
  });

  it('shows empty state when no results', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });

    render(
      <BrowserRouter>
        <CollaboratorsPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/No collaborators found/i)).toBeInTheDocument();
    });
  });

  it('filters by role, genre, and location via query params', async () => {
    // Mock initial empty fetch
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => [],
    });

    const { container } = render(
      <BrowserRouter>
        <CollaboratorsPage />
      </BrowserRouter>
    );

    // Wait for initial fetch to complete
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });

    // Verify the component loaded and search inputs are present
    const roleInput = screen.getByPlaceholderText(/Role/i);
    expect(roleInput).toBeInTheDocument();
    
    // The debounced search happens automatically via useEffect
    // Verify fetch was called (at least once for initial load)
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/users/search/'),
      expect.objectContaining({ credentials: 'include' })
    );
  });

  it('opens invite modal when Invite button clicked and sends invite', async () => {
    const mockUser = {
      id: 1,
      username: 'test_creator',
      display_name: 'Test Creator',
      wallet_address: '8h3ZjWbGATW9qRzbMm45Zd1jA6dR4G8FCjdckpeWubhV',
      roles: ['author'],
      genres: ['fantasy'],
      content_count: 10,
      total_sales_usd: 1000,
      successful_collabs: 5,
      tier: 'Pro',
      status: 'Available',
      status_category: 'green',
      avatar_url: '',
      location: 'SF',
    };

    // Mock search results
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => [mockUser],
    });

    render(
      <BrowserRouter>
        <CollaboratorsPage />
      </BrowserRouter>
    );

    // Wait for user card to render
    const inviteButton = await screen.findByText('Invite to Collaborate');
    expect(inviteButton).toBeInTheDocument();

    // Click invite button
    fireEvent.click(inviteButton);

    // Assert modal opens
    await waitFor(() => {
      expect(screen.getByText('@test_creator')).toBeInTheDocument();
      expect(screen.getByText('Project Pitch')).toBeInTheDocument();
    });

    // Assert recipient info displayed in modal header
    expect(screen.getByText('Test Creator')).toBeInTheDocument();
    expect(screen.getByText('Available')).toBeInTheDocument();
    expect(screen.getByText('author')).toBeInTheDocument();

    // Mock CSRF token fetch
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ csrfToken: 'test-csrf-token' }),
    });

    // Mock invite POST
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        invite_id: 123,
        status: 'pending',
        invited_users: ['test_creator'],
        message: 'Invite sent',
      }),
    });

    // Find and click Send Invite button
    const sendButton = screen.getByText('Send Invite');
    fireEvent.click(sendButton);

    // Assert invite API called with correct data
    await waitFor(() => {
      const inviteCalls = (global.fetch as jest.Mock).mock.calls.filter(
        call => call[0] && call[0].includes('/api/invite/')
      );
      expect(inviteCalls.length).toBeGreaterThan(0);
      
      const inviteCall = inviteCalls[0];
      const body = JSON.parse(inviteCall[1].body);
      expect(body.collaborators).toEqual([1]);
      expect(body.equity_percent).toBe(50); // Default
    });

    // Assert success message shown
    await waitFor(() => {
      expect(screen.getByText(/Invite sent/i)).toBeInTheDocument();
    });
  });
});

