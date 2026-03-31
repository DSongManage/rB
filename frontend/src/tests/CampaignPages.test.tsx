import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CampaignsDiscoverPage from '../pages/CampaignsDiscoverPage';
import CampaignCreatePage from '../pages/CampaignCreatePage';
import { CampaignProgressBar } from '../components/campaign/CampaignProgressBar';
import { CampaignCard } from '../components/campaign/CampaignCard';
import { Campaign } from '../services/campaignApi';

// Mock fetch globally
global.fetch = vi.fn();

const mockCampaign: Campaign = {
  id: 1,
  title: 'Epic Fantasy Novel',
  description: 'A sweeping fantasy epic spanning 6 chapters.',
  content_type: 'book',
  campaign_type: 'solo',
  funding_goal: '3000.00',
  current_amount: '1500.00',
  backer_count: 12,
  deadline: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
  status: 'active',
  creator_username: 'author1',
  creator_display_name: 'Great Author',
  funding_percentage: 50,
  is_goal_met: false,
  chapter_count: 6,
  chapters_published: 0,
  amount_per_chapter: '500.00',
  created_at: new Date().toISOString(),
};

describe('CampaignProgressBar', () => {
  it('renders progress bar with correct percentage', () => {
    render(
      <CampaignProgressBar
        currentAmount={1500}
        fundingGoal={3000}
        backerCount={12}
      />
    );
    expect(screen.getByText(/\$1,500/)).toBeInTheDocument();
    expect(screen.getByText(/\$3,000/)).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByText(/12 backers/)).toBeInTheDocument();
  });

  it('shows 100% when fully funded', () => {
    render(
      <CampaignProgressBar
        currentAmount={3000}
        fundingGoal={3000}
        backerCount={25}
      />
    );
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('caps at 100% when over-funded', () => {
    render(
      <CampaignProgressBar
        currentAmount={5000}
        fundingGoal={3000}
        backerCount={50}
      />
    );
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('renders compact mode without backer count text', () => {
    const { container } = render(
      <CampaignProgressBar
        currentAmount={500}
        fundingGoal={1000}
        backerCount={5}
        compact
      />
    );
    // In compact mode, backer count text is not rendered
    expect(screen.queryByText(/5 backers/)).not.toBeInTheDocument();
  });
});

describe('CampaignCard', () => {
  it('renders campaign title and creator', () => {
    render(
      <MemoryRouter>
        <CampaignCard campaign={mockCampaign} />
      </MemoryRouter>
    );
    expect(screen.getByText('Epic Fantasy Novel')).toBeInTheDocument();
    expect(screen.getByText(/Great Author/)).toBeInTheDocument();
  });

  it('shows campaign type badge', () => {
    render(
      <MemoryRouter>
        <CampaignCard campaign={mockCampaign} />
      </MemoryRouter>
    );
    expect(screen.getByText('Solo')).toBeInTheDocument();
    expect(screen.getByText('book')).toBeInTheDocument();
  });

  it('shows backer count', () => {
    render(
      <MemoryRouter>
        <CampaignCard campaign={mockCampaign} />
      </MemoryRouter>
    );
    expect(screen.getByText('12')).toBeInTheDocument();
  });
});

describe('CampaignsDiscoverPage', () => {
  beforeEach(() => {
    (global.fetch as vi.Mock).mockClear();
  });

  it('renders page title', async () => {
    (global.fetch as vi.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => [mockCampaign],
    });

    render(
      <MemoryRouter>
        <CampaignsDiscoverPage />
      </MemoryRouter>
    );

    expect(screen.getByText('Discover Campaigns')).toBeInTheDocument();
  });

  it('shows campaigns after loading', async () => {
    (global.fetch as vi.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => [mockCampaign],
    });

    render(
      <MemoryRouter>
        <CampaignsDiscoverPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Epic Fantasy Novel')).toBeInTheDocument();
    });
  });

  it('shows empty state when no campaigns', async () => {
    (global.fetch as vi.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });

    render(
      <MemoryRouter>
        <CampaignsDiscoverPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/No campaigns found/)).toBeInTheDocument();
    });
  });

  it('has search input', async () => {
    (global.fetch as vi.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });

    render(
      <MemoryRouter>
        <CampaignsDiscoverPage />
      </MemoryRouter>
    );

    expect(screen.getByPlaceholderText('Search campaigns...')).toBeInTheDocument();
  });
});

describe('CampaignCreatePage', () => {
  it('renders create page with type selection', () => {
    render(
      <MemoryRouter>
        <CampaignCreatePage />
      </MemoryRouter>
    );

    expect(screen.getByText('Create Campaign')).toBeInTheDocument();
    expect(screen.getByText('Solo Project')).toBeInTheDocument();
    expect(screen.getByText('Collaborative Project')).toBeInTheDocument();
  });

  it('shows 0% fee messaging', () => {
    render(
      <MemoryRouter>
        <CampaignCreatePage />
      </MemoryRouter>
    );

    expect(screen.getByText(/0% platform fee/)).toBeInTheDocument();
  });

  it('navigates to basics step when type is selected', async () => {
    render(
      <MemoryRouter>
        <CampaignCreatePage />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByText('Solo Project'));

    await waitFor(() => {
      expect(screen.getByText('Campaign Basics')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Your campaign title')).toBeInTheDocument();
    });
  });

  it('shows chapter count field for solo campaigns', async () => {
    render(
      <MemoryRouter>
        <CampaignCreatePage />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByText('Solo Project'));

    await waitFor(() => {
      expect(screen.getByText(/Number of Chapters/)).toBeInTheDocument();
    });
  });
});
