import React, { useEffect, useRef, useState } from 'react';

type Props = {
  onNext?: (c:{ teaserPercent:number; watermark:boolean; price:number; editions:number; splits:Array<{address:string; percent:number}> })=>void;
  registerSubmit?: (fn: ()=>{ teaserPercent:number; watermark:boolean; price:number; editions:number; splits:Array<{address:string; percent:number}> })=>void;
};

export default function CustomizeStep({ onNext, registerSubmit }: Props){
  const [teaser, setTeaser] = useState(10);
  const [watermark, setWatermark] = useState(false);
  const [price, setPrice] = useState(1);
  const [editions, setEditions] = useState(10);
  const [splits] = useState<Array<{address:string; percent:number}>>([]);
  const latest = useRef({ teaserPercent: teaser, watermark, price, editions, splits });
  // Keep a ref of latest values without triggering parent state updates
  useEffect(()=>{
    latest.current = { teaserPercent: teaser, watermark, price, editions, splits };
  }, [teaser, watermark, price, editions, splits]);
  // Register once (or when registerSubmit identity changes)
  useEffect(()=>{
    if (registerSubmit) {
      registerSubmit(()=> latest.current);
    }
  }, [registerSubmit]);

  return (
    <div style={{display:'grid', gap:12}}>
      <label>Teaser shown to public: {teaser}% <input type="range" min={0} max={100} value={teaser} onChange={(e)=> setTeaser(parseInt(e.target.value))} /></label>
      <label title="Show a watermark overlay on the teaser only (original remains clean)"><input type="checkbox" checked={watermark} onChange={(e)=> setWatermark(e.target.checked)} /> Show watermark on teaser</label>
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8}}>
        <div style={{display:'grid', gap:6}}>
          <div style={{fontSize:12, color:'#94a3b8'}}>Price per edition (USD)</div>
          <input type="number" min={0} step={0.01} value={price} onChange={(e)=> setPrice(parseFloat(e.target.value||'0'))} />
        </div>
        <div style={{display:'grid', gap:6}}>
          <div style={{fontSize:12, color:'#94a3b8'}}>Number of editions</div>
          <input type="number" min={1} value={editions} onChange={(e)=> setEditions(parseInt(e.target.value||'1'))} />
        </div>
      </div>
      <div style={{fontSize:12, color:'#94a3b8'}}>Platform fee applies per terms</div>
    </div>
  );
}


