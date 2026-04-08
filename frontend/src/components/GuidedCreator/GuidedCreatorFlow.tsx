import React, { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { collaborationApi } from '../../services/collaborationApi';
import { STEPS, StepId, ContentType, getStepForContentType } from './stepDefinitions';
import { Layers, BookOpen, Image, Users, Rocket, Briefcase, Pen, UserCheck, Search } from 'lucide-react';
import './GuidedCreatorFlow.css';

/* ── Step 0 inline SVG icons ── */
const Step0Icons: Record<ContentType, () => React.ReactNode> = {
  comic: () => (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="12" y1="3" x2="12" y2="12" />
    </svg>
  ),
  book: () => (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      <line x1="8" y1="7" x2="16" y2="7" />
      <line x1="8" y1="11" x2="14" y2="11" />
    </svg>
  ),
  art: () => (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  ),
};

const CONTENT_TYPE_OPTIONS: { id: ContentType; label: string; description: string; badge: string | null }[] = [
  { id: 'comic', label: 'Comic', description: 'Visual stories with panel layouts, page-by-page uploads, and reader-friendly display.', badge: 'Most popular' },
  { id: 'book', label: 'Book', description: 'Chapters, novels, or short stories with rich text editing and preview before publish.', badge: null },
  { id: 'art', label: 'Art', description: 'Standalone artwork, illustrations, or collections with high-res gallery display.', badge: null },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ICON_MAP: Record<string, React.ComponentType<any>> = {
  Layers, BookOpen, Image, Users, Rocket, Briefcase, Pen, UserCheck, Search,
};

type TerminalAction =
  | { type: 'campaign' }
  | { type: 'campaignSolo' }
  | { type: 'campaignWizard' }
  | { type: 'createProject' }
  | { type: 'publish' }
  | { type: 'browseCollaborators' };

export default function GuidedCreatorFlow() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<StepId>(0);
  const [history, setHistory] = useState<StepId[]>([]);
  const historyRef = useRef<StepId[]>([]);
  const [selectedContentType, setSelectedContentType] = useState<ContentType>('comic');
  const [pendingAction, setPendingAction] = useState<TerminalAction | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const goTo = useCallback((stepId: StepId) => {
    historyRef.current = [...historyRef.current, currentStep];
    setHistory(historyRef.current);
    setCurrentStep(stepId);
  }, [currentStep]);

  const goBack = useCallback(() => {
    if (historyRef.current.length === 0) return;
    const target = historyRef.current[historyRef.current.length - 1];
    historyRef.current = historyRef.current.slice(0, -1);
    setHistory(historyRef.current);
    setCurrentStep(target);
  }, []);

  const startOver = useCallback(() => {
    historyRef.current = [];
    setHistory([]);
    setCurrentStep(0);
    setPendingAction(null);
  }, []);

  const executeAction = useCallback(async (action: TerminalAction) => {
    setCreating(true);
    setError('');
    try {
      switch (action.type) {
        case 'campaign':
          navigate('/studio/campaign/new?type=collaborative');
          break;
        case 'campaignSolo':
          navigate('/studio/campaign/new?type=solo');
          break;
        case 'campaignWizard':
          navigate('/studio/campaign/wizard');
          break;
        case 'createProject': {
          const timestamp = new Date().toLocaleString('en-US', {
            month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
          });
          const ct = selectedContentType;
          const project = await collaborationApi.createCollaborativeProject({
            title: `Untitled ${ct.charAt(0).toUpperCase() + ct.slice(1)} - ${timestamp}`,
            content_type: ct,
            description: '',
          });
          // Comic projects: launch production pipeline wizard
          if (ct === 'comic') {
            navigate(`/studio/${project.id}?setup=pipeline`);
          } else {
            navigate(`/studio/${project.id}`);
          }
          break;
        }
        case 'publish':
          navigate('/studio?mode=solo');
          break;
        case 'browseCollaborators':
          navigate('/collaborators');
          break;
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
      setCreating(false);
    }
  }, [navigate, selectedContentType]);

  const handleOptionClick = useCallback((targetStep: StepId, contentType?: ContentType) => {
    // Step 0: store selected content type
    if (contentType) {
      setSelectedContentType(contentType);
    }
    goTo(targetStep);
  }, [goTo]);

  // When navigating to step 99 via navNext, determine the pending action
  const handleNavNext = useCallback((stepId: StepId) => {
    if (stepId === 99) {
      if (currentStep === 12) {
        setPendingAction({ type: 'campaignSolo' }); // solo self-escrow
      }
    }
    goTo(stepId);
  }, [currentStep, goTo]);

  // Use content-type-aware steps for all shared steps
  const step = getStepForContentType(currentStep, selectedContentType);

  // ── Step 0: dedicated content type selector ──
  if (currentStep === 0) {
    return (
      <div className="guided-flow">
        <div className="step0-wrapper">
          <p className="step0-eyebrow">Create</p>
          <h2 className="step0-title">What are you making?</h2>

          <div className="step0-options">
            {CONTENT_TYPE_OPTIONS.map((type) => (
              <button
                key={type.id}
                className="step0-item"
                onClick={() => {
                  setSelectedContentType(type.id);
                  handleOptionClick(1 as StepId, type.id);
                }}
              >
                <div className="step0-icon">
                  {Step0Icons[type.id]()}
                </div>
                <div className="step0-text">
                  <div className="step0-label-row">
                    <span className="step0-label">{type.label}</span>
                    {type.badge && <span className="step0-badge">{type.badge}</span>}
                  </div>
                  <p className="step0-desc">{type.description}</p>
                </div>
                <div className="step0-arrow">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#E8981F" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Derive eyebrow from breadcrumb
  const eyebrow = step.breadcrumb ? step.breadcrumb.join(' / ') : 'Get started';

  return (
    <div className="guided-flow">
      <div className="step0-wrapper">
        {/* Eyebrow */}
        <p className="step0-eyebrow">{eyebrow}</p>

        {/* Title */}
        <h2 className="step0-title">{step.title}</h2>
        {step.subtitle && <p className="guided-subtitle">{step.subtitle}</p>}

        {/* Error */}
        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid #ef4444',
            borderRadius: 8,
            padding: 12,
            color: '#ef4444',
            fontSize: 13,
            marginBottom: 16,
          }}>
            {error}
          </div>
        )}

        {/* Options variant — same layout as step 0 */}
        {step.variant === 'options' && step.options && (
          <div className="step0-options">
            {step.options.map((opt, i) => {
              const IconComponent = opt.icon ? ICON_MAP[opt.icon] : null;
              return (
                <button
                  key={i}
                  className="step0-item"
                  onClick={() => {
                    if (creating) return;
                    if (opt.contentType) setSelectedContentType(opt.contentType);
                    if (opt.action) {
                      executeAction({ type: opt.action });
                    } else if (opt.targetStep !== undefined) {
                      handleOptionClick(opt.targetStep, opt.contentType);
                    }
                  }}
                  style={{ opacity: creating ? 0.6 : 1 }}
                >
                  {IconComponent && (
                    <div className="step0-icon">
                      <IconComponent size={24} />
                    </div>
                  )}
                  <div className="step0-text">
                    <div className="step0-label-row">
                      <span className="step0-label">{opt.label}</span>
                    </div>
                    {opt.tag && <span className="step0-badge">{opt.tag}</span>}
                    <p className="step0-desc">{opt.description}</p>
                  </div>
                  <div className="step0-arrow">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#E8981F" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Preview image */}
        {step.previewImage && (
          <div style={{
            borderRadius: 12, overflow: 'hidden', marginBottom: 16,
            border: '1px solid var(--panel-border, rgba(58, 54, 50, 0.08))',
          }}>
            <img
              src={step.previewImage}
              alt="Preview"
              style={{ width: '100%', display: 'block' }}
            />
          </div>
        )}

        {/* Outcome variant */}
        {step.variant === 'outcome' && step.outcomeItems && (
          <div className="guided-outcome">
            {step.outcomeTitle && (
              <p className="guided-outcome-title">{step.outcomeTitle}</p>
            )}
            <div className="guided-outcome-list">
              {step.outcomeItems.map((item, i) => {
                const isSummary = item.bold.startsWith("Campaign goal");
                return (
                  <div key={i} className={`guided-outcome-item ${isSummary ? 'guided-outcome-summary' : ''}`}>
                    {!isSummary && (
                      <div className="guided-outcome-num">{i + 1}</div>
                    )}
                    <div className="guided-outcome-content">
                      <p className="guided-outcome-label">{item.bold}</p>
                      {item.text && <p className="guided-outcome-desc">{item.text}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* After-outcome text */}
        {step.afterOutcome && <p className="guided-after-outcome">{step.afterOutcome}</p>}

        {/* Note */}
        {step.note && <p className="guided-note">{step.note}</p>}

        {/* Navigation */}
        <div className="guided-nav">
          {history.length > 0 && (
            <button className="guided-btn guided-btn-secondary" onClick={goBack}>
              Back
            </button>
          )}
          {step.startOverButton && (
            <button className="guided-btn guided-btn-secondary" onClick={startOver}>
              Start over
            </button>
          )}
          {step.navNext && (
            <button
              className="guided-btn guided-btn-primary"
              onClick={() => handleNavNext(step.navNext!.stepId)}
              disabled={creating}
            >
              {step.navNext.label}
            </button>
          )}
          {step.directAction && (
            <button
              className="guided-btn guided-btn-primary"
              onClick={() => executeAction({ type: step.directAction!.action })}
              disabled={creating}
            >
              {creating ? 'Setting up...' : step.directAction.label}
            </button>
          )}
          {currentStep === 99 && pendingAction && (
            <button
              className="guided-btn guided-btn-primary"
              onClick={() => executeAction(pendingAction)}
              disabled={creating}
            >
              {creating ? 'Setting up...' : 'Launch campaign setup'}
            </button>
          )}
        </div>

        {creating && <p className="guided-creating">Setting up your workspace...</p>}
      </div>
    </div>
  );
}
