import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Palette, Users, Crown, TrendingUp, Heart, Sparkles,
  Target, Zap, Star, Award, Rocket, Shield,
  PenTool, Music, Video, Camera, BookOpen, Brush,
  Handshake, DollarSign, Eye, Lock, TrendingDown
} from 'lucide-react';
import { API_URL } from '../config';
import './BetaLanding.css';

export default function BetaLanding() {
  const [email, setEmail] = useState('');
  const [creatorType, setCreatorType] = useState('');
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
          message: `Creator type: ${creatorType || 'Not specified'} | Requested via beta landing page at ${new Date().toISOString()}`
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage('✅ Thanks! We\'ll review your request and send an invite if approved.');
        setEmail('');
        setCreatorType('');
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
      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-content">
          <div className="beta-badge">Private Beta</div>

          <div className="hero-icon-wrapper">
            <Rocket className="hero-rocket" size={80} />
            <Sparkles className="hero-sparkle sparkle-1" size={24} />
            <Sparkles className="hero-sparkle sparkle-2" size={20} />
            <Sparkles className="hero-sparkle sparkle-3" size={18} />
          </div>

          <h1 className="hero-title">
            Own Your Creative Future
          </h1>

          <p className="hero-subtitle">
            The platform where creators keep control, build lasting partnerships, and turn their passion into sustainable income
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
                  {submitting ? 'Joining...' : 'Join the Creator Revolution'}
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

          <div className="hero-decoration">
            <div className="decoration-circle circle-1"></div>
            <div className="decoration-circle circle-2"></div>
            <div className="decoration-circle circle-3"></div>
          </div>
        </div>
      </section>

      {/* Problems Section */}
      <section className="problems-section">
        <div className="container">
          <h2 className="section-title">Tired of Platforms That Don't Put Creators First?</h2>
          <p className="section-subtitle">You're not alone. Here's what creators face every day:</p>

          <div className="problems-grid">
            <div className="problem-card">
              <div className="problem-icon-wrapper">
                <TrendingDown size={32} />
              </div>
              <h3>Revenue Theft</h3>
              <p>Publishers take 70% of your revenue while you do all the work</p>
            </div>

            <div className="problem-card">
              <div className="problem-icon-wrapper">
                <Lock size={32} />
              </div>
              <h3>Lost Rights</h3>
              <p>You lose rights to your own work the moment you hit publish</p>
            </div>

            <div className="problem-card">
              <div className="problem-icon-wrapper">
                <Users size={32} opacity={0.5} />
              </div>
              <h3>No Partners</h3>
              <p>Hard to find reliable creative partners you can trust</p>
            </div>

            <div className="problem-card">
              <div className="problem-icon-wrapper">
                <Shield size={32} />
              </div>
              <h3>Content Deletion</h3>
              <p>Platforms can delete your content anytime without warning</p>
            </div>
          </div>
        </div>
      </section>

      {/* Solutions Section */}
      <section className="solutions-section">
        <div className="container">
          <h2 className="section-title">What if you could...</h2>
          <p className="section-subtitle">Transform your creative career with true ownership</p>

          <div className="solutions-grid">
            <div className="solution-card">
              <div className="solution-icon-wrapper">
                <DollarSign size={36} />
              </div>
              <h3>Keep Your Revenue</h3>
              <p>Keep 85-90% of every sale. You create it, you profit from it.</p>
            </div>

            <div className="solution-card">
              <div className="solution-icon-wrapper">
                <Heart size={36} />
              </div>
              <h3>Find Your Soulmate</h3>
              <p>Find your creative soulmate with shared vision and values</p>
            </div>

            <div className="solution-card">
              <div className="solution-icon-wrapper">
                <Crown size={36} />
              </div>
              <h3>Own Your Work</h3>
              <p>Own your work forever. No takedowns, no platform control.</p>
            </div>

            <div className="solution-card">
              <div className="solution-icon-wrapper">
                <Target size={36} />
              </div>
              <h3>Build Your Empire</h3>
              <p>Build your creative empire on a foundation you control</p>
            </div>

            <div className="solution-card">
              <div className="solution-icon-wrapper">
                <Zap size={36} />
              </div>
              <h3>Earn Immediately</h3>
              <p>Earn from day one. No waiting, no minimum followers.</p>
            </div>

            <div className="solution-card">
              <div className="solution-icon-wrapper">
                <Eye size={36} />
              </div>
              <h3>Get Discovered</h3>
              <p>Get discovered by the right people who value your work</p>
            </div>
          </div>
        </div>
      </section>

      {/* Partnership Section */}
      <section className="partnership-section">
        <div className="container">
          <h2 className="section-title">Find Your Creative Other Half</h2>
          <p className="section-subtitle">Great work happens when creators collaborate</p>

          <div className="partnership-grid">
            <div className="partnership-card">
              <div className="partnership-icons">
                <div className="partner-icon">
                  <PenTool size={32} />
                </div>
                <div className="partner-connector">
                  <div className="connector-dots">
                    <span></span><span></span><span></span>
                  </div>
                  <div className="connector-plus">+</div>
                </div>
                <div className="partner-icon">
                  <Palette size={32} />
                </div>
                <div className="partner-heart">
                  <Heart size={20} fill="currentColor" />
                </div>
              </div>
              <h3>Authors + Illustrators</h3>
              <p>Create stunning visual stories together</p>
            </div>

            <div className="partnership-card">
              <div className="partnership-icons">
                <div className="partner-icon">
                  <Music size={32} />
                </div>
                <div className="partner-connector">
                  <div className="connector-dots">
                    <span></span><span></span><span></span>
                  </div>
                  <div className="connector-plus">+</div>
                </div>
                <div className="partner-icon">
                  <BookOpen size={32} />
                </div>
                <div className="partner-heart">
                  <Heart size={20} fill="currentColor" />
                </div>
              </div>
              <h3>Musicians + Lyricists</h3>
              <p>Compose music that moves hearts</p>
            </div>

            <div className="partnership-card">
              <div className="partnership-icons">
                <div className="partner-icon">
                  <Video size={32} />
                </div>
                <div className="partner-connector">
                  <div className="connector-dots">
                    <span></span><span></span><span></span>
                  </div>
                  <div className="connector-plus">+</div>
                </div>
                <div className="partner-icon">
                  <Camera size={32} />
                </div>
                <div className="partner-heart">
                  <Heart size={20} fill="currentColor" />
                </div>
              </div>
              <h3>Filmmakers + Editors</h3>
              <p>Craft cinematic experiences</p>
            </div>

            <div className="partnership-card">
              <div className="partnership-icons">
                <div className="partner-icon">
                  <Brush size={32} />
                </div>
                <div className="partner-connector">
                  <div className="connector-dots">
                    <span></span><span></span><span></span>
                  </div>
                  <div className="connector-plus">+</div>
                </div>
                <div className="partner-icon">
                  <PenTool size={32} />
                </div>
                <div className="partner-heart">
                  <Heart size={20} fill="currentColor" />
                </div>
              </div>
              <h3>Artists + Writers</h3>
              <p>Blend visual and narrative art</p>
            </div>
          </div>
        </div>
      </section>

      {/* Success Stories Section */}
      <section className="stories-section">
        <div className="container">
          <h2 className="section-title">Creators Already Building Their Dreams</h2>
          <p className="section-subtitle">Real stories from early creators</p>

          <div className="stories-grid">
            <div className="story-card">
              <div className="story-decoration">
                <Star className="story-star star-1" size={20} fill="currentColor" />
                <Star className="story-star star-2" size={16} fill="currentColor" />
              </div>
              <div className="story-icons">
                <BookOpen size={24} />
                <Palette size={24} />
              </div>
              <Award className="story-award" size={48} />
              <p className="story-quote">
                "I spent years trying to find the right illustrator. Within a week on renaissBlock, I met Maya. We published our first children's book in 3 months and both earned more than we ever did with traditional publishers."
              </p>
              <div className="story-author">
                <div className="author-name">Sarah K.</div>
                <div className="author-role">Children's Author</div>
              </div>
            </div>

            <div className="story-card">
              <div className="story-decoration">
                <Star className="story-star star-1" size={20} fill="currentColor" />
                <Star className="story-star star-2" size={16} fill="currentColor" />
              </div>
              <div className="story-icons">
                <Music size={24} />
                <PenTool size={24} />
              </div>
              <Award className="story-award" size={48} />
              <p className="story-quote">
                "As a producer, finding the right lyricist was impossible on other platforms. renaissBlock's collaboration tools made it seamless. We released 3 singles and I kept 90% of the revenue. Game changer."
              </p>
              <div className="story-author">
                <div className="author-name">Marcus T.</div>
                <div className="author-role">Music Producer</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Ownership Section */}
      <section className="ownership-section">
        <div className="container">
          <h2 className="section-title">This Time, You're in Control</h2>
          <p className="section-subtitle">Your work, your rules, your revenue</p>

          <div className="ownership-grid">
            <div className="ownership-card">
              <div className="ownership-icon-wrapper">
                <Target size={32} />
              </div>
              <h3>Set Your Own Prices</h3>
              <p>You decide what your work is worth</p>
            </div>

            <div className="ownership-card">
              <div className="ownership-icon-wrapper">
                <Shield size={32} />
              </div>
              <h3>Keep Your Rights</h3>
              <p>You own everything you create, forever</p>
            </div>

            <div className="ownership-card">
              <div className="ownership-icon-wrapper">
                <Users size={32} />
              </div>
              <h3>Direct Fan Relationships</h3>
              <p>Build direct relationships with your audience</p>
            </div>

            <div className="ownership-card">
              <div className="ownership-icon-wrapper">
                <Zap size={32} />
              </div>
              <h3>No Middleman</h3>
              <p>Keep your profits instead of giving them away</p>
            </div>

            <div className="ownership-card">
              <div className="ownership-icon-wrapper">
                <Crown size={32} />
              </div>
              <h3>Never Deleted</h3>
              <p>Your content lives forever, no takedowns</p>
            </div>

            <div className="ownership-card">
              <div className="ownership-icon-wrapper">
                <TrendingUp size={32} />
              </div>
              <h3>Scale Your Business</h3>
              <p>Grow your creative business your way</p>
            </div>
          </div>
        </div>
      </section>

      {/* Beta Access Section */}
      <section className="beta-access-section">
        <div className="container">
          <div className="beta-access-card">
            <div className="access-sparkles">
              <Sparkles className="access-sparkle sparkle-1" size={24} />
              <Sparkles className="access-sparkle sparkle-2" size={20} />
              <Sparkles className="access-sparkle sparkle-3" size={18} />
            </div>

            <h2>Ready to Transform Your Creative Career?</h2>
            <p className="beta-intro">
              Join hundreds of creators who are building their future on a platform they control
            </p>

            <form onSubmit={handleSubmit} className="beta-form">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email address"
                required
                disabled={submitting}
              />

              <select
                value={creatorType}
                onChange={(e) => setCreatorType(e.target.value)}
                disabled={submitting}
                className="creator-type-select"
              >
                <option value="">What type of creator are you?</option>
                <option value="writer">Writer / Author</option>
                <option value="artist">Visual Artist / Illustrator</option>
                <option value="musician">Musician / Composer</option>
                <option value="filmmaker">Filmmaker / Video Creator</option>
                <option value="photographer">Photographer</option>
                <option value="other">Other Creative</option>
              </select>

              <button type="submit" disabled={submitting}>
                {submitting ? 'Requesting Access...' : 'Request Early Access'}
              </button>
              {message && <div className={`form-message ${message.startsWith('✅') ? 'success' : 'error'}`}>{message}</div>}
            </form>

            <p className="beta-proof">
              <Handshake size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '6px' }} />
              500+ creators already building their future
            </p>

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
                Where creators own their future
              </p>
            </div>

            <div className="footer-col">
              <h4>Product</h4>
              <ul>
                <li><Link to="/auth">Sign In</Link></li>
                <li><a href="#solutions">For Creators</a></li>
                <li><a href="#partnerships">Find Partners</a></li>
                <li><a href="/wallet-info">About Wallets</a></li>
              </ul>
            </div>

            <div className="footer-col">
              <h4>Community</h4>
              <ul>
                <li><a href="#stories">Success Stories</a></li>
                <li><a href="https://discord.gg/renaissblock" target="_blank" rel="noopener noreferrer">Discord</a></li>
                <li><a href="https://twitter.com/renaissblock" target="_blank" rel="noopener noreferrer">Twitter</a></li>
                <li><a href="#blog">Creator Blog</a></li>
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
            <p>Built for creators, by creators</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
