import React, { useState } from 'react';

export default function ProfileEditForm({ initialDisplayName }: { initialDisplayName?: string }) {
  const [displayName, setDisplayName] = useState(initialDisplayName || '');
  const [msg, setMsg] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('http://localhost:8000/api/users/profile/', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ display_name: displayName })
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
      <button type="submit">Save</button>
      <div style={{fontSize:12, color:'#94a3b8'}}>{msg}</div>
    </form>
  );
}


