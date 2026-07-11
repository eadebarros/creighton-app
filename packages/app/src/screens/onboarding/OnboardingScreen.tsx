import { useState } from 'react';
import { useAuth } from '@clerk/expo';
import type { VariantMode } from '@creighton/rules-engine';
import { patchMe } from '../../api/client';
import { getApiBaseUrl } from '../../api/config';
import { setCachedVariantMode } from '../../settings/variantModeCache';
import { WelcomeDisclaimerScreen } from './WelcomeDisclaimerScreen';
import { VariantSelectionScreen } from './VariantSelectionScreen';

interface Props {
  onDone: () => void;
}

/** Shown once, gated by !me.instructorCredentialAck in RoleGate.tsx — sequences disclaimer ack then variant choice. */
export function OnboardingScreen({ onDone }: Props) {
  const { getToken } = useAuth();
  const [step, setStep] = useState<'disclaimer' | 'variant'>('disclaimer');

  async function finish(variant: VariantMode) {
    const token = await getToken();
    if (token) {
      await patchMe(getApiBaseUrl(), token, { instructorCredentialAck: true, currentVariantMode: variant });
    }
    await setCachedVariantMode(variant);
    onDone();
  }

  return step === 'disclaimer' ? (
    <WelcomeDisclaimerScreen onContinue={() => setStep('variant')} />
  ) : (
    <VariantSelectionScreen onContinue={finish} />
  );
}
