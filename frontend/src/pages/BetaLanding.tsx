import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Sparkles, Pen, Users, Heart, ArrowRight, CheckCircle
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
            <Sparkles size={14} style={{ display: 'inline', marginRight: 6 }} />
            PRIVATE BETA
          </div>

          <h1 className="hero-title">
            Unleash What's Inside You
          </h1>

          <p className="hero-subtitle">
            A home for serious creators to write, collaborate, and share their work with the world
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
                  {submitting ? 'Submitting...' : 'Start Creating'}
                </button>
              </div>
              {message && <div className={`form-message ${message.startsWith('✅') ? 'success' : 'error'}`}>{message}</div>}
            </form>
            <p className="hero-proof">
              Join a growing community of authors and artists
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

      {/* 2. COMPARISON SECTION */}
      <section className="comparison-section">
        <div className="container">
          <h2 className="section-title">Create on Your Terms</h2>

          <div className="comparison-table-wrapper">
            <table className="comparison-table">
              <thead>
                <tr>
                  <th className="old-way-header">THE OLD WAY</th>
                  <th className="new-way-header">THE renaissBlock WAY</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="old-way">
                    <span className="main-text">Gatekeepers Decide</span>
                    <span className="sub-text">wait for permission</span>
                  </td>
                  <td className="new-way">
                    <span className="main-text">You Decide</span>
                    <span className="sub-text">publish when you're ready</span>
                  </td>
                </tr>
                <tr>
                  <td className="old-way">
                    <span className="main-text">Work in Isolation</span>
                    <span className="sub-text">hope to meet the right collaborator</span>
                  </td>
                  <td className="new-way">
                    <span className="main-text">Find Your People</span>
                    <span className="sub-text">connect with creators who complete your vision</span>
                  </td>
                </tr>
                <tr>
                  <td className="old-way">
                    <span className="main-text">Chase Your Earnings</span>
                    <span className="sub-text">invoices, delays, disputes</span>
                  </td>
                  <td className="new-way">
                    <span className="main-text">Earnings Come to You</span>
                    <span className="sub-text">automatic, instant, fair</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* 3. WHY CREATORS CHOOSE US */}
      <section className="benefits-section">
        <div className="container">
          <h2 className="section-title">Built for Creators Who Mean It</h2>

          <div className="benefits-grid">
            <div className="benefit-card">
              <div className="benefit-icon">
                <Pen size={48} />
              </div>
              <h3>Your Work, Your Way</h3>
              <p>No gatekeepers. No algorithms deciding your fate. Just you and your readers.</p>
            </div>

            <div className="benefit-card">
              <div className="benefit-icon">
                <Users size={48} />
              </div>
              <h3>Find Your Creative Other Half</h3>
              <p>Writers meet illustrators. Musicians meet lyricists. Great work happens together.</p>
            </div>

            <div className="benefit-card">
              <div className="benefit-icon">
                <Heart size={48} />
              </div>
              <h3>Fair Splits, Zero Drama</h3>
              <p>Collaborate with confidence. Everyone gets paid automatically, exactly as agreed.</p>
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
              <p>Bring your vision to life</p>
            </div>

            <div className="timeline-connector">
              <ArrowRight size={24} />
            </div>

            <div className="timeline-step">
              <div className="step-number">2</div>
              <h3>Collaborate</h3>
              <p>Find partners who elevate your work</p>
            </div>

            <div className="timeline-connector">
              <ArrowRight size={24} />
            </div>

            <div className="timeline-step">
              <div className="step-number">3</div>
              <h3>Share</h3>
              <p>Reach readers who value quality</p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. SOCIAL PROOF */}
      <section className="testimonial-section">
        <div className="container">
          <h2 className="section-title">Creators Already Here</h2>

          <div className="testimonial-card">
            <p className="testimonial-quote">
              "I'd been sitting on my manuscript for two years, afraid to self-publish alone. On renaissBlock, I found Maya — the illustrator I didn't know I needed. Three months later, we had a book we're both proud of."
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
            <h2>Ready to Create Something Meaningful?</h2>
            <p className="cta-subtext">
              Join a community of serious creators building the next wave of quality content
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
                Sign In <ArrowRight size={14} style={{ display: 'inline', verticalAlign: 'middle' }} />
              </Link>
            </p>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="landing-footer">
        <div className="container">
          <div className="footer-grid">
            <div className="footer-col">
              <div className="footer-logo">
                <img src="/rb-logo.png" alt="renaissBlock" />
                <span>renaissBlock</span>
              </div>
              <p className="footer-tagline">
                Where serious creators thrive
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
