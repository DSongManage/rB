/**
 * Footer component with legal links.
 */

import React from 'react';
import { Link } from 'react-router-dom';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer style={{
      marginTop: 'auto',
      padding: '24px 20px',
      borderTop: '1px solid var(--border, #334155)',
      background: 'var(--bg-secondary, #1e293b)',
    }}>
      <div style={{
        maxWidth: 1200,
        margin: '0 auto',
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 32,
      }}>
        {/* Brand */}
        <div style={{ minWidth: 200 }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 8,
          }}>
            <img
              src="/rb-logo.png"
              alt="renaissBlock"
              style={{
                height: 28,
                width: 'auto',
                borderRadius: 4,
              }}
            />
            <span style={{
              fontSize: 16,
              fontWeight: 700,
              color: 'var(--text, #e5e7eb)',
            }}>
              renaissBlock
            </span>
          </div>
          <div style={{
            fontSize: 13,
            color: 'var(--text-muted, #94a3b8)',
          }}>
            A platform for serious creators.
          </div>
        </div>

        {/* Legal Links */}
        <div style={{ minWidth: 150 }}>
          <div style={{
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--text, #e5e7eb)',
            marginBottom: 12,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}>
            Legal
          </div>
          <nav style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}>
            <Link to="/legal/terms" style={linkStyle}>Terms of Service</Link>
            <Link to="/legal/privacy" style={linkStyle}>Privacy Policy</Link>
            <Link to="/legal/content-policy" style={linkStyle}>Content Policy</Link>
            <Link to="/legal/dmca" style={linkStyle}>DMCA / Copyright</Link>
            <Link to="/legal/creator-agreement" style={linkStyle}>Creator Agreement</Link>
          </nav>
        </div>

        {/* Payments */}
        <div style={{ minWidth: 150 }}>
          <div style={{
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--text, #e5e7eb)',
            marginBottom: 12,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}>
            Payments
          </div>
          <nav style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}>
            <Link to="/how-payments-work" style={linkStyle}>How Payments Work</Link>
            <a href="https://www.circle.com/en/usdc" target="_blank" rel="noopener noreferrer" style={linkStyle}>About USDC</a>
          </nav>
        </div>

        {/* Support Links */}
        <div style={{ minWidth: 150 }}>
          <div style={{
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--text, #e5e7eb)',
            marginBottom: 12,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}>
            Support
          </div>
          <nav style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}>
            <a href="mailto:support@renaissblock.com" style={linkStyle}>Contact Us</a>
            <a href="mailto:dmca@renaissblock.com" style={linkStyle}>Report Copyright</a>
            <a href="mailto:reports@renaissblock.com" style={linkStyle}>Report Content</a>
          </nav>
        </div>

        {/* Copyright */}
        <div style={{
          width: '100%',
          paddingTop: 16,
          borderTop: '1px solid var(--border, #334155)',
          marginTop: 8,
        }}>
          <div style={{
            fontSize: 12,
            color: 'var(--text-muted, #94a3b8)',
            textAlign: 'center',
          }}>
            &copy; {currentYear} renaissBlock. All rights reserved.
          </div>
        </div>
      </div>
    </footer>
  );
}

const linkStyle: React.CSSProperties = {
  fontSize: 13,
  color: 'var(--text-muted, #94a3b8)',
  textDecoration: 'none',
  transition: 'color 0.2s',
};

export default Footer;
