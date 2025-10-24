import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import CreateWizard from '../components/CreateWizard/CreateWizard';
import BookEditor from '../components/BookEditor/BookEditor';

export default function StudioPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [editContentId, setEditContentId] = useState<number | null>(null);

  useEffect(() => {
    const contentIdParam = searchParams.get('editContent');
    console.log('[StudioPage] editContent param:', contentIdParam);
    if (contentIdParam) {
      setEditContentId(parseInt(contentIdParam, 10));
    } else {
      setEditContentId(null);
    }
  }, [searchParams]);

  // If editing existing content, show BookEditor directly
  // BUT: Don't show BookEditor if we're in the mintContent flow
  const mintContentParam = searchParams.get('mintContent');
  console.log('[StudioPage] mintContent param:', mintContentParam);
  console.log('[StudioPage] editContentId:', editContentId);
  
  if (editContentId && !mintContentParam) {
    return (
      <div className="page" style={{maxWidth:1100, margin:'0 auto'}}>
        <BookEditor
          existingContentId={editContentId}
          onPublish={(contentId) => {
            // After preparing chapter/book, navigate to minting wizard
            console.log('[StudioPage] onPublish called with contentId:', contentId);
            console.log('[StudioPage] Navigating to /studio?mintContent=' + contentId);
            navigate(`/studio?mintContent=${contentId}`);
          }}
          onBack={() => {
            // Clear the query param and return to normal studio
            navigate('/studio');
            setEditContentId(null);
          }}
        />
      </div>
    );
  }

  return (
    <div className="page" style={{maxWidth:1100, margin:'0 auto'}}>
      <CreateWizard />
    </div>
  );
}
