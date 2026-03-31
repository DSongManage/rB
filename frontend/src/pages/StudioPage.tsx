import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import CreateWizard from '../components/CreateWizard/CreateWizard';
import BookEditor from '../components/BookEditor/BookEditor';
import { CreatorAgreementGate } from '../components/legal/CreatorAgreementGate';
import GuidedCreatorFlow from '../components/GuidedCreator/GuidedCreatorFlow';
import { useTour } from '../contexts/TourContext';

export default function StudioPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { startTour, hasCompletedTour } = useTour();
  const [editContentId, setEditContentId] = useState<number | null>(null);
  const [editBookProjectId, setEditBookProjectId] = useState<number | null>(null);
  const [showChoice, setShowChoice] = useState(true);

  // Trigger creator intro tour on first visit to studio choice screen
  useEffect(() => {
    const modeParam = searchParams.get('mode');
    const mintContentParam = searchParams.get('mintContent');
    const editContentParam = searchParams.get('editContent');
    const editBookProjectParam = searchParams.get('editBookProject');

    // Only show tour on the choice screen (no params)
    if (!modeParam && !mintContentParam && !editContentParam && !editBookProjectParam) {
      if (!hasCompletedTour('creator-intro')) {
        // Small delay to let the page render
        setTimeout(() => {
          startTour('creator-intro');
        }, 500);
      }
    }
  }, [searchParams, hasCompletedTour, startTour]);

  useEffect(() => {
    const contentIdParam = searchParams.get('editContent');
    const bookProjectParam = searchParams.get('editBookProject');
    const modeParam = searchParams.get('mode');
    console.log('[StudioPage] editContent param:', contentIdParam);
    console.log('[StudioPage] editBookProject param:', bookProjectParam);

    if (bookProjectParam) {
      // Edit book project directly by ID
      setEditBookProjectId(parseInt(bookProjectParam, 10));
      setEditContentId(null);
      setShowChoice(false);
    } else if (contentIdParam) {
      setEditContentId(parseInt(contentIdParam, 10));
      setEditBookProjectId(null);
      setShowChoice(false);
    } else if (modeParam) {
      // If mode is set (solo or collab), skip choice screen
      setShowChoice(false);
    } else {
      setEditContentId(null);
      setEditBookProjectId(null);
      setShowChoice(true);
    }
  }, [searchParams]);

  // If editing existing content or book project, show BookEditor directly
  // BUT: Don't show BookEditor if we're in the mintContent flow
  const mintContentParam = searchParams.get('mintContent');
  const modeParam = searchParams.get('mode');
  console.log('[StudioPage] mintContent param:', mintContentParam);
  console.log('[StudioPage] editContentId:', editContentId);
  console.log('[StudioPage] editBookProjectId:', editBookProjectId);

  if ((editContentId || editBookProjectId) && !mintContentParam) {
    return (
      <CreatorAgreementGate>
        <div style={{
          maxWidth: 1100,
          margin: '0 auto',
          height: 'calc(100vh - 80px)', // Account for header
          padding: '0 16px',
          overflow: 'hidden',
        }}>
          <BookEditor
            existingContentId={editContentId || undefined}
            existingBookProjectId={editBookProjectId || undefined}
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
              setEditBookProjectId(null);
            }}
          />
        </div>
      </CreatorAgreementGate>
    );
  }

  // Show guided creator flow
  if (showChoice && !modeParam && !mintContentParam) {
    return <GuidedCreatorFlow />;
  }

  return (
    <CreatorAgreementGate>
      <div className="page" style={{maxWidth:1100, margin:'0 auto'}}>
        <CreateWizard />
      </div>
    </CreatorAgreementGate>
  );
}
