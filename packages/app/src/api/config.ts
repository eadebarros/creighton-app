/**
 * Resolved lazily (not at module-load time) so importing api/client.ts or
 * sync/syncClient.ts in a test never requires this env var to be set —
 * only real call sites (useSyncLifecycle, IntercourseScreen) ever call this.
 */
export function getApiBaseUrl(): string {
  const url = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (!url) {
    throw new Error('Missing EXPO_PUBLIC_API_BASE_URL — copy packages/app/.env.example to .env and fill it in.');
  }
  return url;
}
