import React, { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { collaborationApi } from '../../services/collaborationApi';
import { STEPS, StepId, ContentType, getStepForContentType } from './stepDefinitions';
import { Layers, BookOpen, Image, Users, Rocket, Briefcase, Pen, UserCheck, Search } from 'lucide-react';
import './GuidedCreatorFlow.css';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ICON_MAP: Record<string, React.ComponentType<any>> = {
  Layers, BookOpen, Image, Users, Rocket, Briefcase, Pen, UserCheck, Search,
};

type TerminalAction =
  | { type: 'campaign' }
  | { type: 'campaignSolo' }
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
          navigate(`/studio/${project.id}`);
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
      if (currentStep === 8) {
        setPendingAction({ type: 'campaign' }); // collaborative — raising to hire
      } else if (currentStep === 12) {
        setPendingAction({ type: 'campaignSolo' }); // solo self-escrow
      }
    }
    goTo(stepId);
  }, [currentStep, goTo]);

  // Use content-type-aware steps for all shared steps
  const step = getStepForContentType(currentStep, selectedContentType);

  return (
    <div className="guided-flow">
      {/* Breadcrumb */}
      {step.breadcrumb && step.breadcrumb.length > 0 && (
        <div className="guided-breadcrumb">
          {step.breadcrumb.map((crumb, i) => (
            <React.Fragment key={i}>
              {i > 0 && <span className="guided-breadcrumb-sep">&gt;</span>}
              <span className={`guided-breadcrumb-item ${i === step.breadcrumbActive ? 'guided-breadcrumb-active' : ''}`}>
                {crumb}
              </span>
            </React.Fragment>
          ))}
        </div>
      )}

      {/* Title */}
      <h2 className="guided-title">{step.title}</h2>
      <p className="guided-subtitle">{step.subtitle}</p>

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

      {/* Options variant */}
      {step.variant === 'options' && step.options && (
        <div className="guided-options">
          {step.options.map((opt, i) => {
            const IconComponent = opt.icon ? ICON_MAP[opt.icon] : null;
            return (
              <div
                key={i}
                className="guided-option"
                onClick={() => {
                  if (creating) return;
                  if (opt.contentType) setSelectedContentType(opt.contentType);
                  if (opt.action) {
                    executeAction({ type: opt.action });
                  } else if (opt.targetStep !== undefined) {
                    handleOptionClick(opt.targetStep, opt.contentType);
                  }
                }}
                style={{ opacity: creating ? 0.6 : 1, cursor: creating ? 'wait' : 'pointer' }}
              >
                {opt.tag && (
                  <div className={`guided-tag guided-tag-${opt.tagColor || 'green'}`}>
                    {opt.tag}
                  </div>
                )}
                <div className="guided-option-header">
                  {IconComponent && (
                    <div className="guided-option-icon" style={{ background: `${opt.iconColor}18` }}>
                      <IconComponent size={20} color={opt.iconColor} />
                    </div>
                  )}
                  <p className="guided-option-label">{opt.label}</p>
                </div>
                <p className="guided-option-desc">{opt.description}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Preview image */}
      {step.previewImage && (
        <div style={{
          borderRadius: 12, overflow: 'hidden', marginBottom: 16,
          border: '1px solid var(--panel-border, #334155)',
        }}>
          <img
            src={step.previewImage}
            alt="Campaign preview"
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

      {/* Note */}
      {step.note && <p className="guided-note">{step.note}</p>}

      {/* After-outcome text */}
      {step.afterOutcome && <p className="guided-after-outcome">{step.afterOutcome}</p>}

      {/* Navigation */}
      <div className="guided-nav">
        {history.length > 0 && (
          <button className="guided-btn guided-btn-secondary" onClick={goBack}>
            Back
          </button>
        )}
        {step.startOverButton && currentStep !== 0 && (
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
        {/* Direct action button (steps with terminal actions) */}
        {step.directAction && (
          <button
            className="guided-btn guided-btn-primary"
            onClick={() => executeAction({ type: step.directAction!.action })}
            disabled={creating}
          >
            {creating ? 'Setting up...' : step.directAction.label}
          </button>
        )}
        {/* Step 99: campaign action button */}
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
  );
}
