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
  partner: { email: string; linkedAt: string | null } | null;
  instructorCredentialAck: boolean;
  instructorCredentialAckAt: string | null;
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

export async function unlinkPartner(baseUrl: string, token: string): Promise<void> {
  const res = await fetch(`${baseUrl}/partner/unlink`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`POST /partner/unlink failed: ${res.status}`);
  }
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

/** Best-effort — the local void already happened; this just lets the server (and other devices) know. */
export async function voidObservationRemote(baseUrl: string, token: string, observationId: string): Promise<void> {
  const res = await fetch(`${baseUrl}/observations/${observationId}/void`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`POST /observations/${observationId}/void failed: ${res.status}`);
  }
}

/** Dev/testing affordance — wipes this account's clinical history server-side and resets onboarding. */
export async function resetTestData(baseUrl: string, token: string): Promise<void> {
  const res = await fetch(`${baseUrl}/me/reset-test-data`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`POST /me/reset-test-data failed: ${res.status}`);
  }
}

export class DataExportError extends Error {
  constructor(public readonly code: 'rate_limited' | 'unknown') {
    super(code);
  }
}

/** LGPD portabilidade (SPEC 03 §3.4) — returns the raw JSON text as-is, written straight to a file for sharing. */
export async function exportMyData(baseUrl: string, token: string): Promise<string> {
  const res = await fetch(`${baseUrl}/me/export-data`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    throw new DataExportError(res.status === 429 ? 'rate_limited' : 'unknown');
  }
  return res.text();
}

/** LGPD — direito de exclusão (SPEC 03 §3.7). Só deve ser chamado após a reautenticação de senha via Clerk, no app. */
export async function deleteMyAccount(baseUrl: string, token: string): Promise<void> {
  const res = await fetch(`${baseUrl}/me/delete-account`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`POST /me/delete-account failed: ${res.status}`);
  }
}

export type ExportPeriod = 'current' | 'last3' | 'custom';

export interface ExportPdfBody {
  period: ExportPeriod;
  customStart?: string;
  customEnd?: string;
}

export class ExportPdfError extends Error {
  constructor(public readonly code: 'insufficient_data' | 'rate_limited' | 'unknown') {
    super(code);
  }
}

/** SPEC 02 — the PDF itself is never persisted server-side; this just streams the binary once. */
export async function exportPdf(baseUrl: string, token: string, body: ExportPdfBody): Promise<ArrayBuffer> {
  const res = await fetch(`${baseUrl}/exports/pdf`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    if (res.status === 422) throw new ExportPdfError('insufficient_data');
    if (res.status === 429) throw new ExportPdfError('rate_limited');
    throw new ExportPdfError('unknown');
  }
  return res.arrayBuffer();
}
