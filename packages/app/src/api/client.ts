import type {
  BleedingType,
  MucusColor,
  MucusSensation,
  MucusStretch,
  VariantMode,
} from '@creighton/rules-engine';

export interface OutboxPayloadEntry {
  id: string;
  cycle: {
    id: string;
    startDate: string;
    endDate: string | null;
    isActive: boolean;
    variantModeSnapshot: VariantMode;
  };
  date: string;
  bleedingType: BleedingType;
  mucusSensation: MucusSensation;
  mucusStretch: MucusStretch;
  mucusColor: MucusColor | null;
  shinyReflex: boolean | null;
  intercourse: boolean;
  enteredAt: string;
  entrySource: 'USER' | 'INSTRUCTOR_CORRECTION';
}

export interface EntryResult {
  id: string;
  status: 'created' | 'duplicate';
}

export async function postEntries(
  baseUrl: string,
  token: string,
  entries: OutboxPayloadEntry[],
): Promise<EntryResult[]> {
  const res = await fetch(`${baseUrl}/entries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ entries }),
  });
  if (!res.ok) {
    throw new Error(`POST /entries failed: ${res.status}`);
  }
  const body: { results: EntryResult[] } = await res.json();
  return body.results;
}

export interface SyncCycle {
  id: string;
  startDate: string;
  endDate: string | null;
  isActive: boolean;
  variantModeSnapshot: VariantMode;
  confirmedPeakDay: string | null;
  peakDayConfirmedAt: string | null;
}

export interface SyncFertilityState {
  entryId: string;
  cycleId: string;
  date: string;
  computedState: string;
  peakRelation: string;
  computedAt: string;
  ruleEngineVersion: string;
}

export interface SyncResponse {
  serverTime: string;
  cycles: SyncCycle[];
  fertilityStates: SyncFertilityState[];
}

export async function getSync(baseUrl: string, token: string, since: string): Promise<SyncResponse> {
  const res = await fetch(`${baseUrl}/sync?since=${encodeURIComponent(since)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`GET /sync failed: ${res.status}`);
  }
  return res.json();
}
