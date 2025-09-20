import React, { useState } from 'react';

export default function StudioPage() {
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File|null>(null);
  const [status, setStatus] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) { setStatus('Choose a file'); return; }
    const form = new FormData();
    form.append('title', title);
    form.append('file', file);
    const res = await fetch('http://127.0.0.1:8000/api/content/', { method:'POST', body: form });
    if (res.ok) setStatus('Uploaded'); else setStatus('Upload failed');
  };

  return (
    <div className="page">
      <h2>Studio</h2>
      <form onSubmit={submit}>
        <input placeholder="Title" value={title} onChange={(e)=>setTitle(e.target.value)} />
        <input type="file" onChange={(e)=> setFile(e.target.files?.[0] ?? null)} />
        <button type="submit">Upload</button>
      </form>
      <div>{status}</div>
    </div>
  );
}
