import React, { useEffect, useState } from 'react';

export default function DashboardPage() {
  const [data, setData] = useState<{content_count:number; sales:number; tier?:string; fee?:number}>({content_count:0, sales:0});
  useEffect(()=>{
    fetch('http://127.0.0.1:8000/api/dashboard/')
      .then(r=>r.json()).then(setData).catch(()=>setData({content_count:0, sales:0}));
  },[]);
  return (
    <div className="page">
      <h2>Dashboard</h2>
      <div>Contents: {data.content_count}</div>
      <div>Sales: ${data.sales}</div>
      <div>Tier: {data.tier ?? 'N/A'} (Fee: {data.fee ?? 'N/A'}%)</div>
    </div>
  );
}
