import { campaignApi } from '../services/campaignApi';
import { API_URL as API_BASE } from '../config';

// Mock fetch
global.fetch = vi.fn();

beforeEach(() => {
  (global.fetch as vi.Mock).mockClear();
  // First call in any write operation will be the CSRF token fetch
  // Set up a default CSRF mock that resolves immediately
});

describe('campaignApi', () => {
  describe('discoverCampaigns', () => {
    it('fetches active campaigns without auth', async () => {
      (global.fetch as vi.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => [{ id: 1, title: 'Test Campaign' }],
      });

      const campaigns = await campaignApi.discoverCampaigns();
      expect(campaigns).toHaveLength(1);
      expect(campaigns[0].title).toBe('Test Campaign');

      // Check it called the correct URL with credentials
      expect(global.fetch).toHaveBeenCalledWith(
        `${API_BASE}/api/campaigns/discover/`,
        expect.objectContaining({
          credentials: 'include',
        })
      );
    });

    it('passes filter params', async () => {
      (global.fetch as vi.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      await campaignApi.discoverCampaigns({ type: 'solo', content_type: 'book' });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('type=solo'),
        expect.anything()
      );
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('content_type=book'),
        expect.anything()
      );
    });
  });

  describe('createCampaign', () => {
    it('sends campaign data with CSRF token', async () => {
      // First call: CSRF token fetch
      (global.fetch as vi.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ csrfToken: 'test-csrf-123' }),
      });
      // Second call: actual create
      (global.fetch as vi.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 1, title: 'New Campaign' }),
      });

      const result = await campaignApi.createCampaign({
        title: 'New Campaign',
        description: 'Test',
        content_type: 'book',
        campaign_type: 'solo',
        funding_goal: '1000',
        deadline: '2026-05-01T00:00:00Z',
        chapter_count: 5,
      });

      expect(result.title).toBe('New Campaign');
      // Second call should have CSRF header
      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect((global.fetch as vi.Mock).mock.calls[1][1]).toEqual(
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
          headers: expect.objectContaining({
            'X-CSRFToken': 'test-csrf-123',
          }),
        })
      );
    });
  });

  describe('createContributionIntent', () => {
    it('creates intent with 0% fee', async () => {
      // CSRF fetch
      (global.fetch as vi.Mock).mockResolvedValueOnce({
        ok: true, json: async () => ({ csrfToken: 'csrf' }),
      });
      (global.fetch as vi.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          contribution_id: 42,
          amount: '25.00',
          fee: '0.00',
          fee_note: 'Campaign contributions have 0% platform fee.',
        }),
      });

      const intent = await campaignApi.createContributionIntent(1, '25.00');
      expect(intent.fee).toBe('0.00');
      expect(intent.contribution_id).toBe(42);
    });
  });

  describe('confirmContribution', () => {
    it('confirms with transaction signature', async () => {
      // CSRF fetch
      (global.fetch as vi.Mock).mockResolvedValueOnce({
        ok: true, json: async () => ({ csrfToken: 'csrf' }),
      });
      (global.fetch as vi.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          contribution_id: 42,
          amount: '25.00',
          campaign_status: 'active',
          funding_percentage: 25,
          is_goal_met: false,
        }),
      });

      const result = await campaignApi.confirmContribution(42, 'tx_sig_abc');
      expect(result.campaign_status).toBe('active');

      // Second call (index 1) is the actual confirm
      const body = JSON.parse((global.fetch as vi.Mock).mock.calls[1][1].body);
      expect(body.contribution_id).toBe(42);
      expect(body.transaction_signature).toBe('tx_sig_abc');
    });
  });

  describe('launchCampaign', () => {
    it('sends POST to launch endpoint', async () => {
      // CSRF fetch
      (global.fetch as vi.Mock).mockResolvedValueOnce({
        ok: true, json: async () => ({ csrfToken: 'csrf' }),
      });
      (global.fetch as vi.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 1, status: 'active' }),
      });

      const result = await campaignApi.launchCampaign(1);
      expect(result.status).toBe('active');
      // Second call should be the launch POST
      expect((global.fetch as vi.Mock).mock.calls[1][0]).toBe(
        `${API_BASE}/api/campaigns/1/launch/`
      );
    });
  });

  describe('postUpdate', () => {
    it('posts campaign update', async () => {
      // CSRF fetch
      (global.fetch as vi.Mock).mockResolvedValueOnce({
        ok: true, json: async () => ({ csrfToken: 'csrf' }),
      });
      (global.fetch as vi.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 1, title: 'Week 1', body: 'Progress!' }),
      });

      const update = await campaignApi.postUpdate(1, 'Week 1', 'Progress!');
      expect(update.title).toBe('Week 1');
    });
  });

  describe('error handling', () => {
    it('throws on API error', async () => {
      (global.fetch as vi.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: 'Campaign not found' }),
      });

      await expect(campaignApi.getCampaign(999)).rejects.toThrow('Campaign not found');
    });
  });
});
