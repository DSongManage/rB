import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { API_URL } from '../../config';
import TypeSelect from './TypeSelect';
import CreateStep from './CreateStep';
import CustomizeStep from './CustomizeStep';
import ConfigureStep from './ConfigureStep';
import MintStep from './MintStep';
import ShareStep from './ShareStep';
import StepIndicator from './StepIndicator';
import BookEditor from '../BookEditor/BookEditor';
import './CreateWizard.css';

type Payload = { title: string; type: 'text' | 'image' | 'video'; file?: File; textHtml?: string };
type FlowMode = 'full' | 'publish';

// Step configurations for each flow
const FULL_FLOW_STEPS = ['Type', 'Create/Upload', 'Customize', 'Review', 'Share'];
const PUBLISH_FLOW_STEPS = ['Configure', 'Review', 'Share'];

export default function CreateWizard() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Flow mode: 'full' for fresh uploads, 'publish' when content already exists
  const [flowMode, setFlowMode] = useState<FlowMode>('full');
  const [step, setStep] = useState(0);
  const [ctype, setCtype] = useState<'text' | 'image' | 'video' | 'none'>('none');
  const [, setPayload] = useState<Payload | undefined>();
  const [contentId, setContentId] = useState<number | undefined>();
  const [msg, setMsg] = useState('');
  const [maxStep, setMaxStep] = useState(0);
  const [showBookEditor, setShowBookEditor] = useState(false);
  const [minted, setMinted] = useState(false);

  // Get current step labels based on flow mode
  const steps = useMemo(() => (flowMode === 'publish' ? PUBLISH_FLOW_STEPS : FULL_FLOW_STEPS), [flowMode]);

  // Check for mintContent parameter (from book editor publish flow)
  useEffect(() => {
    const mintContentParam = searchParams.get('mintContent');
    if (mintContentParam) {
      const contentIdFromParam = parseInt(mintContentParam, 10);
      if (!isNaN(contentIdFromParam)) {
        // Set content ID and switch to publish flow
        setContentId(contentIdFromParam);
        setFlowMode('publish');
        setStep(0); // First step in publish flow (Configure)
        setMaxStep(0);
        // Clear the parameter from URL to prevent re-triggering
        navigate('/studio?mode=solo', { replace: true });
      }
    }
  }, [searchParams, navigate]);

  async function fetchCsrf() {
    try {
      const t = await fetch(`${API_URL}/api/auth/csrf/`, { credentials: 'include' }).then(r => r.json());
      return t?.csrfToken || '';
    } catch {
      return '';
    }
  }

  const createContent = async (p: Payload) => {
    const form = new FormData();
    form.append('title', p.title);
    const mapped = p.type === 'text' ? 'book' : (p.type === 'image' ? 'art' : 'film');
    form.append('content_type', mapped);
    if (p.file) {
      form.append('file', p.file);
    } else if (p.type === 'text' && p.textHtml) {
      form.append('text', p.textHtml);
    }
    form.append('genre', 'other');
    const csrf = await fetchCsrf();
    const res = await fetch(`${API_URL}/api/content/`, {
      method: 'POST',
      headers: { 'X-CSRFToken': csrf, 'X-Requested-With': 'XMLHttpRequest' },
      body: form,
      credentials: 'include'
    });
    if (res.ok) {
      const d = await res.json();
      setContentId(d.id || d.pk);
      setMsg('Created');
      setStep(2); // Go to Customize step in full flow
    } else {
      setMsg('Create failed');
    }
  };

  const doMint = async () => {
    const csrf = await fetchCsrf();
    const res = await fetch(`${API_URL}/api/mint/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrf, 'X-Requested-With': 'XMLHttpRequest' },
      body: JSON.stringify({ content_id: contentId, royalties: [] }),
      credentials: 'include'
    });
    if (res.ok) {
      setMinted(true);
      // Move to Share step
      if (flowMode === 'publish') {
        setStep(2); // Share is step 2 in publish flow
      } else {
        setStep(4); // Share is step 4 in full flow
      }
    } else {
      setMsg('Mint failed');
    }
  };

  // Allow global Next placement (footer) by registering per-step submit
  const [submitCurrent, setSubmitCurrent] = useState<(() => void) | null>(null);
  const [collectCustomize, setCollectCustomize] = useState<(() => {
    teaserPercent: number;
    watermark: boolean;
    price: number;
    editions: number;
    authorsNote: string;
    tagIds: number[];
    splits: any[];
  }) | null>(null);

  const registerSubmit = useCallback((fn: () => void) => { setSubmitCurrent(() => fn); }, []);
  const registerCustomize = useCallback((fn: () => {
    teaserPercent: number;
    watermark: boolean;
    price: number;
    editions: number;
    authorsNote: string;
    tagIds: number[];
    splits: any[];
  }) => { setCollectCustomize(() => fn); }, []);

  // Handle book editor publish
  const handleBookPublish = (publishedContentId: number) => {
    setContentId(publishedContentId);
    setShowBookEditor(false);
    setFlowMode('publish');
    setStep(0); // First step in publish flow (Configure)
    setMaxStep(0);
  };

  // Save customizations helper
  const saveCustomizations = async () => {
    if (!collectCustomize || !contentId) return;

    const c = collectCustomize();
    const csrf = await fetchCsrf();
    const body = JSON.stringify({
      price_usd: c.price,
      editions: c.editions,
      teaser_percent: c.teaserPercent,
      watermark_preview: c.watermark,
      authors_note: c.authorsNote || '',
      tag_ids: c.tagIds || [],
    });

    await fetch(`${API_URL}/api/content/detail/${contentId}/`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrf, 'X-Requested-With': 'XMLHttpRequest' },
      credentials: 'include',
      body
    });
  };

  // If book editor is active, show it instead of the wizard
  if (showBookEditor) {
    return (
      <BookEditor
        onPublish={handleBookPublish}
        onBack={() => {
          setShowBookEditor(false);
          setCtype('none');
          setStep(0);
        }}
      />
    );
  }

  // Calculate actual step index for rendering components
  // In publish flow: 0=Configure, 1=Review, 2=Share
  // In full flow: 0=Type, 1=Create, 2=Customize, 3=Review, 4=Share
  const renderFullFlow = flowMode === 'full';
  const renderPublishFlow = flowMode === 'publish';

  return (
    <div className="create-wizard">
      {/* Step Indicator */}
      <StepIndicator
        steps={steps}
        currentStep={step}
        maxStep={maxStep}
        onStepClick={(i) => i <= maxStep && setStep(i)}
      />

      {/* Navigation buttons - only show in full flow */}
      {renderFullFlow && step >= 1 && (
        <div className="wizard-nav">
          <button
            onClick={() => setStep(Math.max(0, step - 1))}
            className="back-btn"
          >
            Back
          </button>
          <button
            onClick={() => {
              setCtype('none');
              setPayload(undefined);
              setContentId(undefined);
              setStep(0);
              setFlowMode('full');
            }}
            className="change-type-btn"
          >
            Change type
          </button>
        </div>
      )}

      {/* Publish flow navigation - simpler, just back */}
      {renderPublishFlow && step >= 1 && !minted && (
        <div className="wizard-nav">
          <button
            onClick={() => setStep(Math.max(0, step - 1))}
            className="back-btn"
          >
            Back
          </button>
        </div>
      )}

      {/* FULL FLOW STEPS */}
      {renderFullFlow && step === 0 && (
        <TypeSelect onSelect={(t) => {
          setCtype(t);
          if (t === 'text') {
            setShowBookEditor(true);
          } else {
            setMaxStep(Math.max(maxStep, 0));
            setStep(1);
          }
        }} />
      )}

      {renderFullFlow && step === 1 && ctype !== 'none' && (
        <CreateStep
          type={ctype}
          registerSubmit={registerSubmit}
          showNextButton={false}
          onReady={(p) => {
            setPayload({ title: p.title, type: ctype, file: p.file, textHtml: p.textHtml });
            setMaxStep(Math.max(maxStep, 1));
            createContent({ title: p.title, type: ctype, file: p.file, textHtml: p.textHtml });
          }}
        />
      )}

      {renderFullFlow && step === 2 && (
        <CustomizeStep
          registerSubmit={registerCustomize}
          onNext={async (c) => {
            try {
              const csrf = await fetchCsrf();
              const body = JSON.stringify({
                price_usd: c.price,
                editions: c.editions,
                teaser_percent: c.teaserPercent,
                watermark_preview: c.watermark,
                authors_note: c.authorsNote || '',
              });
              await fetch(`${API_URL}/api/content/detail/${contentId}/`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrf, 'X-Requested-With': 'XMLHttpRequest' },
                credentials: 'include',
                body
              });
            } catch (_) { }
            setMaxStep(Math.max(maxStep, 2));
            setStep(3);
          }}
        />
      )}

      {renderFullFlow && step === 3 && (
        <MintStep
          contentId={contentId}
          price={collectCustomize ? collectCustomize().price : undefined}
          editions={collectCustomize ? collectCustomize().editions : undefined}
          onMint={() => {
            setMaxStep(Math.max(maxStep, 3));
            doMint();
          }}
        />
      )}

      {renderFullFlow && step === 4 && (
        <ShareStep
          contentId={contentId}
          minted={minted}
          onPublish={async () => {
            const csrf = await fetchCsrf();
            const res = await fetch(`${API_URL}/api/mint/`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrf, 'X-Requested-With': 'XMLHttpRequest' },
              body: JSON.stringify({ content_id: contentId }),
              credentials: 'include'
            });
            if (res.ok) {
              setMinted(true);
              setMsg('Published');
            }
          }}
        />
      )}

      {/* PUBLISH FLOW STEPS */}
      {renderPublishFlow && step === 0 && (
        <ConfigureStep
          contentId={contentId}
          registerSubmit={registerCustomize}
        />
      )}

      {renderPublishFlow && step === 1 && (
        <MintStep
          contentId={contentId}
          price={collectCustomize ? collectCustomize().price : undefined}
          editions={collectCustomize ? collectCustomize().editions : undefined}
          onMint={() => {
            setMaxStep(Math.max(maxStep, 1));
            doMint();
          }}
        />
      )}

      {renderPublishFlow && step === 2 && (
        <ShareStep
          contentId={contentId}
          minted={minted}
          onPublish={async () => {
            const csrf = await fetchCsrf();
            const res = await fetch(`${API_URL}/api/mint/`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrf, 'X-Requested-With': 'XMLHttpRequest' },
              body: JSON.stringify({ content_id: contentId }),
              credentials: 'include'
            });
            if (res.ok) {
              setMinted(true);
              setMsg('Published');
            }
          }}
        />
      )}

      {/* Footer with Next buttons */}
      <div className="wizard-footer">
        <div className="wizard-message">{msg}</div>

        {/* Full flow: step 1 Next button */}
        {renderFullFlow && step === 1 && (
          <button
            onClick={() => submitCurrent && submitCurrent()}
            className="next-btn"
          >
            Next
          </button>
        )}

        {/* Full flow: step 2 Next button */}
        {renderFullFlow && step === 2 && (
          <button
            onClick={async () => {
              setMaxStep(Math.max(maxStep, 2));
              await saveCustomizations();
              setStep(3);
            }}
            className="next-btn"
          >
            Next
          </button>
        )}

        {/* Publish flow: step 0 (Configure) Next button */}
        {renderPublishFlow && step === 0 && (
          <button
            onClick={async () => {
              setMaxStep(Math.max(maxStep, 0));
              await saveCustomizations();
              setStep(1);
            }}
            className="next-btn"
          >
            Next
          </button>
        )}
      </div>
    </div>
  );
}
