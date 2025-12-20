import React, { useEffect, useState } from 'react';
import { API_URL } from '../config';

export default function DashboardPage() {
  const [data, setData] = useState<{content_count:number; sales:number; tier?:string; fee?:number}>({content_count:0, sales:0});

  useEffect(()=>{
    const abortController = new AbortController();

    fetch(`${API_URL}/api/dashboard/`, {
      credentials: 'include',
      signal: abortController.signal,
    })
      .then(r=>r.json())
      .then(setData)
      .catch((err)=>{
        if (err.name !== 'AbortError') {
          setData({content_count:0, sales:0});
        }
      });

    return () => abortController.abort();
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
