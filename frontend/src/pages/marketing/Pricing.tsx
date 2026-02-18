import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import SEOHead from './SEOHead';
import MarketingLayout from './MarketingLayout';

const pricingSchemas = [
  {
    "@type": "Offer",
    "name": "Standard",
    "price": "0",
    "priceCurrency": "USD",
    "description": "Free to join and publish. 10% platform fee on sales — creators keep 90% of every sale. Includes automatic revenue splits, secure digital wallet, bank cashouts, reader analytics, and unlimited collaborations.",
    "eligibleRegion": "Worldwide",
    "seller": {
      "@type": "Organization",
      "name": "renaissBlock"
    }
  },
  {
    "@type": "Offer",
    "name": "Founding Creator",
    "price": "0",
    "priceCurrency": "USD",
    "description": "Permanent 1% platform fee — creators keep 99% of every sale. Available to the first 50 creators who complete a project earning $100+ in sales. Includes Founding Creator badge, priority in creator directory, and early access to new features.",
    "eligibleRegion": "Worldwide",
    "seller": {
      "@type": "Organization",
      "name": "renaissBlock"
    }
  }
];

const standardFeatures = [
  'Free to sign up & publish',
  'Automatic revenue splits',
  'Secure digital wallet',
  'Bank cashouts (1-3 days)',
  'Reader analytics',
  'Unlimited collaborations',
];

const foundingFeatures = [
  'Everything in Standard',
  'Permanent 1% fee (forever)',
  'Founding Creator badge',
  'Priority in creator directory',
  'Early access to new features',
  'Exclusive founding creator community',
];

const compareData = [
  { platform: 'renaissBlock', revenue: '90–99%', matching: 'Built-in matching', splits: 'Automatic trustless splits' },
  { platform: 'Webtoon / Tapas', revenue: '~50% (ad rev share)', matching: 'None', splits: 'Manual / external' },
  { platform: 'Patreon', revenue: '88–95%', matching: 'None', splits: 'Manual / external' },
  { platform: 'Fiverr / Upwork', revenue: '80% (one-time)', matching: 'Hiring only', splits: 'N/A (freelance)' },
  { platform: 'Self-publish (Amazon)', revenue: '35–70%', matching: 'None', splits: 'Contracts + lawyers' },
];

export default function Pricing() {
  return (
    <MarketingLayout>
      <SEOHead
        title="Pricing | renaissBlock — Simple, Creator-First Pricing"
        description="Keep 90-99% of every sale. renaissBlock charges a simple 10% platform fee — or just 1% for founding creators. No hidden fees, no subscriptions."
        canonicalPath="/pricing"
        schemas={pricingSchemas}
      />

      <div className="mk-page-hero">
        <h1>Simple, Creator-First Pricing</h1>
        <p>No subscriptions. No hidden fees. You earn, we take a small cut.</p>
      </div>

      <section className="mk-section">
        <div className="mk-container">
          <div className="mk-pricing-cards">
            {/* Standard */}
            <div className="mk-pricing-card">
              <h3>Standard</h3>
              <div className="mk-pricing-pct">90% <span>of every sale is yours</span></div>
              <p className="mk-pricing-desc">10% platform fee</p>
              <ul className="mk-pricing-features">
                {standardFeatures.map((f, i) => (
                  <li key={i}>
                    <Check size={16} className="mk-pricing-check" />
                    {f}
                  </li>
                ))}
              </ul>
              <a href="/#signup" className="mk-btn-secondary" style={{ width: '100%', justifyContent: 'center' }}>
                Get Started Free
              </a>
            </div>

            {/* Founding Creator */}
            <div className="mk-pricing-card mk-pricing-card--featured">
              <div className="mk-pricing-badge">FOUNDING CREATOR</div>
              <h3>Founding Creator</h3>
              <div className="mk-pricing-pct">99% <span>of every sale is yours</span></div>
              <p className="mk-pricing-desc">Just 1% platform fee. Permanent.</p>
              <ul className="mk-pricing-features">
                {foundingFeatures.map((f, i) => (
                  <li key={i}>
                    <Check size={16} className="mk-pricing-check" />
                    {f}
                  </li>
                ))}
              </ul>
              <p className="mk-pricing-desc" style={{ marginBottom: 0, fontSize: 13, color: 'var(--mk-text-muted)' }}>
                Complete one project earning $100+ in sales to qualify.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Comparison Table */}
      <section className="mk-section mk-section--alt">
        <div className="mk-container">
          <div className="mk-section-header">
            <div className="mk-section-label">Compare</div>
            <h2 className="mk-section-title">How We Compare</h2>
          </div>
          <div className="mk-compare-wrap">
            <table className="mk-compare-table">
              <thead>
                <tr>
                  <th>Platform</th>
                  <th>Creator Revenue</th>
                  <th>Collaborator Matching</th>
                  <th>Revenue Splits</th>
                </tr>
              </thead>
              <tbody>
                {compareData.map((row, i) => (
                  <tr key={i}>
                    <td className={i === 0 ? 'mk-compare-highlight' : ''}>{row.platform}</td>
                    <td className={i === 0 ? 'mk-compare-highlight' : ''}>{row.revenue}</td>
                    <td className={i === 0 ? 'mk-compare-highlight' : ''}>{row.matching}</td>
                    <td className={i === 0 ? 'mk-compare-highlight' : ''}>{row.splits}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
