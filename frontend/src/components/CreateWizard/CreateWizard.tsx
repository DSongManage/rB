import React, { useState, useCallback } from 'react';
import TypeSelect from './TypeSelect';
import CreateStep from './CreateStep';
import CustomizeStep from './CustomizeStep';
import MintStep from './MintStep';
import ShareStep from './ShareStep';

type Payload = { title: string; type:'text'|'image'|'video'; file?: File; textHtml?: string };

export default function CreateWizard(){
  const [step, setStep] = useState(0);
  const [ctype, setCtype] = useState<'text'|'image'|'video'|'none'>('none');
  const [payload, setPayload] = useState<Payload|undefined>();
  const [contentId, setContentId] = useState<number|undefined>();
  const [msg, setMsg] = useState('');
  const [maxStep, setMaxStep] = useState(0);

  async function fetchCsrf(){
    try {
      const t = await fetch('http://localhost:8000/api/auth/csrf/', { credentials:'include' }).then(r=>r.json());
      return t?.csrfToken || '';
    } catch { return ''; }
  }

  const createContent = async (p: Payload) => {
    const form = new FormData();
    form.append('title', p.title);
    const mapped = p.type === 'text' ? 'book' : (p.type === 'image' ? 'art' : 'film');
    form.append('content_type', mapped);
    if (p.file) {
      form.append('file', p.file);
    } else if (p.type === 'text' && p.textHtml) {
      const blob = new Blob([p.textHtml], { type: 'text/html' });
      const pseudo = new File([blob], 'content.html', { type: 'text/html' });
      form.append('file', pseudo);
    }
    const csrf = await fetchCsrf();
    const res = await fetch('http://localhost:8000/api/content/', { method:'POST', headers:{ 'X-CSRFToken': csrf, 'X-Requested-With':'XMLHttpRequest' }, body: form, credentials:'include' });
    if (res.ok) {
      const d = await res.json();
      setContentId(d.id || d.pk);
      setMsg('Created');
      setStep(2);
    } else {
      setMsg('Create failed');
    }
  };

  const doMint = async () => {
    const csrf = await fetchCsrf();
    const res = await fetch('http://localhost:8000/api/mint/', { method:'POST', headers:{'Content-Type':'application/json', 'X-CSRFToken': csrf, 'X-Requested-With':'XMLHttpRequest'}, body: JSON.stringify({ royalties: [] }), credentials:'include' });
    if (res.ok) setStep(4); else setMsg('Mint failed');
  };

  // Allow global Next placement (footer) by registering per-step submit
  const [submitCurrent, setSubmitCurrent] = useState<(()=>void)|null>(null);
  const [collectCustomize, setCollectCustomize] = useState<(()=>{ teaserPercent:number; watermark:boolean; price:number; editions:number; splits:any[] })|null>(null);
  const registerSubmit = useCallback((fn: ()=>void)=> { setSubmitCurrent(()=> fn); }, []);
  const registerCustomize = useCallback((fn: ()=>{ teaserPercent:number; watermark:boolean; price:number; editions:number; splits:any[] })=> { setCollectCustomize(()=> fn); }, []);

  return (
    <div style={{display:'grid', gap:16}}>
      <div style={{display:'grid', gridTemplateColumns:'repeat(5, 1fr)', gap:8, alignItems:'end'}}>
        {['Type','Create/Upload','Customize','Mint','Share'].map((t,i)=> {
          const current = i === step;
          const canClick = i <= maxStep || i <= step;
          return (
            <div key={t} onClick={()=> canClick && setStep(i)} style={{cursor: canClick? 'pointer':'default'}}>
              <div style={{display:'flex', alignItems:'center', gap:8}}>
                <div style={{width:22, height:22, borderRadius:999, border:'1px solid var(--panel-border)', background: current? 'var(--accent)':'var(--panel)', color: current? '#111':'var(--text-dim)', display:'grid', placeItems:'center', fontSize:12, fontWeight:700}}>{i+1}</div>
                <div style={{fontSize:12, color: current? 'var(--text)' : 'var(--text-dim)', fontWeight: current? 700:600}}>{t}</div>
              </div>
              <div style={{height:3, marginTop:6, borderRadius:999, background: current? 'radial-gradient(60% 100% at 50% 100%, rgba(245,158,11,0.9), rgba(245,158,11,0.2))':'transparent', boxShadow: current? '0 0 8px rgba(245,158,11,0.7)' : 'none'}} />
            </div>
          );
        })}
      </div>

      {step>=1 && (
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
          <button onClick={()=> { const prev = Math.max(0, step-1); setStep(prev); }} style={{background:'transparent', border:'1px solid var(--panel-border)', color:'var(--text-dim)', borderRadius:8, padding:'6px 10px'}}>Back</button>
          <button onClick={()=> { setCtype('none'); setPayload(undefined); setContentId(undefined); setStep(0); }} style={{background:'transparent', border:'none', color:'var(--accent-soft)', textDecoration:'underline'}}>Change type</button>
        </div>
      )}

      {step===0 && (
        <TypeSelect onSelect={(t)=> { setCtype(t); setMaxStep(Math.max(maxStep,0)); setStep(1); }} />
      )}
      {step===1 && ctype!=='none' && (
        <CreateStep
          type={ctype}
          registerSubmit={registerSubmit}
          showNextButton={false}
          onReady={(p)=> { setPayload({ title: p.title, type: ctype, file: p.file, textHtml: p.textHtml }); setMaxStep(Math.max(maxStep,1)); createContent({ title: p.title, type: ctype, file: p.file, textHtml: p.textHtml }); }}
        />
      )}
      {step===2 && (
        <CustomizeStep registerSubmit={registerCustomize} onNext={(c)=> { setMaxStep(Math.max(maxStep,2)); setStep(3); }} />
      )}
      {step===3 && (
        <MintStep price={collectCustomize ? collectCustomize().price : undefined} editions={collectCustomize ? collectCustomize().editions : undefined} onMint={()=> { setMaxStep(Math.max(maxStep,3)); doMint(); }} />
      )}
      {step===4 && (
        <ShareStep contentId={contentId} />
      )}
      <div style={{position:'sticky', bottom:0, display:'flex', justifyContent:'space-between', alignItems:'center'}}>
        <div style={{fontSize:12, color:'#94a3b8'}}>{msg}</div>
        {false && step===0 && (
          <button disabled={ctype==='none'} onClick={()=> { if (ctype!=='none') { setMaxStep(Math.max(maxStep,0)); setStep(1); } }} style={{opacity: ctype==='none'? 0.5:1, background:'var(--accent)', color:'#111', border:'none', padding:'10px 18px', borderRadius:999}}>Next</button>
        )}
        {step===1 && (
          <button onClick={()=> submitCurrent && submitCurrent()} style={{background:'var(--accent)', color:'#111', border:'none', padding:'10px 18px', borderRadius:999}}>Next</button>
        )}
        {step===2 && (
          <button onClick={()=> { if (collectCustomize){ const c = collectCustomize(); } setMaxStep(Math.max(maxStep,2)); setStep(3); }} style={{background:'var(--accent)', color:'#111', border:'none', padding:'10px 18px', borderRadius:999}}>Next</button>
        )}
        {false && step===3 && (
          <button onClick={()=> { setMaxStep(Math.max(maxStep,3)); doMint(); }} style={{background:'var(--accent)', color:'#111', border:'none', padding:'10px 18px', borderRadius:999}}>Mint</button>
        )}
      </div>
    </div>
  );
}


