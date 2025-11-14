import React, { useEffect, useState } from 'react';
import { Route, Routes, Link, useLocation, useNavigate, Navigate } from 'react-router-dom';
import './App.css';
import HomePage from './pages/HomePage';
import SearchPage from './pages/SearchPage';
import StudioPage from './pages/StudioPage';
import DashboardPage from './pages/DashboardPage';
import ProfilePage from './pages/ProfilePage';
import AuthPage from './pages/AuthPage';
import WalletInfoPage from './pages/WalletInfoPage';
import TermsPage from './pages/TermsPage';
import BetaLanding from './pages/BetaLanding';
import { CreatorSidebar } from './components/CreatorSidebar';
import { LibrarySidebar } from './components/LibrarySidebar';
import CollaboratorsPage from './pages/CollaboratorsPage';
import ContentDetail from './pages/ContentDetail';
import PurchaseSuccessPage from './pages/PurchaseSuccessPage';
import { ReaderPage } from './pages/ReaderPage';
import CollaborationDashboard from './pages/CollaborationDashboard';
import CollaborativeProjectPage from './pages/CollaborativeProjectPage';
import ProtectedRoute from './components/ProtectedRoute';
import NotificationBell from './components/notifications/NotificationBell';
import NotificationToastContainer from './components/notifications/NotificationToastContainer';
import notificationService from './services/notificationService';
import { BetaBadge, TestModeBanner } from './components/BetaBadge';
import { useAuth } from './hooks/useAuth';
import FeedbackModal from './components/FeedbackModal';
import BetaOnboarding from './components/BetaOnboarding';
import { API_URL } from './config';

function Header() {
  const [q, setQ] = useState('');
  const [isAuthed, setIsAuthed] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const checkAuth = React.useCallback(() => {
    fetch(`${API_URL}/api/auth/status/`, { credentials: 'include' })
      .then(r=>r.json())
      .then(d=> {
        const authed = !!d?.authenticated;
        setIsAuthed(authed);

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

  const submit = (e: React.FormEvent) => { e.preventDefault(); navigate(`/search?q=${encodeURIComponent(q)}`); };
  const goLogin = () => { navigate('/auth'); };

  const doLogout = async () => {
    try {
      const t = await fetch(`${API_URL}/api/auth/csrf/`, { credentials:'include' }).then(r=>r.json()).then(j=> j?.csrfToken || '');
      await fetch(`${API_URL}/api/auth/logout/`, { method:'POST', credentials:'include', headers:{ 'X-CSRFToken': t, 'X-Requested-With': 'XMLHttpRequest' } });
    } catch {}

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
        <Link to="/" className="rb-logo-link"><img src="/rb-logo.jpeg" alt="renaissBlock" className="rb-logo-img"/></Link>
        <BetaBadge variant="header" showTestMode={true} />
      </div>
      <div className="rb-header-center">
        <form onSubmit={submit} className="rb-search">
          <input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Search" />
          <button type="submit">Search</button>
        </form>
      </div>
      <div className="rb-header-right rb-nav">
        {isAuthed && <NotificationBell />}
        {isAuthed && <Link to="/profile">Profile</Link>}
        {isAuthed && <Link to="/collaborations">Collaborations</Link>}
        {isAuthed && <Link to="/collaborators">Collaborators</Link>}
        {isAuthed && (
          <button
            onClick={() => setShowFeedback(true)}
            style={{
              background: 'transparent',
              border: '1px solid #f59e0b',
              color: '#f59e0b',
              padding: '6px 12px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 500,
              fontSize: '13px',
            }}
            title="Send feedback about the beta"
          >
            💬 Feedback
          </button>
        )}
        {!isAuthed && <button onClick={goLogin} style={{background:'transparent', border:'none', color:'#cbd5e1', cursor:'pointer', fontWeight:500}}>Sign in</button>}
        {isAuthed && <button onClick={doLogout} style={{background:'transparent', border:'none', color:'#cbd5e1', cursor:'pointer', fontWeight:500}}>Logout</button>}
      </div>
      <FeedbackModal isOpen={showFeedback} onClose={() => setShowFeedback(false)} />
    </nav>
  );
}

export default function App() {
  const location = useLocation();
  const { isAuthenticated, loading } = useAuth();

  const showCreatorSidebar = [/^\/studio/, /^\/dashboard/, /^\/profile/, /^\/collaborators/, /^\/collaborations/].some(r => r.test(location.pathname));
  const showLibrarySidebar = [/^\/$/, /^\/search/].some(r => r.test(location.pathname));
  const isReaderPage = /^\/reader/.test(location.pathname);

  // Public routes that don't require authentication
  const publicRoutes = ['/auth', '/terms', '/wallet-info', '/beta'];
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

  return (
    <div className="rb-app">
      <Header />
      {showLibrarySidebar && <LibrarySidebar />}
      <main
        className="rb-main"
        style={{
          display: 'grid',
          gridTemplateColumns: showCreatorSidebar ? '240px 1fr' : '1fr',
          gap: 16,
          marginLeft: showLibrarySidebar ? 320 : 0,
          transition: 'margin-left 0.3s ease',
        }}
      >
        {showCreatorSidebar && <CreatorSidebar />}
        <div style={{ width: isReaderPage ? '100%' : 'auto', maxWidth: isReaderPage ? 'none' : undefined }}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/beta" element={<BetaLanding />} />
            <Route path="/login" element={<Navigate to="/auth" replace />} />
            <Route path="/signup" element={<Navigate to="/auth" replace />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/studio" element={<StudioPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/collaborators" element={<CollaboratorsPage />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/wallet-info" element={<WalletInfoPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/content/:id" element={<ContentDetail />} />
            <Route path="/purchase/success" element={<PurchaseSuccessPage />} />
            <Route path="/reader/:contentId" element={<ReaderPage />} />
            <Route path="/collaborations" element={<ProtectedRoute><CollaborationDashboard /></ProtectedRoute>} />
            <Route path="/collaborations/:projectId" element={<ProtectedRoute><CollaborativeProjectPage /></ProtectedRoute>} />
          </Routes>
        </div>
      </main>
      <NotificationToastContainer />
      <TestModeBanner />
      <BetaOnboarding />
    </div>
  );
}
