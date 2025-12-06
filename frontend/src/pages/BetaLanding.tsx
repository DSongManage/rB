import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Rocket, DollarSign, Users, Lock, ArrowRight, CheckCircle
} from 'lucide-react';
import { API_URL } from '../config';
import './BetaLanding.css';

export default function BetaLanding() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const inviteCode = searchParams.get('invite');

  React.useEffect(() => {
    if (inviteCode) {
      localStorage.setItem('inviteCode', inviteCode);
    }
  }, [inviteCode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage('');

    try {
      const response = await fetch(`${API_URL}/api/beta/request-access/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          email: email,
          message: `Requested via beta landing page at ${new Date().toISOString()}`
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage('✅ Thanks! We\'ll review your request and send an invite if approved.');
        setEmail('');
      } else {
        setMessage(`❌ ${data.error || 'Something went wrong. Please try again.'}`);
      }
    } catch (error) {
      console.error('Beta request error:', error);
      setMessage('❌ Unable to submit request. Please try again later.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="beta-landing">
      {/* 1. HERO SECTION */}
      <section className="hero-section">
        <div className="hero-content">
          <div className="hero-logo">
            <img src="/rb-logo.png" alt="renaissBlock" />
          </div>

          <div className="beta-badge">
            <Rocket size={14} style={{ display: 'inline', marginRight: 6 }} />
            PRIVATE BETA
          </div>

          <h1 className="hero-title">
            Collaborate Without Risk.<br />Earn Without Limits.
          </h1>

          <p className="hero-subtitle">
            Find your creative partner, publish together, and keep what you earn
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
                <button
                  type="submit"
                  disabled={submitting}
                  className="cta-button"
                >
                  {submitting ? 'Joining...' : 'Join the Revolution'}
                </button>
              </div>
              {message && <div className={`form-message ${message.startsWith('✅') ? 'success' : 'error'}`}>{message}</div>}
            </form>
            <p className="hero-proof">
              <CheckCircle size={16} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
              500+ creators already building
            </p>
            <p className="signin-link">
              Already have access?{' '}
              <Link to={inviteCode ? `/auth?invite=${inviteCode}` : '/auth'}>
                Sign In →
              </Link>
            </p>
          </div>
        </div>
      </section>

      {/* 2. PROBLEM → SOLUTION VISUAL */}
      <section className="comparison-section">
        <div className="container">
          <h2 className="section-title">Other Platforms vs renaissBlock</h2>

          <div className="comparison-grid">
            <div className="comparison-card them">
              <div className="card-label">THEM</div>
              <div className="comparison-items">
                <div className="comparison-item">
                  <span className="item-value bad">Keep 30%</span>
                  <span className="item-label">of your revenue</span>
                </div>
                <div className="comparison-item">
                  <span className="item-value bad">No Rights</span>
                  <span className="item-label">lose ownership</span>
                </div>
                <div className="comparison-item">
                  <span className="item-value bad">Work Alone</span>
                  <span className="item-label">hard to find partners</span>
                </div>
              </div>
            </div>

            <div className="comparison-arrow">
              <ArrowRight size={40} />
            </div>

            <div className="comparison-card you">
              <div className="card-label">YOU</div>
              <div className="comparison-items">
                <div className="comparison-item">
                  <span className="item-value good">Keep 90%</span>
                  <span className="item-label">of every sale</span>
                </div>
                <div className="comparison-item">
                  <span className="item-value good">Own Forever</span>
                  <span className="item-label">blockchain-backed</span>
                </div>
                <div className="comparison-item">
                  <span className="item-value good">Collaborate</span>
                  <span className="item-label">find perfect partners</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. THREE CORE BENEFITS */}
      <section className="benefits-section">
        <div className="container">
          <h2 className="section-title">Why Creators Choose Us</h2>

          <div className="benefits-grid">
            <div className="benefit-card">
              <div className="benefit-icon">
                <DollarSign size={48} />
              </div>
              <h3>Keep 90% of Every Sale</h3>
              <p>Other platforms take 70%. You keep 10-15% after fees. We keep 90%.</p>
            </div>

            <div className="benefit-card">
              <div className="benefit-icon">
                <Users size={48} />
              </div>
              <h3>Find Perfect Partners</h3>
              <p>Collaborate with verified creators. Splits handled automatically.</p>
            </div>

            <div className="benefit-card">
              <div className="benefit-icon">
                <Lock size={48} />
              </div>
              <h3>Own It All Forever</h3>
              <p>Blockchain-backed ownership. No takedowns, no platform control.</p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. HOW IT WORKS */}
      <section className="how-it-works-section">
        <div className="container">
          <h2 className="section-title">How It Works</h2>

          <div className="timeline">
            <div className="timeline-step">
              <div className="step-number">1</div>
              <h3>Create</h3>
              <p>Upload your content</p>
            </div>

            <div className="timeline-connector">
              <ArrowRight size={24} />
            </div>

            <div className="timeline-step">
              <div className="step-number">2</div>
              <h3>Collaborate</h3>
              <p>Find partners and set rev splits</p>
            </div>

            <div className="timeline-connector">
              <ArrowRight size={24} />
            </div>

            <div className="timeline-step">
              <div className="step-number">3</div>
              <h3>Earn</h3>
              <p>Keep your revenue</p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. SOCIAL PROOF */}
      <section className="testimonial-section">
        <div className="container">
          <h2 className="section-title">Creators Already Building</h2>

          <div className="testimonial-card">
            <p className="testimonial-quote">
              "I spent years trying to find the right illustrator. Within a week on renaissBlock, I met Maya. We published our children's book in 3 months and both earned more than we ever did with traditional publishers."
            </p>
            <div className="testimonial-author">
              <div className="author-name">Sarah K.</div>
              <div className="author-role">Children's Author</div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. FINAL CTA */}
      <section className="final-cta-section">
        <div className="container">
          <div className="final-cta-card">
            <h2>Ready to Own Your Creative Future?</h2>
            <p className="cta-subtext">
              Join 500+ creators building on a platform they control
            </p>

            <form onSubmit={handleSubmit} className="final-cta-form">
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
                <button
                  type="submit"
                  disabled={submitting}
                  className="cta-button"
                >
                  {submitting ? 'Submitting...' : 'Get Early Access'}
                </button>
              </div>
              {message && <div className={`form-message ${message.startsWith('✅') ? 'success' : 'error'}`}>{message}</div>}
            </form>

            <p className="signin-link">
              Already have access?{' '}
              <Link to={inviteCode ? `/auth?invite=${inviteCode}` : '/auth'}>
                Sign In →
              </Link>
            </p>
          </div>
        </div>
      </section>

      {/* FOOTER - Simplified */}
      <footer className="landing-footer">
        <div className="container">
          <div className="footer-grid">
            <div className="footer-col">
              <div className="footer-logo">
                <img src="/rb-logo.png" alt="renaissBlock" />
                <span>renaissBlock</span>
              </div>
              <p className="footer-tagline">
                Where creators own their future
              </p>
            </div>

            <div className="footer-col">
              <h4>Platform</h4>
              <ul>
                <li><Link to="/auth">Sign In</Link></li>
                <li><Link to="/wallet-info">About Wallets</Link></li>
              </ul>
            </div>

            <div className="footer-col">
              <h4>Legal</h4>
              <ul>
                <li><Link to="/terms">Terms of Service</Link></li>
              </ul>
            </div>
          </div>

          <div className="footer-bottom">
            <p>&copy; 2026 renaissBlock. Built for creators, by creators.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
