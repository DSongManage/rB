import React, { useEffect, useState } from 'react';
import { Route, Routes, Link, useLocation, useNavigate } from 'react-router-dom';
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
import CollaboratorsPage from './pages/CollaboratorsPage';
import ContentDetail from './pages/ContentDetail';

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
  const submit = (e: React.FormEvent) => { e.preventDefault(); navigate(`/search?q=${encodeURIComponent(q)}`); };
  const goLogin = () => { navigate('/auth'); };
  const doLogout = () => {
    const next = encodeURIComponent(window.location.origin + '/');
    window.location.assign(`/accounts/logout/?next=${next}`);
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
              <span style={{position:'absolute', top:-6, right:-8, background:'#ef4444', color:'#fff', fontSize:10, fontWeight:700, padding:'2px 6px', borderRadius:10, minWidth:18, textAlign:'center'}}>
                {notifCount}
              </span>
            )}
          </Link>
        )}
        {isAuthed && <Link to="/collaborators">Collaborators</Link>}
        {!isAuthed && <button onClick={goLogin} style={{background:'transparent', border:'none', color:'#cbd5e1', cursor:'pointer', fontWeight:500}}>Sign in</button>}
        {isAuthed && <button onClick={doLogout} style={{background:'transparent', border:'none', color:'#cbd5e1', cursor:'pointer', fontWeight:500}}>Logout</button>}
      </div>
    </nav>
  );
}

export default function App() {
  const location = useLocation();
  const showCreatorSidebar = [/^\/studio/, /^\/dashboard/, /^\/profile/, /^\/collaborators/].some(r => r.test(location.pathname));
  return (
    <div className="rb-app">
      <Header />
      <main className="rb-main" style={{display:'grid', gridTemplateColumns: showCreatorSidebar ? '240px 1fr' : '1fr', gap:16}}>
        {showCreatorSidebar && <CreatorSidebar />}
        <div>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/studio" element={<StudioPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/collaborators" element={<CollaboratorsPage />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/wallet-info" element={<WalletInfoPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/content/:id" element={<ContentDetail />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}
