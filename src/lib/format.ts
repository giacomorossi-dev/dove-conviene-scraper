/** "€ 3,99". */
export const formatPrice = (n: number): string =>
  `€ ${n.toFixed(2).replace(".", ",")}`;

/**
 * The calendar day of an ISO date or date-time as written ("2026-10-21",
 * "2026-10-21T23:59:59+02:00" → 21 October), at local midnight. Parsing a
 * bare date as UTC would show the day before anywhere west of Greenwich.
 * null when unreadable.
 */
export function parseDay(iso: string): Date | null {
  const ymd = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymd) return new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]));
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? null
    : new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** "21/10/2026"; an unreadable date is shown as it is. */
export function formatDate(iso: string): string {
  const day = parseDay(iso);
  return day
    ? day.toLocaleDateString("it-IT", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : iso;
}
