import React, { useEffect, useState, Suspense, lazy } from 'react';
import { Route, Routes, Link, useLocation, useNavigate, Navigate } from 'react-router-dom';
import './App.css';
import { CreatorSidebar } from './components/CreatorSidebar';
import { LibrarySidebar } from './components/LibrarySidebar';
import { MobileLibrary } from './components/MobileLibrary';
import { useMobile } from './hooks/useMobile';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import NotificationBell from './components/notifications/NotificationBell';
import NotificationToastContainer from './components/notifications/NotificationToastContainer';
import notificationService from './services/notificationService';
import { disconnectWeb3Auth } from './services/web3authService';
import { BetaBadge, TestModeBanner } from './components/BetaBadge';
import { useAuth } from './hooks/useAuth';
import BetaOnboarding from './components/BetaOnboarding';
import { Footer } from './components/legal/Footer';
import { CookieBanner } from './components/legal/CookieBanner';
import { API_URL } from './config';
import { CartProvider } from './contexts/CartContext';
import { TourProvider } from './contexts/TourContext';
import { BalanceProvider } from './contexts/BalanceContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ProfileDropdown } from './components/profile/ProfileDropdown';
import { TourRenderer } from './components/Tour/TourProvider';
import { TourMenu } from './components/Tour/TourMenu';
import CartIcon from './components/CartIcon';
import {
  User, Menu, X, Users
} from 'lucide-react';
import { SearchAutocomplete } from './components/SearchAutocomplete';

// Lazy-loaded page components for code splitting
const HomePage = lazy(() => import('./pages/HomePage'));
const SearchPage = lazy(() => import('./pages/SearchPage'));
const StudioPage = lazy(() => import('./pages/StudioPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePageRedesigned'));
const AuthPage = lazy(() => import('./pages/AuthPage'));
const WalletInfoPage = lazy(() => import('./pages/WalletInfoPage'));
// TermsPage replaced by TermsOfServicePage in legal pages
const BetaLanding = lazy(() => import('./pages/BetaLanding'));
const CollaboratorsPage = lazy(() => import('./pages/CollaboratorsPage'));
const PublicProfilePage = lazy(() => import('./pages/PublicProfilePage'));
const ContentDetail = lazy(() => import('./pages/ContentDetail'));
const PurchaseSuccessPage = lazy(() => import('./pages/PurchaseSuccessPage'));
const ReaderPage = lazy(() => import('./pages/ReaderPage').then(m => ({ default: m.ReaderPage })));
const CollaborativeProjectPage = lazy(() => import('./pages/CollaborativeProjectPage'));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'));
const FollowingFeedPage = lazy(() => import('./pages/FollowingFeedPage'));
const CartPage = lazy(() => import('./pages/CartPage'));
const CartSuccessPage = lazy(() => import('./pages/CartSuccessPage'));

// Legal pages
const TermsOfServicePage = lazy(() => import('./pages/legal/TermsOfServicePage'));
const PrivacyPolicyPage = lazy(() => import('./pages/legal/PrivacyPolicyPage'));
const ContentPolicyPage = lazy(() => import('./pages/legal/ContentPolicyPage'));
const DMCAPolicyPage = lazy(() => import('./pages/legal/DMCAPolicyPage'));
const CreatorAgreementPage = lazy(() => import('./pages/legal/CreatorAgreementPage'));

// Info pages
const HowPaymentsWorkPage = lazy(() => import('./pages/HowPaymentsWorkPage'));

// Loading fallback component
const PageLoader = () => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '200px',
    color: 'var(--text-muted, #94a3b8)',
  }}>
    Loading...
  </div>
);

function Header() {
  const [isAuthed, setIsAuthed] = useState(false);
  const [username, setUsername] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const profileButtonRef = React.useRef<HTMLButtonElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

  const checkAuth = React.useCallback(() => {
    fetch(`${API_URL}/api/auth/status/`, { credentials: 'include' })
      .then(r=>r.json())
      .then(d=> {
        const authed = !!d?.authenticated;
        setIsAuthed(authed);

        // Store username and avatar if available
        if (authed && d?.user?.username) {
          setUsername(d.user.username);
          setAvatarUrl(d.user.avatar_url || null);
        } else {
          setUsername('');
          setAvatarUrl(null);
        }

        // Start/stop notification polling based on auth state
        if (authed) {
          if (!notificationService.isPolling()) {
            notificationService.startPolling();
          }
        } else {
          if (notificationService.isPolling()) {
            notificationService.stopPolling();
          }
          notificationService.reset();
        }
      })
      .catch(()=> {
        setIsAuthed(false);
        setUsername('');
        setAvatarUrl(null);
        notificationService.stopPolling();
        notificationService.reset();
      });
  }, []);

  useEffect(()=>{
    checkAuth();
    // Poll auth status every 10 seconds to catch changes
    const interval = setInterval(checkAuth, 10000);
    return () => {
      clearInterval(interval);
      // Clean up notification service on unmount
      notificationService.stopPolling();
    };
  },[location.pathname, checkAuth]);

  // Also refresh immediately when we land on home with potential fresh logout redirect
  useEffect(()=>{
    if (location.pathname === '/') {
      checkAuth();
    }
  }, [location.pathname, checkAuth]);

  const goLogin = () => { navigate('/auth'); };

  const doLogout = async () => {
    try {
      const t = await fetch(`${API_URL}/api/auth/csrf/`, { credentials:'include' }).then(r=>r.json()).then(j=> j?.csrfToken || '');
      await fetch(`${API_URL}/api/auth/logout/`, { method:'POST', credentials:'include', headers:{ 'X-CSRFToken': t, 'X-Requested-With': 'XMLHttpRequest' } });
    } catch {}

    // CRITICAL: Disconnect Web3Auth to prevent wallet session mismatch on next login
    try {
      await disconnectWeb3Auth();
    } catch (e) {
      console.warn('[App] Web3Auth disconnect failed:', e);
    }

    // Stop notification polling and reset
    notificationService.stopPolling();
    notificationService.reset();

    // Optimistically flip immediately
    setIsAuthed(false);

    // Navigate to home using React Router
    navigate('/');

    // Re-check server state after navigation
    setTimeout(() => checkAuth(), 100);
  };
  return (
    <nav className="rb-header">
      <div className="rb-header-left">
        <Link to="/" className="rb-logo-link">
          <img src="/rb-logo.png" alt="renaissBlock" className="rb-logo-img"/>
        </Link>
        <BetaBadge variant="header" showTestMode={true} />
        {isAuthed && <TourMenu />}
      </div>
      <div className="rb-header-center" data-tour="search-bar">
        <SearchAutocomplete />
      </div>

      {/* Mobile Menu Toggle */}
      <button
        className="rb-mobile-menu-toggle"
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        aria-label="Toggle menu"
        data-tour="mobile-menu-toggle"
      >
        {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Navigation Links */}
      <div className={`rb-header-right rb-nav ${mobileMenuOpen ? 'rb-nav-mobile-open' : ''}`}>
        {isAuthed && (
          <>
            <span data-tour="cart-button">
              <CartIcon />
            </span>
            <span data-tour="notifications-button">
              <NotificationBell />
            </span>
            <Link to="/collaborators" className="rb-nav-link" title="Find Collaborators" data-tour="collaborators-link">
              <Users size={20} />
            </Link>
            {/* Profile Dropdown */}
            <div style={{ position: 'relative' }} data-tour="profile-link">
              <button
                ref={profileButtonRef}
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                className="rb-nav-link rb-profile-btn"
                title="Profile menu"
                aria-expanded={profileDropdownOpen}
                aria-haspopup="menu"
              >
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={username}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      objectFit: 'cover',
                      border: '2px solid var(--accent)',
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      background: 'var(--chip-bg)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '2px solid var(--accent)',
                    }}
                  >
                    <User size={18} />
                  </div>
                )}
              </button>
              <ProfileDropdown
                isOpen={profileDropdownOpen}
                onClose={() => setProfileDropdownOpen(false)}
                anchorEl={profileButtonRef.current}
                username={username}
                avatarUrl={avatarUrl}
                onLogout={doLogout}
              />
            </div>
          </>
        )}
        {!isAuthed && (
          <button onClick={goLogin} className="rb-nav-link rb-signin-btn">
            <User size={20} />
            <span>Sign in</span>
          </button>
        )}
      </div>
    </nav>
  );
}

export default function App() {
  const location = useLocation();
  const { isAuthenticated, loading } = useAuth();
  const { isMobile } = useMobile();

  // Legacy CreatorSidebar removed - functionality now in navbar and page tabs
  const showCreatorSidebar = false;
  // Only show Library sidebar when authenticated AND on home or search pages AND not mobile
  const showLibrarySidebar = !isMobile && isAuthenticated && [/^\/$/, /^\/search/].some(r => r.test(location.pathname));
  // Show mobile library on home page for authenticated mobile users
  const showMobileLibrary = isMobile && isAuthenticated && location.pathname === '/';
  const isReaderPage = /^\/reader/.test(location.pathname);
  // Hide footer on pages that have the sidebar (footer links are in sidebar instead)
  const showFooter = !showLibrarySidebar;

  // Public routes that don't require authentication
  const publicRoutes = ['/auth', '/terms', '/wallet-info', '/beta', '/profile/', '/legal', '/how-payments-work'];
  const isPublicRoute = publicRoutes.some(route => location.pathname.startsWith(route));

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="rb-app" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: 'var(--bg)',
        color: 'var(--text)'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '18px', marginBottom: '8px' }}>Loading...</div>
        </div>
      </div>
    );
  }

  // Show beta landing page for unauthenticated users (except on public routes)
  if (!isAuthenticated && !isPublicRoute) {
    return (
      <div className="rb-app">
        <BetaLanding />
        <NotificationToastContainer />
      </div>
    );
  }

  // Special handling for explicit /beta route
  const isBetaLanding = location.pathname === '/beta';
  if (isBetaLanding) {
    return (
      <div className="rb-app">
        <BetaLanding />
        <NotificationToastContainer />
      </div>
    );
  }

  // Reader page gets its own full-screen layout without app chrome
  if (isReaderPage) {
    return (
      <div className="rb-app">
        <ErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/reader/:contentId" element={<ReaderPage />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </div>
    );
  }

  return (
    <ThemeProvider>
    <TourProvider>
    <CartProvider>
    <BalanceProvider>
    <div className="rb-app">
      <Header />
      {showLibrarySidebar && <LibrarySidebar />}
      <main
        className="rb-main"
        style={{
          display: 'grid',
          gridTemplateColumns: showCreatorSidebar ? '240px 1fr' : '1fr',
          gap: 16,
          ...(showLibrarySidebar ? {
            marginLeft: 320,
            marginRight: 0,
            width: 'calc(100% - 320px)',
          } : {}),
          transition: 'margin-left 0.3s ease, width 0.3s ease',
        }}
      >
        {showCreatorSidebar && <CreatorSidebar />}
        <div style={{ width: '100%', minWidth: 0 }}>
          {/* Mobile Library - shown at top of home page for mobile users */}
          {showMobileLibrary && <MobileLibrary />}
          <ErrorBoundary>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/beta" element={<BetaLanding />} />
                <Route path="/login" element={<Navigate to="/auth" replace />} />
                <Route path="/signup" element={<Navigate to="/auth" replace />} />
                <Route path="/search" element={<SearchPage />} />
                <Route path="/studio" element={<StudioPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/profile/:username" element={<PublicProfilePage />} />
                <Route path="/collaborators" element={<CollaboratorsPage />} />
                <Route path="/auth" element={<AuthPage />} />
                <Route path="/wallet-info" element={<WalletInfoPage />} />
                <Route path="/terms" element={<TermsOfServicePage />} />
                <Route path="/legal/terms" element={<TermsOfServicePage />} />
                <Route path="/legal/privacy" element={<PrivacyPolicyPage />} />
                <Route path="/legal/content-policy" element={<ContentPolicyPage />} />
                <Route path="/legal/dmca" element={<DMCAPolicyPage />} />
                <Route path="/legal/creator-agreement" element={<CreatorAgreementPage />} />
                <Route path="/how-payments-work" element={<HowPaymentsWorkPage />} />
                <Route path="/content/:id" element={<ContentDetail />} />
                <Route path="/purchase/success" element={<PurchaseSuccessPage />} />
                <Route path="/cart" element={<ProtectedRoute><CartPage /></ProtectedRoute>} />
                <Route path="/cart/success" element={<ProtectedRoute><CartSuccessPage /></ProtectedRoute>} />
                <Route path="/collaborations/:projectId" element={<ProtectedRoute><CollaborativeProjectPage /></ProtectedRoute>} />
                <Route path="/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
                <Route path="/feed" element={<ProtectedRoute><FollowingFeedPage /></ProtectedRoute>} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </div>
      </main>
      {showFooter && <Footer />}
      <NotificationToastContainer />
      <CookieBanner />
      <TestModeBanner />
      <BetaOnboarding />
      <TourRenderer />
    </div>
    </BalanceProvider>
    </CartProvider>
    </TourProvider>
    </ThemeProvider>
  );
}
