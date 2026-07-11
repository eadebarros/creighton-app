import * as SecureStore from 'expo-secure-store';
import type { VariantMode } from '@creighton/rules-engine';

const VARIANT_CACHE_KEY = 'creighton.currentVariantMode';

/** Mirrors RoleGate.tsx's role-cache pattern — lets entryRepository read the user's variant mode without a network round trip. */
export async function getCachedVariantMode(): Promise<VariantMode> {
  const cached = await SecureStore.getItemAsync(VARIANT_CACHE_KEY);
  return (cached as VariantMode | null) ?? 'REGULAR';
}

export async function setCachedVariantMode(mode: VariantMode): Promise<void> {
  await SecureStore.setItemAsync(VARIANT_CACHE_KEY, mode);
}
