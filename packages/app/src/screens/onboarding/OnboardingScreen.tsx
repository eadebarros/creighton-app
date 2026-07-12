import { useState } from 'react';
import { useAuth } from '@clerk/expo';
import type { VariantMode } from '@creighton/rules-engine';
import { patchMe } from '../../api/client';
import { getApiBaseUrl } from '../../api/config';
import { setCachedVariantMode } from '../../settings/variantModeCache';
import { WelcomeDisclaimerScreen } from './WelcomeDisclaimerScreen';
import { VariantSelectionScreen } from './VariantSelectionScreen';
import { NotificationContextScreen } from './NotificationContextScreen';

interface Props {
  onDone: () => void;
}

/** Shown once, gated by !me.instructorCredentialAck in RoleGate.tsx — sequences disclaimer ack, variant choice, then the notification-permission context screen. */
export function OnboardingScreen({ onDone }: Props) {
  const { getToken } = useAuth();
  const [step, setStep] = useState<'disclaimer' | 'variant' | 'notifications'>('disclaimer');
  const [variant, setVariant] = useState<VariantMode | null>(null);

  async function finish() {
    const token = await getToken();
    if (token && variant) {
      await patchMe(getApiBaseUrl(), token, { instructorCredentialAck: true, currentVariantMode: variant });
    }
    if (variant) {
      await setCachedVariantMode(variant);
    }
    onDone();
  }

  if (step === 'disclaimer') {
    return <WelcomeDisclaimerScreen onContinue={() => setStep('variant')} />;
  }
  if (step === 'variant') {
    return (
      <VariantSelectionScreen
        onContinue={(chosen) => {
          setVariant(chosen);
          setStep('notifications');
        }}
      />
    );
  }
  return <NotificationContextScreen onContinue={finish} />;
}
