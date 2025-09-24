import React, { useState } from 'react';

export default function ProfileEditForm({ initialDisplayName }: { initialDisplayName?: string }) {
  const [displayName, setDisplayName] = useState(initialDisplayName || '');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [bannerUrl, setBannerUrl] = useState('');
  const [location, setLocation] = useState('');
  const [roles, setRoles] = useState<string>('');
  const [genres, setGenres] = useState<string>('');
  const [msg, setMsg] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = {
      display_name: displayName,
      avatar_url: avatarUrl,
      banner_url: bannerUrl,
      location,
      roles: roles ? roles.split(',').map(s=>s.trim()).filter(Boolean) : [],
      genres: genres ? genres.split(',').map(s=>s.trim()).filter(Boolean) : [],
    };
    const res = await fetch('http://localhost:8000/api/users/profile/', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body)
    });
    if (res.ok) {
      setMsg('Saved');
    } else {
      const t = await res.text();
      setMsg(`Failed: ${t}`);
    }
  };

  return (
    <form onSubmit={submit} style={{display:'grid', gap:8}}>
      <input value={displayName} onChange={(e)=>setDisplayName(e.target.value)} placeholder="Display name" />
      <input value={avatarUrl} onChange={(e)=>setAvatarUrl(e.target.value)} placeholder="Avatar URL" />
      <input value={bannerUrl} onChange={(e)=>setBannerUrl(e.target.value)} placeholder="Banner URL" />
      <input value={location} onChange={(e)=>setLocation(e.target.value)} placeholder="Location (e.g., New York, NY)" />
      <input value={roles} onChange={(e)=>setRoles(e.target.value)} placeholder="Roles (comma-separated, e.g., author, editor)" />
      <input value={genres} onChange={(e)=>setGenres(e.target.value)} placeholder="Genres (comma-separated, e.g., fantasy, drama)" />
      <button type="submit">Save</button>
      <div style={{fontSize:12, color:'#94a3b8'}}>{msg}</div>
    </form>
  );
}


