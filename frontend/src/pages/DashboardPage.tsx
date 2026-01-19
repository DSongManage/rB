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
      <div data-tour="earnings-card" style={{ marginBottom: 16 }}>
        <div>Sales: ${data.sales}</div>
      </div>
      <div data-tour="sales-chart" style={{ marginBottom: 16 }}>
        <div>Tier: {data.tier ?? 'N/A'} (Fee: {data.fee ?? 'N/A'}%)</div>
      </div>
      <div data-tour="content-list" style={{ marginBottom: 16 }}>
        <div>Contents: {data.content_count}</div>
      </div>
      <div data-tour="wallet-section">
        <div style={{ fontSize: 12, color: '#94a3b8' }}>Wallet connected via Web3Auth</div>
      </div>
    </div>
  );
}
