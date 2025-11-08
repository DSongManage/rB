import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import './BetaLanding.css';

export default function BetaLanding() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Check if user has invite code in URL
  const inviteCode = searchParams.get('invite');

  // If invite code exists, allow bypass to auth page
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
      // TODO: Replace with actual API endpoint
      await new Promise(resolve => setTimeout(resolve, 1000));
      setMessage('✅ Thanks! We\'ll send you an invite soon.');
      setEmail('');
    } catch (error) {
      setMessage('❌ Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="beta-landing">
      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-content">
          <div className="beta-badge">Private Beta</div>

          <h1 className="hero-title">
            The Future of Creative<br />Collaboration
          </h1>

          <p className="hero-subtitle">
            Where creators collaborate and automatically split revenue using blockchain technology. No middlemen, no disputes—just fair compensation.
          </p>

          {/* Hero CTA Form */}
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
                  {submitting ? 'Requesting...' : 'Request Access'}
                </button>
              </div>
              {message && <div className={`form-message ${message.startsWith('✅') ? 'success' : 'error'}`}>{message}</div>}
            </form>
            <p className="signin-link">
              Already have access?{' '}
              <Link to={inviteCode ? `/auth?invite=${inviteCode}` : '/auth'}>
                Sign In
              </Link>
            </p>
          </div>

          {/* Decorative Elements */}
          <div className="hero-decoration">
            <div className="decoration-circle circle-1"></div>
            <div className="decoration-circle circle-2"></div>
            <div className="decoration-circle circle-3"></div>
          </div>
        </div>
      </section>

      {/* Problem/Solution Section */}
      <section className="problem-solution-section">
        <div className="container">
          <div className="problem-solution-grid">
            <div className="problem-card">
              <div className="card-icon problem-icon">⚠️</div>
              <h3>The Problem</h3>
              <p>
                Traditional collaboration requires complex contracts, lawyers, and endless trust issues. Revenue splits are manual, disputes are common, and creators waste time on paperwork instead of creating.
              </p>
              <ul className="problem-list">
                <li>❌ Complex legal contracts</li>
                <li>❌ Payment disputes</li>
                <li>❌ Manual revenue distribution</li>
                <li>❌ Lack of transparency</li>
              </ul>
            </div>

            <div className="solution-card">
              <div className="card-icon solution-icon">✨</div>
              <h3>Our Solution</h3>
              <p>
                Smart contracts automatically enforce revenue splits. Set percentages once, collaborate freely, and earn instantly when your work sells. No lawyers, no disputes, no delays.
              </p>
              <ul className="solution-list">
                <li>✅ Automatic smart contracts</li>
                <li>✅ Instant revenue splits</li>
                <li>✅ Transparent & trustless</li>
                <li>✅ Zero paperwork</li>
              </ul>
            </div>
          </div>

          {/* Visual Diagram */}
          <div className="split-diagram">
            <div className="diagram-card">
              <div className="diagram-content">
                <div className="collaborator">
                  <div className="avatar">👨‍💻</div>
                  <div className="name">Author</div>
                </div>
                <div className="plus-sign">+</div>
                <div className="collaborator">
                  <div className="avatar">🎨</div>
                  <div className="name">Illustrator</div>
                </div>
                <div className="arrow">→</div>
                <div className="split-result">
                  <div className="split-item">
                    <span className="percentage">70%</span>
                    <span className="label">Author</span>
                  </div>
                  <div className="split-divider"></div>
                  <div className="split-item">
                    <span className="percentage">30%</span>
                    <span className="label">Illustrator</span>
                  </div>
                </div>
              </div>
              <div className="diagram-caption">
                Automatic 70/30 revenue split enforced by smart contract
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="how-it-works-section">
        <div className="container">
          <h2 className="section-title">How It Works</h2>
          <p className="section-subtitle">Get started in three simple steps</p>

          <div className="steps-grid">
            <div className="step-card">
              <div className="step-number">1</div>
              <div className="step-icon">🤝</div>
              <h3>Collaborate</h3>
              <p>
                Invite collaborators to your project. Work together in real-time with our professional creative tools.
              </p>
            </div>

            <div className="step-card">
              <div className="step-number">2</div>
              <div className="step-icon">📝</div>
              <h3>Agree on Split</h3>
              <p>
                Set revenue percentages upfront. All collaborators must approve before minting. Democratic and transparent.
              </p>
            </div>

            <div className="step-card">
              <div className="step-number">3</div>
              <div className="step-icon">💰</div>
              <h3>Earn Instantly</h3>
              <p>
                When your work sells, smart contracts automatically distribute revenue. No delays, no disputes, no middlemen.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Highlights Section */}
      <section className="features-section">
        <div className="container">
          <h2 className="section-title">Built for Creators</h2>
          <p className="section-subtitle">Everything you need to collaborate and earn</p>

          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">⚡</div>
              <h3>Real-time Collaboration</h3>
              <p>
                See who's online, track changes, leave comments, and work together seamlessly. Our editor supports books, art, music, and video projects.
              </p>
              <ul className="feature-list">
                <li>Live editing</li>
                <li>Comment threads</li>
                <li>Version history</li>
                <li>Activity feed</li>
              </ul>
            </div>

            <div className="feature-card">
              <div className="feature-icon">🔐</div>
              <h3>Trustless Payments</h3>
              <p>
                Blockchain-powered smart contracts ensure fair compensation. Revenue splits are automatic, instant, and tamper-proof. No trust required.
              </p>
              <ul className="feature-list">
                <li>Smart contract enforcement</li>
                <li>Automatic distribution</li>
                <li>Transparent on-chain</li>
                <li>Zero disputes</li>
              </ul>
            </div>

            <div className="feature-card">
              <div className="feature-icon">🎨</div>
              <h3>Professional Tools</h3>
              <p>
                Rich text editor for writers, canvas for artists, music studio for musicians, and video editor for filmmakers. All in one platform.
              </p>
              <ul className="feature-list">
                <li>Multi-format support</li>
                <li>NFT minting</li>
                <li>Export options</li>
                <li>Analytics dashboard</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Beta Access Section */}
      <section className="beta-access-section">
        <div className="container">
          <div className="beta-access-card">
            <h2>Join the Beta</h2>
            <p className="beta-intro">
              Be among the first creators to revolutionize collaboration. Limited spots available.
            </p>

            <div className="beta-benefits">
              <div className="benefit-item">
                <span className="benefit-icon">🎁</span>
                <span>Free during beta period</span>
              </div>
              <div className="benefit-item">
                <span className="benefit-icon">🚀</span>
                <span>Early access to new features</span>
              </div>
              <div className="benefit-item">
                <span className="benefit-icon">💎</span>
                <span>Founding creator badge</span>
              </div>
              <div className="benefit-item">
                <span className="benefit-icon">🎯</span>
                <span>Direct influence on roadmap</span>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="beta-form">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email address"
                required
                disabled={submitting}
              />
              <button type="submit" disabled={submitting}>
                {submitting ? 'Requesting...' : 'Request Beta Access'}
              </button>
              {message && <div className={`form-message ${message.startsWith('✅') ? 'success' : 'error'}`}>{message}</div>}
            </form>

            <p className="beta-signin">
              Already have access?{' '}
              <Link to={inviteCode ? `/auth?invite=${inviteCode}` : '/auth'}>
                Sign In →
              </Link>
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="container">
          <div className="footer-grid">
            <div className="footer-col">
              <div className="footer-logo">
                <img src="/rb-logo.jpeg" alt="renaissBlock" />
                <span>renaissBlock</span>
              </div>
              <p className="footer-tagline">
                The future of creative collaboration
              </p>
            </div>

            <div className="footer-col">
              <h4>Product</h4>
              <ul>
                <li><Link to="/auth">Sign In</Link></li>
                <li><a href="#features">Features</a></li>
                <li><a href="#how-it-works">How It Works</a></li>
                <li><a href="/wallet-info">About Wallets</a></li>
              </ul>
            </div>

            <div className="footer-col">
              <h4>Company</h4>
              <ul>
                <li><a href="#about">About</a></li>
                <li><a href="https://github.com/renaissblock" target="_blank" rel="noopener noreferrer">GitHub</a></li>
                <li><a href="https://twitter.com/renaissblock" target="_blank" rel="noopener noreferrer">Twitter</a></li>
                <li><a href="https://discord.gg/renaissblock" target="_blank" rel="noopener noreferrer">Discord</a></li>
              </ul>
            </div>

            <div className="footer-col">
              <h4>Legal</h4>
              <ul>
                <li><Link to="/terms">Terms of Service</Link></li>
                <li><a href="#privacy">Privacy Policy</a></li>
                <li><a href="#contact">Contact</a></li>
              </ul>
            </div>
          </div>

          <div className="footer-bottom">
            <p>&copy; 2024 renaissBlock. All rights reserved.</p>
            <p>Built on Solana 🌐</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
