import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import type { BleedingType, MucusColor, MucusSensation, MucusStretch } from '@creighton/rules-engine';

export interface CaptureFlowAnswers {
  bleedingType?: BleedingType;
  mucusSensation?: MucusSensation;
  shinyReflex?: boolean;
  mucusColor?: MucusColor;
  mucusStretch?: MucusStretch;
  intercourse?: boolean;
}

interface CaptureFlowContextValue {
  answers: CaptureFlowAnswers;
  setAnswer: <K extends keyof CaptureFlowAnswers>(key: K, value: CaptureFlowAnswers[K]) => void;
  reset: () => void;
}

const CaptureFlowContext = createContext<CaptureFlowContextValue | null>(null);

/** Wraps the capture flow's screens so answers survive navigation between them. */
export function CaptureFlowProvider({ children }: { children: ReactNode }) {
  const [answers, setAnswers] = useState<CaptureFlowAnswers>({});

  function setAnswer<K extends keyof CaptureFlowAnswers>(key: K, value: CaptureFlowAnswers[K]) {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  }

  function reset() {
    setAnswers({});
  }

  return <CaptureFlowContext.Provider value={{ answers, setAnswer, reset }}>{children}</CaptureFlowContext.Provider>;
}

export function useCaptureFlow(): CaptureFlowContextValue {
  const ctx = useContext(CaptureFlowContext);
  if (!ctx) {
    throw new Error('useCaptureFlow must be used within a CaptureFlowProvider');
  }
  return ctx;
}

export type CaptureStep = 'bleeding' | 'sensation' | 'mucusColor' | 'mucusStretch' | 'intercourse' | 'done';

/** 3 dots normally; a 4th appears once a non-Seco sensation opens the mucus branch. */
export function totalDots(sensation: MucusSensation | undefined): number {
  return sensation !== undefined && sensation !== 'DRY' ? 4 : 3;
}

/** Which dot is active for a given step — -1 means no dot lit (the Confirmation screen). */
export function dotIndexForStep(step: CaptureStep, sensation: MucusSensation | undefined): number {
  switch (step) {
    case 'bleeding':
      return 0;
    case 'sensation':
      return 1;
    case 'mucusColor':
    case 'mucusStretch':
      return 2;
    case 'intercourse':
      return sensation === 'DRY' ? 2 : 3;
    case 'done':
      return -1;
  }
}

/** The step "← Voltar" returns to, or null when the step has no back link. */
export function backStepFor(step: CaptureStep, sensation: MucusSensation | undefined): CaptureStep | null {
  switch (step) {
    case 'sensation':
      return 'bleeding';
    case 'mucusColor':
      return 'sensation';
    case 'mucusStretch':
      return 'mucusColor';
    case 'intercourse':
      return sensation === 'DRY' ? 'sensation' : 'mucusStretch';
    default:
      return null;
  }
}
