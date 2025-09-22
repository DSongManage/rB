import React, { useEffect, useState } from 'react';
import SignupForm from '../components/SignupForm';

const BACKEND = 'http://localhost:8000';

export default function AuthPage() {
  const [csrf, setCsrf] = useState('');
  const [mode, setMode] = useState<'login'|'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(()=>{
    fetch(`${BACKEND}/api/auth/csrf/`, { credentials:'include' })
      .then(r=>r.json())
      .then(d=> setCsrf(d?.csrfToken || ''))
      .catch(()=> setCsrf(''));
  },[]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg('');
    const form = new URLSearchParams();
    if (mode==='login') {
      form.set('login', username);
      form.set('password', password);
      form.set('next', '/');
      const res = await fetch(`${BACKEND}/accounts/login/`, {
        method:'POST', credentials:'include', headers:{ 'Content-Type':'application/x-www-form-urlencoded', 'X-CSRFToken': csrf }, body:String(form)
      });
      if (res.ok) { window.location.href = '/'; } else { setMsg('Sign in failed'); }
    } else {
      form.set('username', username);
      form.set('password1', password);
      form.set('password2', password2);
      form.set('next', '/');
      const res = await fetch(`${BACKEND}/accounts/signup/`, {
        method:'POST', credentials:'include', headers:{ 'Content-Type':'application/x-www-form-urlencoded', 'X-CSRFToken': csrf }, body:String(form)
      });
      if (res.ok) { window.location.href = '/'; } else { setMsg('Signup failed'); }
    }
  };

  return (
    <div className="page" style={{maxWidth:480, margin:'40px auto'}}>
      <div style={{display:'flex', gap:8, marginBottom:16}}>
        <button className={mode==='login'? 'chip active':'chip'} onClick={()=>setMode('login')}>Sign in</button>
        <button className={mode==='register'? 'chip active':'chip'} onClick={()=>setMode('register')}>Create account</button>
      </div>

      <form onSubmit={submit} style={{display:'grid', gap:12}}>
        <input value={username} onChange={(e)=>setUsername(e.target.value)} placeholder="Username" required />
        <input type="password" value={password} onChange={(e)=>setPassword(e.target.value)} placeholder="Password" required />
        {mode==='register' && (
          <input type="password" value={password2} onChange={(e)=>setPassword2(e.target.value)} placeholder="Confirm password" required />
        )}
        <button type="submit" style={{marginTop:6}}>{mode==='login' ? 'Sign in' : 'Create account'}</button>
      </form>
      <div style={{marginTop:10, fontSize:12, color:'#94a3b8'}}>{msg || 'Your session is secured with CSRF & cookies.'}</div>
      {mode==='register' && (
        <div style={{marginTop:16, paddingTop:16, borderTop:'1px solid #1f2937'}}>
          <div style={{fontWeight:600, color:'#e5e7eb', marginBottom:8}}>Or quick handle-only signup (MVP)</div>
          <SignupForm />
        </div>
      )}
    </div>
  );
}
