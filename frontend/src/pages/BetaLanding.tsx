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
        setMessage('Thanks! We\'ll review your request and send an invite if approved.');
        setEmail('');
      } else {
        setMessage(`${data.error || 'Something went wrong. Please try again.'}`);
      }
    } catch (error) {
      console.error('Beta request error:', error);
      setMessage('Unable to submit request. Please try again later.');
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
                <button
                  type="submit"
                  disabled={submitting}
                  className="cta-button"
                >
                  {submitting ? 'Submitting...' : 'Start Creating'}
                </button>
              </div>
              {message && <div className={`form-message ${message.includes('Thanks') ? 'success' : 'error'}`}>{message}</div>}
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

      {/* 2. COMPARISON SECTION */}
      <section className="comparison-section">
        <div className="container">
          <h2 className="section-title">Create on Your Terms</h2>

          <div className="comparison-table-wrapper">
            <table className="comparison-table">
              <thead>
                <tr>
                  <th className="old-way-header">THE OLD WAY</th>
                  <th className="new-way-header">THE RENAISSBLOCK WAY</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="old-way">
                    <span className="main-text">Find Collaborators by Luck</span>
                    <span className="sub-text">hope you know someone</span>
                  </td>
                  <td className="new-way">
                    <span className="main-text">Browse a Marketplace</span>
                    <span className="sub-text">writers and artists looking for each other</span>
                  </td>
                </tr>
                <tr>
                  <td className="old-way">
                    <span className="main-text">Negotiate Awkward Splits</span>
                    <span className="sub-text">verbal agreements, hope for the best</span>
                  </td>
                  <td className="new-way">
                    <span className="main-text">Set Terms Upfront</span>
                    <span className="sub-text">revenue splits are automatic, every sale</span>
                  </td>
                </tr>
                <tr>
                  <td className="old-way">
                    <span className="main-text">Risk the Whole Project</span>
                    <span className="sub-text">commit to 200 pages with a stranger</span>
                  </td>
                  <td className="new-way">
                    <span className="main-text">Publish Chapter by Chapter</span>
                    <span className="sub-text">test the collaboration, build as you go</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* 3. VALUE PROPS */}
      <section className="benefits-section">
        <div className="container">
          <h2 className="section-title">Built for Comics That Take Two</h2>

          <div className="benefits-grid">
            <div className="benefit-card">
              <div className="benefit-icon">
                <Pen size={48} />
              </div>
              <h3>Your Script or Your Art</h3>
              <p>Bring what you've got. Post your project, set your terms, find the missing piece.</p>
            </div>

            <div className="benefit-card">
              <div className="benefit-icon">
                <Users size={48} />
              </div>
              <h3>Find Your Collaborator</h3>
              <p>Browse writers looking for artists. Browse artists looking for scripts. Message, discuss, team up.</p>
            </div>

            <div className="benefit-card">
              <div className="benefit-icon">
                <Heart size={48} />
              </div>
              <h3>Fair Splits, Zero Drama</h3>
              <p>Revenue splits happen automatically every sale. No invoices, no chasing, no awkward conversations.</p>
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
              <h3>Post</h3>
              <p>Writers post scripts. Artists post portfolios. Describe what you're looking for.</p>
            </div>

            <div className="timeline-connector">
              <ArrowRight size={24} />
            </div>

            <div className="timeline-step">
              <div className="step-number">2</div>
              <h3>Team Up</h3>
              <p>Find your match. Agree on a split. Start your first chapter.</p>
            </div>

            <div className="timeline-connector">
              <ArrowRight size={24} />
            </div>

            <div className="timeline-step">
              <div className="step-number">3</div>
              <h3>Publish & Earn</h3>
              <p>Release chapter by chapter. Every sale pays both of you instantly.</p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. SOCIAL PROOF */}
      <section className="testimonial-section">
        <div className="container">
          <h2 className="section-title">Creators Already Here</h2>

          <div className="testimonials-grid">
            <div className="testimonial-card">
              <p className="testimonial-quote">
                "I'd been sitting on a fantasy script for two years because I can't draw. Found an artist in the first week, and we just published chapter three."
              </p>
              <div className="testimonial-author">
                <div className="author-name">Marcus T.</div>
                <div className="author-role">Writer</div>
              </div>
            </div>

            <div className="testimonial-card">
              <p className="testimonial-quote">
                "I was tired of drawing fan art for exposure. Now I'm working on an original series and actually getting paid for it."
              </p>
              <div className="testimonial-author">
                <div className="author-name">Elena R.</div>
                <div className="author-role">Artist</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. FINAL CTA */}
      <section className="final-cta-section">
        <div className="container">
          <div className="final-cta-card">
            <h2>Your Comic Is Waiting</h2>
            <p className="cta-subtext">
              Whether you write or draw, someone's looking for you.
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
                  {submitting ? 'Submitting...' : 'Join the Beta'}
                </button>
              </div>
              {message && <div className={`form-message ${message.includes('Thanks') ? 'success' : 'error'}`}>{message}</div>}
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
          <div className="footer-links">
            <Link to="/about">About</Link>
            <Link to="/faq">FAQ</Link>
            <Link to="/terms">Terms</Link>
            <Link to="/privacy">Privacy</Link>
            <Link to="/contact">Contact</Link>
          </div>

          <div className="footer-bottom">
            <p>&copy; 2026 renaissBlock</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
