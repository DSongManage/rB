import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import CreateWizard from '../components/CreateWizard/CreateWizard';
import BookEditor from '../components/BookEditor/BookEditor';
import { CreatorAgreementGate } from '../components/legal/CreatorAgreementGate';
import { PenLine, Users } from 'lucide-react';
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

  // Show choice screen: Solo vs Collaboration
  if (showChoice && !modeParam && !mintContentParam) {
    return (
      <div className="page" style={{maxWidth:800, margin:'0 auto', padding:'48px 32px'}}>
        <div style={{textAlign:'center', marginBottom:48}}>
          <h1 style={{fontSize:32, fontWeight:800, color:'var(--text)', marginBottom:12}}>
            Create New Content
          </h1>
          <p style={{fontSize:16, color:'#94a3b8'}}>
            Choose how you want to create your content
          </p>
        </div>

        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:24}} data-tour="studio-mode-selection">
          {/* Solo Content */}
          <div
            onClick={() => navigate('/studio?mode=solo')}
            data-tour="solo-mode-card"
            style={{
              background:'var(--panel)',
              border:'2px solid var(--panel-border)',
              borderRadius:16,
              padding:32,
              cursor:'pointer',
              transition:'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#3b82f6';
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = '0 8px 24px rgba(59, 130, 246, 0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--panel-border)';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <div style={{display:'flex', justifyContent:'center', marginBottom:16}}>
              <div style={{
                width:64,
                height:64,
                borderRadius:16,
                background:'rgba(59, 130, 246, 0.15)',
                display:'flex',
                alignItems:'center',
                justifyContent:'center',
                color:'#3b82f6',
              }}>
                <PenLine size={32} />
              </div>
            </div>
            <h3 style={{fontSize:20, fontWeight:700, color:'var(--text)', marginBottom:12, textAlign:'center'}}>
              Create Solo
            </h3>
            <p style={{fontSize:14, color:'#94a3b8', lineHeight:1.6, textAlign:'center'}}>
              Work independently on your own content. Perfect for individual creators who want full control.
            </p>
            <ul style={{
              fontSize:13,
              color:'#cbd5e1',
              marginTop:16,
              paddingLeft:20,
              lineHeight:1.8,
            }}>
              <li>100% creative control</li>
              <li>100% revenue</li>
              <li>Quick to publish</li>
            </ul>
          </div>

          {/* Collaborative Content */}
          <div
            onClick={() => navigate('/collaborations')}
            data-tour="collab-mode-card"
            style={{
              background:'var(--panel)',
              border:'2px solid var(--panel-border)',
              borderRadius:16,
              padding:32,
              cursor:'pointer',
              transition:'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#f59e0b';
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = '0 8px 24px rgba(245, 158, 11, 0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--panel-border)';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <div style={{display:'flex', justifyContent:'center', marginBottom:16}}>
              <div style={{
                width:64,
                height:64,
                borderRadius:16,
                background:'rgba(245, 158, 11, 0.15)',
                display:'flex',
                alignItems:'center',
                justifyContent:'center',
                color:'#f59e0b',
              }}>
                <Users size={32} />
              </div>
            </div>
            <h3 style={{fontSize:20, fontWeight:700, color:'var(--text)', marginBottom:12, textAlign:'center'}}>
              Start Collaboration
            </h3>
            <p style={{fontSize:14, color:'#94a3b8', lineHeight:1.6, textAlign:'center'}}>
              Work with other creators. Combine skills and split revenue transparently.
            </p>
            <ul style={{
              fontSize:13,
              color:'#cbd5e1',
              marginTop:16,
              paddingLeft:20,
              lineHeight:1.8,
            }}>
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
      <div className="page" style={{maxWidth:1100, margin:'0 auto'}}>
        <CreateWizard />
      </div>
    </CreatorAgreementGate>
  );
}
