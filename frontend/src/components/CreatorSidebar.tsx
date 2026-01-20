import React from 'react';
import { useLocation } from 'react-router-dom';

export function CreatorSidebar() {
  const location = useLocation();
  const isActive = (path: string) => location.pathname.startsWith(path);
  return (
    <aside className="sidebar">
      <nav className="sidebar-nav">
        <a className={`sidebar-item ${isActive('/profile') ? 'active' : ''}`} href="/profile">
          <span>Profile</span>
        </a>
        <a className={`sidebar-item ${isActive('/studio') ? 'active' : ''}`} href="/studio">
          <span>Create</span>
        </a>
        <a className={`sidebar-item ${isActive('/collaborators') ? 'active' : ''}`} href="/collaborators">
          <span>Collaborators</span>
        </a>
      </nav>
    </aside>
  );
}
