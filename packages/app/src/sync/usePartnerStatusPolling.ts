import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useAuth } from '@clerk/expo';
import { getPartnerStatus } from '../api/client';
import type { PartnerStatus } from '../api/client';
import { getApiBaseUrl } from '../api/config';

const POLL_INTERVAL_MS = 60_000;

export type PartnerStatusState =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'ready'; status: PartnerStatus };

/**
 * Mirrors useSyncLifecycle.ts's foreground/timer shape, but deliberately
 * keeps the fetched status in React state only — never persisted to SQLite.
 * LGPD-minimization call (briefing Seção 6): the partner's device shouldn't
 * accumulate its own at-rest copy of her derived health status just for a
 * 60-second-refresh UI. Trade-off: a fully offline partner device shows an
 * error state instead of a stale-but-persisted one.
 */
export function usePartnerStatusPolling(): { state: PartnerStatusState; refresh: () => void } {
  const { getToken } = useAuth();
  const [state, setState] = useState<PartnerStatusState>({ kind: 'loading' });
  const runningRef = useRef(false);

  async function poll() {
    if (runningRef.current) {
      return;
    }
    runningRef.current = true;
    try {
      const token = await getToken();
      if (!token) {
        setState({ kind: 'error' });
        return;
      }
      const status = await getPartnerStatus(getApiBaseUrl(), token);
      setState({ kind: 'ready', status });
    } catch {
      setState((prev) => (prev.kind === 'ready' ? prev : { kind: 'error' }));
    } finally {
      runningRef.current = false;
    }
  }

  useEffect(() => {
    poll();
    const subscription = AppState.addEventListener('change', (appState) => {
      if (appState === 'active') {
        poll();
      }
    });
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      subscription.remove();
      clearInterval(interval);
    };
  }, [getToken]);

  return { state, refresh: poll };
}
