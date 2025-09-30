import React, { useState } from 'react';

const OPTIONS = [
  'Mint-Ready Partner',
  'Chain Builder',
  'Open Node',
  'Selective Forge',
  'Linked Capacity',
  'Partial Protocol',
  'Locked Chain',
  'Sealed Vault',
  'Exclusive Mint',
];

export default function StatusEditForm({ initialStatus, onSaved }: { initialStatus?: string; onSaved?: ()=>void }){
  const [status, setStatus] = useState(initialStatus || 'Open Node');
  const [msg, setMsg] = useState('');

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const csrf = await fetch('http://localhost:8000/api/auth/csrf/', { credentials:'include' }).then(r=>r.json()).then(j=> j?.csrfToken || '');
    const res = await fetch('http://localhost:8000/api/profile/status/', {
      method:'PATCH', headers:{ 'Content-Type':'application/json', 'X-CSRFToken': csrf, 'X-Requested-With':'XMLHttpRequest' }, credentials:'include', body: JSON.stringify({ status })
    });
    if (res.ok) { setMsg('Saved'); onSaved && onSaved(); } else { setMsg('Failed'); }
  };

  return (
    <form onSubmit={save} style={{display:'flex', gap:8, alignItems:'center'}}>
      <select value={status} onChange={(e)=> setStatus(e.target.value)}>
        {OPTIONS.map(o=> <option key={o} value={o}>{o}</option>)}
      </select>
      <button type="submit">Save</button>
      <span style={{fontSize:12, color:'#94a3b8'}}>{msg}</span>
    </form>
  );
}


