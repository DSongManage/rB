import React, { useState, useEffect } from 'react';
import { API_URL } from '../config';

interface ProfileEditFormProps {
  initialDisplayName?: string;
  initialLocation?: string;
  initialRoles?: string[];
  initialGenres?: string[];
  onSaved?: () => void;
}

export default function ProfileEditForm({
  initialDisplayName,
  initialLocation,
  initialRoles,
  initialGenres,
  onSaved
}: ProfileEditFormProps) {
  const [displayName, setDisplayName] = useState(initialDisplayName || '');
  const [location, setLocation] = useState(initialLocation || '');
  const [roles, setRoles] = useState<string>('');
  const [genres, setGenres] = useState<string>('');
  const [msg, setMsg] = useState('');

  // Update form fields when initial values change
  useEffect(() => {
    setDisplayName(initialDisplayName || '');
  }, [initialDisplayName]);

  useEffect(() => {
    setLocation(initialLocation || '');
  }, [initialLocation]);

  useEffect(() => {
    // Convert array to comma-separated string for display
    setRoles(initialRoles ? initialRoles.join(', ') : '');
  }, [initialRoles]);

  useEffect(() => {
    // Convert array to comma-separated string for display
    setGenres(initialGenres ? initialGenres.join(', ') : '');
  }, [initialGenres]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Fetch CSRF token for authenticated PATCH
    const csrfRes = await fetch(`${API_URL}/api/auth/csrf/`, { credentials: 'include' });
    const csrfData = await csrfRes.json();
    const csrf = csrfData?.csrfToken || '';
    const body = {
      display_name: displayName,
      location,
      roles: roles ? roles.split(',').map(s=>s.trim()).filter(Boolean) : [],
      genres: genres ? genres.split(',').map(s=>s.trim()).filter(Boolean) : [],
    };
    const res = await fetch(`${API_URL}/api/users/profile/`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrf, 'X-Requested-With': 'XMLHttpRequest' },
      credentials: 'include',
      body: JSON.stringify(body)
    });
    if (res.ok) {
      setMsg('✅ Profile updated successfully');
      onSaved && onSaved();
      // Clear success message after 3 seconds
      setTimeout(() => setMsg(''), 3000);
    } else {
      const t = await res.text();
      setMsg(`❌ Failed: ${t}`);
    }
  };

  return (
    <form onSubmit={submit} style={{display:'grid', gap:8}}>
      <input
        value={displayName}
        onChange={(e)=>setDisplayName(e.target.value)}
        placeholder="Display name"
      />
      <input
        value={location}
        onChange={(e)=>setLocation(e.target.value)}
        placeholder="Location (e.g., New York, NY)"
      />
      <input
        value={roles}
        onChange={(e)=>setRoles(e.target.value)}
        placeholder="Roles (comma-separated, e.g., author, editor, artist)"
      />
      <input
        value={genres}
        onChange={(e)=>setGenres(e.target.value)}
        placeholder="Genres (comma-separated, e.g., fantasy, drama, anime)"
      />
      <button type="submit">Save Profile</button>
      {msg && (
        <div style={{
          fontSize:13,
          color: msg.includes('✅') ? '#10b981' : '#ef4444',
          padding: '8px',
          background: msg.includes('✅') ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
          borderRadius: 6,
          border: `1px solid ${msg.includes('✅') ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
        }}>
          {msg}
        </div>
      )}
    </form>
  );
}
