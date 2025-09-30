import React from 'react';

const COLOR_MAP: Record<string, string> = {
  'Mint-Ready Partner': '#00FF00',
  'Chain Builder': '#00FF00',
  'Open Node': '#00FF00',
  'Selective Forge': '#FFFF00',
  'Linked Capacity': '#FFFF00',
  'Partial Protocol': '#FFFF00',
  'Locked Chain': '#FF0000',
  'Sealed Vault': '#FF0000',
  'Exclusive Mint': '#FF0000',
};

export function ProfileStatus({ status }: { status?: string }){
  const color = COLOR_MAP[status || 'Open Node'] || '#FFFF00';
  return (
    <span style={{display:'inline-flex', alignItems:'center', gap:6, fontSize:12}}>
      <span style={{width:8, height:8, borderRadius:999, background: color, boxShadow:`0 0 8px ${color}`}} />
      <span>{status || 'Open Node'}</span>
    </span>
  );
}

export default ProfileStatus;


