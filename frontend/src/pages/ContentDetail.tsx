import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import PreviewModal from '../components/PreviewModal';

export default function ContentDetail(){
  const { id } = useParams();
  const [data, setData] = useState<any>(null);
  useEffect(()=>{
    if (!id) return;
    fetch(`/api/content/${id}/preview/`).then(r=> r.ok? r.json(): null).then(setData);
  }, [id]);
  if (!id) return null;
  if (!data) return <div style={{padding:16}}>Loading…</div>;
  return (
    <div style={{maxWidth:900, margin:'0 auto', padding:16}}>
      <h2 style={{marginBottom:12}}>{data?.title}</h2>
      <div style={{marginBottom:12, fontSize:12, color:'#94a3b8'}}>
        Status: {data?.inventory_status} • Contract: {data?.nft_contract || '-'}
        {data?.price_usd !== undefined && ` • Price: $${data.price_usd.toFixed(2)}`}
        {data?.editions !== undefined && ` • ${data.editions} edition${data.editions > 1 ? 's' : ''} available`}
      </div>
      <PreviewModal 
        open={true} 
        onClose={()=>{}} 
        teaserUrl={data?.teaser_link} 
        contentType={data?.content_type}
        contentId={parseInt(id)}
        price={data?.price_usd}
        editions={data?.editions}
      />
    </div>
  );
}


