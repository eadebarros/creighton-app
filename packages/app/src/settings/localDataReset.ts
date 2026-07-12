import * as SecureStore from 'expo-secure-store';
import { resetTestData } from '../api/client';
import { getDb } from '../db/client';
import { resetLocalData } from '../db/schema';
import { clearCachedVariantMode } from './variantModeCache';

export const ROLE_CACHE_KEY = 'creighton.role';
export const LAST_USER_CACHE_KEY = 'creighton.lastClerkUserId';

/**
 * Testing/dev affordance — resets the account server-side (cycles, entries,
 * observations, onboarding ack) then wipes local SQLite + every SecureStore
 * cache RoleGate.tsx depends on, so the next resolve (typically right after a
 * sign-out/sign-in) starts completely fresh, onboarding included. The normal
 * "different Clerk identity" wipe in RoleGate.tsx only fires on a genuinely
 * different account — this covers the same-account, full-reset case.
 */
export async function resetAllLocalState(baseUrl: string, token: string): Promise<void> {
  await resetTestData(baseUrl, token);
  const db = await getDb();
  await resetLocalData(db);
  await SecureStore.deleteItemAsync(ROLE_CACHE_KEY);
  await SecureStore.deleteItemAsync(LAST_USER_CACHE_KEY);
  await clearCachedVariantMode();
}
