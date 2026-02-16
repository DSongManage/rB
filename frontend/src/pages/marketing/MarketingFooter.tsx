import { Link } from 'react-router-dom';

export default function MarketingFooter() {
  return (
    <footer className="mk-footer">
      <div className="mk-footer-inner">
        <div className="mk-footer-top">
          <div className="mk-footer-brand">
            <Link to="/" className="mk-footer-logo">
              <img src="/rb-logo.png" alt="renaissBlock" className="mk-footer-logo-img" />
              <span className="mk-footer-logo-text">renaissBlock</span>
            </Link>
            <p className="mk-footer-tagline">Where writers and artists create together.</p>
          </div>
          <div className="mk-footer-col">
            <h4>Platform</h4>
            <Link to="/how-it-works">How It Works</Link>
            <Link to="/pricing">Pricing</Link>
            <Link to="/search">Explore</Link>
          </div>
          <div className="mk-footer-col">
            <h4>Company</h4>
            <Link to="/about">About</Link>
          </div>
          <div className="mk-footer-col">
            <h4>Legal</h4>
            <Link to="/legal/terms">Terms of Service</Link>
            <Link to="/legal/privacy">Privacy Policy</Link>
            <Link to="/legal/creator-agreement">Creator Agreement</Link>
          </div>
        </div>
        <div className="mk-footer-bottom">
          &copy; 2026 renaissBlock, LLC. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
