/**
 * Deterministic -3.00..3.00 degree rotation from a string seed (usually the
 * day's date), ported from design/design_files/StampBadge.dc.html so every
 * render of the same day's stamp tilts identically instead of jittering.
 */
export function hashRotationDegrees(seed: string): number {
  const s = String(seed ?? '0');
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  const positive = ((h % 601) + 601) % 601;
  return positive / 100 - 3;
}
