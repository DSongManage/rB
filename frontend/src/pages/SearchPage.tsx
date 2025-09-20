import React, { useState } from 'react';

export default function SearchPage() {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<string[]>([]);
  const run = ()=>{
    fetch(`http://127.0.0.1:8000/api/search/?q=${encodeURIComponent(q)}`)
      .then(r=>r.json()).then(setResults).catch(()=>setResults([]));
  };
  return (
    <div className="page">
      <h2>Search Collaborators</h2>
      <input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Search creators"/>
      <button onClick={run}>Search</button>
      <ul>
        {results.map(r=> <li key={r}>{r}</li>)}
      </ul>
    </div>
  );
}
