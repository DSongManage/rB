import React from 'react';

export function CreatorSidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-title">Creator</div>
      <nav className="sidebar-nav">
        <a className="sidebar-item" href="/studio">
          <span>New upload</span>
        </a>
        <a className="sidebar-item" href="/collaborators">
          <span>Collaborators</span>
        </a>
        <a className="sidebar-item" href="/dashboard">
          <span>Analytics</span>
        </a>
        <a className="sidebar-item" href="/profile">
          <span>Profile</span>
        </a>
      </nav>
    </aside>
  );
}
