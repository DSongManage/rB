import React, { useState } from 'react';

export default function SignupForm() {
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [msg, setMsg] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('http://localhost:8000/api/users/signup/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, display_name: displayName })
    });
    if (res.ok) {
      const data = await res.json();
      setMsg(`Created @${data.username}`);
    } else {
      const t = await res.text();
      setMsg(`Failed: ${t}`);
    }
  };

  return (
    <form onSubmit={submit} style={{display:'grid', gap:8}}>
      <input value={username} onChange={(e)=>setUsername(e.target.value)} placeholder="@handle (optional)" />
      <input value={displayName} onChange={(e)=>setDisplayName(e.target.value)} placeholder="Display name" />
      <button type="submit">Create account</button>
      <div style={{fontSize:12, color:'#94a3b8'}}>{msg || 'Handle is permanent; display name can be edited later.'}</div>
    </form>
  );
}


