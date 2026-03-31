import React, { useState, useEffect } from 'react';
import { Search, Filter } from 'lucide-react';
import campaignApi, { Campaign } from '../services/campaignApi';
import { CampaignCard } from '../components/campaign/CampaignCard';

export default function CampaignsDiscoverPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [contentFilter, setContentFilter] = useState<string>('');

  useEffect(() => {
    loadCampaigns();
  }, [typeFilter, contentFilter]);

  const loadCampaigns = async () => {
    setLoading(true);
    try {
      const data = await campaignApi.discoverCampaigns({
        type: typeFilter || undefined,
        content_type: contentFilter || undefined,
      });
      setCampaigns(data);
    } catch (err) {
      console.error('Failed to load campaigns:', err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = campaigns.filter(c =>
    !search || c.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="page" style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px' }}>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>
          Discover Campaigns
        </h1>
        <p style={{ fontSize: 15, color: '#94a3b8' }}>
          Back creative projects. Funds are protected by escrow until work is delivered.
        </p>
      </div>

      {/* Search & filters */}
      <div style={{
        display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap',
        alignItems: 'center',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: '#1e293b', borderRadius: 8, padding: '8px 12px',
          flex: 1, minWidth: 200, border: '1px solid #334155',
        }}>
          <Search size={16} style={{ color: '#64748b' }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search campaigns..."
            style={{
              background: 'transparent', border: 'none', outline: 'none',
              color: '#e2e8f0', fontSize: 14, width: '100%',
            }}
          />
        </div>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          style={{
            background: '#1e293b', border: '1px solid #334155', borderRadius: 8,
            padding: '8px 12px', color: '#e2e8f0', fontSize: 13,
          }}
        >
          <option value="">All Types</option>
          <option value="collaborative">Collaborative</option>
          <option value="solo">Solo</option>
        </select>

        <select
          value={contentFilter}
          onChange={(e) => setContentFilter(e.target.value)}
          style={{
            background: '#1e293b', border: '1px solid #334155', borderRadius: 8,
            padding: '8px 12px', color: '#e2e8f0', fontSize: 13,
          }}
        >
          <option value="">All Content</option>
          <option value="book">Books</option>
          <option value="comic">Comics</option>
          <option value="art">Art</option>
        </select>
      </div>

      {/* Campaign grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#64748b' }}>
          Loading campaigns...
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#64748b' }}>
          No campaigns found. Be the first to create one!
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 20,
        }}>
          {filtered.map(campaign => (
            <CampaignCard key={campaign.id} campaign={campaign} />
          ))}
        </div>
      )}
    </div>
  );
}
