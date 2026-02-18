import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';

export default function MarketingNav() {
  const [solid, setSolid] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className={`mk-nav ${solid ? 'mk-nav--solid' : 'mk-nav--transparent'}`}>
      <div className="mk-nav-inner">
        <Link to="/" className="mk-nav-logo">
          <img src="/rb-logo.png" alt="renaissBlock" className="mk-nav-logo-img" />
          <span className="mk-nav-logo-text">renaissBlock</span>
        </Link>

        <button
          className="mk-nav-mobile-toggle"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>

        <div className={`mk-nav-links ${mobileOpen ? 'mk-nav-links--open' : ''}`}>
          <Link to="/" className={`mk-nav-link ${isActive('/') ? 'active' : ''}`}>Home</Link>
          <Link to="/how-it-works" className={`mk-nav-link ${isActive('/how-it-works') ? 'active' : ''}`}>How It Works</Link>
          <Link to="/pricing" className={`mk-nav-link ${isActive('/pricing') ? 'active' : ''}`}>Creators</Link>
          <Link to="/about" className={`mk-nav-link ${isActive('/about') ? 'active' : ''}`}>About</Link>
          <Link to="/blog" className={`mk-nav-link ${isActive('/blog') ? 'active' : ''}`}>Blog</Link>
          <a href="/#signup" className="mk-nav-cta">Start Creating</a>
        </div>
      </div>
    </nav>
  );
}
