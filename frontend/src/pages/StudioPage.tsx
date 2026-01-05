import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import CreateWizard from '../components/CreateWizard/CreateWizard';
import BookEditor from '../components/BookEditor/BookEditor';
import { CreatorAgreementGate } from '../components/legal/CreatorAgreementGate';
import { PenLine, Users } from 'lucide-react';

export default function StudioPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [editContentId, setEditContentId] = useState<number | null>(null);
  const [editBookProjectId, setEditBookProjectId] = useState<number | null>(null);
  const [showChoice, setShowChoice] = useState(true);

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
          width: '100%',
          maxWidth: 'none',
          height: 'calc(100vh - 80px)', // Account for header
          padding: '0 24px',
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

  // Show choice screen: Solo vs Collaboration
  if (showChoice && !modeParam && !mintContentParam) {
    return (
      <div className="page create-choice-container">
        <div className="create-choice-header">
          <h1>Create New Content</h1>
          <p>Choose how you want to create your content</p>
        </div>

        <div className="create-choice-grid">
          {/* Solo Content */}
          <div
            className="create-choice-card solo"
            onClick={() => navigate('/studio?mode=solo')}
          >
            <div className="create-choice-icon solo">
              <PenLine size={32} />
            </div>
            <h3>Create Solo</h3>
            <p>
              Work independently on your own content. Perfect for individual creators who want full control.
            </p>
            <ul>
              <li>100% creative control</li>
              <li>100% revenue</li>
              <li>Quick to publish</li>
            </ul>
          </div>

          {/* Collaborative Content */}
          <div
            className="create-choice-card collab"
            onClick={() => navigate('/collaborations')}
          >
            <div className="create-choice-icon collab">
              <Users size={32} />
            </div>
            <h3>Start Collaboration</h3>
            <p>
              Work with other creators. Combine skills and split revenue transparently.
            </p>
            <ul>
              <li>Invite multiple creators</li>
              <li>Set roles & permissions</li>
              <li>Fair revenue splits</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return (
    <CreatorAgreementGate>
      <div className="page" style={{ width: '100%', maxWidth: 'none', padding: '16px' }}>
        <CreateWizard />
      </div>
    </CreatorAgreementGate>
  );
}
