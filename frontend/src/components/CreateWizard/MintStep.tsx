import React, { useEffect, useState } from 'react';
import { API_URL } from '../../config';

type Props = { onMint: ()=>void; price?: number; editions?: number };

export default function MintStep({ onMint, price, editions }: Props){
  const [agree, setAgree] = useState(false);
  const [feePct, setFeePct] = useState<number>(10);
  useEffect(()=>{
    fetch(`${API_URL}/api/dashboard/`, { credentials:'include' })
      .then(r=> r.ok? r.json(): null)
      .then(d=> { if (d && typeof d.fee === 'number') setFeePct(d.fee); })
      .catch(()=>{});
  }, []);
  const gross = (Number(price||0) * Number(editions||1));
  const net = gross * (Math.max(0, 100-feePct)/100);
  return (
    <div style={{display:'grid', gap:12}}>
      <div style={{fontSize:14, fontWeight:600}}>Review</div>
      <div style={{fontSize:12, color:'#94a3b8'}}>Price per edition: ${price ?? 0} • Editions: {editions ?? 1}</div>
      <div style={{fontSize:12, color:'#94a3b8'}}>Gross: ${gross.toFixed(2)} • Platform Fee: {feePct}% • Net: ${net.toFixed(2)}</div>
      <a href="/terms" target="_blank" rel="noreferrer" style={{fontSize:12}}>View terms and conditions</a>
      <label><input type="checkbox" checked={agree} onChange={(e)=> setAgree(e.target.checked)} /> I agree to the Terms and understand fees</label>
      <button disabled={!agree} onClick={onMint} style={{background:'var(--accent)', color:'#111', border:'none', padding:'8px 12px', borderRadius:8, width:160}}>Mint & Publish</button>
    </div>
  );
}


