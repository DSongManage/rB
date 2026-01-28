import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import CreateWizard from '../components/CreateWizard/CreateWizard';
import BookEditor from '../components/BookEditor/BookEditor';
import { CreatorAgreementGate } from '../components/legal/CreatorAgreementGate';
import { Book, Layers, Image } from 'lucide-react';
import { useTour } from '../contexts/TourContext';
import { collaborationApi } from '../services/collaborationApi';

export default function StudioPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { startTour, hasCompletedTour } = useTour();
  const [editContentId, setEditContentId] = useState<number | null>(null);
  const [editBookProjectId, setEditBookProjectId] = useState<number | null>(null);
  const [showChoice, setShowChoice] = useState(true);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

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

  const handleCreateProject = async (contentType: 'book' | 'comic' | 'art') => {
    setCreating(true);
    setCreateError('');
    try {
      // Generate unique title with timestamp to avoid duplicates
      const timestamp = new Date().toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      });
      const project = await collaborationApi.createCollaborativeProject({
        title: `Untitled ${contentType.charAt(0).toUpperCase() + contentType.slice(1)} - ${timestamp}`,
        content_type: contentType,
        description: '',
      });
      navigate(`/studio/${project.id}`);
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create project');
      setCreating(false);
    }
  };

  // Show content type selection screen
  if (showChoice && !modeParam && !mintContentParam) {
    const contentTypes = [
      {
        type: 'book' as const,
        icon: Book,
        title: 'Book',
        description: 'Write chapters, novels, or short stories with rich text editing.',
        color: '#3b82f6',
        features: ['Chapter-based structure', 'Rich text editor', 'Preview before publish'],
      },
      {
        type: 'comic' as const,
        icon: Layers,
        title: 'Comic',
        description: 'Create visual stories with panel layouts and artwork.',
        color: '#f59e0b',
        features: ['Page-by-page layout', 'Upload artwork', 'Panel arrangement'],
      },
      {
        type: 'art' as const,
        icon: Image,
        title: 'Art',
        description: 'Publish standalone artwork, illustrations, or collections.',
        color: '#10b981',
        features: ['High-res uploads', 'Art collections', 'Gallery display'],
      },
    ];

    return (
      <div className="page" style={{maxWidth:900, margin:'0 auto', padding:'48px 32px'}}>
        <div style={{textAlign:'center', marginBottom:48}}>
          <h1 style={{fontSize:32, fontWeight:800, color:'var(--text)', marginBottom:12}}>
            Create New Project
          </h1>
          <p style={{fontSize:16, color:'#94a3b8'}}>
            What would you like to create?
          </p>
          <p style={{fontSize:14, color:'#64748b', marginTop:8}}>
            All projects support collaboration - invite team members anytime from the Team tab
          </p>
        </div>

        {createError && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid #ef4444',
            borderRadius: 8,
            padding: 16,
            color: '#ef4444',
            fontSize: 14,
            marginBottom: 24,
            textAlign: 'center',
          }}>
            {createError}
          </div>
        )}

        <div style={{display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:24}} data-tour="content-type-selection">
          {contentTypes.map(({ type, icon: Icon, title, description, color, features }) => (
            <div
              key={type}
              onClick={() => !creating && handleCreateProject(type)}
              data-tour={`${type}-type-card`}
              style={{
                background:'var(--panel)',
                border:'2px solid var(--panel-border)',
                borderRadius:16,
                padding:32,
                cursor: creating ? 'wait' : 'pointer',
                transition:'all 0.2s ease',
                opacity: creating ? 0.7 : 1,
              }}
              onMouseEnter={(e) => {
                if (!creating) {
                  e.currentTarget.style.borderColor = color;
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.boxShadow = `0 8px 24px ${color}25`;
                }
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
                  background:`${color}20`,
                  display:'flex',
                  alignItems:'center',
                  justifyContent:'center',
                  color: color,
                }}>
                  <Icon size={32} />
                </div>
              </div>
              <h3 style={{fontSize:20, fontWeight:700, color:'var(--text)', marginBottom:12, textAlign:'center'}}>
                {title}
              </h3>
              <p style={{fontSize:14, color:'#94a3b8', lineHeight:1.6, textAlign:'center'}}>
                {description}
              </p>
              <ul style={{
                fontSize:13,
                color:'#cbd5e1',
                marginTop:16,
                paddingLeft:20,
                lineHeight:1.8,
              }}>
                {features.map((feature, i) => (
                  <li key={i}>{feature}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {creating && (
          <div style={{
            textAlign: 'center',
            marginTop: 24,
            color: '#94a3b8',
            fontSize: 14,
          }}>
            Creating your project...
          </div>
        )}
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
