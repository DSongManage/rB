import React from 'react';

const COLOR_MAP: Record<string, string> = {
  // GREEN - Available
  'Available': '#10b981',
  'Open to Offers': '#10b981',
  // YELLOW - Limited availability
  'Selective': '#f59e0b',
  'Booked': '#f59e0b',
  // RED - Unavailable
  'Unavailable': '#ef4444',
  'On Hiatus': '#ef4444',
};

export function ProfileStatus({ status }: { status?: string }){
  const color = COLOR_MAP[status || 'Available'] || '#f59e0b';
  return (
    <span style={{display:'inline-flex', alignItems:'center', gap:6, fontSize:12}}>
      <span style={{width:8, height:8, borderRadius:999, background: color, boxShadow:`0 0 8px ${color}`}} />
      <span>{status || 'Available'}</span>
    </span>
  );
}

export default ProfileStatus;


