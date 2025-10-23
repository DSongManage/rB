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
    if (contentIdParam) {
      setEditContentId(parseInt(contentIdParam, 10));
    }
  }, [searchParams]);

  // If editing existing content, show BookEditor directly
  if (editContentId) {
    return (
      <div className="page" style={{maxWidth:1100, margin:'0 auto'}}>
        <BookEditor
          existingContentId={editContentId}
          onPublish={(contentId) => {
            // After publishing a new chapter, stay in edit mode
            navigate(`/studio?editContent=${editContentId}`);
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
