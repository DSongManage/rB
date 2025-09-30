import React from 'react';

export default function ShareStep({ contentId }:{ contentId?: number }){
  const url = contentId ? `https://renaissblock.local/content/${contentId}` : '';
  return (
    <div style={{display:'grid', gap:12}}>
      <div>Share your work</div>
      <div style={{display:'flex', gap:8}}>
        <input value={url} readOnly style={{flex:1}} />
        <button onClick={()=> url && navigator.clipboard.writeText(url)}>Copy link</button>
      </div>
      <div style={{fontSize:12, color:'#94a3b8'}}>Invite collaborators directly from the Collaborators page.</div>
    </div>
  );
}


