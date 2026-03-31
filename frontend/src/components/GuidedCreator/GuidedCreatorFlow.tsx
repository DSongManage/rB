import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { collaborationApi } from '../../services/collaborationApi';
import { STEPS, StepId } from './stepDefinitions';
import './GuidedCreatorFlow.css';

type TerminalAction =
  | { type: 'campaign' }
  | { type: 'createProject'; contentType: 'book' | 'comic' | 'art' }
  | { type: 'publish' }
  | { type: 'hire' };

export default function GuidedCreatorFlow() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<StepId>(0);
  const [history, setHistory] = useState<StepId[]>([]);
  const [pendingAction, setPendingAction] = useState<TerminalAction | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const goTo = useCallback((stepId: StepId) => {
    setCurrentStep(prev => {
      setHistory(h => [...h, prev]);
      return stepId;
    });
  }, []);

  const goBack = useCallback(() => {
    setHistory(h => {
      if (h.length === 0) return h;
      const newHistory = [...h];
      const prev = newHistory.pop()!;
      setCurrentStep(prev);
      return newHistory;
    });
  }, []);

  const startOver = useCallback(() => {
    setCurrentStep(0);
    setHistory([]);
    setPendingAction(null);
  }, []);

  const executeAction = useCallback(async (action: TerminalAction) => {
    setCreating(true);
    setError('');
    try {
      switch (action.type) {
        case 'campaign':
          navigate('/studio/campaign/new');
          break;
        case 'createProject': {
          const timestamp = new Date().toLocaleString('en-US', {
            month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
          });
          const project = await collaborationApi.createCollaborativeProject({
            title: `Untitled ${action.contentType.charAt(0).toUpperCase() + action.contentType.slice(1)} - ${timestamp}`,
            content_type: action.contentType,
            description: '',
          });
          navigate(`/studio/${project.id}`);
          break;
        }
        case 'publish':
          navigate('/studio?mode=solo');
          break;
        case 'hire':
          navigate('/discover');
          break;
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
      setCreating(false);
    }
  }, [navigate]);

  const handleOptionClick = useCallback((targetStep: StepId) => {
    // Set pending action based on which path leads to step 99
    if (targetStep === 99) {
      // Determine action from context — which step are we on?
      // Steps 6, 7 → campaign; step 11 → campaign (solo)
      // This is handled by the step that navigates to 99
    }
    goTo(targetStep);
  }, [goTo]);

  // When navigating to step 99, determine the pending action
  const handleNavNext = useCallback((stepId: StepId) => {
    if (stepId === 99) {
      // Determine action based on current step
      if (currentStep === 6 || currentStep === 7) {
        setPendingAction({ type: 'campaign' });
      } else if (currentStep === 11) {
        setPendingAction({ type: 'campaign' });
      }
    }
    goTo(stepId);
  }, [currentStep, goTo]);

  const step = STEPS[currentStep];

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
          {step.options.map((opt, i) => (
            <div
              key={i}
              className="guided-option"
              onClick={() => !creating && handleOptionClick(opt.targetStep)}
              style={{ opacity: creating ? 0.6 : 1, cursor: creating ? 'wait' : 'pointer' }}
            >
              {opt.tag && (
                <div className={`guided-tag guided-tag-${opt.tagColor || 'green'}`}>
                  {opt.tag}
                </div>
              )}
              <p className="guided-option-label">{opt.label}</p>
              <p className="guided-option-desc">{opt.description}</p>
            </div>
          ))}
        </div>
      )}

      {/* Outcome variant */}
      {step.variant === 'outcome' && step.outcomeItems && (
        <div className="guided-outcome">
          {step.outcomeTitle && (
            <p className="guided-outcome-title">{step.outcomeTitle}</p>
          )}
          {step.outcomeItems.map((item, i) => (
            <React.Fragment key={i}>
              {/* Insert divider before "Campaign goal" item */}
              {item.bold === "Campaign goal: $6,000" && <hr className="guided-divider" />}
              <p className="guided-outcome-item">
                <span>{item.bold}</span>
                {item.text && ` — ${item.text}`}
              </p>
            </React.Fragment>
          ))}
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
        {/* Step 99: action button */}
        {currentStep === 99 && pendingAction && (
          <button
            className="guided-btn guided-btn-primary"
            onClick={() => executeAction(pendingAction)}
            disabled={creating}
          >
            {creating ? 'Setting up...' : 'Get started'}
          </button>
        )}
      </div>

      {creating && <p className="guided-creating">Setting up your workspace...</p>}
    </div>
  );
}
