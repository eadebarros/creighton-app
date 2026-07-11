/**
 * Today's calendar date (device-local), as an ISO yyyy-mm-dd string. Device-clock
 * read — stays app-only; `daysBetween`/`addDays` live in `@creighton/rules-engine`
 * now, shared with the backend.
 */
export function today(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
