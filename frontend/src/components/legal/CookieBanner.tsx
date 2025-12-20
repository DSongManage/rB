/**
 * Cookie consent banner for GDPR/CCPA compliance.
 * Shows on first visit and stores preference in localStorage.
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';

const COOKIE_CONSENT_KEY = 'rb_cookie_consent';

interface CookiePreferences {
  necessary: boolean; // Always true
  analytics: boolean;
  marketing: boolean;
}

export function CookieBanner() {
  const [isVisible, setIsVisible] = useState(false);
  const [showCustomize, setShowCustomize] = useState(false);
  const [preferences, setPreferences] = useState<CookiePreferences>({
    necessary: true,
    analytics: false,
    marketing: false,
  });

  useEffect(() => {
    // Check if user has already made a choice
    const consent = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!consent) {
      // Small delay to prevent flash on page load
      const timer = setTimeout(() => setIsVisible(true), 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const saveConsent = (prefs: CookiePreferences) => {
    localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify({
      ...prefs,
      timestamp: new Date().toISOString(),
    }));
    setIsVisible(false);
  };

  const handleAcceptAll = () => {
    saveConsent({
      necessary: true,
      analytics: true,
      marketing: true,
    });
  };

  const handleRejectNonEssential = () => {
    saveConsent({
      necessary: true,
      analytics: false,
      marketing: false,
    });
  };

  const handleSavePreferences = () => {
    saveConsent(preferences);
  };

  if (!isVisible) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 9999,
      background: 'var(--bg, #0f172a)',
      borderTop: '1px solid var(--border, #334155)',
      padding: '16px 20px',
      boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.3)',
    }}>
      <div style={{
        maxWidth: 1200,
        margin: '0 auto',
      }}>
        {!showCustomize ? (
          // Simple banner
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 16,
            justifyContent: 'space-between',
          }}>
            <div style={{ flex: '1 1 400px' }}>
              <p style={{
                margin: 0,
                fontSize: 14,
                color: 'var(--text, #e5e7eb)',
              }}>
                We use cookies to improve your experience.{' '}
                <Link
                  to="/legal/privacy"
                  style={{ color: 'var(--accent, #f59e0b)' }}
                >
                  Learn more in our Privacy Policy
                </Link>
              </p>
            </div>
            <div style={{
              display: 'flex',
              gap: 8,
              flexWrap: 'wrap',
            }}>
              <button
                onClick={() => setShowCustomize(true)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 6,
                  border: '1px solid var(--border, #334155)',
                  background: 'transparent',
                  color: 'var(--text, #e5e7eb)',
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                Customize
              </button>
              <button
                onClick={handleRejectNonEssential}
                style={{
                  padding: '8px 16px',
                  borderRadius: 6,
                  border: '1px solid var(--border, #334155)',
                  background: 'transparent',
                  color: 'var(--text, #e5e7eb)',
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                Reject Non-Essential
              </button>
              <button
                onClick={handleAcceptAll}
                style={{
                  padding: '8px 16px',
                  borderRadius: 6,
                  border: 'none',
                  background: 'var(--accent, #f59e0b)',
                  color: '#000',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Accept All
              </button>
            </div>
          </div>
        ) : (
          // Customize view
          <div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 16,
            }}>
              <h3 style={{
                margin: 0,
                fontSize: 16,
                fontWeight: 600,
                color: 'var(--text, #e5e7eb)',
              }}>
                Cookie Preferences
              </h3>
              <button
                onClick={() => setShowCustomize(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 4,
                  cursor: 'pointer',
                  color: 'var(--text-muted, #94a3b8)',
                }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              marginBottom: 16,
            }}>
              <label style={{
                display: 'flex',
                gap: 12,
                alignItems: 'flex-start',
                padding: 12,
                background: 'var(--bg-secondary, #1e293b)',
                borderRadius: 6,
              }}>
                <input
                  type="checkbox"
                  checked={true}
                  disabled
                  style={{ marginTop: 3 }}
                />
                <div>
                  <div style={{ fontWeight: 500, color: 'var(--text, #e5e7eb)', marginBottom: 2 }}>
                    Necessary Cookies
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted, #94a3b8)' }}>
                    Required for the website to function. Cannot be disabled.
                  </div>
                </div>
              </label>

              <label style={{
                display: 'flex',
                gap: 12,
                alignItems: 'flex-start',
                padding: 12,
                background: 'var(--bg-secondary, #1e293b)',
                borderRadius: 6,
                cursor: 'pointer',
              }}>
                <input
                  type="checkbox"
                  checked={preferences.analytics}
                  onChange={(e) => setPreferences(prev => ({ ...prev, analytics: e.target.checked }))}
                  style={{ marginTop: 3 }}
                />
                <div>
                  <div style={{ fontWeight: 500, color: 'var(--text, #e5e7eb)', marginBottom: 2 }}>
                    Analytics Cookies
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted, #94a3b8)' }}>
                    Help us understand how you use the site to improve it.
                  </div>
                </div>
              </label>

              <label style={{
                display: 'flex',
                gap: 12,
                alignItems: 'flex-start',
                padding: 12,
                background: 'var(--bg-secondary, #1e293b)',
                borderRadius: 6,
                cursor: 'pointer',
              }}>
                <input
                  type="checkbox"
                  checked={preferences.marketing}
                  onChange={(e) => setPreferences(prev => ({ ...prev, marketing: e.target.checked }))}
                  style={{ marginTop: 3 }}
                />
                <div>
                  <div style={{ fontWeight: 500, color: 'var(--text, #e5e7eb)', marginBottom: 2 }}>
                    Marketing Cookies
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted, #94a3b8)' }}>
                    Used to show you relevant content and ads.
                  </div>
                </div>
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                onClick={handleRejectNonEssential}
                style={{
                  padding: '8px 16px',
                  borderRadius: 6,
                  border: '1px solid var(--border, #334155)',
                  background: 'transparent',
                  color: 'var(--text, #e5e7eb)',
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                Reject All
              </button>
              <button
                onClick={handleSavePreferences}
                style={{
                  padding: '8px 16px',
                  borderRadius: 6,
                  border: 'none',
                  background: 'var(--accent, #f59e0b)',
                  color: '#000',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Save Preferences
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default CookieBanner;
