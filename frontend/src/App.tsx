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
import { CreatorSidebar } from './components/CreatorSidebar';
import { LibrarySidebar } from './components/LibrarySidebar';
import CollaboratorsPage from './pages/CollaboratorsPage';
import ContentDetail from './pages/ContentDetail';
import PurchaseSuccessPage from './pages/PurchaseSuccessPage';
import { ReaderPage } from './pages/ReaderPage';
import CollaborationDashboard from './pages/CollaborationDashboard';
import CollaborativeProjectPage from './pages/CollaborativeProjectPage';
import ProtectedRoute from './components/ProtectedRoute';

function Header() {
  const [q, setQ] = useState('');
  const [isAuthed, setIsAuthed] = useState(false);
  const [notifCount, setNotifCount] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();
  
  const checkAuthAndNotifications = React.useCallback(() => {
    fetch('/api/auth/status/', { credentials: 'include' })
      .then(r=>r.json())
      .then(d=> {
        const authed = !!d?.authenticated;
        setIsAuthed(authed);
        // Only fetch notifications if authenticated
        if (authed) {
          fetch('/api/notifications/', { credentials: 'include' })
            .then(r=> r.ok ? r.json() : [])
            .then(data=> setNotifCount(Array.isArray(data) ? data.length : 0))
            .catch(()=> setNotifCount(0));
        } else {
          setNotifCount(0);
        }
      })
      .catch(()=> {
        setIsAuthed(false);
        setNotifCount(0);
      });
  }, []);
  
  useEffect(()=>{
    checkAuthAndNotifications();
    // Poll every 10 seconds to catch auth state changes (e.g., after login)
    const interval = setInterval(checkAuthAndNotifications, 10000);
    return () => clearInterval(interval);
  },[location.pathname, checkAuthAndNotifications]);
  // Also refresh immediately when we land on home with potential fresh logout redirect
  useEffect(()=>{
    if (location.pathname === '/') {
      checkAuthAndNotifications();
    }
  }, [location.pathname, checkAuthAndNotifications]);
  const submit = (e: React.FormEvent) => { e.preventDefault(); navigate(`/search?q=${encodeURIComponent(q)}`); };
  const goLogin = () => { navigate('/auth'); };
  const doLogout = async () => {
    try {
      const t = await fetch('/api/auth/csrf/', { credentials:'include' }).then(r=>r.json()).then(j=> j?.csrfToken || '');
      await fetch('/api/auth/logout/', { method:'POST', credentials:'include', headers:{ 'X-CSRFToken': t, 'X-Requested-With': 'XMLHttpRequest' } });
    } catch {}
    // Optimistically flip immediately
    setIsAuthed(false);
    setNotifCount(0);
    // Navigate to home using React Router
    navigate('/');
    // Re-check server state after navigation
    setTimeout(() => checkAuthAndNotifications(), 100);
  };
  return (
    <nav className="rb-header">
      <div className="rb-header-left">
        <Link to="/" className="rb-logo-link"><img src="/rb-logo.jpeg" alt="renaissBlock" className="rb-logo-img"/></Link>
      </div>
      <div className="rb-header-center">
        <form onSubmit={submit} className="rb-search">
          <input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Search" />
          <button type="submit">Search</button>
        </form>
      </div>
      <div className="rb-header-right rb-nav">
        {isAuthed && (
          <Link to="/profile" style={{position:'relative'}}>
            Profile
            {notifCount > 0 && (
              <span className="rb-badge" style={{position:'absolute', top:-6, right:-8, background:'#ef4444', color:'#fff', fontSize:10, fontWeight:700, padding:'2px 6px', borderRadius:10, minWidth:18, textAlign:'center'}}>
                {notifCount}
              </span>
            )}
          </Link>
        )}
        {isAuthed && <Link to="/collaborations">Collaborations</Link>}
        {isAuthed && <Link to="/collaborators">Collaborators</Link>}
        {!isAuthed && <button onClick={goLogin} style={{background:'transparent', border:'none', color:'#cbd5e1', cursor:'pointer', fontWeight:500}}>Sign in</button>}
        {isAuthed && <button onClick={doLogout} style={{background:'transparent', border:'none', color:'#cbd5e1', cursor:'pointer', fontWeight:500}}>Logout</button>}
      </div>
    </nav>
  );
}

export default function App() {
  const location = useLocation();
  const showCreatorSidebar = [/^\/studio/, /^\/dashboard/, /^\/profile/, /^\/collaborators/, /^\/collaborations/].some(r => r.test(location.pathname));
  const showLibrarySidebar = [/^\/$/, /^\/search/].some(r => r.test(location.pathname));
  const isReaderPage = /^\/reader/.test(location.pathname);

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
    </div>
  );
}
