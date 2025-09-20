import React, { useState } from 'react';
import { Route, Routes, Link, useLocation, useNavigate } from 'react-router-dom';
import './App.css';
import HomePage from './pages/HomePage';
import SearchPage from './pages/SearchPage';
import StudioPage from './pages/StudioPage';
import DashboardPage from './pages/DashboardPage';
import ProfilePage from './pages/ProfilePage';
import { CreatorSidebar } from './components/CreatorSidebar';

function Header() {
  const [q, setQ] = useState('');
  const navigate = useNavigate();
  const submit = (e: React.FormEvent) => { e.preventDefault(); navigate(`/search?q=${encodeURIComponent(q)}`); };
  return (
    <nav className="rb-header">
      <div className="rb-header-left">
        <div className="rb-logo">renaissBlock</div>
      </div>
      <div className="rb-header-center">
        <form onSubmit={submit} className="rb-search">
          <input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Search" />
          <button type="submit">Search</button>
        </form>
      </div>
      <div className="rb-header-right rb-nav">
        <Link to="/">Home</Link>
        <Link to="/search">Search</Link>
        <Link to="/studio">Studio</Link>
        <Link to="/dashboard">Dashboard</Link>
        <Link to="/profile">Profile</Link>
      </div>
    </nav>
  );
}

export default function App() {
  const location = useLocation();
  const showCreatorSidebar = [/^\/studio/, /^\/dashboard/, /^\/profile/].some(r => r.test(location.pathname));
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
          </Routes>
        </div>
      </main>
    </div>
  );
}
