import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import PreviewModal from '../components/PreviewModal';
import { API_URL } from '../config';

export default function ContentDetail(){
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [modalOpen, setModalOpen] = useState(true);

  useEffect(()=>{
    if (!id) return;
    console.log('[ContentDetail] Fetching preview for content:', id);
    fetch(`${API_URL}/api/content/${id}/preview/`, { credentials: 'include' })
      .then(r=> {
        console.log('[ContentDetail] Preview response:', r.status, r.statusText);
        return r.ok? r.json(): null;
      })
      .then(data => {
        console.log('[ContentDetail] Preview data:', data);
        setData(data);
      });

    // Track content view
    fetch(`${API_URL}/api/content/${id}/view/`, {
      method: 'POST',
      credentials: 'include',
    }).catch(err => console.log('[ContentDetail] View tracking failed:', err));
  }, [id]);

  const handleClose = () => {
    setModalOpen(false);
    // Navigate back to home or previous page
    navigate(-1);
  };

  if (!id) return null;
  if (!data) return <div style={{padding:16}}>Loading…</div>;

  // For books, always use the teaser API endpoint (not the cover image)
  // For other types (art, film, music), use the teaser_link directly
  const teaserUrl = data?.content_type === 'book'
    ? `${API_URL}/api/content/${id}/teaser/`
    : data?.teaser_link;

  // Transform collaborators to match PreviewModal's expected format
  const collaborators = data?.collaborators?.map((c: any) => ({
    username: c.username,
    role: c.role,
    revenuePercentage: c.revenue_percentage,
  })) || [];

  return (
    <div style={{maxWidth:900, margin:'0 auto', padding:16}}>
      <h2 style={{marginBottom:12}}>{data?.title}</h2>
      <div style={{marginBottom:12, fontSize:12, color:'#94a3b8'}}>
        Status: {data?.inventory_status} • Contract: {data?.nft_contract || '-'}
        {data?.price_usd !== undefined && ` • Price: $${data.price_usd.toFixed(2)}`}
        {data?.editions !== undefined && ` • ${data.editions} edition${data.editions > 1 ? 's' : ''} available`}
      </div>
      <PreviewModal
        open={modalOpen}
        onClose={handleClose}
        teaserUrl={teaserUrl}
        contentType={data?.content_type}
        contentId={parseInt(id)}
        price={data?.price_usd}
        editions={data?.editions}
        isCollaborative={data?.is_collaborative}
        collaborators={collaborators}
      />
    </div>
  );
}


