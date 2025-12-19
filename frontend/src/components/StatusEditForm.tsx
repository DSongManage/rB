import React, { useState } from 'react';

const OPTIONS = [
  { value: 'Available', label: 'Available', description: 'Ready to start new collaborations', category: 'green' },
  { value: 'Open to Offers', label: 'Open to Offers', description: 'Will consider interesting projects', category: 'green' },
  { value: 'Selective', label: 'Selective', description: 'Only taking specific types of work', category: 'yellow' },
  { value: 'Booked', label: 'Booked', description: 'Currently busy, booking future work', category: 'yellow' },
  { value: 'Unavailable', label: 'Unavailable', description: 'Not accepting collaborations', category: 'red' },
  { value: 'On Hiatus', label: 'On Hiatus', description: 'Taking a break', category: 'red' },
];

const CATEGORY_COLORS = {
  green: { bg: '#10b981', text: '#fff', dot: '#10b981' },
  yellow: { bg: '#f59e0b', text: '#000', dot: '#f59e0b' },
  red: { bg: '#ef4444', text: '#fff', dot: '#ef4444' },
};

export default function StatusEditForm({ initialStatus, onSaved }: { initialStatus?: string; onSaved?: ()=>void }){
  const [status, setStatus] = useState(initialStatus || 'Available');
  const [msg, setMsg] = useState('');

  const currentOption = OPTIONS.find(o => o.value === status) || OPTIONS[0];

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const csrf = await fetch('/api/auth/csrf/', { credentials:'include' }).then(r=>r.json()).then(j=> j?.csrfToken || '');
    const res = await fetch('/api/profile/status/', {
      method:'PATCH', headers:{ 'Content-Type':'application/json', 'X-CSRFToken': csrf, 'X-Requested-With':'XMLHttpRequest' }, credentials:'include', body: JSON.stringify({ status })
    });
    if (res.ok) { setMsg('Saved'); onSaved && onSaved(); } else { setMsg('Failed'); }
  };

  return (
    <form onSubmit={save} style={{display:'flex', gap:12, alignItems:'center', flexWrap:'wrap'}}>
      <div style={{display:'flex', alignItems:'center', gap:8}}>
        <div style={{
          width:10, height:10, borderRadius:'50%',
          background: CATEGORY_COLORS[currentOption.category as keyof typeof CATEGORY_COLORS].dot
        }} />
        <select
          value={status}
          onChange={(e)=> setStatus(e.target.value)}
          style={{
            padding:'8px 12px',
            background:'#1e293b',
            border:'1px solid #334155',
            borderRadius:8,
            color:'#f1f5f9',
            fontSize:14,
            cursor:'pointer',
            minWidth:160
          }}
        >
          {OPTIONS.map(o=> (
            <option key={o.value} value={o.value}>
              {o.label} - {o.description}
            </option>
          ))}
        </select>
      </div>
      <button
        type="submit"
        style={{
          padding:'8px 16px',
          background:'#f59e0b',
          border:'none',
          borderRadius:8,
          color:'#111',
          fontWeight:600,
          cursor:'pointer',
          fontSize:14
        }}
      >
        Save
      </button>
      {msg && <span style={{fontSize:12, color: msg === 'Saved' ? '#10b981' : '#ef4444'}}>{msg}</span>}
    </form>
  );
}


