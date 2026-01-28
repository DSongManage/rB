import React, { useState } from 'react';
import { ScriptData, ScriptPanel } from '../../services/collaborationApi';
import {
  ScrollText,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  MessageSquare,
  FileText,
} from 'lucide-react';

interface ScriptReferencePanelProps {
  scriptData: ScriptData | null | undefined;
  pageNumber: number;
  isExpanded: boolean;
  onToggle: () => void;
  onOpenScriptTab?: () => void;
}

export function ScriptReferencePanel({
  scriptData,
  pageNumber,
  isExpanded,
  onToggle,
  onOpenScriptTab,
}: ScriptReferencePanelProps) {
  const hasScript = scriptData?.page_description ||
    (scriptData?.panels && scriptData.panels.length > 0);

  return (
    <div style={{
      background: 'var(--panel)',
      border: '1px solid var(--panel-border)',
      borderRadius: 8,
      marginBottom: 12,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <button
        onClick={onToggle}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 12px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--text)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ScrollText size={14} style={{ color: '#8b5cf6' }} />
          <span style={{ fontSize: 12, fontWeight: 600 }}>
            Page {pageNumber} Script
          </span>
          {hasScript && (
            <span style={{
              background: 'rgba(16, 185, 129, 0.1)',
              color: '#10b981',
              fontSize: 10,
              padding: '2px 6px',
              borderRadius: 4,
              fontWeight: 500,
            }}>
              Available
            </span>
          )}
        </div>
        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {/* Content */}
      {isExpanded && (
        <div style={{
          padding: '0 12px 12px',
          borderTop: '1px solid var(--panel-border)',
        }}>
          {!hasScript ? (
            <div style={{
              padding: '16px 8px',
              textAlign: 'center',
              color: '#64748b',
              fontSize: 12,
            }}>
              <FileText size={24} style={{ marginBottom: 8, opacity: 0.5 }} />
              <div>No script written for this page yet.</div>
              {onOpenScriptTab && (
                <button
                  onClick={onOpenScriptTab}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    marginTop: 8,
                    padding: '6px 12px',
                    background: 'rgba(139, 92, 246, 0.1)',
                    border: '1px solid rgba(139, 92, 246, 0.3)',
                    borderRadius: 6,
                    color: '#8b5cf6',
                    fontSize: 11,
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  <ExternalLink size={12} />
                  Open Script Tab
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Page Description */}
              {scriptData?.page_description && (
                <div style={{ marginTop: 12 }}>
                  <div style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: '#64748b',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    marginBottom: 4,
                  }}>
                    Page Overview
                  </div>
                  <div style={{
                    fontSize: 12,
                    color: 'var(--text)',
                    lineHeight: 1.5,
                    background: 'var(--bg)',
                    padding: 8,
                    borderRadius: 6,
                    border: '1px solid var(--panel-border)',
                  }}>
                    {scriptData.page_description}
                  </div>
                </div>
              )}

              {/* Panels */}
              {scriptData?.panels && scriptData.panels.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: '#64748b',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    marginBottom: 8,
                  }}>
                    Panels ({scriptData.panels.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {scriptData.panels.map((panel) => (
                      <PanelReference key={panel.panel_number} panel={panel} />
                    ))}
                  </div>
                </div>
              )}

              {/* Open Script Tab Link */}
              {onOpenScriptTab && (
                <button
                  onClick={onOpenScriptTab}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    width: '100%',
                    marginTop: 12,
                    padding: '8px 12px',
                    background: 'transparent',
                    border: '1px solid var(--panel-border)',
                    borderRadius: 6,
                    color: '#8b5cf6',
                    fontSize: 11,
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  <ExternalLink size={12} />
                  Edit in Script Tab
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// Individual panel reference card
function PanelReference({ panel }: { panel: ScriptPanel }) {
  const [expanded, setExpanded] = useState(false);

  const hasDialogue = panel.dialogue && panel.dialogue.trim();
  const hasNotes = panel.notes && panel.notes.trim();

  return (
    <div style={{
      background: 'var(--bg)',
      border: '1px solid var(--panel-border)',
      borderRadius: 6,
      overflow: 'hidden',
    }}>
      {/* Panel Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 10px',
          background: 'rgba(139, 92, 246, 0.05)',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--text)',
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 600, color: '#8b5cf6' }}>
          Panel {panel.panel_number}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {hasDialogue && (
            <MessageSquare size={10} style={{ color: '#64748b' }} />
          )}
          {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </div>
      </button>

      {/* Scene Preview (always visible) */}
      <div style={{
        padding: '8px 10px',
        fontSize: 11,
        color: '#94a3b8',
        lineHeight: 1.4,
        borderTop: '1px solid var(--panel-border)',
        maxHeight: expanded ? 'none' : 40,
        overflow: 'hidden',
        position: 'relative',
      }}>
        {panel.scene || 'No scene description'}
        {!expanded && panel.scene && panel.scene.length > 80 && (
          <div style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 20,
            background: 'linear-gradient(transparent, var(--bg))',
          }} />
        )}
      </div>

      {/* Expanded Details */}
      {expanded && (hasDialogue || hasNotes) && (
        <div style={{
          padding: '0 10px 10px',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}>
          {/* Dialogue */}
          {hasDialogue && (
            <div>
              <div style={{
                fontSize: 9,
                fontWeight: 600,
                color: '#64748b',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                marginBottom: 2,
              }}>
                Dialogue
              </div>
              <div style={{
                fontSize: 11,
                color: 'var(--text)',
                lineHeight: 1.4,
                fontStyle: 'italic',
                background: 'rgba(139, 92, 246, 0.05)',
                padding: 6,
                borderRadius: 4,
                border: '1px solid rgba(139, 92, 246, 0.1)',
              }}>
                "{panel.dialogue}"
              </div>
            </div>
          )}

          {/* Notes */}
          {hasNotes && (
            <div>
              <div style={{
                fontSize: 9,
                fontWeight: 600,
                color: '#64748b',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                marginBottom: 2,
              }}>
                Notes
              </div>
              <div style={{
                fontSize: 10,
                color: '#f59e0b',
                lineHeight: 1.4,
                background: 'rgba(245, 158, 11, 0.05)',
                padding: 6,
                borderRadius: 4,
                border: '1px solid rgba(245, 158, 11, 0.1)',
              }}>
                {panel.notes}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ScriptReferencePanel;
