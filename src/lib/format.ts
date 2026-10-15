/** "€ 3,99". */
export const formatPrice = (n: number): string =>
  `€ ${n.toFixed(2).replace(".", ",")}`;

/** "21/10/2026"; an unreadable date is shown as it is. */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("it-IT", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
}
