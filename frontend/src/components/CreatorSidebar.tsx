import React from 'react';

export function CreatorSidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-title">Creator</div>
      <ul>
        <li><a href="/studio">New upload</a></li>
        <li><a href="/dashboard">Analytics</a></li>
        <li><a href="/profile">Profile</a></li>
      </ul>
    </aside>
  );
}
