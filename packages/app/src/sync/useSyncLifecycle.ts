import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useAuth } from '@clerk/expo';
import { getApiBaseUrl } from '../api/config';
import { getDb } from '../db/client';
import { syncNow } from './syncClient';

const SYNC_INTERVAL_MS = 60_000;

/**
 * Fires syncNow on mount, whenever the app comes back to the foreground, and
 * on a foreground timer — best-effort background sync, not user-facing.
 * Mount this once, inside the signed-in subtree (RootNavigator), since it
 * needs Clerk's getToken.
 */
export function useSyncLifecycle(): void {
  const { getToken } = useAuth();
  const runningRef = useRef(false);

  useEffect(() => {
    async function runSync() {
      if (runningRef.current) {
        return;
      }
      runningRef.current = true;
      try {
        const db = await getDb();
        await syncNow(db, getToken, getApiBaseUrl());
      } catch {
        // Best-effort — per-entry failures are already recorded in sync_outbox.last_error.
      } finally {
        runningRef.current = false;
      }
    }

    runSync();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        runSync();
      }
    });
    const interval = setInterval(runSync, SYNC_INTERVAL_MS);

    return () => {
      subscription.remove();
      clearInterval(interval);
    };
  }, [getToken]);
}
