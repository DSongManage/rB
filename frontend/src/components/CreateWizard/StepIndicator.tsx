import React from 'react';
import { Check } from 'lucide-react';

interface StepIndicatorProps {
  steps: string[];
  currentStep: number;
  maxStep: number;
  onStepClick: (index: number) => void;
}

export default function StepIndicator({ steps, currentStep, maxStep, onStepClick }: StepIndicatorProps) {
  return (
    <div className="step-indicator">
      {steps.map((label, i) => {
        const isActive = i === currentStep;
        const isCompleted = i < currentStep;
        const canClick = i <= maxStep;

        return (
          <React.Fragment key={label}>
            <div
              className={`step ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''} ${canClick ? 'clickable' : ''}`}
              onClick={() => canClick && onStepClick(i)}
              style={{ cursor: canClick ? 'pointer' : 'default' }}
            >
              <div className="step-circle">
                {isCompleted ? <Check size={16} /> : i + 1}
              </div>
              <div className="step-label">{label}</div>
            </div>
            {i < steps.length - 1 && (
              <div className={`step-connector ${isCompleted ? 'completed' : ''}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
