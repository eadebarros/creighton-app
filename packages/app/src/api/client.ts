import type {
  BleedingType,
  FertilityColorToken,
  MucusColor,
  MucusSensation,
  MucusStretch,
  PeakRelation,
  VariantMode,
} from '@creighton/rules-engine';

export interface OutboxPayloadEntry {
  id: string;
  /** Stable id of the derived "peak of the day" row this observation consolidates into (Adendo 01). */
  dailyEntryId: string;
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

export interface MeResponse {
  role: 'PRIMARY_OBSERVER' | 'COOP_PARTNER';
  partner: { email: string } | null;
  instructorCredentialAck: boolean;
  currentVariantMode: VariantMode;
}

export async function getMe(baseUrl: string, token: string): Promise<MeResponse> {
  const res = await fetch(`${baseUrl}/me`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    throw new Error(`GET /me failed: ${res.status}`);
  }
  return res.json();
}

export interface PatchMeBody {
  instructorCredentialAck?: boolean;
  currentVariantMode?: VariantMode;
}

export async function patchMe(baseUrl: string, token: string, body: PatchMeBody): Promise<MeResponse> {
  const res = await fetch(`${baseUrl}/me`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`PATCH /me failed: ${res.status}`);
  }
  return res.json();
}

export interface PartnerInvite {
  code: string;
  expiresAt: string;
}

export async function createPartnerInvite(baseUrl: string, token: string): Promise<PartnerInvite> {
  const res = await fetch(`${baseUrl}/partner-invites`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`POST /partner-invites failed: ${res.status}`);
  }
  return res.json();
}

export interface RedeemInviteResult {
  partnerEmail: string;
}

export async function redeemPartnerInvite(baseUrl: string, token: string, code: string): Promise<RedeemInviteResult> {
  const res = await fetch(`${baseUrl}/partner-invites/redeem`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ code }),
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(body?.error ?? `POST /partner-invites/redeem failed: ${res.status}`);
  }
  return body;
}

export interface PartnerStatus {
  hasActiveCycle: boolean;
  today: string;
  asOfDate: string | null;
  cycleDay: number | null;
  colorToken: FertilityColorToken | null;
  peakRelation: PeakRelation | null;
  acknowledgedToday: boolean;
}

export async function getPartnerStatus(baseUrl: string, token: string): Promise<PartnerStatus> {
  const res = await fetch(`${baseUrl}/partner/status`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    throw new Error(`GET /partner/status failed: ${res.status}`);
  }
  return res.json();
}

export async function postPartnerAcknowledge(baseUrl: string, token: string): Promise<void> {
  const res = await fetch(`${baseUrl}/partner/acknowledge`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`POST /partner/acknowledge failed: ${res.status}`);
  }
}

export interface AcknowledgmentSummary {
  date: string;
  acknowledgedAt: string;
}

export async function getPartnerAcknowledgments(baseUrl: string, token: string): Promise<AcknowledgmentSummary[]> {
  const res = await fetch(`${baseUrl}/partner/acknowledgments`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    throw new Error(`GET /partner/acknowledgments failed: ${res.status}`);
  }
  const body: { acknowledgments: AcknowledgmentSummary[] } = await res.json();
  return body.acknowledgments;
}
