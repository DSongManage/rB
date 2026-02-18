import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Sparkles, ArrowRight, Search, Zap, Shield } from 'lucide-react';
import { API_URL } from '../../config';
import SEOHead from './SEOHead';
import MarketingLayout from './MarketingLayout';
import '../BetaLanding.css';

const softwareAppSchema = {
  "@type": "SoftwareApplication",
  "name": "renaissBlock",
  "applicationCategory": "CreativeWork",
  "operatingSystem": "Web",
  "description": "A comic collaboration platform where writers and artists create together with automatic, trustless revenue sharing. Publish chapter by chapter, split revenue automatically, and cash out to your bank.",
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "USD",
    "description": "Free to join and publish. 10% platform fee on sales."
  }
};

export default function MarketingHome() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [searchParams] = useSearchParams();
  const inviteCode = searchParams.get('invite');

  useEffect(() => {
    if (inviteCode) localStorage.setItem('inviteCode', inviteCode);
  }, [inviteCode]);

  useEffect(() => {
    if (window.location.hash === '#signup') {
      setTimeout(() => {
        document.getElementById('signup')?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage('');
    try {
      const response = await fetch(`${API_URL}/api/beta/request-access/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email,
          message: `Requested via marketing homepage at ${new Date().toISOString()}`
        }),
      });
      const data = await response.json();
      if (response.ok) {
        setMessage("Thanks! We'll review your request and send an invite if approved.");
        setEmail('');
      } else {
        setMessage(data.error || 'Something went wrong. Please try again.');
      }
    } catch {
      setMessage('Unable to submit request. Please try again later.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <MarketingLayout>
      <SEOHead
        title="renaissBlock — Where Writers and Artists Create Together"
        description="A comic collaboration marketplace with automatic revenue sharing. Writers find artists, publish chapter by chapter, and cash out to your bank."
        canonicalPath="/"
        schemas={[softwareAppSchema]}
      />

      {/* HERO SECTION — preserved from original BetaLanding */}
      <section className="hero-section">
        <div className="hero-content">
          <div className="hero-logo">
            <img src="/rb-logo.png" alt="renaissBlock" />
          </div>

          <div className="beta-badge">
            <Sparkles size={14} style={{ display: 'inline', marginRight: 6 }} />
            PRIVATE BETA
          </div>

          <h1 className="hero-title">
            Stories Need Art. Art Needs Stories.
          </h1>

          <p className="hero-subtitle">
            A marketplace for comic collaborations. You focus on your craft - we handle payments, splits, and publishing.
          </p>

          <div className="hero-form">
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  required
                  disabled={submitting}
                  className="email-input"
                />
                <button type="submit" disabled={submitting} className="cta-button">
                  {submitting ? 'Submitting...' : 'Start Creating'}
                </button>
              </div>
              {message && (
                <div className={`form-message ${message.includes('Thanks') ? 'success' : 'error'}`}>
                  {message}
                </div>
              )}
            </form>
            <p className="hero-proof">
              Join writers and artists already creating together
            </p>
            <p className="signin-link">
              Already have access?{' '}
              <Link to={inviteCode ? `/auth?invite=${inviteCode}` : '/auth'}>
                Sign In <ArrowRight size={14} style={{ display: 'inline', verticalAlign: 'middle' }} />
              </Link>
            </p>
          </div>
        </div>
      </section>

      {/* VALUE PROPS */}
      <section className="mk-section mk-section--alt">
        <div className="mk-container">
          <div className="mk-section-header">
            <div className="mk-section-label">Why renaissBlock</div>
            <h2 className="mk-section-title">Everything You Need to Create Together</h2>
          </div>
          <div className="mk-values-grid">
            <div className="mk-value-card">
              <div className="mk-value-icon"><Search size={24} /></div>
              <h3>Find Your Perfect Partner</h3>
              <p>Browse creator profiles, see their work, check if they're open to collaborations. When the fit feels right, send a project proposal directly. No middlemen.</p>
            </div>
            <div className="mk-value-card">
              <div className="mk-value-icon"><Zap size={24} /></div>
              <h3>Automatic Revenue Splits</h3>
              <p>Agree on a split before you publish. Every sale distributes earnings instantly. No invoicing, no awkward money conversations.</p>
            </div>
            <div className="mk-value-card">
              <div className="mk-value-icon"><Shield size={24} /></div>
              <h3>Trustless by Design</h3>
              <p>Smart contracts enforce every agreement. Your partner gets paid the second a sale happens. No trust required — just mutual creativity.</p>
            </div>
          </div>
        </div>
      </section>

      {/* THREE STEPS */}
      <section className="mk-section">
        <div className="mk-container">
          <div className="mk-section-header">
            <div className="mk-section-label">How It Works</div>
            <h2 className="mk-section-title">From Idea to Income in Three Steps</h2>
          </div>
          <div className="mk-steps">
            <div className="mk-step">
              <div className="mk-step-number">STEP 01</div>
              <h3>Browse &amp; Connect</h3>
              <p>Explore creator profiles — writers, artists, colorists. When someone's style clicks with your vision, send them a direct project proposal with your pitch and proposed revenue split.</p>
            </div>
            <div className="mk-step">
              <div className="mk-step-number">STEP 02</div>
              <h3>Collaborate &amp; Publish</h3>
              <p>Once your partner accepts, start creating. Publish chapter by chapter to build your audience and de-risk the project for both sides.</p>
            </div>
            <div className="mk-step">
              <div className="mk-step-number">STEP 03</div>
              <h3>Publish &amp; Earn</h3>
              <p>Every sale splits revenue automatically. Creators cash out to their bank account anytime. Simple.</p>
            </div>
          </div>
        </div>
      </section>

      {/* FOUNDING CREATOR CTA */}
      <section className="mk-section mk-section--alt">
        <div className="mk-container">
          <div className="mk-founding">
            <h2>Become a Founding Creator</h2>
            <div className="mk-founding-limit">Limited to 50 creators</div>
            <p>
              The first 50 creators to complete a project earning $100+ in sales get a permanent{' '}
              <span className="mk-founding-highlight">1% platform fee</span> instead of the standard 10%.{' '}
              Forever.
            </p>
            <a href="/#signup" className="mk-btn-primary">Claim Your Spot</a>
          </div>
        </div>
      </section>

      {/* BETA SIGNUP */}
      <section id="signup" className="mk-beta-section">
        <div className="mk-container">
          <div className="mk-beta-card">
            <h2>Request Beta Access</h2>
            <p>Join the private beta and start creating today.</p>
            <form onSubmit={handleSubmit}>
              <div className="mk-beta-form">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  required
                  disabled={submitting}
                  className="mk-beta-input"
                />
                <button type="submit" disabled={submitting} className="mk-beta-submit">
                  {submitting ? 'Submitting...' : 'Request Access'}
                </button>
              </div>
              {message && (
                <div className={`mk-beta-message ${message.includes('Thanks') ? 'success' : 'error'}`}>
                  {message}
                </div>
              )}
            </form>
            <p className="mk-beta-signin">
              Already have access?{' '}
              <Link to={inviteCode ? `/auth?invite=${inviteCode}` : '/auth'}>Sign In</Link>
            </p>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
